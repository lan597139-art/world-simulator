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
    data = _normalize_datetimes(dict(event_data))
    branch_id = data.get("branch_id")
    if branch_id:
        branch = db.query(models.SimulationBranch).filter(
            models.SimulationBranch.id == str(branch_id)
        ).first()
        if not branch:
            raise HTTPException(status_code=422, detail="分支不存在")
        if data.get("world_id") and data.get("world_id") != branch.world_id:
            raise HTTPException(status_code=409, detail="事件世界与分支世界不一致")
        data["world_id"] = branch.world_id
    new_event = models.Event(**data)
    db.add(new_event)
    db.flush()
    sync_event_entities(db, new_event)
    db.commit()
    db.refresh(new_event)
    return new_event


# 支持按 world_id 过滤
@router.get("/api/events")
def list_events(
    world_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Event)
    if world_id is not None:
        query = query.filter(models.Event.world_id == world_id)
    if branch_id:
        # 分支视图：主时间线事件 + 该分支专属事件
        query = query.filter(
            (models.Event.branch_id == branch_id) | (models.Event.branch_id.is_(None))
        )
    else:
        query = query.filter(models.Event.branch_id.is_(None))
    return query.order_by(models.Event.created_at.desc()).all()


@router.get("/api/events/unprocessed")
def get_unprocessed_events(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Event).filter(models.Event.branch_id.is_(None))
    if world_id:
        query = query.filter(models.Event.world_id == world_id)
    events = query.all()
    simulated_event_ids = [
        r.event_id
        for r in db.query(models.SimulationRun).filter(models.SimulationRun.branch_id.is_(None)).all()
    ]
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
    choice_ids = [
        row[0] for row in db.query(models.EventChoice.id).filter(models.EventChoice.event_id == event.id).all()
    ]
    if choice_ids:
        db.query(models.EventChoiceOption).filter(
            models.EventChoiceOption.choice_id.in_(choice_ids)
        ).delete(synchronize_session=False)
        db.query(models.EventChoice).filter(models.EventChoice.id.in_(choice_ids)).delete(
            synchronize_session=False
        )
    # 树节点只引用事件：删事件时保留结构位置，退化为可重新填充的待填充位。
    db.query(models.StoryTreeNode).filter(models.StoryTreeNode.event_id == event.id).update(
        {models.StoryTreeNode.event_id: None, models.StoryTreeNode.node_status: "pending"},
        synchronize_session=False,
    )
    db.query(models.EventSandboxScenario).filter(
        models.EventSandboxScenario.event_id == event.id
    ).delete(synchronize_session=False)
    db.query(models.AxisObject).filter(models.AxisObject.event_id == event.id).delete(
        synchronize_session=False
    )
    db.delete(event)
    db.commit()
    return {"status": "ok", "message": "Event deleted"}
