"""全局回收站：删除前保存整行快照，恢复时按原 ID 重建。"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

import models

MODEL_BY_TYPE = {
    "world": models.World,
    "character": models.Character,
    "location": models.Location,
    "event": models.Event,
    "organization": models.Organization,
    "relationship": models.Relationship,
    "story": models.Story,
}

LABEL_BY_TYPE = {
    "world": "世界",
    "character": "人物",
    "location": "地点",
    "event": "事件",
    "organization": "组织",
    "relationship": "关系",
    "story": "章节",
}


def _jsonable(value):
    if isinstance(value, datetime):
        return {"__datetime__": value.isoformat()}
    if isinstance(value, date):
        return {"__date__": value.isoformat()}
    return value


def _from_json(value):
    if isinstance(value, dict) and "__datetime__" in value:
        return datetime.fromisoformat(value["__datetime__"])
    if isinstance(value, dict) and "__date__" in value:
        return date.fromisoformat(value["__date__"])
    return value


def serialize_row(row) -> dict:
    return {
        column.name: _jsonable(getattr(row, column.name, None))
        for column in row.__table__.columns
    }


def _nodes_for(db: Session, entity_type: str, entity_id: str):
    rows = (
        db.query(models.WorldNode)
        .filter(
            models.WorldNode.ref_type == entity_type,
            models.WorldNode.ref_id == entity_id,
        )
        .all()
    )
    return [serialize_row(row) for row in rows]


def _drafts_for_story(db: Session, story_id: str):
    rows = db.query(models.EntityDraft).filter(models.EntityDraft.story_id == story_id).all()
    return [serialize_row(row) for row in rows]


def trash_entity(
    db: Session,
    model,
    entity_type: str,
    row,
    *,
    extras: dict | None = None,
    skip_guard: bool = False,
) -> models.TrashEntry:
    if not skip_guard and getattr(row, "world_id", None):
        from reference_guard import assert_not_referenced

        assert_not_referenced(db, row.world_id, entity_type, row.id, LABEL_BY_TYPE.get(entity_type, "对象"))

    payload = extras or {}
    payload["nodes"] = _nodes_for(db, entity_type, row.id)
    if entity_type == "story":
        payload["drafts"] = _drafts_for_story(db, row.id)

    entry = models.TrashEntry(
        world_id=getattr(row, "world_id", "") or "",
        entity_type=entity_type,
        entity_id=row.id,
        name=getattr(row, "name", None) or getattr(row, "title", None) or row.id,
        data=serialize_row(row),
        extras=payload,
    )
    db.add(entry)

    for node in db.query(models.WorldNode).filter(
        models.WorldNode.ref_type == entity_type,
        models.WorldNode.ref_id == row.id,
    ).all():
        db.delete(node)

    if entity_type == "story":
        db.query(models.EntityDraft).filter(models.EntityDraft.story_id == row.id).delete(
            synchronize_session=False
        )

    db.delete(row)
    db.flush()
    return entry


def trash_world(db: Session, world: models.World) -> models.TrashEntry:
    world.deleted_at = datetime.utcnow()
    entry = models.TrashEntry(
        world_id=world.id,
        entity_type="world",
        entity_id=world.id,
        name=world.name or world.id,
        data={"soft": True},
        extras={},
    )
    db.add(entry)
    db.commit()
    return entry


def restore_entry(db: Session, entry: models.TrashEntry):
    model = MODEL_BY_TYPE.get(entry.entity_type)
    if not model:
        raise ValueError("未知的回收站类型")

    if entry.entity_type == "world":
        world = db.query(models.World).filter(models.World.id == entry.entity_id).first()
        if not world:
            raise ValueError("世界已不存在，无法恢复")
        world.deleted_at = None
        db.delete(entry)
        db.commit()
        return world

    existing = db.query(model).filter(model.id == entry.entity_id).first()
    if existing:
        raise ValueError("同 ID 数据已存在，无法恢复")

    values = {key: _from_json(value) for key, value in (entry.data or {}).items()}
    values.pop("id", None)
    row = model(id=entry.entity_id, **values)
    db.add(row)
    db.flush()

    nodes = (entry.extras or {}).get("nodes") or []
    node_rows = []
    for raw in nodes:
        data = {key: _from_json(value) for key, value in raw.items()}
        data["id"] = data.get("id") or data.get("node_id")
        data["ref_id"] = entry.entity_id
        data.pop("node_id", None)
        data["parent_id"] = None
        node_rows.append(data)
    if node_rows:
        db.execute(models.WorldNode.__table__.insert(), node_rows)
        for raw, data in zip(nodes, node_rows):
            parent_id = _from_json(raw.get("parent_id"))
            if parent_id:
                db.execute(
                    models.WorldNode.__table__.update()
                    .where(models.WorldNode.id == data["id"])
                    .values(parent_id=parent_id if db.query(models.WorldNode).filter(models.WorldNode.id == parent_id).first() else None)
                )

    for raw in (entry.extras or {}).get("drafts") or []:
        data = {key: _from_json(value) for key, value in raw.items()}
        data.pop("id", None)
        db.add(models.EntityDraft(**data))

    db.delete(entry)
    db.commit()
    db.refresh(row)
    return row


def list_entries(db: Session, world_id: str = ""):
    query = db.query(models.TrashEntry)
    if world_id:
        query = query.filter(models.TrashEntry.world_id == world_id)
    return query.order_by(models.TrashEntry.deleted_at.desc()).all()
