"""官方防删演示世界：内置《凡人修仙传》，锁定并支持一键重置。"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from access import is_owner_request
from database import get_db
from world_lifecycle import import_world, restore_world

router = APIRouter()

OFFICIAL_KEY = "fanren"
FIXTURE_PATH = Path(__file__).with_name("seed") / "fanren.json"


def load_fixture() -> dict:
    if not FIXTURE_PATH.exists():
        raise FileNotFoundError(f"官方演示数据不存在：{FIXTURE_PATH}")
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _backfill_official_participants(db: Session, world_id: str) -> None:
    """官方数据先于 M020 导入时，把 event_entities 的人物参与方补回 events.participants。"""
    grouped: dict[str, list[str]] = {}
    rows = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.world_id == world_id,
            models.EventEntity.category == "participant",
            models.EventEntity.entity_type == "character",
        )
        .order_by(models.EventEntity.created_at)
        .all()
    )
    for row in rows:
        if not row.entity_id:
            continue
        ids = grouped.setdefault(row.event_id, [])
        if row.entity_id not in ids:
            ids.append(row.entity_id)
    if not grouped:
        return
    events = db.query(models.Event).filter(models.Event.id.in_(grouped.keys())).all()
    changed = False
    for event in events:
        if not (event.participants or []):
            event.participants = grouped.get(event.id, [])
            changed = True
    if changed:
        db.commit()


def ensure_official_world(db: Session) -> models.World | None:
    """启动时确保官方演示世界存在；已有同名世界则直接标记为官方，不覆盖用户数据。"""
    existing = db.query(models.World).filter(models.World.official_key == OFFICIAL_KEY).first()
    if existing:
        changed = False
        if not existing.is_official:
            existing.is_official = True
            changed = True
        if not existing.owner_id:
            existing.owner_id = "local"
            changed = True
        if not existing.product_scene:
            existing.product_scene = "game"
            changed = True
        if changed:
            db.commit()
        _backfill_official_participants(db, existing.id)
        return existing

    named = db.query(models.World).filter(models.World.name == "凡人修仙传").first()
    if named:
        named.is_official = True
        named.official_key = OFFICIAL_KEY
        named.deleted_at = None
        if not named.owner_id:
            named.owner_id = "local"
        if not named.product_scene:
            named.product_scene = "game"
        db.commit()
        _backfill_official_participants(db, named.id)
        return named

    try:
        data = load_fixture()
    except FileNotFoundError:
        return None
    target_id = data.get("world", {}).get("id")
    world_id = import_world(db, data, target_id)
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if world:
        world.is_official = True
        world.official_key = OFFICIAL_KEY
        world.deleted_at = None
        world.archived_at = None
        if not world.owner_id:
            world.owner_id = "local"
        if not world.product_scene:
            world.product_scene = "game"
        db.commit()
        _backfill_official_participants(db, world.id)
    return world


@router.post("/api/worlds/{world_id}/reset-official")
def reset_official_world(world_id: str, request: Request, db: Session = Depends(get_db)):
    if not is_owner_request(request, db):
        raise HTTPException(status_code=403, detail="只有开发者可以重置官方演示世界")
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        raise HTTPException(status_code=404, detail="世界不存在")
    if not world.is_official:
        raise HTTPException(status_code=409, detail="这不是官方演示世界")
    try:
        data = load_fixture()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="官方演示数据缺失") from exc
    data = dict(data)
    data["world"] = dict(data.get("world") or {})
    data["world"]["id"] = world.id
    data["world"]["is_official"] = True
    data["world"]["official_key"] = OFFICIAL_KEY
    restore_world(db, world.id, data)
    world = db.query(models.World).filter(models.World.id == world_id).first()
    world.is_official = True
    world.official_key = OFFICIAL_KEY
    world.product_scene = world.product_scene or "game"
    world.deleted_at = None
    world.archived_at = None
    db.commit()
    try:
        ensure_official_storyline(db)
    except Exception as exc:  # 故事线导入失败不阻断世界重置
        print(f"官方故事线重建跳过: {exc}")
    return {"status": "ok", "reset": True, "world_id": world.id}
