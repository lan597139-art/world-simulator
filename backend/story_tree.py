"""真实故事树：树干=主线，树枝=支线/副本/暗线/人物线，树叶=事件或待填充位置。

树节点只引用 events，不复制事件；旧 story_thread_events / story_thread_edges 保留。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()


def _story(db: Session, story_id: str) -> models.StoryProject:
    row = db.query(models.StoryProject).filter(models.StoryProject.id == story_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="故事不存在")
    return row


def _thread(db: Session, thread_id: str) -> models.StoryThread:
    row = db.query(models.StoryThread).filter(models.StoryThread.id == thread_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="故事线不存在")
    return row


def _node(db: Session, node_id: str) -> models.StoryTreeNode:
    row = db.query(models.StoryTreeNode).filter(models.StoryTreeNode.id == node_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="故事树节点不存在")
    return row


def _node_row(db: Session, row: models.StoryTreeNode) -> dict:
    event = db.query(models.Event).filter(models.Event.id == row.event_id).first() if row.event_id else None
    return {
        "id": row.id,
        "story_id": row.story_id,
        "thread_id": row.thread_id,
        "parent_node_id": row.parent_node_id,
        "event_id": row.event_id,
        "event_name": event.name if event else "",
        "event_description": (event.description or "") if event else "",
        "event_polarity": event.polarity if event else "",
        "event_storyline": event.storyline if event else "",
        "title": row.title or (event.name if event else "待填充事件"),
        "node_status": row.node_status or ("filled" if row.event_id else "pending"),
        "order_index": row.order_index or 0,
        "collapsed": bool(row.collapsed),
        "note": row.note or "",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _branch_row(db: Session, row: models.StoryThread) -> dict:
    character = db.query(models.Character).filter(models.Character.id == row.character_id).first() if row.character_id else None
    return {
        "id": row.id,
        "story_id": row.story_id,
        "title": row.title,
        "kind": row.kind,
        "character_id": row.character_id,
        "character_name": character.name if character else "",
        "parent_thread_id": row.parent_thread_id,
        "order_index": row.order_index or 0,
        "meta": row.meta or {},
    }


def _bootstrap(db: Session, story: models.StoryProject) -> int:
    """旧 story_thread_events 没有树节点时，一次性转成树节点；幂等。"""
    created = 0
    threads = db.query(models.StoryThread).filter(models.StoryThread.story_id == story.id).all()
    for thread in threads:
        links = (
            db.query(models.StoryThreadEvent)
            .filter(models.StoryThreadEvent.thread_id == thread.id)
            .order_by(models.StoryThreadEvent.order_index.asc(), models.StoryThreadEvent.created_at.asc())
            .all()
        )
        for index, link in enumerate(links):
            exists = (
                db.query(models.StoryTreeNode)
                .filter(models.StoryTreeNode.thread_id == thread.id, models.StoryTreeNode.event_id == link.event_id)
                .first()
            )
            if exists:
                continue
            event = db.query(models.Event).filter(models.Event.id == link.event_id).first()
            db.add(models.StoryTreeNode(
                world_id=story.world_id,
                story_id=story.id,
                thread_id=thread.id,
                event_id=link.event_id,
                title=event.name if event else "事件",
                node_status="filled",
                order_index=index,
            ))
            created += 1
    if created:
        db.commit()
    return created


@router.get("/api/stories/{story_id}/tree")
def get_tree(story_id: str, db: Session = Depends(get_db)):
    story = _story(db, story_id)
    _bootstrap(db, story)
    threads = (
        db.query(models.StoryThread)
        .filter(models.StoryThread.story_id == story.id)
        .order_by(models.StoryThread.order_index.asc(), models.StoryThread.created_at.asc())
        .all()
    )
    nodes = (
        db.query(models.StoryTreeNode)
        .filter(models.StoryTreeNode.story_id == story.id)
        .order_by(models.StoryTreeNode.order_index.asc(), models.StoryTreeNode.created_at.asc())
        .all()
    )
    edges = (
        db.query(models.StoryThreadEdge)
        .filter(models.StoryThreadEdge.story_id == story.id)
        .order_by(models.StoryThreadEdge.created_at.asc())
        .all()
    )
    return {
        "story": {"id": story.id, "title": story.title, "world_id": story.world_id},
        "branches": [_branch_row(db, row) for row in threads],
        "nodes": [_node_row(db, row) for row in nodes],
        "edges": [
            {
                "id": edge.id, "from_thread_id": edge.from_thread_id, "from_event_id": edge.from_event_id,
                "to_thread_id": edge.to_thread_id, "to_event_id": edge.to_event_id,
                "edge_type": edge.edge_type, "note": edge.note or "",
            }
            for edge in edges
        ],
        "counts": {
            "branches": len(threads),
            "filled": sum(1 for node in nodes if node.event_id),
            "pending": sum(1 for node in nodes if not node.event_id),
        },
    }


@router.post("/api/stories/{story_id}/tree/bootstrap")
def bootstrap_tree(story_id: str, db: Session = Depends(get_db)):
    story = _story(db, story_id)
    return {"created": _bootstrap(db, story)}


@router.post("/api/stories/{story_id}/tree/nodes")
def create_node(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _story(db, story_id)
    thread_id = str(payload.get("thread_id") or "").strip()
    if not thread_id:
        raise HTTPException(status_code=422, detail="缺少所属树枝")
    thread = _thread(db, thread_id)
    if thread.story_id != story.id:
        raise HTTPException(status_code=409, detail="树枝不属于该故事")

    event_id = str(payload.get("event_id") or "").strip() or None
    if event_id:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event or event.world_id != story.world_id:
            raise HTTPException(status_code=409, detail="事件不在该世界")

    parent_id = str(payload.get("parent_node_id") or "").strip() or None
    if parent_id:
        parent = _node(db, parent_id)
        if parent.story_id != story.id:
            raise HTTPException(status_code=409, detail="父节点不属于该故事")
        if parent.thread_id != thread.id:
            raise HTTPException(status_code=409, detail="父节点不在同一树枝")

    siblings = db.query(models.StoryTreeNode).filter(
        models.StoryTreeNode.thread_id == thread.id,
        models.StoryTreeNode.parent_node_id == parent_id,
    ).count()
    status = "filled" if event_id else str(payload.get("node_status") or "pending")
    if status not in {"filled", "pending", "new"}:
        status = "pending"
    title = str(payload.get("title") or "").strip()[:200]
    if not title and event_id:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        title = event.name if event else "事件"
    row = models.StoryTreeNode(
        world_id=story.world_id,
        story_id=story.id,
        thread_id=thread.id,
        parent_node_id=parent_id,
        event_id=event_id,
        title=title or "待填充事件",
        node_status=status,
        order_index=int(payload.get("order_index") if payload.get("order_index") is not None else siblings),
        note=str(payload.get("note") or "")[:1000],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _node_row(db, row)


@router.patch("/api/story-tree-nodes/{node_id}")
def update_node(node_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _node(db, node_id)
    story = _story(db, row.story_id)
    target_thread_id = row.thread_id
    if "thread_id" in payload:
        target_thread_id = str(payload.get("thread_id") or "").strip()
        thread = _thread(db, target_thread_id)
        if thread.story_id != story.id:
            raise HTTPException(status_code=409, detail="目标树枝不属于该故事")
    if "parent_node_id" in payload:
        parent_id = str(payload.get("parent_node_id") or "").strip() or None
        if parent_id:
            parent = _node(db, parent_id)
            if parent.story_id != story.id or parent.thread_id != target_thread_id:
                raise HTTPException(status_code=409, detail="父节点不在同一树枝")
            cursor = parent
            guard = 0
            while cursor.parent_node_id and guard < 200:
                if cursor.parent_node_id == row.id:
                    raise HTTPException(status_code=422, detail="节点父子关系成环")
                cursor = _node(db, cursor.parent_node_id)
                guard += 1
        row.parent_node_id = parent_id
    row.thread_id = target_thread_id

    if "event_id" in payload:
        event_id = str(payload.get("event_id") or "").strip() or None
        if event_id:
            event = db.query(models.Event).filter(models.Event.id == event_id).first()
            if not event or event.world_id != story.world_id:
                raise HTTPException(status_code=409, detail="事件不在该世界")
            row.event_id = event_id
            row.node_status = "filled"
            row.title = str(payload.get("title") or event.name)[:200]
        else:
            row.event_id = None
            row.node_status = "pending"
    if "node_status" in payload:
        status = str(payload.get("node_status") or "")
        if status in {"filled", "pending", "new"}:
            row.node_status = status
    if "title" in payload:
        row.title = str(payload.get("title") or "")[:200]
    if "note" in payload:
        row.note = str(payload.get("note") or "")[:1000]
    if "collapsed" in payload:
        row.collapsed = bool(payload.get("collapsed"))
    if "order_index" in payload:
        row.order_index = int(payload.get("order_index") or 0)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _node_row(db, row)


@router.delete("/api/story-tree-nodes/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    row = _node(db, node_id)
    children = db.query(models.StoryTreeNode).filter(models.StoryTreeNode.parent_node_id == row.id).count()
    if children:
        raise HTTPException(status_code=409, detail="该节点下还有子节点，请先移动或删除子节点")
    db.delete(row)
    db.commit()
    return {"status": "removed"}
