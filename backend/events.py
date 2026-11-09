from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

import models
from event_links import sync_event_entities
from database import get_db

router = APIRouter()


def _normalize_datetimes(data: dict) -> dict:
    """前端传的是 ISO 字符串，SQLite DateTime 列只接受 datetime 对象。"""
    for key in ("occurred_at", "ended_at"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            try:
                data[key] = datetime.fromisoformat(value.strip().replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                data.pop(key)
        elif value == "":
            data.pop(key)
    return data


@router.post("/api/events")
def create_event(event_data: dict, db: Session = Depends(get_db)):
    new_event = models.Event(**_normalize_datetimes(dict(event_data)))
    db.add(new_event)
    db.flush()
    sync_event_entities(db, new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


# 支持按 world_id 过滤
@router.get("/api/events")
def list_events(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Event)
    if world_id is not None:
        query = query.filter(models.Event.world_id == world_id)
    return query.order_by(models.Event.created_at.desc()).all()


@router.get("/api/events/unprocessed")
def get_unprocessed_events(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Event)
    if world_id:
        query = query.filter(models.Event.world_id == world_id)
    events = query.all()
    simulated_event_ids = [r.event_id for r in db.query(models.SimulationRun).all()]
    unprocessed = [e for e in events if e.id not in simulated_event_ids]
    unprocessed.sort(key=lambda x: x.created_at)
    return unprocessed


@router.get("/api/events/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/api/events/{event_id}")
@router.patch("/api/events/{event_id}")
def update_event(event_id: str, event_data: dict, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for key, value in _normalize_datetimes(dict(event_data)).items():
        if hasattr(event, key):
            setattr(event, key, value)

    sync_event_entities(db, event)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/api/events/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.query(models.EventEntity).filter(models.EventEntity.event_id == event.id).delete()
    db.delete(event)
    db.commit()
    return {"status": "ok", "message": "Event deleted"}
