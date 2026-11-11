"""故事线人物线 / DAG 关系（J2）。"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["story-threads"])

KINDS = {"main", "side", "copy", "shadow", "ensemble"}


def _fail(code, message):
    raise HTTPException(status_code=code, detail=message)


def _story(db, story_id):
    row = db.query(models.StoryProject).filter(models.StoryProject.id == story_id).first()
    if not row:
        _fail(404, "故事不存在")
    return row


def _thread(db, thread_id):
    row = db.query(models.StoryThread).filter(models.StoryThread.id == thread_id).first()
    if not row:
        _fail(404, "人物线不存在")
    return row


def _thread_row(db, row):
    events = (
        db.query(models.StoryThreadEvent)
        .filter(models.StoryThreadEvent.thread_id == row.id)
        .order_by(models.StoryThreadEvent.order_index.asc(), models.StoryThreadEvent.created_at.asc())
        .all()
    )
    char = db.query(models.Character).filter(models.Character.id == row.character_id).first() if row.character_id else None
    return {
        "id": row.id,
        "story_id": row.story_id,
        "character_id": row.character_id,
        "character_name": char.name if char else "",
        "parent_thread_id": row.parent_thread_id,
        "kind": row.kind,
        "title": row.title,
        "order_index": row.order_index or 0,
        "status": row.status,
        "events": [
            {
                "id": link.id,
                "event_id": link.event_id,
                "event_name": (db.query(models.Event).filter(models.Event.id == link.event_id).first().name
                               if db.query(models.Event).filter(models.Event.id == link.event_id).first() else ""),
                "order_index": link.order_index or 0,
                "role": link.role or "",
            }
            for link in events
        ],
    }


def _edge_row(db, row):
    return {
        "id": row.id,
        "from_thread_id": row.from_thread_id,
        "from_event_id": row.from_event_id,
        "to_thread_id": row.to_thread_id,
        "to_event_id": row.to_event_id,
        "edge_type": row.edge_type,
        "note": row.note or "",
    }


@router.get("/api/stories/{story_id}/threads")
def list_threads(story_id: str, db: Session = Depends(get_db)):
    _story(db, story_id)
    rows = (
        db.query(models.StoryThread)
        .filter(models.StoryThread.story_id == story_id)
        .order_by(models.StoryThread.order_index.asc(), models.StoryThread.created_at.asc())
        .all()
    )
    return [_thread_row(db, row) for row in rows]


@router.post("/api/stories/{story_id}/threads")
def create_thread(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _story(db, story_id)
    title = str(payload.get("title") or "").strip()[:200]
    if not title:
        _fail(422, "缺少人物线标题")
    kind = str(payload.get("kind") or "main")
    if kind not in KINDS:
        _fail(422, "人物线类型不合法")
    character_id = str(payload.get("character_id") or "").strip() or None
    if character_id:
        char = db.query(models.Character).filter(models.Character.id == character_id).first()
        if not char or char.world_id != story.world_id:
            _fail(409, "人物不在该世界")
    parent_id = str(payload.get("parent_thread_id") or "").strip() or None
    if parent_id:
        parent = _thread(db, parent_id)
        if parent.story_id != story.id:
            _fail(409, "父人物线不属于该故事")
    count = db.query(models.StoryThread).filter(models.StoryThread.story_id == story.id).count()
    row = models.StoryThread(
        story_id=story.id,
        world_id=story.world_id,
        character_id=character_id,
        parent_thread_id=parent_id,
        kind=kind,
        title=title,
        order_index=int(payload.get("order_index") or count),
        meta={"note": str(payload.get("note") or "")[:500]},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _thread_row(db, row)


@router.patch("/api/story-threads/{thread_id}")
def update_thread(thread_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _thread(db, thread_id)
    if "title" in payload:
        title = str(payload.get("title") or "").strip()[:200]
        if not title:
            _fail(422, "标题不能为空")
        row.title = title
    if "kind" in payload:
        kind = str(payload.get("kind") or "")
        if kind not in KINDS:
            _fail(422, "人物线类型不合法")
        row.kind = kind
    if "status" in payload:
        row.status = str(payload.get("status") or "active")[:20]
    db.commit()
    db.refresh(row)
    return _thread_row(db, row)


@router.delete("/api/story-threads/{thread_id}")
def delete_thread(thread_id: str, db: Session = Depends(get_db)):
    row = _thread(db, thread_id)
    children = db.query(models.StoryThread).filter(models.StoryThread.parent_thread_id == row.id).all()
    for child in children:
        child.parent_thread_id = None
    db.query(models.StoryThreadEvent).filter(models.StoryThreadEvent.thread_id == row.id).delete(
        synchronize_session=False
    )
    db.query(models.StoryThreadEdge).filter(
        (models.StoryThreadEdge.from_thread_id == row.id) | (models.StoryThreadEdge.to_thread_id == row.id)
    ).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"status": "removed"}


@router.post("/api/story-threads/{thread_id}/events")
def attach_event(thread_id: str, payload: dict, db: Session = Depends(get_db)):
    thread = _thread(db, thread_id)
    event_id = str(payload.get("event_id") or "").strip()
    if not event_id:
        _fail(422, "缺少 event_id")
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event or event.world_id != thread.world_id:
        _fail(409, "事件不在该世界")
    existing = (
        db.query(models.StoryThreadEvent)
        .filter(models.StoryThreadEvent.thread_id == thread.id, models.StoryThreadEvent.event_id == event.id)
        .first()
    )
    if existing:
        _fail(409, "事件已在这条人物线中")
    count = db.query(models.StoryThreadEvent).filter(models.StoryThreadEvent.thread_id == thread.id).count()
    link = models.StoryThreadEvent(
        world_id=thread.world_id,
        thread_id=thread.id,
        event_id=event.id,
        order_index=int(payload.get("order_index") or count),
        role=str(payload.get("role") or "")[:50],
        note=str(payload.get("note") or "")[:500],
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _thread_row(db, thread)


@router.delete("/api/story-thread-events/{link_id}")
def detach_event(link_id: str, db: Session = Depends(get_db)):
    link = db.query(models.StoryThreadEvent).filter(models.StoryThreadEvent.id == link_id).first()
    if not link:
        _fail(404, "关联不存在")
    db.delete(link)
    db.commit()
    return {"status": "removed"}


@router.get("/api/stories/{story_id}/thread-edges")
def list_edges(story_id: str, db: Session = Depends(get_db)):
    _story(db, story_id)
    rows = (
        db.query(models.StoryThreadEdge)
        .filter(models.StoryThreadEdge.story_id == story_id)
        .order_by(models.StoryThreadEdge.created_at.asc())
        .all()
    )
    return [_edge_row(db, row) for row in rows]


@router.post("/api/stories/{story_id}/thread-edges")
def create_edge(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _story(db, story_id)
    from_id = str(payload.get("from_thread_id") or "").strip()
    to_id = str(payload.get("to_thread_id") or "").strip()
    if not from_id or not to_id:
        _fail(422, "缺少起点/终点人物线")
    if from_id == to_id:
        _fail(422, "同一人物线不能连边")
    for thread_id in (from_id, to_id):
        row = _thread(db, thread_id)
        if row.story_id != story.id:
            _fail(409, "人物线不属于该故事")
    edge_type = str(payload.get("edge_type") or "impact")
    if edge_type not in {"converge", "impact", "fork"}:
        _fail(422, "关系类型不合法")
    row = models.StoryThreadEdge(
        story_id=story.id,
        world_id=story.world_id,
        from_thread_id=from_id,
        from_event_id=str(payload.get("from_event_id") or "").strip() or None,
        to_thread_id=to_id,
        to_event_id=str(payload.get("to_event_id") or "").strip() or None,
        edge_type=edge_type,
        note=str(payload.get("note") or "")[:500],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _edge_row(db, row)


@router.delete("/api/story-thread-edges/{edge_id}")
def delete_edge(edge_id: str, db: Session = Depends(get_db)):
    row = db.query(models.StoryThreadEdge).filter(models.StoryThreadEdge.id == edge_id).first()
    if not row:
        _fail(404, "关系不存在")
    db.delete(row)
    db.commit()
    return {"status": "removed"}
