"""多路径推演：发展方向 / 分支沙盒 / 节点回溯 / 结局 / 对比。

设计要点（docs/PHASE2-C-多路径推演架构设计.md）：
- 分支 = 沙盒：推演结果只写入分支快照，绝不污染主时间线。
- 快照 = 复用 world_lifecycle.dump_world（按 branch_id 作用域）。
- 节点回溯 = 取节点全量快照恢复为分支当前状态。
- 应用分支 = 显式覆盖主时间线实体表，保留分支表，并先写一份主时间线快照兜底。
"""

from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import world_lifecycle as lifecycle
from ai_engine import run_branch_simulation, run_direction_suggestions
from common import fail, get_or_404, parse_datetime, utcnow
from database import get_db

router = APIRouter()

QUADRANTS = {"亲密", "认同", "敌对", "漠视"}
STATE_HINTS = {"S0", "S1", "S2", "D0", "D1", "D2", "Dec0", "Dec1", "Dec2"}
DIRECTION_SOURCES = {"user", "ai", "ai_confirmed"}


# ---------------------------------------------------------------------
# 快照工具
# ---------------------------------------------------------------------


def _marker() -> dict:
    return {"__datetime__": utcnow().isoformat()}


def _snapshot_rows(snapshot: dict, table: str) -> list:
    return (snapshot.get("tables") or {}).get(table) or []


def _add_row(snapshot: dict, table: str, row: dict) -> None:
    snapshot.setdefault("tables", {}).setdefault(table, []).append(row)


def _world_row(snapshot: dict) -> dict:
    return snapshot.get("world") or {}


def _world_settings(snapshot: dict) -> dict:
    settings = _world_row(snapshot).get("settings")
    return settings if isinstance(settings, dict) else {}


def _six_axis(snapshot: dict) -> dict:
    axis = _world_settings(snapshot).get("six_axis")
    return axis if isinstance(axis, dict) else {}


def _char_by_name(snapshot: dict) -> dict:
    return {row.get("name"): row for row in _snapshot_rows(snapshot, "characters") if row.get("name")}


def _life_events(char_row: dict) -> list:
    history = char_row.get("life_history")
    if isinstance(history, list):
        return history
    if isinstance(history, dict):
        events = history.get("events")
        return events if isinstance(events, list) else []
    return []


def _c_profile_summary(char_row: dict) -> dict:
    basic = char_row.get("basic_profile")
    if not isinstance(basic, dict):
        return {}
    profile = basic.get("c_profile")
    if not isinstance(profile, dict):
        return {}
    out: dict = {}
    for group, values in profile.items():
        if isinstance(values, dict):
            numeric = {k: v for k, v in values.items() if isinstance(v, (int, float))}
            if numeric:
                out[group] = numeric
    return out


def _dump(db: Session, world_id: str, branch_id: Optional[str] = None) -> dict:
    return lifecycle.dump_world(db, world_id, branch_id=branch_id)


# ---------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------


def _direction_row(row: models.SimulationDirection) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "event_id": row.event_id,
        "name": row.name,
        "description": row.description or "",
        "trigger_conditions": row.trigger_conditions or [],
        "related_character_ids": row.related_character_ids or [],
        "cognition": row.cognition or {},
        "engine_activation": row.engine_activation or {},
        "behavior_output": row.behavior_output or "",
        "reality_resistance": row.reality_resistance or "",
        "direct_result": row.direct_result or "",
        "future_impacts": row.future_impacts or [],
        "sort_order": row.sort_order or 0,
        "enabled": bool(row.enabled),
        "source": row.source or "user",
        "confirmed": bool(row.confirmed),
        "note": row.note or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _node_row(row: models.SimulationBranchNode, with_snapshot: bool = False) -> dict:
    data = {
        "id": row.id,
        "branch_id": row.branch_id,
        "seq": row.seq or 0,
        "kind": row.kind or "simulation",
        "event_id": row.event_id,
        "run_id": row.run_id,
        "summary": row.summary or "",
        "source": row.source or "simulation",
        "rollback_reason": row.rollback_reason or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    if with_snapshot:
        data["snapshot"] = row.snapshot or {}
    return data


def _branch_row(row: models.SimulationBranch, node_count: int = 0, ending_count: int = 0) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "root_event_id": row.root_event_id,
        "source_direction_id": row.source_direction_id,
        "parent_branch_id": row.parent_branch_id,
        "parent_node_id": row.parent_node_id,
        "name": row.name,
        "note": row.note or "",
        "status": row.status or "active",
        "node_count": node_count,
        "ending_count": ending_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _ending_row(row: models.SimulationEnding, with_detail: bool = True) -> dict:
    data = {
        "id": row.id,
        "world_id": row.world_id,
        "branch_id": row.branch_id,
        "node_id": row.node_id,
        "name": row.name,
        "description": row.description or "",
        "key_reasons": row.key_reasons or "",
        "allow_continue": bool(row.allow_continue),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    if with_detail:
        data.update(
            {
                "path_node_ids": row.path_node_ids or [],
                "character_final_states": row.character_final_states or [],
                "relationship_changes": row.relationship_changes or [],
                "resource_changes": row.resource_changes or [],
                "world_changes": row.world_changes or [],
            }
        )
    return data


# ---------------------------------------------------------------------
# 通用校验
# ---------------------------------------------------------------------


def _world(db: Session, world_id: str):
    world = get_or_404(db, models.World, world_id, "世界")
    if world.deleted_at is not None:
        fail(404, "NOT_FOUND", "世界已删除")
    return world


def _active_world(db: Session, world_id: str):
    world = _world(db, world_id)
    if world.archived_at is not None:
        fail(409, "WORLD_ARCHIVED", "该世界已归档，恢复后才能继续推演")
    return world


def _branch(db: Session, branch_id: str) -> models.SimulationBranch:
    branch = get_or_404(db, models.SimulationBranch, branch_id, "推演分支")
    _world(db, branch.world_id)
    return branch


def _event(db: Session, event_id: str) -> models.Event:
    return get_or_404(db, models.Event, event_id, "事件")


def _event_ai_payload(db: Session, event: models.Event) -> dict:
    loc_name = ""
    org_name = ""
    if event.location_id:
        loc = db.query(models.Location).filter(models.Location.id == event.location_id).first()
        if loc:
            loc_name = loc.name
    if event.organization_id:
        org = db.query(models.Organization).filter(models.Organization.id == event.organization_id).first()
        if org:
            org_name = org.name
    return {
        "name": event.name,
        "description": event.description,
        "polarity": event.polarity,
        "intensity": event.intensity,
        "story_time": event.story_time or "未指定时间",
        "location": loc_name or "未指定地点",
        "organization": org_name or "未指定组织",
        "participants": event.participants or [],
    }


def _perceptions(db: Session, event_id: str, character_id: str) -> dict:
    row = (
        db.query(models.CharacterEventPerception)
        .filter(
            models.CharacterEventPerception.event_id == event_id,
            models.CharacterEventPerception.character_id == character_id,
        )
        .first()
    )
    if not row:
        return {}
    return {
        "perceived_content": row.perceived_content or "",
        "perceived_polarity": row.perceived_polarity,
        "perceived_intensity": row.perceived_intensity,
        "attribution_target": row.attribution_target,
        "certainty": row.certainty,
        "information_source": row.information_source or "",
    }


def _db_characters(db: Session, event: models.Event) -> list:
    ids = event.participants or []
    if not ids:
        return []
    return (
        db.query(models.Character)
        .filter(models.Character.id.in_(ids), models.Character.archived_at.is_(None))
        .all()
    )


def _char_ai_payload(char: models.Character, perception: dict) -> dict:
    runtime = char.runtime_state or {}
    engines = runtime.get("engines") or char.engines or {}
    return {
        "name": char.name,
        "engines": engines,
        "dominance": (engines or {}).get("dominance") if isinstance(engines, dict) else None,
        "main_color": runtime.get("main_color"),
        "growth_version": runtime.get("version"),
        "reality_conditions": char.reality_conditions or {},
        "thought_imprints": char.thought_imprints or [],
        "perception": perception or None,
        "c_profile": _c_profile_summary({"basic_profile": char.basic_profile or {}}),
    }


# ---------------------------------------------------------------------
# 发展方向
# ---------------------------------------------------------------------


def _next_direction_order(db: Session, event_id: str) -> int:
    values = [
        row[0]
        for row in db.query(models.SimulationDirection.sort_order)
        .filter(models.SimulationDirection.event_id == event_id)
        .all()
    ]
    return (max(values) + 1) if values else 0


@router.get("/api/events/{event_id}/directions")
def list_directions(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = (
        db.query(models.SimulationDirection)
        .filter(models.SimulationDirection.event_id == event_id)
        .order_by(models.SimulationDirection.sort_order.asc(), models.SimulationDirection.created_at.asc())
        .all()
    )
    return [_direction_row(row) for row in rows]


@router.post("/api/events/{event_id}/directions")
def create_direction(event_id: str, payload: dict, db: Session = Depends(get_db)):
    event = _event(db, event_id)
    _active_world(db, event.world_id) if event.world_id else None
    name = (payload.get("name") or "").strip()[:120]
    if not name:
        fail(422, "VALIDATION_ERROR", "方向名称不能为空")
    source = payload.get("source") or "user"
    if source not in DIRECTION_SOURCES:
        fail(422, "VALIDATION_ERROR", "source 只能是 user/ai/ai_confirmed")
    confirmed = bool(payload.get("confirmed", source != "ai"))
    if source == "ai" and confirmed:
        source = "ai_confirmed"
    row = models.SimulationDirection(
        world_id=event.world_id,
        event_id=event.id,
        name=name,
        description=(payload.get("description") or "")[:4000],
        trigger_conditions=payload.get("trigger_conditions") or [],
        related_character_ids=payload.get("related_character_ids") or [],
        cognition=payload.get("cognition") or {},
        engine_activation=payload.get("engine_activation") or {},
        behavior_output=(payload.get("behavior_output") or "")[:4000],
        reality_resistance=(payload.get("reality_resistance") or "")[:4000],
        direct_result=(payload.get("direct_result") or "")[:4000],
        future_impacts=payload.get("future_impacts") or [],
        sort_order=_next_direction_order(db, event.id),
        enabled=bool(payload.get("enabled", True)),
        source=source,
        confirmed=confirmed,
        note=(payload.get("note") or "")[:500],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _direction_row(row)


@router.post("/api/events/{event_id}/directions/suggest")
def suggest_directions(event_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    """AI 生成方向建议：只返回，不落库；用户确认后调用创建接口。"""
    event = _event(db, event_id)
    if not event.world_id:
        fail(409, "WORLD_MISSING", "事件未归属任何世界")
    _active_world(db, event.world_id)
    chars = _db_characters(db, event)
    chars_payload = [
        {
            "name": char.name,
            "engines": ((char.runtime_state or {}).get("engines") or char.engines or {}),
            "reality_conditions": char.reality_conditions or {},
            "c_profile": _c_profile_summary({"basic_profile": char.basic_profile or {}}),
        }
        for char in chars
    ]
    world = _world(db, event.world_id)
    axis = (world.settings or {}).get("six_axis") if isinstance(world.settings, dict) else {}
    result = run_direction_suggestions(
        {
            "event": _event_ai_payload(db, event),
            "characters": chars_payload,
            "world": {"six_axis": axis or {}, "name": world.name, "background": (world.background or "")[:800]},
            "count": (payload or {}).get("count") or 4,
        }
    )
    if "error" in result:
        fail(502, "AI_ERROR", str(result["error"]))
    suggestions = []
    for item in result.get("directions") or []:
        if not isinstance(item, dict):
            continue
        if not (item.get("name") or "").strip():
            continue
        suggestions.append(
            {
                "name": str(item.get("name") or "")[:120],
                "description": str(item.get("description") or "")[:4000],
                "trigger_conditions": item.get("trigger_conditions") if isinstance(item.get("trigger_conditions"), list) else [],
                "cognition": item.get("cognition") if isinstance(item.get("cognition"), dict) else {},
                "behavior_output": str(item.get("behavior_output") or "")[:4000],
                "reality_resistance": str(item.get("reality_resistance") or "")[:4000],
                "direct_result": str(item.get("direct_result") or "")[:4000],
                "future_impacts": item.get("future_impacts") if isinstance(item.get("future_impacts"), list) else [],
            }
        )
    return {"directions": suggestions}


@router.patch("/api/directions/{direction_id}")
def update_direction(direction_id: str, payload: dict, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationDirection, direction_id, "发展方向")
    if "name" in payload:
        name = (payload.get("name") or "").strip()[:120]
        if not name:
            fail(422, "VALIDATION_ERROR", "方向名称不能为空")
        row.name = name
    for key, limit in (
        ("description", 4000),
        ("behavior_output", 4000),
        ("reality_resistance", 4000),
        ("direct_result", 4000),
        ("note", 500),
    ):
        if key in payload:
            setattr(row, key, (payload.get(key) or "")[:limit])
    for key in ("trigger_conditions", "related_character_ids", "future_impacts"):
        if key in payload:
            setattr(row, key, payload.get(key) or [])
    for key in ("cognition", "engine_activation"):
        if key in payload:
            setattr(row, key, payload.get(key) or {})
    if "enabled" in payload:
        row.enabled = bool(payload.get("enabled"))
    if "confirmed" in payload:
        row.confirmed = bool(payload.get("confirmed"))
        if row.confirmed and row.source == "ai":
            row.source = "ai_confirmed"
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or 0)
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    return _direction_row(row)


@router.post("/api/directions/{direction_id}/duplicate")
def duplicate_direction(direction_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationDirection, direction_id, "发展方向")
    clone = models.SimulationDirection(
        world_id=row.world_id,
        event_id=row.event_id,
        name=f"{row.name}（副本）"[:120],
        description=row.description or "",
        trigger_conditions=copy.deepcopy(row.trigger_conditions or []),
        related_character_ids=copy.deepcopy(row.related_character_ids or []),
        cognition=copy.deepcopy(row.cognition or {}),
        engine_activation=copy.deepcopy(row.engine_activation or {}),
        behavior_output=row.behavior_output or "",
        reality_resistance=row.reality_resistance or "",
        direct_result=row.direct_result or "",
        future_impacts=copy.deepcopy(row.future_impacts or []),
        sort_order=_next_direction_order(db, row.event_id),
        enabled=row.enabled,
        source="user",
        confirmed=True,
        note=row.note or "",
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return _direction_row(clone)


@router.post("/api/directions/{direction_id}/toggle")
def toggle_direction(direction_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationDirection, direction_id, "发展方向")
    row.enabled = not bool(row.enabled)
    row.updated_at = utcnow()
    db.commit()
    db.refresh(row)
    return _direction_row(row)


@router.delete("/api/directions/{direction_id}")
def delete_direction(direction_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationDirection, direction_id, "发展方向")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.patch("/api/events/{event_id}/directions/reorder")
def reorder_directions(event_id: str, payload: dict, db: Session = Depends(get_db)):
    _event(db, event_id)
    ids = payload.get("ids")
    if not isinstance(ids, list):
        fail(422, "VALIDATION_ERROR", "ids 必须是数组")
    rows = {
        row.id: row
        for row in db.query(models.SimulationDirection)
        .filter(models.SimulationDirection.event_id == event_id)
        .all()
    }
    for index, direction_id in enumerate(ids):
        row = rows.get(str(direction_id))
        if row:
            row.sort_order = index
            row.updated_at = utcnow()
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# 分支
# ---------------------------------------------------------------------


def _node_count(db: Session, branch_id: str) -> int:
    return db.query(models.SimulationBranchNode).filter(models.SimulationBranchNode.branch_id == branch_id).count()


def _ending_count(db: Session, branch_id: str) -> int:
    return db.query(models.SimulationEnding).filter(models.SimulationEnding.branch_id == branch_id).count()


def _next_seq(db: Session, branch_id: str) -> int:
    value = (
        db.query(models.SimulationBranchNode.seq)
        .filter(models.SimulationBranchNode.branch_id == branch_id)
        .order_by(models.SimulationBranchNode.seq.desc())
        .first()
    )
    return (value[0] + 1) if value and value[0] is not None else 0


def _add_node(
    db: Session,
    branch: models.SimulationBranch,
    *,
    kind: str,
    summary: str,
    snapshot: dict,
    event_id: Optional[str] = None,
    run_id: Optional[str] = None,
    source: str = "simulation",
    rollback_reason: str = "",
) -> models.SimulationBranchNode:
    node = models.SimulationBranchNode(
        branch_id=branch.id,
        world_id=branch.world_id,
        seq=_next_seq(db, branch.id),
        kind=kind,
        event_id=event_id,
        run_id=run_id,
        summary=summary[:2000],
        source=source,
        snapshot=snapshot,
        rollback_reason=rollback_reason[:500],
    )
    db.add(node)
    return node


@router.post("/api/branches")
def create_branch(payload: dict, db: Session = Depends(get_db)):
    root_event_id = payload.get("root_event_id")
    if not root_event_id:
        fail(422, "VALIDATION_ERROR", "缺少 root_event_id")
    event = _event(db, str(root_event_id))
    if not event.world_id:
        fail(409, "WORLD_MISSING", "事件未归属任何世界")
    _active_world(db, event.world_id)

    direction_id = payload.get("source_direction_id")
    direction = None
    if direction_id:
        direction = get_or_404(db, models.SimulationDirection, str(direction_id), "发展方向")
        if direction.event_id != event.id:
            fail(409, "MISMATCH", "方向不属于该事件")

    parent_branch_id = payload.get("parent_branch_id")
    parent_node_id = payload.get("parent_node_id")
    if parent_node_id:
        node = get_or_404(db, models.SimulationBranchNode, str(parent_node_id), "分支节点")
        parent = _branch(db, node.branch_id)
        if parent.world_id != event.world_id:
            fail(409, "WORLD_MISMATCH", "节点不在该世界")
        base = node.snapshot or parent.current_snapshot or {}
        parent_branch_id = parent.id
    elif parent_branch_id:
        parent = _branch(db, str(parent_branch_id))
        if parent.world_id != event.world_id:
            fail(409, "WORLD_MISMATCH", "父分支不在该世界")
        base = parent.current_snapshot or {}
    else:
        base = _dump(db, event.world_id)

    if not base or not base.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "世界尚无可用数据，无法建立分支")

    name = (payload.get("name") or "").strip()[:120]
    if not name:
        if direction:
            name = f"{event.name} · {direction.name}"
        else:
            name = f"{event.name} · 新分支"
    branch = models.SimulationBranch(
        world_id=event.world_id,
        root_event_id=event.id,
        source_direction_id=direction.id if direction else None,
        parent_branch_id=parent_branch_id,
        parent_node_id=parent_node_id,
        name=name,
        note=(payload.get("note") or "")[:1000],
        status="active",
        base_snapshot=copy.deepcopy(base),
        current_snapshot=copy.deepcopy(base),
    )
    db.add(branch)
    db.flush()
    summary = f"分支起点：{event.name}"
    if direction:
        summary += f" · {direction.name}"
    _add_node(db, branch, kind="fork", summary=summary, snapshot=copy.deepcopy(base), source="user")
    db.commit()
    db.refresh(branch)
    return _branch_row(branch, node_count=1, ending_count=0)


@router.get("/api/worlds/{world_id}/branches")
def list_branches(world_id: str, db: Session = Depends(get_db)):
    _world(db, world_id)
    rows = (
        db.query(models.SimulationBranch)
        .filter(models.SimulationBranch.world_id == world_id)
        .order_by(models.SimulationBranch.created_at.asc())
        .all()
    )
    return [
        _branch_row(row, node_count=_node_count(db, row.id), ending_count=_ending_count(db, row.id))
        for row in rows
    ]


@router.get("/api/branches/{branch_id}")
def get_branch(branch_id: str, db: Session = Depends(get_db)):
    branch = _branch(db, branch_id)
    nodes = (
        db.query(models.SimulationBranchNode)
        .filter(models.SimulationBranchNode.branch_id == branch.id)
        .order_by(models.SimulationBranchNode.seq.asc())
        .all()
    )
    endings = (
        db.query(models.SimulationEnding)
        .filter(models.SimulationEnding.branch_id == branch.id)
        .order_by(models.SimulationEnding.created_at.asc())
        .all()
    )
    data = _branch_row(branch, node_count=len(nodes), ending_count=len(endings))
    data["nodes"] = [_node_row(node) for node in nodes]
    data["endings"] = [_ending_row(ending, with_detail=False) for ending in endings]
    return data


@router.patch("/api/branches/{branch_id}")
def update_branch(branch_id: str, payload: dict, db: Session = Depends(get_db)):
    branch = _branch(db, branch_id)
    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if name:
            branch.name = name[:120]
    if "note" in payload:
        branch.note = (payload.get("note") or "")[:1000]
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in {"active", "paused", "archived"}:
            fail(422, "VALIDATION_ERROR", "status 只能是 active/paused/archived")
        branch.status = status
    branch.updated_at = utcnow()
    db.commit()
    db.refresh(branch)
    return _branch_row(branch, node_count=_node_count(db, branch.id), ending_count=_ending_count(db, branch.id))


@router.post("/api/branches/{branch_id}/pause")
def pause_branch(branch_id: str, db: Session = Depends(get_db)):
    return update_branch(branch_id, {"status": "paused"}, db)


@router.post("/api/branches/{branch_id}/resume")
def resume_branch(branch_id: str, db: Session = Depends(get_db)):
    return update_branch(branch_id, {"status": "active"}, db)


@router.post("/api/branches/{branch_id}/duplicate")
def duplicate_branch(branch_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    source = _branch(db, branch_id)
    base = source.current_snapshot or {}
    if not base.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "分支快照为空")
    clone = models.SimulationBranch(
        world_id=source.world_id,
        root_event_id=source.root_event_id,
        source_direction_id=source.source_direction_id,
        parent_branch_id=source.id,
        parent_node_id=None,
        name=((payload or {}).get("name") or f"{source.name}（副本）")[:120],
        note=source.note or "",
        status="active",
        base_snapshot=copy.deepcopy(base),
        current_snapshot=copy.deepcopy(base),
    )
    db.add(clone)
    db.flush()
    _add_node(db, clone, kind="fork", summary=f"从分支复制：{source.name}", snapshot=copy.deepcopy(base), source="user")
    db.commit()
    db.refresh(clone)
    return _branch_row(clone, node_count=1, ending_count=0)


@router.delete("/api/branches/{branch_id}")
def archive_branch(branch_id: str, db: Session = Depends(get_db)):
    """删除分支 = 归档（数据保留，可恢复），避免误删路径。"""
    branch = _branch(db, branch_id)
    branch.status = "archived"
    branch.updated_at = utcnow()
    db.commit()
    return {"status": "ok", "archived": True}


@router.get("/api/branches/{branch_id}/nodes")
def list_branch_nodes(branch_id: str, db: Session = Depends(get_db)):
    _branch(db, branch_id)
    rows = (
        db.query(models.SimulationBranchNode)
        .filter(models.SimulationBranchNode.branch_id == branch_id)
        .order_by(models.SimulationBranchNode.seq.asc())
        .all()
    )
    return [_node_row(row) for row in rows]


@router.get("/api/branches/{branch_id}/nodes/{node_id}")
def get_branch_node(branch_id: str, node_id: str, db: Session = Depends(get_db)):
    _branch(db, branch_id)
    node = get_or_404(db, models.SimulationBranchNode, node_id, "分支节点")
    if node.branch_id != branch_id:
        fail(409, "MISMATCH", "节点不属于该分支")
    return _node_row(node, with_snapshot=True)


# ---------------------------------------------------------------------
# 分支内推演
# ---------------------------------------------------------------------


def _apply_relationship_changes(snapshot: dict, changes: list) -> int:
    """把 AI 关系变化写入分支快照（只动快照）。"""
    chars = _char_by_name(snapshot)
    rows = _snapshot_rows(snapshot, "relationships")
    applied = 0
    for change in changes:
        if not isinstance(change, dict):
            continue
        source = chars.get((change.get("source_name") or "").strip())
        target = chars.get((change.get("target_name") or "").strip())
        if not source or not target or source.get("id") == target.get("id"):
            continue
        quadrant = change.get("new_quadrant")
        if quadrant not in QUADRANTS:
            continue
        reason = (change.get("reason") or "")[:300]
        existing = next(
            (
                row
                for row in rows
                if (row.get("source_id") == source["id"] and row.get("target_id") == target["id"])
                or (row.get("source_id") == target["id"] and row.get("target_id") == source["id"])
            ),
            None,
        )
        if existing:
            existing["source_quadrant"] = quadrant
            if existing.get("is_bidirectional"):
                existing["target_quadrant"] = quadrant
            description = (existing.get("description") or "").strip()
            if reason:
                description = (description + ("；" if description else "") + reason)[:900]
            existing["description"] = description
            existing["updated_at"] = _marker()
        else:
            rows.append(
                {
                    "id": str(uuid.uuid4()),
                    "world_id": snapshot.get("world", {}).get("id"),
                    "source_id": source["id"],
                    "target_id": target["id"],
                    "source_type": "character",
                    "target_type": "character",
                    "relation_type": "未分类",
                    "description": reason,
                    "is_bidirectional": False,
                    "source_quadrant": quadrant,
                    "source_strength": "中",
                    "source_power": "对等",
                    "source_value": "利己",
                    "target_quadrant": "漠视",
                    "target_strength": "中",
                    "target_power": "对等",
                    "target_value": "利己",
                    "status": "active",
                    "strength_level": "中",
                    "history": [],
                    "created_at": _marker(),
                    "updated_at": _marker(),
                }
            )
        applied += 1
    return applied


def _append_actions(snapshot: dict, actions: list, event: models.Event, deposits: list) -> int:
    """把行动与记忆写入分支快照中的人物履历。"""
    chars = _char_by_name(snapshot)
    applied = 0
    for action in actions:
        if not isinstance(action, dict):
            continue
        name = (action.get("name") or "").strip()
        char = chars.get(name)
        if not char:
            continue
        history = char.get("life_history")
        if isinstance(history, list):
            history = {"events": history, "deposits": {}}
        if not isinstance(history, dict):
            history = {"events": [], "deposits": {}}
        events_list = history.get("events")
        if not isinstance(events_list, list):
            events_list = []
        events_list.append(
            {
                "id": str(uuid.uuid4()),
                "name": f"分支推演：{event.name}",
                "startTime": event.story_time or "未知时间",
                "facts": f"当时我采取了行动：{action.get('action') or ''}",
                "cognition": action.get("cognition_reason") or "由分支推演生成。",
                "lifeImpact": f"事件结果：{action.get('status') or '无具体结果'}",
                "domain": event.domain or [],
                "polarity": event.polarity,
                "intensity": event.intensity,
                "engine": action.get("engine"),
                "engine_label": action.get("engine_label"),
                "source": "branch_simulation",
                "distortion_meta": {"source": "branch_simulation", "branch_only": True},
            }
        )
        history["events"] = events_list
        char["life_history"] = history
        applied += 1

    for deposit in deposits:
        if not isinstance(deposit, dict):
            continue
        char = chars.get((deposit.get("name") or "").strip())
        if not char or not (deposit.get("content") or "").strip():
            continue
        history = char.get("life_history")
        if not isinstance(history, dict):
            history = {"events": [], "deposits": {}}
        dep = history.get("deposits")
        if not isinstance(dep, dict):
            dep = {}
        dep[str(uuid.uuid4())] = str(deposit.get("content"))[:500]
        history["deposits"] = dep
        char["life_history"] = history
    return applied


def _append_world_changes(snapshot: dict, text: str, event_name: str) -> None:
    if not (text or "").strip():
        return
    world = snapshot.setdefault("world", {})
    settings = world.get("settings")
    if not isinstance(settings, dict):
        settings = {}
        world["settings"] = settings
    log = settings.get("branch_changes")
    if not isinstance(log, list):
        log = []
    log.append(
        {
            "event": event_name,
            "text": str(text)[:2000],
            "at": utcnow().isoformat(),
        }
    )
    settings["branch_changes"] = log[-40:]


@router.post("/api/branches/{branch_id}/simulate")
def simulate_branch(branch_id: str, payload: dict, db: Session = Depends(get_db)):
    branch = _branch(db, branch_id)
    if branch.status != "active":
        fail(409, "BRANCH_INACTIVE", "分支已暂停或归档，恢复后才能推演")
    event_id = payload.get("event_id")
    if not event_id:
        fail(422, "VALIDATION_ERROR", "缺少 event_id")
    event = get_or_404(db, models.Event, str(event_id), "事件")
    if event.world_id != branch.world_id:
        fail(409, "WORLD_MISMATCH", "事件不属于该分支所在世界")
    if event.branch_id and event.branch_id != branch.id:
        fail(409, "BRANCH_MISMATCH", "该事件属于其他分支")

    direction = None
    direction_id = payload.get("direction_id")
    if direction_id:
        direction = get_or_404(db, models.SimulationDirection, str(direction_id), "发展方向")
        if direction.event_id != event.id:
            fail(409, "MISMATCH", "方向不属于该事件")
        if not direction.enabled:
            fail(409, "DIRECTION_DISABLED", "该方向已禁用")

    snapshot = branch.current_snapshot or {}
    if not snapshot.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "分支快照为空，无法推演")

    chars_rows = _snapshot_rows(snapshot, "characters")
    named = {row.get("name"): row for row in chars_rows}
    participants = [
        char for char in _db_characters(db, event)
        if char.name in named
    ]
    chars_payload = []
    for char in participants:
        char_row = named.get(char.name) or {}
        runtime = char_row.get("runtime_state")
        if not isinstance(runtime, dict):
            runtime = {}
        engines = runtime.get("engines") or char_row.get("engines") or char.engines or {}
        chars_payload.append(
            {
                "name": char.name,
                "engines": engines,
                "dominance": (engines or {}).get("dominance") if isinstance(engines, dict) else None,
                "main_color": runtime.get("main_color"),
                "growth_version": runtime.get("version"),
                "reality_conditions": char_row.get("reality_conditions") or char.reality_conditions or {},
                "thought_imprints": char_row.get("thought_imprints") or [],
                "life_event_count": len(_life_events(char_row)),
                "perception": _perceptions(db, event.id, char.id) or None,
                "c_profile": _c_profile_summary(char_row),
            }
        )

    rules = [
        {"name": row.get("name"), "description": (row.get("description") or "")[:300], "consequences": (row.get("consequences") or "")[:300]}
        for row in _snapshot_rows(snapshot, "world_rules")
        if row.get("status") == "active"
    ][:10]

    world_row = _world_row(snapshot)
    result = run_branch_simulation(
        {
            "event": _event_ai_payload(db, event),
            "direction": _direction_row(direction) if direction else {},
            "characters": chars_payload,
            "world": {
                "name": world_row.get("name"),
                "six_axis": _six_axis(snapshot),
                "branch_changes": (_world_settings(snapshot).get("branch_changes") or [])[-5:],
            },
            "rules": rules,
        }
    )
    if "error" in result:
        fail(502, "AI_ERROR", str(result["error"]))

    relationship_changes = result.get("relationship_changes") or []
    actions = result.get("actions") or []
    deposits = result.get("memory_deposits") or []
    world_changes_text = result.get("world_changes") or ""
    state_hint = str(result.get("state_hint") or "").strip()

    new_snapshot = copy.deepcopy(snapshot)
    rel_applied = _apply_relationship_changes(new_snapshot, relationship_changes)
    act_applied = _append_actions(new_snapshot, actions, event, deposits)
    _append_world_changes(new_snapshot, world_changes_text, event.name)

    summary_parts = [f"{event.name}"]
    if direction:
        summary_parts.append(direction.name)
    summary_parts.append(f"关系变化 {rel_applied} 条 / 行动 {act_applied} 条")
    if state_hint in STATE_HINTS:
        summary_parts.append(f"状态标签 {state_hint}")

    run = models.SimulationRun(
        world_id=branch.world_id,
        event_id=event.id,
        direction=direction.name if direction else "",
        perspective=str(payload.get("perspective") or "")[:200],
        world_changes=str(world_changes_text)[:4000],
        character_actions=actions,
        branch_id=branch.id,
    )
    db.add(run)
    db.flush()

    node = _add_node(
        db,
        branch,
        kind="simulation",
        summary=" · ".join(summary_parts),
        snapshot=new_snapshot,
        event_id=event.id,
        run_id=run.id,
        source="ai_suggestion" if direction and direction.source in {"ai", "ai_confirmed"} else "simulation",
    )
    branch.current_snapshot = new_snapshot
    branch.updated_at = utcnow()
    db.commit()
    db.refresh(run)
    db.refresh(node)

    return {
        "run": {
            "id": run.id,
            "world_changes": run.world_changes,
            "character_actions": run.character_actions,
            "direction": run.direction,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        },
        "node": _node_row(node),
        "branch": _branch_row(branch, node_count=_node_count(db, branch.id), ending_count=_ending_count(db, branch.id)),
        "applied": {"relationships": rel_applied, "actions": act_applied},
        "state_hint": state_hint if state_hint in STATE_HINTS else "",
    }


@router.post("/api/branches/{branch_id}/rollback")
def rollback_branch(branch_id: str, payload: dict, db: Session = Depends(get_db)):
    branch = _branch(db, branch_id)
    node_id = payload.get("node_id")
    if not node_id:
        fail(422, "VALIDATION_ERROR", "缺少 node_id")
    node = get_or_404(db, models.SimulationBranchNode, str(node_id), "分支节点")
    if node.branch_id != branch.id:
        fail(409, "MISMATCH", "节点不属于该分支")
    snapshot = node.snapshot or {}
    if not snapshot.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "节点快照为空")
    reason = str(payload.get("reason") or "回溯到历史节点")
    branch.current_snapshot = copy.deepcopy(snapshot)
    branch.updated_at = utcnow()
    fork = _add_node(
        db,
        branch,
        kind="fork",
        summary=f"回溯到节点 {node.seq}：{node.summary or node.kind}",
        snapshot=copy.deepcopy(snapshot),
        source="user",
        rollback_reason=reason,
    )
    db.commit()
    db.refresh(fork)
    return {
        "branch": _branch_row(branch, node_count=_node_count(db, branch.id), ending_count=_ending_count(db, branch.id)),
        "node": _node_row(fork),
        "rolled_back_to": _node_row(node),
    }


@router.post("/api/branches/{branch_id}/apply")
def apply_branch(branch_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    """显式把分支某个节点快照应用回主时间线（覆盖式，先备份）。"""
    branch = _branch(db, branch_id)
    node_id = (payload or {}).get("node_id")
    if node_id:
        node = get_or_404(db, models.SimulationBranchNode, str(node_id), "分支节点")
        if node.branch_id != branch.id:
            fail(409, "MISMATCH", "节点不属于该分支")
    else:
        node = (
            db.query(models.SimulationBranchNode)
            .filter(models.SimulationBranchNode.branch_id == branch.id)
            .order_by(models.SimulationBranchNode.seq.desc())
            .first()
        )
    if not node:
        fail(409, "NODE_MISSING", "分支没有可应用的节点")
    snapshot = node.snapshot or {}
    if not snapshot.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "节点快照为空")

    backup = _dump(db, branch.world_id)
    db.add(
        models.WorldSnapshot(
            world_id=branch.world_id,
            label=f"应用分支前备份：{branch.name}",
            data=json.dumps(backup, ensure_ascii=False),
            entity_count=int(backup.get("entity_count") or 0),
        )
    )

    data = copy.deepcopy(snapshot)
    # 分支专属事件/推演在主时间线中恢复为主时间线记录
    for table_name in ("events", "simulation_runs"):
        for row in (data.get("tables") or {}).get(table_name) or []:
            if row.get("branch_id") == branch.id:
                row["branch_id"] = None

    world = _world(db, branch.world_id)
    _replace_world_entities(db, world, data)
    db.commit()
    return {
        "status": "ok",
        "applied_node": _node_row(node),
        "branch": _branch_row(branch, node_count=_node_count(db, branch.id), ending_count=_ending_count(db, branch.id)),
        "backup_snapshot": True,
    }


def _replace_world_entities(db: Session, world: models.World, data: dict) -> None:
    """用快照覆盖主时间线实体表，但保留分支与快照表。"""
    rule_ids = [
        row[0]
        for row in db.query(models.WorldRule.id)
        .filter(models.WorldRule.world_id == world.id)
        .all()
    ]
    if rule_ids:
        db.query(models.RuleScope).filter(models.RuleScope.rule_id.in_(rule_ids)).delete(
            synchronize_session=False
        )
    for table_name, column in lifecycle._SELF_REFS.items():
        model = getattr(
            models,
            {"world_nodes": "WorldNode", "locations": "Location", "organization_units": "OrganizationUnit"}[table_name],
        )
        db.query(model).filter(model.world_id == world.id).update(
            {getattr(model, column): None}, synchronize_session=False
        )
    db.query(models.TimeSettings).filter(models.TimeSettings.world_id == world.id).update(
        {models.TimeSettings.current_era_id: None}, synchronize_session=False
    )
    for table in reversed(lifecycle.world_tables()):
        db.execute(table.delete().where(table.c.world_id == world.id))
    lifecycle._ensure_globals(db, data)

    world_row = data.get("world") or {}
    for column in models.World.__table__.columns:
        if column.name == "id" or column.name not in world_row:
            continue
        setattr(world, column.name, lifecycle._from_json(world_row[column.name]))
    world.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    db.flush()
    lifecycle._insert_world_data(db, world.id, data)


# ---------------------------------------------------------------------
# 结局
# ---------------------------------------------------------------------


def _ending_payload_from_node(db: Session, branch: models.SimulationBranch, node: models.SimulationBranchNode) -> dict:
    snapshot = node.snapshot or {}
    nodes = (
        db.query(models.SimulationBranchNode)
        .filter(
            models.SimulationBranchNode.branch_id == branch.id,
            models.SimulationBranchNode.seq <= (node.seq or 0),
        )
        .order_by(models.SimulationBranchNode.seq.asc())
        .all()
    )
    char_states = []
    for row in _snapshot_rows(snapshot, "characters"):
        runtime = row.get("runtime_state") if isinstance(row.get("runtime_state"), dict) else {}
        engines = runtime.get("engines") or row.get("engines") or {}
        events = _life_events(row)
        char_states.append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "engines": engines,
                "main_color": runtime.get("main_color"),
                "version": runtime.get("version"),
                "event_count": len(events),
                "last_event": (events[-1].get("name") if events and isinstance(events[-1], dict) else None),
                "life_history": (row.get("life_history") if isinstance(row.get("life_history"), dict) else {"events": []}),
            }
        )
    relationships = [
        {
            "source_name": next((c.get("name") for c in _snapshot_rows(snapshot, "characters") if c.get("id") == row.get("source_id")), row.get("source_id")),
            "target_name": next((c.get("name") for c in _snapshot_rows(snapshot, "characters") if c.get("id") == row.get("target_id")), row.get("target_id")),
            "source_quadrant": row.get("source_quadrant"),
            "target_quadrant": row.get("target_quadrant"),
            "description": row.get("description"),
        }
        for row in _snapshot_rows(snapshot, "relationships")
        if row.get("source_type") == "character" and row.get("target_type") == "character"
    ]
    resources = [
        {"name": row.get("name"), "type": row.get("type"), "quantity": row.get("quantity")}
        for row in _snapshot_rows(snapshot, "resources")
    ]
    return {
        "path_node_ids": [item.id for item in nodes],
        "character_final_states": char_states,
        "relationship_changes": relationships,
        "resource_changes": resources,
        "world_changes": (_world_settings(snapshot).get("branch_changes") or []),
        "path_summary": " → ".join(item.summary or item.kind for item in nodes),
    }


@router.post("/api/branches/{branch_id}/endings")
def create_ending(branch_id: str, payload: dict, db: Session = Depends(get_db)):
    branch = _branch(db, branch_id)
    node_id = payload.get("node_id")
    if node_id:
        node = get_or_404(db, models.SimulationBranchNode, str(node_id), "分支节点")
        if node.branch_id != branch.id:
            fail(409, "MISMATCH", "节点不属于该分支")
    else:
        node = (
            db.query(models.SimulationBranchNode)
            .filter(models.SimulationBranchNode.branch_id == branch.id)
            .order_by(models.SimulationBranchNode.seq.desc())
            .first()
        )
    if not node:
        fail(409, "NODE_MISSING", "分支没有可用节点")
    data = _ending_payload_from_node(db, branch, node)
    name = (payload.get("name") or "").strip()[:120] or f"{branch.name} · 结局"
    ending = models.SimulationEnding(
        world_id=branch.world_id,
        branch_id=branch.id,
        node_id=node.id,
        name=name,
        description=(payload.get("description") or data.get("path_summary") or "")[:4000],
        key_reasons=(payload.get("key_reasons") or "")[:2000],
        path_node_ids=data["path_node_ids"],
        character_final_states=data["character_final_states"],
        relationship_changes=data["relationship_changes"],
        resource_changes=data["resource_changes"],
        world_changes=data["world_changes"],
        allow_continue=bool(payload.get("allow_continue", True)),
    )
    db.add(ending)
    db.commit()
    db.refresh(ending)
    return _ending_row(ending)


@router.get("/api/worlds/{world_id}/endings")
def list_endings(world_id: str, db: Session = Depends(get_db)):
    _world(db, world_id)
    rows = (
        db.query(models.SimulationEnding)
        .filter(models.SimulationEnding.world_id == world_id)
        .order_by(models.SimulationEnding.created_at.asc())
        .all()
    )
    return [_ending_row(row, with_detail=False) for row in rows]


@router.get("/api/endings/{ending_id}")
def get_ending(ending_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationEnding, ending_id, "结局")
    return _ending_row(row)


@router.delete("/api/endings/{ending_id}")
def delete_ending(ending_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SimulationEnding, ending_id, "结局")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.post("/api/endings/{ending_id}/continue")
def continue_ending(ending_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    ending = get_or_404(db, models.SimulationEnding, ending_id, "结局")
    if not ending.allow_continue:
        fail(409, "ENDING_CLOSED", "该结局已标记为不可继续")
    node = get_or_404(db, models.SimulationBranchNode, ending.node_id, "分支节点")
    source = _branch(db, ending.branch_id)
    base = node.snapshot or {}
    if not base.get("tables"):
        fail(409, "SNAPSHOT_EMPTY", "结局节点快照为空")
    branch = models.SimulationBranch(
        world_id=ending.world_id,
        root_event_id=source.root_event_id,
        source_direction_id=source.source_direction_id,
        parent_branch_id=source.id,
        parent_node_id=node.id,
        name=((payload or {}).get("name") or f"{ending.name} · 续推")[:120],
        note=f"从结局「{ending.name}」继续推演",
        status="active",
        base_snapshot=copy.deepcopy(base),
        current_snapshot=copy.deepcopy(base),
    )
    db.add(branch)
    db.flush()
    _add_node(db, branch, kind="fork", summary=f"从结局继续：{ending.name}", snapshot=copy.deepcopy(base), source="user")
    db.commit()
    db.refresh(branch)
    return _branch_row(branch, node_count=1, ending_count=0)


# ---------------------------------------------------------------------
# 对比
# ---------------------------------------------------------------------


def _character_diff(a: dict, b: dict) -> list:
    ca = {row.get("name"): row for row in _snapshot_rows(a, "characters")}
    cb = {row.get("name"): row for row in _snapshot_rows(b, "characters")}
    diffs = []
    for name in sorted(set(ca) | set(cb)):
        ra, rb = ca.get(name), cb.get(name)
        if ra is None or rb is None:
            diffs.append(
                {
                    "name": name,
                    "kind": "added" if rb is None else "removed",
                    "detail": "仅存在于" + ("A" if rb is None else "B"),
                }
            )
            continue
        ra_run = ra.get("runtime_state") if isinstance(ra.get("runtime_state"), dict) else {}
        rb_run = rb.get("runtime_state") if isinstance(rb.get("runtime_state"), dict) else {}
        fields = {}
        if (ra.get("engines") or {}) != (rb.get("engines") or {}):
            fields["engines"] = {"a": ra.get("engines"), "b": rb.get("engines")}
        if ra_run.get("main_color") != rb_run.get("main_color"):
            fields["main_color"] = {"a": ra_run.get("main_color"), "b": rb_run.get("main_color")}
        if ra_run.get("version") != rb_run.get("version"):
            fields["version"] = {"a": ra_run.get("version"), "b": rb_run.get("version")}
        ea, eb = len(_life_events(ra)), len(_life_events(rb))
        if ea != eb:
            fields["event_count"] = {"a": ea, "b": eb}
        if fields:
            diffs.append({"name": name, "kind": "changed", "fields": fields})
    return diffs


def _relationship_diff(a: dict, b: dict) -> list:
    names_a = {row.get("id"): row.get("name") for row in _snapshot_rows(a, "characters")}
    names_b = {row.get("id"): row.get("name") for row in _snapshot_rows(b, "characters")}

    def key(rows, names):
        out = {}
        for row in rows:
            if row.get("source_type") != "character" or row.get("target_type") != "character":
                continue
            source = names.get(row.get("source_id"), row.get("source_id"))
            target = names.get(row.get("target_id"), row.get("target_id"))
            out[f"{source}→{target}"] = row.get("source_quadrant")
        return out

    ka, kb = key(_snapshot_rows(a, "relationships"), names_a), key(_snapshot_rows(b, "relationships"), names_b)
    diffs = []
    for pair in sorted(set(ka) | set(kb)):
        if ka.get(pair) != kb.get(pair):
            diffs.append({"pair": pair, "a": ka.get(pair), "b": kb.get(pair)})
    return diffs


def _resource_diff(a: dict, b: dict) -> list:
    def pack(rows):
        return {row.get("name"): row.get("quantity") for row in rows if row.get("name")}

    ra, rb = pack(_snapshot_rows(a, "resources")), pack(_snapshot_rows(b, "resources"))
    diffs = []
    for name in sorted(set(ra) | set(rb)):
        if ra.get(name) != rb.get(name):
            diffs.append({"name": name, "a": ra.get(name), "b": rb.get(name)})
    return diffs


def _world_diff(a: dict, b: dict) -> list:
    diffs = []
    sa, sb = _six_axis(a), _six_axis(b)
    for axis in sorted(set(sa) | set(sb)):
        if sa.get(axis) != sb.get(axis):
            diffs.append({"field": f"six_axis.{axis}", "a": sa.get(axis), "b": sb.get(axis)})
    la = len(_world_settings(a).get("branch_changes") or [])
    lb = len(_world_settings(b).get("branch_changes") or [])
    if la != lb:
        diffs.append({"field": "branch_changes", "a": la, "b": lb})
    return diffs


def _diff_snapshots(a: dict, b: dict) -> dict:
    return {
        "characters": _character_diff(a, b),
        "relationships": _relationship_diff(a, b),
        "resources": _resource_diff(a, b),
        "world": _world_diff(a, b),
    }


@router.post("/api/branches/compare")
def compare_branches(payload: dict, db: Session = Depends(get_db)):
    ids = payload.get("branch_ids") or payload.get("ids")
    if not isinstance(ids, list) or len(ids) < 2:
        fail(422, "VALIDATION_ERROR", "至少选择两个分支")
    branches = []
    for branch_id in ids[:4]:
        branch = _branch(db, str(branch_id))
        branches.append(
            {
                "branch": _branch_row(branch, node_count=_node_count(db, branch.id), ending_count=_ending_count(db, branch.id)),
                "snapshot": branch.current_snapshot or {},
            }
        )
    base = branches[0]
    comparisons = []
    for item in branches[1:]:
        comparisons.append(
            {
                "a": base["branch"]["id"],
                "b": item["branch"]["id"],
                "diff": _diff_snapshots(base["snapshot"], item["snapshot"]),
            }
        )
    return {"branches": [item["branch"] for item in branches], "comparisons": comparisons}


@router.post("/api/endings/compare")
def compare_endings(payload: dict, db: Session = Depends(get_db)):
    ids = payload.get("ending_ids") or payload.get("ids")
    if not isinstance(ids, list) or len(ids) < 2:
        fail(422, "VALIDATION_ERROR", "至少选择两个结局")
    endings = []
    for ending_id in ids[:4]:
        row = get_or_404(db, models.SimulationEnding, str(ending_id), "结局")
        endings.append(_ending_row(row))

    def pack_ending(row: dict) -> dict:
        chars = {}
        for char in row.get("character_final_states") or []:
            chars[char.get("name")] = {
                "engines": char.get("engines"),
                "main_color": char.get("main_color"),
                "version": char.get("version"),
                "event_count": char.get("event_count"),
            }
        rel = {}
        for item in row.get("relationship_changes") or []:
            rel[f"{item.get('source_name')}→{item.get('target_name')}"] = item.get("source_quadrant")
        return {
            "characters": chars,
            "relationships": rel,
            "resources": {item.get("name"): item.get("quantity") for item in row.get("resource_changes") or []},
            "world_changes": [item.get("text") if isinstance(item, dict) else item for item in row.get("world_changes") or []],
        }

    base = pack_ending(endings[0])
    comparisons = []
    for row in endings[1:]:
        packed = pack_ending(row)
        comparisons.append(
            {
                "a": endings[0]["id"],
                "b": row["id"],
                "diff": {
                    "characters": _character_final_diff(base["characters"], packed["characters"]),
                    "relationships": _relationship_final_diff(base["relationships"], packed["relationships"]),
                    "resources": _resource_final_diff(base["resources"], packed["resources"]),
                    "world_changes": {"a": base["world_changes"], "b": packed["world_changes"]},
                },
            }
        )
    return {"endings": endings, "comparisons": comparisons}


def _character_final_diff(a: dict, b: dict) -> list:
    diffs = []
    for name in sorted(set(a) | set(b)):
        if a.get(name) != b.get(name):
            diffs.append({"name": name, "a": a.get(name), "b": b.get(name)})
    return diffs


def _relationship_final_diff(a: dict, b: dict) -> list:
    return [{"pair": pair, "a": a.get(pair), "b": b.get(pair)} for pair in sorted(set(a) | set(b)) if a.get(pair) != b.get(pair)]


def _resource_final_diff(a: dict, b: dict) -> list:
    return [{"name": name, "a": a.get(name), "b": b.get(name)} for name in sorted(set(a) | set(b)) if a.get(name) != b.get(name)]


# ---------------------------------------------------------------------
# 世界六轴 / 人物人格参数（C_profile）扩展
# ---------------------------------------------------------------------


SIX_AXIS_KEYS = ("scarcity", "threat", "status", "reputation", "attachment", "regulation")


@router.get("/api/worlds/{world_id}/six-axis")
def get_six_axis(world_id: str, db: Session = Depends(get_db)):
    world = _world(db, world_id)
    settings = world.settings if isinstance(world.settings, dict) else {}
    axis = settings.get("six_axis")
    return {"six_axis": axis if isinstance(axis, dict) else {}, "negentropy": settings.get("negentropy")}


@router.put("/api/worlds/{world_id}/six-axis")
def put_six_axis(world_id: str, payload: dict, db: Session = Depends(get_db)):
    world = _world(db, world_id)
    axis = payload.get("six_axis") or {}
    if not isinstance(axis, dict):
        fail(422, "VALIDATION_ERROR", "six_axis 必须是对象")
    clean = {}
    for key in SIX_AXIS_KEYS:
        value = axis.get(key)
        if value is None:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            fail(422, "VALIDATION_ERROR", f"{key} 必须是数字")
        clean[key] = max(0.0, min(1.0, round(number, 3)))
    negentropy = payload.get("negentropy")
    settings = world.settings if isinstance(world.settings, dict) else {}
    settings = dict(settings)
    settings["six_axis"] = clean
    if negentropy is not None:
        try:
            settings["negentropy"] = max(0.0, min(1.0, round(float(negentropy), 3)))
        except (TypeError, ValueError):
            fail(422, "VALIDATION_ERROR", "negentropy 必须是数字")
    world.settings = settings
    db.commit()
    return {"six_axis": clean, "negentropy": settings.get("negentropy")}


@router.get("/api/characters/{character_id}/c-profile")
def get_c_profile(character_id: str, db: Session = Depends(get_db)):
    char = get_or_404(db, models.Character, character_id, "人物")
    basic = char.basic_profile if isinstance(char.basic_profile, dict) else {}
    return {"c_profile": basic.get("c_profile") if isinstance(basic.get("c_profile"), dict) else {}}


@router.put("/api/characters/{character_id}/c-profile")
def put_c_profile(character_id: str, payload: dict, db: Session = Depends(get_db)):
    char = get_or_404(db, models.Character, character_id, "人物")
    profile = payload.get("c_profile")
    if not isinstance(profile, dict):
        fail(422, "VALIDATION_ERROR", "c_profile 必须是对象")
    clean = {}
    for group, values in profile.items():
        if not isinstance(values, dict):
            continue
        entry = {}
        for key, value in values.items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                entry[str(key)[:64]] = max(0.0, min(1.0, round(float(value), 3)))
            elif isinstance(value, (str, bool)):
                entry[str(key)[:64]] = value if not isinstance(value, str) else value[:200]
        clean[str(group)[:64]] = entry
    basic = dict(char.basic_profile) if isinstance(char.basic_profile, dict) else {}
    basic["c_profile"] = clean
    char.basic_profile = basic
    db.commit()
    return {"c_profile": clean}
