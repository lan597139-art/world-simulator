"""世界数据导出：把用户自己的世界资产打包为可迁移 JSON。"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import inspect
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter()


def _value(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _dump(row):
    if row is None:
        return None
    return {column.key: _value(getattr(row, column.key)) for column in inspect(row).mapper.column_attrs}


@router.get("/api/worlds/{world_id}/export")
def export_world(world_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        raise HTTPException(status_code=404, detail="世界不存在")
    if world.owner_id != user.id and not world.is_official:
        raise HTTPException(status_code=403, detail="无权导出这个世界")

    characters = db.query(models.Character).filter(models.Character.world_id == world_id).all()
    events = db.query(models.Event).filter(models.Event.world_id == world_id).all()
    relationships = db.query(models.Relationship).filter(models.Relationship.world_id == world_id).all()
    locations = db.query(models.Location).filter(models.Location.world_id == world_id).all()
    organizations = db.query(models.Organization).filter(models.Organization.world_id == world_id).all()
    stories = db.query(models.Story).filter(models.Story.world_id == world_id).all()
    story_projects = db.query(models.StoryProject).filter(models.StoryProject.world_id == world_id).all()
    resources = db.query(models.Resource).filter(models.Resource.world_id == world_id).all()
    resource_type_ids = {row.resource_type_id for row in resources if row.resource_type_id}
    resource_types = db.query(models.ResourceType).filter(
        (models.ResourceType.world_id == world_id) | (models.ResourceType.id.in_(resource_type_ids))
    ).all() if resource_type_ids else db.query(models.ResourceType).filter(models.ResourceType.world_id == world_id).all()
    resource_holdings = db.query(models.ResourceHolding).filter(models.ResourceHolding.world_id == world_id).all()
    resource_transactions = db.query(models.ResourceTransaction).filter(models.ResourceTransaction.world_id == world_id).all()
    threads = db.query(models.StoryThread).filter(models.StoryThread.story_id.in_([s.id for s in story_projects])).all() if story_projects else []
    thread_ids = [row.id for row in threads]
    links = db.query(models.StoryThreadEvent).filter(models.StoryThreadEvent.thread_id.in_(thread_ids)).all() if thread_ids else []
    settings = db.query(models.WorldSettings).filter(models.WorldSettings.world_id == world_id).first()

    payload = {
        "format": "world-simulator/world",
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "world": _dump(world),
        "settings": _dump(settings),
        "characters": [_dump(row) for row in characters],
        "events": [_dump(row) for row in events],
        "relationships": [_dump(row) for row in relationships],
        "locations": [_dump(row) for row in locations],
        "organizations": [_dump(row) for row in organizations],
        "stories": [_dump(row) for row in stories],
        "story_projects": [_dump(row) for row in story_projects],
        "story_threads": [_dump(row) for row in threads],
        "story_thread_events": [_dump(row) for row in links],
        "resource_types": [_dump(row) for row in resource_types],
        "resources": [_dump(row) for row in resources],
        "resource_holdings": [_dump(row) for row in resource_holdings],
        "resource_transactions": [_dump(row) for row in resource_transactions],
        "counts": {
            "characters": len(characters),
            "events": len(events),
            "relationships": len(relationships),
            "locations": len(locations),
            "organizations": len(organizations),
            "stories": len(stories),
            "story_projects": len(story_projects),
            "resources": len(resources),
        },
    }
    return payload


# ---------------------------------------------------------------------------
# 导入：把导出的世界包克隆为当前用户的新世界，并重映射所有内部 ID。
# ---------------------------------------------------------------------------

def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())


def _import_row(db: Session, model, data: dict, *, overrides: dict, skip: set[str] | None = None):
    """按模型列复制一行；DateTime 字符串自动还原，未知字段丢弃。"""
    from sqlalchemy import DateTime as SADateTime

    skip = set(skip or set())
    values = {}
    for column in inspect(model).mapper.column_attrs:
        key = column.key
        if key in skip or key not in data:
            continue
        value = data[key]
        if isinstance(column.columns[0].type, SADateTime) and isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                value = None
        values[key] = value
    values.update(overrides)
    row = model(**values)
    db.add(row)
    return row


def _remap(value, maps: dict[str, dict[str, str]]):
    if isinstance(value, str):
        for mapping in maps.values():
            if value in mapping:
                return mapping[value]
    if isinstance(value, list):
        return [_remap(item, maps) for item in value]
    if isinstance(value, dict):
        return {key: _remap(item, maps) for key, item in value.items()}
    return value


@router.post("/api/worlds/import")
def import_world(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if payload.get("format") != "world-simulator/world":
        raise HTTPException(status_code=422, detail="不是世界模拟器导出的世界包")
    source_world = payload.get("world") or {}
    if not source_world.get("name"):
        raise HTTPException(status_code=422, detail="世界包缺少世界名称")
    allowed_scenes = {"game", "literature", "companion", "diary", "yunbao"}
    target_scene = str(payload.get("target_product") or source_world.get("product_scene") or "game")
    if target_scene not in allowed_scenes:
        target_scene = "game"

    now = datetime.utcnow().isoformat()
    world_id_new = _new_id()
    try:
        world = _import_row(
            db,
            models.World,
            source_world,
            overrides={
                "id": world_id_new,
                "owner_id": user.id,
                "name": f"{source_world.get('name')} (导入)",
                "product_scene": target_scene,
                "is_product_workspace": False,
                "is_official": False,
                "official_key": None,
                "archived_at": None,
                "deleted_at": None,
                "createdAt": now,
                "updatedAt": now,
            },
            skip={"settings"},
        )

        maps: dict[str, dict[str, str]] = {
            "characters": {},
            "locations": {},
            "organizations": {},
            "events": {},
            "stories": {},
            "story_projects": {},
            "story_threads": {},
            "resources": {},
        }

        # 地点先建，父子关系第二遍补。
        location_rows = {}
        for item in payload.get("locations") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["locations"][old_id] = new_id
            row = _import_row(
                db, models.Location, item,
                overrides={"id": new_id, "world_id": world_id_new, "parent_location_id": None, "location_type_id": None},
                skip={"created_at", "updated_at"},
            )
            location_rows[old_id] = (row, item)

        db.flush()
        for row, item in location_rows.values():
            row.parent_location_id = maps["locations"].get(str(item.get("parent_location_id") or ""))
        db.flush()

        organization_rows = {}
        for item in payload.get("organizations") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["organizations"][old_id] = new_id
            headquarters = maps["locations"].get(str(item.get("headquarters_location_id") or ""))
            row = _import_row(
                db, models.Organization, item,
                overrides={"id": new_id, "world_id": world_id_new, "headquarters_location_id": headquarters, "society_id": None},
                skip={"created_at", "updated_at"},
            )
            organization_rows[old_id] = (row, item)

        character_rows = {}
        for item in payload.get("characters") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["characters"][old_id] = new_id
            row = _import_row(
                db, models.Character, item,
                overrides={"id": new_id, "world_id": world_id_new, "owner_user_id": user.id, "archived_at": None},
                skip={"created_at"},
            )
            character_rows[old_id] = (row, item)

        resource_type_map: dict[str, str] = {}
        for item in payload.get("resource_types") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            resource_type_map[old_id] = new_id
            _import_row(
                db, models.ResourceType, item,
                overrides={"id": new_id, "world_id": world_id_new},
                skip={"created_at"},
            )
        db.flush()

        for item in payload.get("resources") or []:
            old_id = str(item.get("id") or "")
            type_id = resource_type_map.get(str(item.get("resource_type_id") or ""))
            if not old_id or not type_id:
                continue
            new_id = _new_id()
            maps["resources"][old_id] = new_id
            _import_row(
                db, models.Resource, item,
                overrides={
                    "id": new_id,
                    "world_id": world_id_new,
                    "resource_type_id": type_id,
                    "location_id": maps["locations"].get(str(item.get("location_id") or "")),
                },
                skip={"created_at", "updated_at"},
            )

        holding_map: dict[str, str] = {}
        for item in payload.get("resource_holdings") or []:
            old_holding_id = str(item.get("id") or "")
            resource_id = maps["resources"].get(str(item.get("resource_id") or ""))
            holder_type = str(item.get("holder_type") or "")
            holder_map = maps.get(holder_type) or maps.get(f"{holder_type}s") or {}
            holder_id = holder_map.get(str(item.get("holder_id") or ""))
            if not resource_id or not holder_id:
                continue
            holding_id = _new_id()
            if old_holding_id:
                holding_map[old_holding_id] = holding_id
            _import_row(
                db, models.ResourceHolding, item,
                overrides={
                    "id": holding_id,
                    "world_id": world_id_new,
                    "resource_id": resource_id,
                    "holder_id": holder_id,
                },
                skip={"created_at"},
            )

        transaction_rows = []
        for item in payload.get("resource_transactions") or []:
            resource_id = maps["resources"].get(str(item.get("resource_id") or ""))
            if not resource_id:
                continue
            row = _import_row(
                db, models.ResourceTransaction, item,
                overrides={
                    "id": _new_id(),
                    "world_id": world_id_new,
                    "resource_id": resource_id,
                    "event_id": None,
                    "from_holder_id": holding_map.get(str(item.get("from_holder_id") or "")),
                    "to_holder_id": holding_map.get(str(item.get("to_holder_id") or "")),
                },
                skip={"created_at"},
            )
            transaction_rows.append((row, item))

        event_rows = {}
        for item in payload.get("events") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["events"][old_id] = new_id
            row = _import_row(
                db, models.Event, item,
                overrides={
                    "id": new_id,
                    "world_id": world_id_new,
                    "parent_event_id": None,
                    "location_id": maps["locations"].get(str(item.get("location_id") or "")),
                    "organization_id": maps["organizations"].get(str(item.get("organization_id") or "")),
                    "participants": _remap(item.get("participants") or [], maps),
                    "affected": _remap(item.get("affected") or [], maps),
                    "caused_by": _remap(item.get("caused_by") or [], maps),
                    "branch_id": None,
                },
                skip={"created_at", "updated_at"},
            )
            event_rows[old_id] = (row, item)

        db.flush()
        for row, item in event_rows.values():
            row.parent_event_id = maps["events"].get(str(item.get("parent_event_id") or ""))
        for row, item in transaction_rows:
            row.event_id = maps["events"].get(str(item.get("event_id") or ""))
        db.flush()

        for item in payload.get("relationships") or []:
            source_type = str(item.get("source_type") or "character")
            target_type = str(item.get("target_type") or "character")
            source_map = maps.get(source_type) or maps.get(f"{source_type}s") or {}
            target_map = maps.get(target_type) or maps.get(f"{target_type}s") or {}
            source_id = source_map.get(str(item.get("source_id") or ""))
            target_id = target_map.get(str(item.get("target_id") or ""))
            if not source_id or not target_id:
                continue
            _import_row(
                db, models.Relationship, item,
                overrides={
                    "id": _new_id(),
                    "world_id": world_id_new,
                    "source_id": source_id,
                    "target_id": target_id,
                    "history": _remap(item.get("history") or [], maps),
                },
                skip={"created_at", "updated_at"},
            )

        for item in payload.get("story_projects") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["story_projects"][old_id] = new_id
            _import_row(
                db, models.StoryProject, item,
                overrides={"id": new_id, "world_id": world_id_new, "official_key": None},
                skip={"created_at", "updated_at"},
            )

        for item in payload.get("stories") or []:
            old_id = str(item.get("id") or "")
            if not old_id:
                continue
            new_id = _new_id()
            maps["stories"][old_id] = new_id
            _import_row(
                db, models.Story, item,
                overrides={
                    "id": new_id,
                    "world_id": world_id_new,
                    "owner_user_id": user.id,
                    "community_publication_id": None,
                    "volume_id": None,
                    "source_event_ids": _remap(item.get("source_event_ids") or [], maps),
                    "archived_at": None,
                },
                skip={"created_at", "updated_at"},
            )

        thread_rows = {}
        for item in payload.get("story_threads") or []:
            old_id = str(item.get("id") or "")
            story_id = maps["story_projects"].get(str(item.get("story_id") or "")) or maps["stories"].get(str(item.get("story_id") or ""))
            if not old_id or not story_id:
                continue
            new_id = _new_id()
            maps["story_threads"][old_id] = new_id
            row = _import_row(
                db, models.StoryThread, item,
                overrides={
                    "id": new_id,
                    "story_id": story_id,
                    "world_id": world_id_new,
                    "character_id": maps["characters"].get(str(item.get("character_id") or "")),
                    "parent_thread_id": None,
                },
                skip={"created_at"},
            )
            thread_rows[old_id] = (row, item)

        db.flush()
        for row, item in thread_rows.values():
            row.parent_thread_id = maps["story_threads"].get(str(item.get("parent_thread_id") or ""))
        db.flush()

        for item in payload.get("story_thread_events") or []:
            thread_id = maps["story_threads"].get(str(item.get("thread_id") or ""))
            event_id = maps["events"].get(str(item.get("event_id") or ""))
            if not thread_id or not event_id:
                continue
            _import_row(
                db, models.StoryThreadEvent, item,
                overrides={"id": _new_id(), "world_id": world_id_new, "thread_id": thread_id, "event_id": event_id},
                skip={"created_at"},
            )

        source_settings = payload.get("settings") or {}
        db.add(models.WorldSettings(
            world_id=world_id_new,
            selections=source_settings.get("selections") or {},
            parameters=source_settings.get("parameters") or {},
            revision=1,
        ))
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"世界包导入失败：{exc}") from exc

    return {
        "ok": True,
        "world_id": world_id_new,
        "name": world.name,
        "counts": {
            "characters": len(maps["characters"]),
            "events": len(maps["events"]),
            "relationships": len(payload.get("relationships") or []),
            "locations": len(maps["locations"]),
            "organizations": len(maps["organizations"]),
            "stories": len(maps["stories"]),
            "story_projects": len(maps["story_projects"]),
            "resources": len(maps["resources"]),
        },
    }
