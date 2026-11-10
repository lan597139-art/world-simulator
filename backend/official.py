"""官方防删演示世界：内置《凡人修仙传》，锁定并支持一键重置。"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from world_lifecycle import import_world, restore_world

router = APIRouter()

OFFICIAL_KEY = "fanren"
FIXTURE_PATH = Path(__file__).with_name("seed") / "fanren.json"


def load_fixture() -> dict:
    if not FIXTURE_PATH.exists():
        raise FileNotFoundError(f"官方演示数据不存在：{FIXTURE_PATH}")
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def ensure_official_world(db: Session) -> models.World | None:
    """启动时确保官方演示世界存在；已有同名世界则直接标记为官方，不覆盖用户数据。"""
    existing = db.query(models.World).filter(models.World.official_key == OFFICIAL_KEY).first()
    if existing:
        if not existing.is_official:
            existing.is_official = True
            db.commit()
        return existing

    named = db.query(models.World).filter(models.World.name == "凡人修仙传").first()
    if named:
        named.is_official = True
        named.official_key = OFFICIAL_KEY
        named.deleted_at = None
        db.commit()
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
        db.commit()
    return world


@router.post("/api/worlds/{world_id}/reset-official")
def reset_official_world(world_id: str, db: Session = Depends(get_db)):
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
    world.deleted_at = None
    world.archived_at = None
    db.commit()
    try:
        ensure_official_storyline(db)
    except Exception as exc:  # 故事线导入失败不阻断世界重置
        print(f"官方故事线重建跳过: {exc}")
    return {"status": "ok", "reset": True, "world_id": world.id}
