"""日记 / JournalEntry：独立于世界，按当前用户归属，带类别、敏感度与来源。"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
import product_config as pc
from auth import current_user
from database import get_db

router = APIRouter(tags=["journal"])

SOURCES = {
    "user", "chat", "event", "branch", "import", "ai_draft",
    "self_memory", "other_account", "evidence", "ai_inference",
}
ENTRY_TYPES = {
    "diary": "日记",
    "life_experience": "人生经历",
    "important_event": "重要事件",
    "relationship_note": "关系记录",
    "reflection": "思考与反思",
    "personal_note": "个人备注",
}
INFO_CLASSES = {
    "basic": "基础信息",
    "experience": "经历",
    "relationship": "关系",
    "thought": "思想",
    "event": "事件",
}
SENSITIVITIES = {"normal", "sensitive", "deep"}
STATUSES = {"active", "archived", "deleted"}
TYPE_INFO_CLASS = {
    "diary": "basic",
    "life_experience": "experience",
    "important_event": "event",
    "relationship_note": "relationship",
    "reflection": "thought",
    "personal_note": "basic",
}


def _fail(code: int, message: str):
    raise HTTPException(status_code=code, detail=message)


def _iso(value):
    return value.isoformat() if value else None


def _person_ids(db: Session, entry_id: str) -> list[str]:
    return [
        row.person_id for row in db.query(models.JournalEntryPerson).filter(
            models.JournalEntryPerson.entry_id == entry_id
        ).all()
    ]


def _row(db: Session, row: models.DiaryEntry) -> dict:
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "world_id": row.world_id,
        "character_id": row.character_id,
        "entry_date": row.entry_date,
        "date_end": row.date_end,
        "entry_type": row.entry_type or "diary",
        "entry_type_label": ENTRY_TYPES.get(row.entry_type or "diary", row.entry_type or "diary"),
        "info_class": row.info_class or "basic",
        "sensitivity": row.sensitivity or "normal",
        "status": row.status or "active",
        "title": row.title or "",
        "content": row.content,
        "mood": row.mood or "",
        "tags": row.tags or [],
        "person_ids": _person_ids(db, row.id),
        "source_type": row.source_type,
        "source_ref": row.source_ref or {},
        "product_key": row.product_key or "diary",
        "visibility": row.visibility,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _date(value: str, field: str = "entry_date") -> str:
    raw = str(value or date.today().isoformat())[:10]
    try:
        date.fromisoformat(raw)
    except ValueError:
        _fail(422, f"{field} 必须是 YYYY-MM-DD")
    return raw


def _sync_people(db: Session, owner: str, entry_id: str, person_ids) -> None:
    if not isinstance(person_ids, list):
        return
    ids = []
    for raw in person_ids[:30]:
        value = str(raw or "").strip()
        if value and value not in ids:
            ids.append(value)
    if ids:
        allowed = {
            row.id for row in db.query(models.JournalPerson.id).filter(
                models.JournalPerson.owner_user_id == owner,
                models.JournalPerson.id.in_(ids),
            ).all()
        }
        missing = [value for value in ids if value not in allowed]
        if missing:
            _fail(409, "关联个人人物不存在或不属于当前用户")
    db.query(models.JournalEntryPerson).filter(
        models.JournalEntryPerson.entry_id == entry_id
    ).delete(synchronize_session=False)
    for person_id in ids:
        db.add(models.JournalEntryPerson(
            owner_user_id=owner, entry_id=entry_id, person_id=person_id,
        ))


def _invalidate_sources(entry_id: str):
    try:
        from ai_grants import invalidate_memories_for_source
        from database import SessionLocal
        with SessionLocal() as side:
            invalidate_memories_for_source(side, "journal_entry", entry_id, "source_deleted")
            side.commit()
    except Exception:
        # 删除日记不应因侧路审计失败而失败；M4 服务会在可用时记录。
        pass


@router.get("/api/journal/entries")
@router.get("/api/diary/entries")
def list_entries(
    request: Request,
    world_id: str = "",
    source_type: str = "",
    product: str = "diary",
    entry_type: str = "",
    info_class: str = "",
    sensitivity: str = "",
    status: str = "active",
    person_id: str = "",
    limit: int = 200,
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    try:
        pc.require_module(product, "diary")
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    query = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.owner_user_id == user.id,
        models.DiaryEntry.product_key == product,
    )
    if world_id:
        query = query.filter(models.DiaryEntry.world_id == world_id)
    if source_type:
        query = query.filter(models.DiaryEntry.source_type == source_type)
    if entry_type:
        query = query.filter(models.DiaryEntry.entry_type == entry_type)
    if info_class:
        query = query.filter(models.DiaryEntry.info_class == info_class)
    if sensitivity:
        query = query.filter(models.DiaryEntry.sensitivity == sensitivity)
    if status:
        query = query.filter(models.DiaryEntry.status == status)
    if person_id:
        query = query.join(
            models.JournalEntryPerson,
            models.JournalEntryPerson.entry_id == models.DiaryEntry.id,
        ).filter(models.JournalEntryPerson.person_id == person_id)
    rows = query.order_by(
        models.DiaryEntry.entry_date.desc(), models.DiaryEntry.created_at.desc()
    ).limit(max(1, min(limit, 500))).all()
    return [_row(db, row) for row in rows]


@router.get("/api/journal/entries/{entry_id}")
@router.get("/api/diary/entries/{entry_id}")
def get_entry(entry_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id,
        models.DiaryEntry.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "日记不存在")
    return _row(db, row)


@router.post("/api/journal/entries")
@router.post("/api/diary/entries")
def create_entry(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
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
    entry_type = str(payload.get("entry_type") or "diary")
    if entry_type not in ENTRY_TYPES:
        _fail(422, "记录类型不合法")
    info_class = str(payload.get("info_class") or TYPE_INFO_CLASS.get(entry_type, "basic"))
    if info_class not in INFO_CLASSES:
        _fail(422, "信息类别不合法")
    sensitivity = str(payload.get("sensitivity") or "normal")
    if sensitivity not in SENSITIVITIES:
        _fail(422, "敏感度不合法")

    world_id = str(payload.get("world_id") or "").strip() or None
    if world_id:
        world = db.query(models.World).filter(
            models.World.id == world_id, models.World.deleted_at.is_(None)
        ).first()
        if not world:
            _fail(409, "关联世界不存在")
    character_id = str(payload.get("character_id") or "").strip() or None
    if character_id:
        char = db.query(models.Character).filter(models.Character.id == character_id).first()
        if not char or (world_id and char.world_id != world_id):
            _fail(409, "关联人物不在该世界")

    entry_date = _date(payload.get("entry_date") or date.today().isoformat())
    date_end = str(payload.get("date_end") or "").strip() or None
    if date_end:
        date_end = _date(date_end, "date_end")
        if date_end < entry_date:
            _fail(422, "结束日期不能早于开始日期")

    row = models.DiaryEntry(
        owner_user_id=user.id,
        world_id=world_id,
        character_id=character_id,
        entry_date=entry_date,
        date_end=date_end,
        entry_type=entry_type,
        info_class=info_class,
        sensitivity=sensitivity,
        status="active",
        title=str(payload.get("title") or "")[:200],
        content=content[:20000],
        mood=str(payload.get("mood") or "")[:50],
        tags=[str(tag)[:30] for tag in (payload.get("tags") or [])][:20]
        if isinstance(payload.get("tags"), list) else [],
        source_type=source,
        source_ref=payload.get("source_ref") if isinstance(payload.get("source_ref"), dict) else {},
        visibility="private",
        product_key=product,
    )
    db.add(row)
    db.flush()
    _sync_people(db, user.id, row.id, payload.get("person_ids"))
    db.commit()
    db.refresh(row)
    return _row(db, row)


@router.patch("/api/journal/entries/{entry_id}")
@router.patch("/api/diary/entries/{entry_id}")
def update_entry(entry_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id,
        models.DiaryEntry.owner_user_id == user.id,
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
        row.entry_date = _date(payload.get("entry_date"))
    if "date_end" in payload:
        value = str(payload.get("date_end") or "").strip() or None
        row.date_end = _date(value, "date_end") if value else None
    if "entry_type" in payload:
        value = str(payload.get("entry_type") or "")
        if value not in ENTRY_TYPES:
            _fail(422, "记录类型不合法")
        row.entry_type = value
    if "info_class" in payload:
        value = str(payload.get("info_class") or "")
        if value not in INFO_CLASSES:
            _fail(422, "信息类别不合法")
        row.info_class = value
    if "sensitivity" in payload:
        value = str(payload.get("sensitivity") or "")
        if value not in SENSITIVITIES:
            _fail(422, "敏感度不合法")
        row.sensitivity = value
    if "status" in payload:
        value = str(payload.get("status") or "")
        if value not in STATUSES:
            _fail(422, "状态不合法")
        row.status = value
    if "tags" in payload and isinstance(payload.get("tags"), list):
        row.tags = [str(tag)[:30] for tag in payload["tags"]][:20]
    if "person_ids" in payload:
        _sync_people(db, user.id, row.id, payload.get("person_ids"))
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(db, row)


@router.delete("/api/journal/entries/{entry_id}")
@router.delete("/api/diary/entries/{entry_id}")
def delete_entry(entry_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id,
        models.DiaryEntry.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "日记不存在")
    db.delete(row)
    db.commit()
    _invalidate_sources(entry_id)
    return {"status": "removed"}
