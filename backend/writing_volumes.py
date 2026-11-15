"""写作目录：卷、章节排序与卷章树。"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

import models
from auth import current_user
from common import fail, get_world
from database import get_db

router = APIRouter()

VALID_ACTS = {"setup", "develop", "turn", "climax"}


def _now() -> datetime:
    return datetime.utcnow()


def _volume_or_404(db: Session, volume_id: str, user_id: str) -> models.StoryVolume:
    volume = db.query(models.StoryVolume).filter(models.StoryVolume.id == volume_id).first()
    if not volume or (volume.owner_user_id and volume.owner_user_id != user_id):
        fail(404, "NOT_FOUND", "卷不存在")
    return volume


def _volume_dict(volume: models.StoryVolume, chapters: list[models.Story]) -> dict:
    words = sum(int(story.word_count or 0) for story in chapters)
    return {
        "id": volume.id,
        "world_id": volume.world_id,
        "title": volume.title,
        "summary": volume.summary or "",
        "act": volume.act or "setup",
        "outline_goal": volume.outline_goal or "",
        "target_words": int(volume.target_words or 0),
        "sort_order": int(volume.sort_order or 0),
        "word_count": words,
        "chapter_count": len(chapters),
        "created_at": volume.created_at,
        "updated_at": volume.updated_at,
    }


def _chapter_dict(story: models.Story) -> dict:
    return {
        "id": story.id,
        "title": story.title,
        "volume_id": story.volume_id,
        "sort_order": int(story.sort_order or 0),
        "word_count": int(story.word_count or 0),
        "status": story.status,
        "mode": story.mode,
        "summary": story.summary or "",
        "outline_goal": story.outline_goal or "",
        "target_words": int(story.target_words or 0),
        "updated_at": story.updated_at,
        "created_at": story.created_at,
    }


@router.get("/api/worlds/{world_id}/writing-tree")
def writing_tree(world_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    get_world(db, world_id)
    volumes = (
        db.query(models.StoryVolume)
        .filter(models.StoryVolume.world_id == world_id, models.StoryVolume.owner_user_id == user.id)
        .order_by(models.StoryVolume.sort_order.asc(), models.StoryVolume.created_at.asc())
        .all()
    )
    chapters = (
        db.query(models.Story)
        .filter(
            models.Story.world_id == world_id,
            models.Story.owner_user_id == user.id,
            models.Story.archived_at.is_(None),
        )
        .order_by(models.Story.sort_order.asc(), models.Story.created_at.asc())
        .all()
    )
    by_volume: dict[str, list[models.Story]] = {}
    for story in chapters:
        by_volume.setdefault(story.volume_id or "", []).append(story)
    return {
        "volumes": [_volume_dict(volume, by_volume.get(volume.id, [])) for volume in volumes],
        "chapters": [_chapter_dict(story) for story in chapters],
    }


@router.post("/api/worlds/{world_id}/writing-volumes")
def create_volume(world_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    get_world(db, world_id)
    title = str(payload.get("title") or "未命名卷").strip()[:120] or "未命名卷"
    act = str(payload.get("act") or "setup")
    if act not in VALID_ACTS:
        act = "setup"
    max_order = (
        db.query(models.StoryVolume.sort_order)
        .filter(models.StoryVolume.world_id == world_id, models.StoryVolume.owner_user_id == user.id)
        .order_by(models.StoryVolume.sort_order.desc())
        .first()
    )
    volume = models.StoryVolume(
        world_id=world_id,
        owner_user_id=user.id,
        title=title,
        summary=str(payload.get("summary") or "")[:2000],
        act=act,
        outline_goal=str(payload.get("outline_goal") or "")[:2000],
        target_words=max(0, int(payload.get("target_words") or 0)),
        sort_order=(max_order[0] + 1) if max_order else 0,
    )
    db.add(volume)
    db.commit()
    db.refresh(volume)
    return _volume_dict(volume, [])


@router.patch("/api/writing-volumes/{volume_id}")
def update_volume(volume_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    volume = _volume_or_404(db, volume_id, user.id)
    for key in {"title", "summary", "act", "outline_goal"}:
        if key not in payload:
            continue
        value = str(payload.get(key) or "")
        if key == "act" and value not in VALID_ACTS:
            continue
        if key == "title":
            value = value.strip()[:120] or volume.title
        setattr(volume, key, value[:2000] if key != "title" else value)
    if "target_words" in payload:
        volume.target_words = max(0, int(payload.get("target_words") or 0))
    if "sort_order" in payload:
        volume.sort_order = max(0, int(payload.get("sort_order") or 0))
    volume.updated_at = _now()
    db.commit()
    db.refresh(volume)
    chapters = db.query(models.Story).filter(models.Story.volume_id == volume.id).all()
    return _volume_dict(volume, chapters)


@router.delete("/api/writing-volumes/{volume_id}")
def delete_volume(volume_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    volume = _volume_or_404(db, volume_id, user.id)
    db.query(models.Story).filter(models.Story.volume_id == volume.id).update(
        {models.Story.volume_id: None}, synchronize_session=False
    )
    db.delete(volume)
    db.commit()
    return {"status": "ok", "deleted": True}


@router.post("/api/writing-volumes/reorder")
def reorder_volumes(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    ids = [str(value) for value in (payload.get("ids") or []) if value]
    volumes = (
        db.query(models.StoryVolume)
        .filter(models.StoryVolume.id.in_(ids), models.StoryVolume.owner_user_id == user.id)
        .all()
    )
    by_id = {volume.id: volume for volume in volumes}
    for index, volume_id in enumerate(ids):
        volume = by_id.get(volume_id)
        if volume:
            volume.sort_order = index
            volume.updated_at = _now()
    db.commit()
    return {"status": "ok", "count": len(by_id)}


@router.patch("/api/writings/{story_id}/move")
def move_chapter(story_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story or (story.owner_user_id and story.owner_user_id != user.id):
        fail(404, "NOT_FOUND", "章节不存在")
    volume_id = str(payload.get("volume_id") or "").strip() or None
    if volume_id:
        volume = _volume_or_404(db, volume_id, user.id)
        if volume.world_id != story.world_id:
            fail(422, "WORLD_MISMATCH", "卷与章节不属于同一世界")
    story.volume_id = volume_id
    story.sort_order = max(0, int(payload.get("sort_order") or 0))
    story.updated_at = _now()
    db.commit()
    db.refresh(story)
    return _chapter_dict(story)


@router.post("/api/writings/reorder")
def reorder_chapters(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    volume_id = str(payload.get("volume_id") or "").strip() or None
    ids = [str(value) for value in (payload.get("story_ids") or []) if value]
    stories = (
        db.query(models.Story)
        .filter(models.Story.id.in_(ids), models.Story.owner_user_id == user.id)
        .all()
    )
    by_id = {story.id: story for story in stories}
    for index, story_id in enumerate(ids):
        story = by_id.get(story_id)
        if story:
            story.volume_id = volume_id
            story.sort_order = index
            story.updated_at = _now()
    db.commit()
    return {"status": "ok", "count": len(by_id)}
