"""日记（K2）：独立于世界，带来源标签。"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import product_config as pc
from database import get_db

router = APIRouter(tags=["diary"])

SOURCES = {
    "user", "chat", "event", "branch", "import", "ai_draft",
    "self_memory", "other_account", "evidence", "ai_inference",
}


def _fail(code, message):
    raise HTTPException(status_code=code, detail=message)


def _row(row: models.DiaryEntry) -> dict:
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "world_id": row.world_id,
        "character_id": row.character_id,
        "entry_date": row.entry_date,
        "title": row.title or "",
        "content": row.content,
        "mood": row.mood or "",
        "tags": row.tags or [],
        "source_type": row.source_type,
        "source_ref": row.source_ref or {},
        "product_key": row.product_key or "diary",
        "visibility": row.visibility,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/api/diary/entries")
def list_entries(world_id: str = "", source_type: str = "", product: str = "diary", limit: int = 200,
                 db: Session = Depends(get_db)):
    try:
        pc.require_module(product, "diary")
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    query = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.owner_user_id == "local",
        models.DiaryEntry.product_key == product,
    )
    if world_id:
        query = query.filter(models.DiaryEntry.world_id == world_id)
    if source_type:
        query = query.filter(models.DiaryEntry.source_type == source_type)
    rows = query.order_by(models.DiaryEntry.entry_date.desc(), models.DiaryEntry.created_at.desc()).limit(
        max(1, min(limit, 500))
    ).all()
    return [_row(row) for row in rows]


@router.post("/api/diary/entries")
def create_entry(payload: dict, db: Session = Depends(get_db)):
    product = str(payload.get("product_key") or "diary").strip().lower()
    try:
        pc.require_module(product, "diary")
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    content = str(payload.get("content") or "").strip()
    if not content:
        _fail(422, "日记内容不能为空")
    source = str(payload.get("source_type") or "user")
    if source not in SOURCES:
        _fail(422, "来源类型不合法")
    world_id = str(payload.get("world_id") or "").strip() or None
    if world_id:
        world = db.query(models.World).filter(models.World.id == world_id, models.World.deleted_at.is_(None)).first()
        if not world:
            _fail(409, "关联世界不存在")
    character_id = str(payload.get("character_id") or "").strip() or None
    if character_id:
        char = db.query(models.Character).filter(models.Character.id == character_id).first()
        if not char or (world_id and char.world_id != world_id):
            _fail(409, "关联人物不在该世界")
    entry_date = str(payload.get("entry_date") or date.today().isoformat())[:10]
    try:
        date.fromisoformat(entry_date)
    except ValueError:
        _fail(422, "entry_date 必须是 YYYY-MM-DD")
    row = models.DiaryEntry(
        owner_user_id="local",
        world_id=world_id,
        character_id=character_id,
        entry_date=entry_date,
        title=str(payload.get("title") or "")[:200],
        content=content[:20000],
        mood=str(payload.get("mood") or "")[:50],
        tags=[str(tag)[:30] for tag in (payload.get("tags") or [])][:20] if isinstance(payload.get("tags"), list) else [],
        source_type=source,
        source_ref=payload.get("source_ref") if isinstance(payload.get("source_ref"), dict) else {},
        visibility="private",
        product_key=product,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row(row)


@router.patch("/api/diary/entries/{entry_id}")
def update_entry(entry_id: str, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id, models.DiaryEntry.owner_user_id == "local"
    ).first()
    if not row:
        _fail(404, "日记不存在")
    if "content" in payload:
        content = str(payload.get("content") or "").strip()
        if not content:
            _fail(422, "日记内容不能为空")
        row.content = content[:20000]
    if "title" in payload:
        row.title = str(payload.get("title") or "")[:200]
    if "mood" in payload:
        row.mood = str(payload.get("mood") or "")[:50]
    if "entry_date" in payload:
        value = str(payload.get("entry_date") or "")[:10]
        try:
            date.fromisoformat(value)
        except ValueError:
            _fail(422, "entry_date 必须是 YYYY-MM-DD")
        row.entry_date = value
    if "tags" in payload and isinstance(payload.get("tags"), list):
        row.tags = [str(tag)[:30] for tag in payload["tags"]][:20]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row)


@router.delete("/api/diary/entries/{entry_id}")
def delete_entry(entry_id: str, db: Session = Depends(get_db)):
    row = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id, models.DiaryEntry.owner_user_id == "local"
    ).first()
    if not row:
        _fail(404, "日记不存在")
    db.delete(row)
    db.commit()
    return {"status": "removed"}
