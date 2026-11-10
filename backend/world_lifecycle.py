"""世界级数据：级联清理、全量快照与恢复。

快照覆盖所有带 world_id 的业务表，并额外保存 rule_scopes。
用于时光机与官方演示世界重置/内置。
"""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

import models
from database import Base

_SELF_REFS = {
    "world_nodes": "parent_id",
    "locations": "parent_location_id",
    "organization_units": "parent_unit_id",
}
_META_TABLES = {"world_snapshots", "trash_entries"}
# 多路径推演表自带全量快照，若纳入世界快照会递归膨胀；世界快照/回滚时显式清理。
_MULTIPATH_TABLES = {
    "simulation_directions",
    "simulation_branches",
    "simulation_branch_nodes",
    "simulation_endings",
}
_STORY_TABLES = {
    "story_projects",
    "story_spaces",
    "story_units",
    "story_unit_events",
    "story_choices",
    "story_choice_options",
    "story_endings",
    "story_rejoins",
    "story_chapter_links",
}
_CHAT_TABLES = {
    "ai_roles",
    "chat_threads",
    "chat_participants",
    "chat_messages",
    "character_memories",
    "chat_plans",
    "chat_impacts",
}
_GLOBAL_TABLES = ("location_types", "resource_types", "relationship_types")


def world_tables():
    """所有按 world_id 归属的业务表，按外键依赖正序返回。

    多路径推演表不参与世界快照（避免快照嵌套快照），由 _cascade_delete_world 显式清理。
    """
    return [
        table
        for table in Base.metadata.sorted_tables
        if table.name not in _META_TABLES
        and table.name not in _MULTIPATH_TABLES
        and table.name not in _STORY_TABLES
        and table.name not in _CHAT_TABLES
        and table.name != "worlds"
        and "world_id" in table.c
    ]


def _jsonable(value: Any):
    if isinstance(value, datetime):
        return {"__datetime__": value.isoformat()}
    if isinstance(value, date):
        return {"__date__": value.isoformat()}
    return value


def _from_json(value: Any):
    if isinstance(value, dict) and "__datetime__" in value:
        return datetime.fromisoformat(value["__datetime__"])
    if isinstance(value, dict) and "__date__" in value:
        return date.fromisoformat(value["__date__"])
    return value


def serialize_rows(rows) -> list[dict]:
    return [
        {key: _jsonable(value) for key, value in dict(row).items()}
        for row in rows
    ]


def _row_dict(obj, table):
    return {column.name: _jsonable(getattr(obj, column.name, None)) for column in table.columns}


def dump_world(db: Session, world_id: str, branch_id: str | None = None) -> dict:
    """导出世界快照。

    branch_id=None 时只导出主时间线（branch_id 为空的行），用于时光机/归档；
    branch_id 有值时额外包含该分支的专属行，用于分支沙盒快照。
    """
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        raise ValueError("世界不存在")

    tables: dict[str, list[dict]] = {}
    for table in world_tables():
        stmt = select(table).where(table.c.world_id == world_id)
        if "branch_id" in table.c:
            if branch_id:
                stmt = stmt.where(
                    or_(table.c.branch_id.is_(None), table.c.branch_id == branch_id)
                )
            else:
                stmt = stmt.where(table.c.branch_id.is_(None))
        rows = db.execute(stmt).mappings().all()
        if rows:
            tables[table.name] = serialize_rows(rows)

    rule_ids = [
        row[0]
        for row in db.query(models.WorldRule.id)
        .filter(models.WorldRule.world_id == world_id)
        .all()
    ]
    rule_scopes: list[dict] = []
    if rule_ids:
        scope_table = models.RuleScope.__table__
        rows = db.execute(
            select(scope_table).where(scope_table.c.rule_id.in_(rule_ids))
        ).mappings().all()
        rule_scopes = serialize_rows(rows)

    globals_data: dict[str, list[dict]] = {}
    for table_name in _GLOBAL_TABLES:
        table = Base.metadata.tables[table_name]
        rows = db.execute(select(table).where(table.c.world_id.is_(None))).mappings().all()
        if rows:
            globals_data[table_name] = serialize_rows(rows)

    count = sum(len(rows) for rows in tables.values()) + len(rule_scopes)
    return {
        "version": 1,
        "world": _row_dict(world, models.World.__table__),
        "tables": tables,
        "globals": globals_data,
        "rule_scopes": rule_scopes,
        "entity_count": count,
    }


def _cascade_delete_world(db: Session, world_id: str):
    """清空世界内业务数据，但保留 world 行、快照和回收站记录。"""
    rule_ids = [
        row[0]
        for row in db.query(models.WorldRule.id)
        .filter(models.WorldRule.world_id == world_id)
        .all()
    ]
    if rule_ids:
        db.query(models.RuleScope).filter(models.RuleScope.rule_id.in_(rule_ids)).delete(
            synchronize_session=False
        )

    for table_name, column in _SELF_REFS.items():
        model = getattr(models, {
            "world_nodes": "WorldNode",
            "locations": "Location",
            "organization_units": "OrganizationUnit",
        }[table_name])
        db.query(model).filter(model.world_id == world_id).update(
            {getattr(model, column): None}, synchronize_session=False
        )

    db.query(models.TimeSettings).filter(
        models.TimeSettings.world_id == world_id
    ).update({models.TimeSettings.current_era_id: None}, synchronize_session=False)

    # 多路径推演数据不属于世界快照，但整世界回滚/清空时必须一并清理，
    # 否则旧分支会引用已被重建的实体 ID。
    db.query(models.SimulationEnding).filter(
        models.SimulationEnding.world_id == world_id
    ).delete(synchronize_session=False)
    db.query(models.SimulationBranchNode).filter(
        models.SimulationBranchNode.world_id == world_id
    ).delete(synchronize_session=False)
    db.query(models.SimulationBranch).filter(
        models.SimulationBranch.world_id == world_id
    ).delete(synchronize_session=False)
    db.query(models.SimulationDirection).filter(
        models.SimulationDirection.world_id == world_id
    ).delete(synchronize_session=False)

    # 故事线结构不进世界快照，但清理世界时必须一并移除，避免指向已重建的实体。
    db.query(models.StoryChapterLink).filter(models.StoryChapterLink.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryEnding).filter(models.StoryEnding.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryRejoin).filter(models.StoryRejoin.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryChoiceOption).filter(models.StoryChoiceOption.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryChoice).filter(models.StoryChoice.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryUnitEvent).filter(models.StoryUnitEvent.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryUnit).filter(models.StoryUnit.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StorySpace).filter(models.StorySpace.world_id == world_id).delete(synchronize_session=False)
    db.query(models.StoryProject).filter(models.StoryProject.world_id == world_id).delete(synchronize_session=False)

    # 聊天室不进入世界快照；清理世界时按会话依赖顺序移除。
    chat_thread_ids = [
        row[0]
        for row in db.query(models.ChatThread.id).filter(models.ChatThread.world_id == world_id).all()
    ]
    if chat_thread_ids:
        db.query(models.ChatPlan).filter(models.ChatPlan.thread_id.in_(chat_thread_ids)).delete(synchronize_session=False)
        db.query(models.ChatImpact).filter(models.ChatImpact.thread_id.in_(chat_thread_ids)).delete(synchronize_session=False)
        db.query(models.ChatMessage).filter(models.ChatMessage.thread_id.in_(chat_thread_ids)).delete(synchronize_session=False)
        db.query(models.ChatParticipant).filter(models.ChatParticipant.thread_id.in_(chat_thread_ids)).delete(synchronize_session=False)
        db.query(models.ChatThread).filter(models.ChatThread.world_id == world_id).delete(synchronize_session=False)
    db.query(models.CharacterMemory).filter(models.CharacterMemory.world_id == world_id).delete(synchronize_session=False)
    db.query(models.AiRole).filter(models.AiRole.world_id == world_id).delete(synchronize_session=False)

    for table in reversed(world_tables()):
        db.execute(table.delete().where(table.c.world_id == world_id))

    db.flush()


def _ensure_globals(db: Session, data: dict) -> None:
    """补齐快照依赖的系统级类型（地点/资源/关系），不覆盖已有行。"""
    for table_name, rows in (data.get("globals") or {}).items():
        table = Base.metadata.tables.get(table_name)
        if table is None:
            continue
        existing = {row[0] for row in db.execute(select(table.c.id)).all()}
        missing = []
        for raw in rows:
            row = {key: _from_json(value) for key, value in raw.items()}
            if row.get("id") not in existing:
                missing.append(row)
        if missing:
            db.execute(table.insert(), missing)
            db.flush()


def _insert_world_data(db: Session, world_id: str, data: dict) -> None:
    """在空世界内按依赖顺序插入快照数据。"""
    for table in world_tables():
        rows = data.get("tables", {}).get(table.name) or []
        if not rows:
            continue
        prepared = []
        deferred: list[tuple[dict, dict]] = []
        self_ref = _SELF_REFS.get(table.name)
        for raw in rows:
            row = {key: _from_json(value) for key, value in raw.items()}
            row["world_id"] = world_id
            if self_ref:
                deferred.append((row["id"], {self_ref: row.get(self_ref)}))
                row[self_ref] = None
            if table.name == "time_settings":
                deferred.append((row["world_id"], {"current_era_id": row.get("current_era_id")}))
                row["current_era_id"] = None
            prepared.append(row)
        if prepared:
            db.execute(table.insert(), prepared)
        db.flush()
        for key, values in deferred:
            id_column = "world_id" if table.name == "time_settings" else "id"
            db.execute(
                table.update().where(table.c[id_column] == key).values(**values)
            )

    scopes = data.get("rule_scopes") or []
    if scopes:
        scope_table = models.RuleScope.__table__
        db.execute(
            scope_table.insert(),
            [{key: _from_json(value) for key, value in row.items()} for row in scopes],
        )


def restore_world(db: Session, world_id: str, data: dict) -> None:
    """整世界回滚：先清空当前数据，再按快照重建。"""
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        raise ValueError("世界不存在")
    world_row = dict(data.get("world") or {})
    _cascade_delete_world(db, world_id)
    _ensure_globals(db, data)

    for column in models.World.__table__.columns:
        if column.name == "id" or column.name not in world_row:
            continue
        value = _from_json(world_row[column.name])
        setattr(world, column.name, value)
    world.id = world_id
    world.updatedAt = datetime.utcnow().isoformat()
    db.flush()

    _insert_world_data(db, world_id, data)
    db.commit()
    db.expire_all()


def import_world(db: Session, data: dict, target_world_id: str | None = None) -> str:
    """导入一个世界（官方演示初始数据）。"""
    world_row = dict(data.get("world") or {})
    world_id = target_world_id or world_row.get("id")
    if not world_id:
        raise ValueError("快照缺少世界 ID")
    existing = db.query(models.World).filter(models.World.id == world_id).first()
    if existing:
        raise ValueError("世界已存在")
    values = {
        column.name: _from_json(world_row[column.name])
        for column in models.World.__table__.columns
        if column.name in world_row and column.name != "id"
    }
    values["id"] = world_id
    world = models.World(**values)
    db.add(world)
    db.flush()
    _ensure_globals(db, data)
    _insert_world_data(db, world_id, data)
    db.commit()
    db.expire_all()
    return world_id


def snapshot_json(db: Session, world_id: str) -> tuple[str, int, dict]:
    data = dump_world(db, world_id)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return payload, data["entity_count"], data
