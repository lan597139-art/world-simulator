"""跨路由共用的校验、历史、时间与树工具。"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import models

# ---------------------------------------------------------------------
# 基础
# ---------------------------------------------------------------------


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def world_now(db: Session, world_id: str) -> datetime:
    """取世界当前时间；没有时间配置时退回系统时间。

    历史记录的 occurred_at 应落在世界时间轴上，不能用录入时的系统时间。
    """
    ts = (
        db.query(models.TimeSettings)
        .filter(models.TimeSettings.world_id == world_id)
        .first()
    )
    if ts and ts.current_time:
        return ts.current_time
    return utcnow()


def parse_datetime(value):
    """把前端传入的 ISO 时间字符串转成 naive datetime。

    SQLite 的 DateTime 列只接受 datetime 对象，直接写入字符串会在提交时抛错。
    空值返回 None；无法解析的字符串也返回 None，由调用方回退默认时间。
    """
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def fail(status_code: int, code: str, message: str):
    raise HTTPException(status_code=status_code, detail=f"{code}: {message}")


def get_world(db: Session, world_id: str) -> models.World:
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        fail(404, "NOT_FOUND", "世界不存在")
    return world


def get_or_404(db: Session, model, obj_id: str, label: str):
    obj = db.query(model).filter(model.id == obj_id).first()
    if not obj:
        fail(404, "NOT_FOUND", f"{label}不存在")
    return obj


def assert_same_world(obj, world_id: str, label: str):
    """跨世界引用一律拒绝。"""
    if getattr(obj, "world_id", None) != world_id:
        fail(409, "WORLD_MISMATCH", f"{label}不属于当前世界")
    return obj


# ---------------------------------------------------------------------
# 实体引用（多态）
# ---------------------------------------------------------------------

ENTITY_MODELS = {
    "character": models.Character,
    "organization": models.Organization,
    "location": models.Location,
    "social_group": models.SocialGroup,
    "resource": models.Resource,
    "event": models.Event,
    "rule": models.WorldRule,
    "society": models.Society,
    "era": models.Era,
}

ENTITY_LABELS = {
    "character": "人物",
    "organization": "组织",
    "location": "地点",
    "social_group": "群体",
    "resource": "资源",
    "event": "事件",
    "rule": "规则",
    "society": "社会实体",
    "era": "时代",
}


def resolve_entity(db: Session, world_id: str, entity_type: str, entity_id: str):
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        fail(422, "VALIDATION_ERROR", f"不支持的实体类型：{entity_type}")
    obj = db.query(model).filter(model.id == entity_id).first()
    if not obj:
        fail(404, "NOT_FOUND", f"{ENTITY_LABELS.get(entity_type, entity_type)}不存在")
    return assert_same_world(obj, world_id, ENTITY_LABELS.get(entity_type, entity_type))


def entity_name(db: Session, entity_type: str, entity_id: str) -> Optional[str]:
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        return None
    obj = db.query(model).filter(model.id == entity_id).first()
    return getattr(obj, "name", None) if obj else None


# ---------------------------------------------------------------------
# 历史
# ---------------------------------------------------------------------


def record_history(
    db: Session,
    world_id: str,
    entity_type: str,
    entity_id: str,
    field: str,
    old_value=None,
    new_value=None,
    event_id: Optional[str] = None,
    reason: str = "",
    source: str = "user",
    actor_id: Optional[str] = None,
    occurred_at: Optional[datetime] = None,
):
    if old_value == new_value:
        return None
    row = models.StateHistory(
        world_id=world_id,
        entity_type=entity_type,
        entity_id=entity_id,
        field=field,
        old_value=old_value,
        new_value=new_value,
        event_id=event_id,
        reason=reason,
        source=source,
        actor_id=actor_id,
        occurred_at=occurred_at or utcnow(),
    )
    db.add(row)
    return row


def relationship_history(db: Session, relationship_ids):
    """批量取关系历史，避免 N+1。"""
    if not relationship_ids:
        return {}
    rows = (
        db.query(models.StateHistory)
        .filter(
            models.StateHistory.entity_type == "relationship",
            models.StateHistory.entity_id.in_(relationship_ids),
        )
        .order_by(models.StateHistory.occurred_at.asc())
        .all()
    )
    result = {}
    for row in rows:
        result.setdefault(row.entity_id, []).append(
            {
                "id": row.id,
                "old_status": row.old_value,
                "new_status": row.new_value,
                "reason": row.reason,
                "time": row.occurred_at.strftime("%Y-%m-%d %H:%M") if row.occurred_at else "",
                "event_id": row.event_id,
            }
        )
    return result


# ---------------------------------------------------------------------
# 时间
# ---------------------------------------------------------------------


def get_time_settings(db: Session, world_id: str) -> models.TimeSettings:
    ts = db.query(models.TimeSettings).filter(models.TimeSettings.world_id == world_id).first()
    if ts:
        return ts
    world = get_world(db, world_id)
    start = utcnow()
    if world.createdAt:
        try:
            start = datetime.fromisoformat(str(world.createdAt)[:26])
        except ValueError:
            pass
    ts = models.TimeSettings(
        world_id=world_id,
        current_time=start,
        last_sync_at=utcnow(),
        time_mode="manual",
    )
    db.add(ts)
    db.flush()
    return ts


def sync_world_time(db: Session, world_id: str) -> models.TimeSettings:
    """realtime 模式下按真实流逝时间推进世界时间（惰性推进，无需后台任务）。"""
    ts = get_time_settings(db, world_id)
    if ts.time_mode != "realtime":
        ts.last_sync_at = utcnow()
        return ts
    now = utcnow()
    last = ts.last_sync_at or now
    elapsed = (now - last).total_seconds()
    if elapsed <= 0:
        return ts
    per_day = ts.real_seconds_per_world_day or 86400.0
    world_seconds = elapsed * 86400.0 / per_day
    ts.current_time = (ts.current_time or now) + timedelta(seconds=world_seconds)
    ts.last_sync_at = now
    db.flush()
    return ts


# ---------------------------------------------------------------------
# 树
# ---------------------------------------------------------------------


def next_sort_order(db: Session, model, **filters) -> int:
    query = db.query(func.max(model.sort_order))
    for key, value in filters.items():
        column = getattr(model, key)
        query = query.filter(column.is_(None) if value is None else column == value)
    current = query.scalar()
    return int(current or 0) + 10


def build_tree(rows, id_key="id", parent_key="parent_id"):
    """把扁平列表组装成嵌套树；保持传入顺序。"""
    nodes = {}
    roots = []
    for row in rows:
        item = dict(row)
        item["children"] = []
        nodes[item[id_key]] = item
    for item in nodes.values():
        parent_id = item.get(parent_key)
        if parent_id and parent_id in nodes:
            nodes[parent_id]["children"].append(item)
        else:
            roots.append(item)
    return roots
