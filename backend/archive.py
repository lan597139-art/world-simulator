"""全局归档：旧世界、亡故/退场人物、旧章节封存，不参与当前推演。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()

ARCHIVE_TYPES = {"world", "character", "story"}


def _get_row(db: Session, entity_type: str, entity_id: str):
    model = {
        "world": models.World,
        "character": models.Character,
        "story": models.Story,
    }.get(entity_type)
    if not model:
        raise HTTPException(status_code=422, detail="不支持归档该类型")
    row = db.query(model).filter(model.id == entity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="对象不存在")
    return row


@router.get("/api/archive")
def list_archive(world_id: str = "", db: Session = Depends(get_db)):
    worlds = db.query(models.World).filter(
        models.World.archived_at.is_not(None), models.World.deleted_at.is_(None)
    )
    characters = db.query(models.Character).filter(models.Character.archived_at.is_not(None))
    stories = db.query(models.Story).filter(models.Story.archived_at.is_not(None))
    if world_id:
        characters = characters.filter(models.Character.world_id == world_id)
        stories = stories.filter(models.Story.world_id == world_id)
    world_names = {row.id: row.name for row in db.query(models.World).all()}

    def char_item(row):
        return {
            "id": row.id,
            "name": row.name,
            "world_id": row.world_id,
            "world_name": world_names.get(row.world_id, ""),
            "archived_at": row.archived_at,
        }

    def story_item(row):
        return {
            "id": row.id,
            "title": row.title,
            "world_id": row.world_id,
            "world_name": world_names.get(row.world_id, ""),
            "archived_at": row.archived_at,
            "word_count": row.word_count,
        }

    return {
        "worlds": [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "archived_at": row.archived_at,
                "is_official": row.is_official,
            }
            for row in worlds.order_by(models.World.archived_at.desc()).all()
        ],
        "characters": [char_item(row) for row in characters.order_by(models.Character.archived_at.desc()).all()],
        "stories": [story_item(row) for row in stories.order_by(models.Story.archived_at.desc()).all()],
    }


@router.post("/api/archive/{entity_type}/{entity_id}")
def archive_entity(entity_type: str, entity_id: str, db: Session = Depends(get_db)):
    if entity_type not in ARCHIVE_TYPES:
        raise HTTPException(status_code=422, detail="不支持归档该类型")
    row = _get_row(db, entity_type, entity_id)
    if entity_type == "world" and row.is_official:
        raise HTTPException(status_code=409, detail="官方演示世界已锁定，不能归档")
    row.archived_at = datetime.utcnow()
    db.commit()
    return {"status": "ok", "archived": True}


@router.post("/api/archive/{entity_type}/{entity_id}/restore")
def restore_archived(entity_type: str, entity_id: str, db: Session = Depends(get_db)):
    row = _get_row(db, entity_type, entity_id)
    row.archived_at = None
    db.commit()
    return {"status": "ok", "archived": False}
