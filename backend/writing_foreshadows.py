"""写作伏笔：独立的写作债务，不进入 05 事件或 07 推演。"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

import models
from auth import current_user
from common import fail, get_world
from database import get_db

router = APIRouter()

VALID_STATUS = {"pending", "planted", "paid", "abandoned"}
VALID_PAYOFF = {"信息", "情绪", "危机"}


def _now() -> datetime:
    return datetime.utcnow()


def _foreshadow_or_404(db: Session, foreshadow_id: str, user_id: str) -> models.WritingForeshadow:
    row = db.query(models.WritingForeshadow).filter(models.WritingForeshadow.id == foreshadow_id).first()
    if not row or (row.owner_user_id and row.owner_user_id != user_id):
        fail(404, "NOT_FOUND", "伏笔不存在")
    return row


def _story_or_404(db: Session, story_id: str, user_id: str) -> models.Story:
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story or (story.owner_user_id and story.owner_user_id != user_id):
        fail(404, "NOT_FOUND", "章节不存在")
    return story


def _foreshadow_dict(db: Session, row: models.WritingForeshadow) -> dict:
    story = db.query(models.Story).filter(models.Story.id == row.story_id).first() if row.story_id else None
    planned = db.query(models.Story).filter(models.Story.id == row.planned_story_id).first() if row.planned_story_id else None
    resolved = db.query(models.Story).filter(models.Story.id == row.resolved_story_id).first() if row.resolved_story_id else None
    return {
        "id": row.id,
        "world_id": row.world_id,
        "story_id": row.story_id,
        "story_title": story.title if story else "",
        "event_id": row.event_id,
        "text": row.text or "",
        "promise": row.promise or "",
        "cost": row.cost or "",
        "planned_story_id": row.planned_story_id,
        "planned_story_title": planned.title if planned else "",
        "resolved_story_id": row.resolved_story_id,
        "resolved_story_title": resolved.title if resolved else "",
        "payoff_form": row.payoff_form or "信息",
        "status": row.status or "pending",
        "tags": row.tags or [],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/api/worlds/{world_id}/writing-foreshadows")
def list_foreshadows(world_id: str, request: Request, status: str = "all", db: Session = Depends(get_db)):
    user = current_user(request, db)
    get_world(db, world_id)
    query = db.query(models.WritingForeshadow).filter(
        models.WritingForeshadow.world_id == world_id,
        models.WritingForeshadow.owner_user_id == user.id,
    )
    if status != "all":
        query = query.filter(models.WritingForeshadow.status == status)
    rows = query.order_by(models.WritingForeshadow.created_at.desc()).all()
    return [_foreshadow_dict(db, row) for row in rows]


@router.get("/api/writings/{story_id}/foreshadows")
def list_story_foreshadows(story_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    story = _story_or_404(db, story_id, user.id)
    rows = (
        db.query(models.WritingForeshadow)
        .filter(
            models.WritingForeshadow.story_id == story.id,
            models.WritingForeshadow.owner_user_id == user.id,
        )
        .order_by(models.WritingForeshadow.created_at.desc())
        .all()
    )
    return [_foreshadow_dict(db, row) for row in rows]


@router.post("/api/writings/{story_id}/foreshadows")
def create_foreshadow(story_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    story = _story_or_404(db, story_id, user.id)
    if not story.world_id:
        fail(422, "NO_WORLD", "章节未绑定世界，无法创建伏笔")
    text = str(payload.get("text") or "").strip()
    if not text:
        fail(422, "VALIDATION_ERROR", "请先选中要标记的伏笔文字")
    planned_id = str(payload.get("planned_story_id") or "").strip() or None
    if planned_id:
        planned = _story_or_404(db, planned_id, user.id)
        if planned.world_id != story.world_id:
            fail(422, "WORLD_MISMATCH", "计划回收章节与伏笔不属于同一世界")
    payoff_form = str(payload.get("payoff_form") or "信息")
    if payoff_form not in VALID_PAYOFF:
        payoff_form = "信息"
    row = models.WritingForeshadow(
        world_id=story.world_id,
        owner_user_id=user.id,
        story_id=story.id,
        event_id=str(payload.get("event_id") or "").strip() or None,
        text=text[:4000],
        promise=str(payload.get("promise") or "")[:2000],
        cost=str(payload.get("cost") or "")[:2000],
        planned_story_id=planned_id,
        payoff_form=payoff_form,
        status="pending",
        tags=[str(tag) for tag in (payload.get("tags") or []) if str(tag).strip()][:20],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _foreshadow_dict(db, row)


@router.patch("/api/writing-foreshadows/{foreshadow_id}")
def update_foreshadow(foreshadow_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _foreshadow_or_404(db, foreshadow_id, user.id)
    if "text" in payload:
        row.text = str(payload.get("text") or "")[:4000]
    if "promise" in payload:
        row.promise = str(payload.get("promise") or "")[:2000]
    if "cost" in payload:
        row.cost = str(payload.get("cost") or "")[:2000]
    if "payoff_form" in payload:
        value = str(payload.get("payoff_form") or "")
        if value in VALID_PAYOFF:
            row.payoff_form = value
    if "status" in payload:
        value = str(payload.get("status") or "")
        if value in VALID_STATUS:
            row.status = value
    if "planned_story_id" in payload:
        value = str(payload.get("planned_story_id") or "").strip() or None
        if value:
            planned = _story_or_404(db, value, user.id)
            if planned.world_id != row.world_id:
                fail(422, "WORLD_MISMATCH", "计划回收章节与伏笔不属于同一世界")
        row.planned_story_id = value
    if "resolved_story_id" in payload:
        value = str(payload.get("resolved_story_id") or "").strip() or None
        if value:
            resolved = _story_or_404(db, value, user.id)
            if resolved.world_id != row.world_id:
                fail(422, "WORLD_MISMATCH", "回收章节与伏笔不属于同一世界")
        row.resolved_story_id = value
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _foreshadow_dict(db, row)


@router.post("/api/writing-foreshadows/{foreshadow_id}/resolve")
def resolve_foreshadow(foreshadow_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _foreshadow_or_404(db, foreshadow_id, user.id)
    story_id = str(payload.get("story_id") or row.story_id or "").strip()
    if story_id:
        story = _story_or_404(db, story_id, user.id)
        if story.world_id != row.world_id:
            fail(422, "WORLD_MISMATCH", "回收章节与伏笔不属于同一世界")
        row.resolved_story_id = story_id
    row.status = "paid"
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _foreshadow_dict(db, row)


@router.delete("/api/writing-foreshadows/{foreshadow_id}")
def delete_foreshadow(foreshadow_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _foreshadow_or_404(db, foreshadow_id, user.id)
    db.delete(row)
    db.commit()
    return {"status": "ok", "deleted": True}
