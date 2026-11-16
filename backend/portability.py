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
    threads = db.query(models.StoryThread).filter(models.StoryThread.story_id.in_([s.id for s in stories])).all() if stories else []
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
        "story_threads": [_dump(row) for row in threads],
        "story_thread_events": [_dump(row) for row in links],
        "counts": {
            "characters": len(characters),
            "events": len(events),
            "relationships": len(relationships),
            "locations": len(locations),
            "organizations": len(organizations),
            "stories": len(stories),
        },
    }
    return payload
