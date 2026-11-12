"""Phase N1-M3：用户 Journal / 个人人物 / 用户传记 / 来源引用。

边界：
- `JournalPerson` 不是世界 `Character`；`UserBiography` 不是 `CharacterBiography`。
- 所有读写按当前用户归属。
- 删除私人原稿不删除公开版本；公开层由 community.py 处理。
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from feature_flags import require
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["journal"], dependencies=[require("user_journal_v2")])
logger = logging.getLogger(__name__)

ENTRY_TYPES = {
    "diary": "日记",
    "life_experience": "人生经历",
    "important_event": "重要事件",
    "relationship_note": "关系记录",
    "reflection": "思考与反思",
    "personal_note": "个人备注",
}
INFO_CLASSES = {"basic", "experience", "relationship", "thought", "event"}
SENSITIVITIES = {"normal", "sensitive", "deep"}
BIO_STATUS = {"draft", "published", "archived"}


def _fail(code: int, message: str):
    raise HTTPException(status_code=code, detail=message)


def _iso(value):
    return value.isoformat() if value else None


def _invalidate_chapter(chapter_id: str):
    try:
        from ai_grants import invalidate_memories_for_source
        from database import SessionLocal
        with SessionLocal() as side:
            invalidate_memories_for_source(side, "biography_chapter", chapter_id, "source_deleted")
            side.commit()
    except Exception:
        logger.exception("failed to invalidate memories for deleted biography chapter %s", chapter_id)


def _person(db: Session, owner: str, person_id: str) -> models.JournalPerson:
    row = db.query(models.JournalPerson).filter(
        models.JournalPerson.id == person_id,
        models.JournalPerson.owner_user_id == owner,
    ).first()
    if not row:
        _fail(404, "个人人物不存在")
    return row


def _biography(db: Session, owner: str, biography_id: str) -> models.UserBiography:
    row = db.query(models.UserBiography).filter(
        models.UserBiography.id == biography_id,
        models.UserBiography.owner_user_id == owner,
    ).first()
    if not row:
        _fail(404, "用户传记不存在")
    return row


def _chapter(db: Session, owner: str, biography_id: str, chapter_id: str) -> models.UserBiographyChapter:
    _biography(db, owner, biography_id)
    row = db.query(models.UserBiographyChapter).filter(
        models.UserBiographyChapter.id == chapter_id,
        models.UserBiographyChapter.biography_id == biography_id,
    ).first()
    if not row:
        _fail(404, "传记章节不存在")
    return row


def _person_row(row: models.JournalPerson) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "alias": row.alias or "",
        "relation_label": row.relation_label or "",
        "summary": row.summary or "",
        "birthday": row.birthday or "",
        "avatar": row.avatar or "",
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _relation_row(row: models.JournalRelation) -> dict:
    return {
        "id": row.id,
        "person_id": row.person_id,
        "related_person_id": row.related_person_id,
        "relation_type": row.relation_type or "",
        "description": row.description or "",
        "start_date": row.start_date or "",
        "end_date": row.end_date or "",
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _biography_row(db: Session, row: models.UserBiography) -> dict:
    chapters = db.query(models.UserBiographyChapter).filter(
        models.UserBiographyChapter.biography_id == row.id
    ).order_by(models.UserBiographyChapter.order_index.asc(), models.UserBiographyChapter.created_at.asc()).all()
    return {
        "id": row.id,
        "title": row.title,
        "subtitle": row.subtitle or "",
        "summary": row.summary or "",
        "cover": row.cover or "",
        "status": row.status,
        "visibility": row.visibility,
        "chapter_count": len(chapters),
        "chapters": [_chapter_row(item) for item in chapters],
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _chapter_row(row: models.UserBiographyChapter) -> dict:
    return {
        "id": row.id,
        "biography_id": row.biography_id,
        "title": row.title,
        "summary": row.summary or "",
        "content": row.content or "",
        "order_index": row.order_index,
        "source_entry_ids": row.source_entry_ids or [],
        "status": row.status,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _citation_row(db: Session, row: models.JournalCitation) -> dict:
    source = db.query(models.InformationSource).filter(
        models.InformationSource.id == row.source_id
    ).first()
    return {
        "id": row.id,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "source_id": row.source_id,
        "excerpt": row.excerpt or "",
        "source_title": source.title if source else "",
        "source_type": source.source_type if source else "",
        "source_status": source.status if source else "",
        "created_at": _iso(row.created_at),
    }


@router.get("/api/journal/presets")
def presets():
    return {
        "entry_types": [{"key": key, "label": label} for key, label in ENTRY_TYPES.items()],
        "info_classes": [
            {"key": "basic", "label": "基础信息"},
            {"key": "experience", "label": "经历"},
            {"key": "relationship", "label": "关系"},
            {"key": "thought", "label": "思想"},
            {"key": "event", "label": "事件"},
        ],
        "sensitivities": [
            {"key": "normal", "label": "普通"},
            {"key": "sensitive", "label": "敏感"},
            {"key": "deep", "label": "深度"},
        ],
        "biography_statuses": [
            {"key": "draft", "label": "草稿"},
            {"key": "published", "label": "已完成"},
            {"key": "archived", "label": "归档"},
        ],
        "citation_targets": [
            {"key": "journal_entry", "label": "日记/经历"},
            {"key": "user_biography_chapter", "label": "传记章节"},
        ],
    }


@router.get("/api/journal/overview")
def overview(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return {
        "entries": db.query(models.DiaryEntry).filter(
            models.DiaryEntry.owner_user_id == user.id,
            models.DiaryEntry.status == "active",
        ).count(),
        "people": db.query(models.JournalPerson).filter(
            models.JournalPerson.owner_user_id == user.id,
            models.JournalPerson.status == "active",
        ).count(),
        "relations": db.query(models.JournalRelation).filter(
            models.JournalRelation.owner_user_id == user.id,
            models.JournalRelation.status == "active",
        ).count(),
        "biographies": db.query(models.UserBiography).filter(
            models.UserBiography.owner_user_id == user.id,
            models.UserBiography.status != "archived",
        ).count(),
        "chapters": db.query(models.UserBiographyChapter).join(
            models.UserBiography,
            models.UserBiography.id == models.UserBiographyChapter.biography_id,
        ).filter(models.UserBiography.owner_user_id == user.id).count(),
        "citations": db.query(models.JournalCitation).filter(
            models.JournalCitation.owner_user_id == user.id
        ).count(),
    }


# ---------------------------------------------------------------------
# 个人人物与个人关系
# ---------------------------------------------------------------------
@router.get("/api/journal/people")
def list_people(request: Request, status: str = "active", db: Session = Depends(get_db)):
    user = current_user(request, db)
    query = db.query(models.JournalPerson).filter(models.JournalPerson.owner_user_id == user.id)
    if status:
        query = query.filter(models.JournalPerson.status == status)
    rows = query.order_by(models.JournalPerson.updated_at.desc()).all()
    return [_person_row(row) for row in rows]


@router.post("/api/journal/people")
def create_person(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    name = str(payload.get("name") or "").strip()[:80]
    if not name:
        _fail(422, "姓名不能为空")
    row = models.JournalPerson(
        owner_user_id=user.id,
        name=name,
        alias=str(payload.get("alias") or "")[:80],
        relation_label=str(payload.get("relation_label") or "")[:60],
        summary=str(payload.get("summary") or "")[:2000],
        birthday=str(payload.get("birthday") or "")[:20],
        avatar=str(payload.get("avatar") or "")[:500],
        status="active",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _person_row(row)


@router.patch("/api/journal/people/{person_id}")
def update_person(person_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _person(db, user.id, person_id)
    for key, limit in (("name", 80), ("alias", 80), ("relation_label", 60), ("summary", 2000), ("birthday", 20), ("avatar", 500)):
        if key in payload:
            value = str(payload.get(key) or "")[:limit]
            if key == "name" and not value.strip():
                _fail(422, "姓名不能为空")
            setattr(row, key, value)
    if "status" in payload:
        value = str(payload.get("status") or "")
        if value not in {"active", "archived"}:
            _fail(422, "人物状态不合法")
        row.status = value
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _person_row(row)


@router.delete("/api/journal/people/{person_id}")
def delete_person(person_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _person(db, user.id, person_id)
    db.delete(row)
    db.commit()
    return {"status": "removed"}


@router.get("/api/journal/relations")
def list_relations(request: Request, person_id: str = "", db: Session = Depends(get_db)):
    user = current_user(request, db)
    query = db.query(models.JournalRelation).filter(
        models.JournalRelation.owner_user_id == user.id,
        models.JournalRelation.status == "active",
    )
    if person_id:
        query = query.filter(
            (models.JournalRelation.person_id == person_id)
            | (models.JournalRelation.related_person_id == person_id)
        )
    return [_relation_row(row) for row in query.order_by(models.JournalRelation.updated_at.desc()).all()]


@router.post("/api/journal/relations")
def create_relation(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    person_id = str(payload.get("person_id") or "").strip()
    related_id = str(payload.get("related_person_id") or "").strip()
    if not person_id or not related_id:
        _fail(422, "关系双方不能为空")
    if person_id == related_id:
        _fail(422, "关系双方不能是同一人")
    _person(db, user.id, person_id)
    _person(db, user.id, related_id)
    row = models.JournalRelation(
        owner_user_id=user.id,
        person_id=person_id,
        related_person_id=related_id,
        relation_type=str(payload.get("relation_type") or "")[:60],
        description=str(payload.get("description") or "")[:2000],
        start_date=str(payload.get("start_date") or "")[:20],
        end_date=str(payload.get("end_date") or "")[:20],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _relation_row(row)


@router.patch("/api/journal/relations/{relation_id}")
def update_relation(relation_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.JournalRelation).filter(
        models.JournalRelation.id == relation_id,
        models.JournalRelation.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "个人关系不存在")
    for key, limit in (("relation_type", 60), ("description", 2000), ("start_date", 20), ("end_date", 20)):
        if key in payload:
            setattr(row, key, str(payload.get(key) or "")[:limit])
    if "status" in payload:
        value = str(payload.get("status") or "")
        if value not in {"active", "archived"}:
            _fail(422, "关系状态不合法")
        row.status = value
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _relation_row(row)


@router.delete("/api/journal/relations/{relation_id}")
def delete_relation(relation_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.JournalRelation).filter(
        models.JournalRelation.id == relation_id,
        models.JournalRelation.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "个人关系不存在")
    db.delete(row)
    db.commit()
    return {"status": "removed"}


# ---------------------------------------------------------------------
# 用户传记
# ---------------------------------------------------------------------
@router.get("/api/journal/biographies")
def list_biographies(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    rows = db.query(models.UserBiography).filter(
        models.UserBiography.owner_user_id == user.id,
    ).order_by(models.UserBiography.updated_at.desc()).all()
    return [_biography_row(db, row) for row in rows]


@router.post("/api/journal/biographies")
def create_biography(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    title = str(payload.get("title") or "").strip()[:120]
    if not title:
        _fail(422, "传记标题不能为空")
    row = models.UserBiography(
        owner_user_id=user.id,
        title=title,
        subtitle=str(payload.get("subtitle") or "")[:200],
        summary=str(payload.get("summary") or "")[:4000],
        cover=str(payload.get("cover") or "")[:500],
        status="draft",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _biography_row(db, row)


@router.get("/api/journal/biographies/{biography_id}")
def get_biography(biography_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return _biography_row(db, _biography(db, user.id, biography_id))


@router.patch("/api/journal/biographies/{biography_id}")
def update_biography(biography_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _biography(db, user.id, biography_id)
    for key, limit in (("title", 120), ("subtitle", 200), ("summary", 4000), ("cover", 500)):
        if key in payload:
            value = str(payload.get(key) or "")[:limit]
            if key == "title" and not value.strip():
                _fail(422, "传记标题不能为空")
            setattr(row, key, value)
    if "status" in payload:
        value = str(payload.get("status") or "")
        if value not in BIO_STATUS:
            _fail(422, "传记状态不合法")
        row.status = value
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _biography_row(db, row)


@router.delete("/api/journal/biographies/{biography_id}")
def delete_biography(biography_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _biography(db, user.id, biography_id)
    chapter_ids = [
        item.id for item in db.query(models.UserBiographyChapter.id).filter(
            models.UserBiographyChapter.biography_id == biography_id
        ).all()
    ]
    db.delete(row)
    db.commit()
    for chapter_id in chapter_ids:
        _invalidate_chapter(chapter_id)
    return {"status": "removed"}


@router.post("/api/journal/biographies/{biography_id}/chapters")
def create_chapter(biography_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    _biography(db, user.id, biography_id)
    title = str(payload.get("title") or "").strip()[:120]
    if not title:
        _fail(422, "章节标题不能为空")
    source_ids = payload.get("source_entry_ids") if isinstance(payload.get("source_entry_ids"), list) else []
    source_ids = [str(value) for value in source_ids[:80]]
    if source_ids:
        owned = {
            row.id for row in db.query(models.DiaryEntry.id).filter(
                models.DiaryEntry.owner_user_id == user.id,
                models.DiaryEntry.id.in_(source_ids),
            ).all()
        }
        if any(value not in owned for value in source_ids):
            _fail(409, "来源日记不存在或不属于当前用户")
    max_order = db.query(models.UserBiographyChapter).filter(
        models.UserBiographyChapter.biography_id == biography_id
    ).count()
    row = models.UserBiographyChapter(
        biography_id=biography_id,
        title=title,
        summary=str(payload.get("summary") or "")[:1000],
        content=str(payload.get("content") or "")[:50000],
        order_index=int(payload.get("order_index", max_order) or max_order),
        source_entry_ids=source_ids,
        status=str(payload.get("status") or "draft")[:20],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _chapter_row(row)


@router.post("/api/journal/biographies/{biography_id}/chapters/from-entries")
def chapter_from_entries(biography_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    _biography(db, user.id, biography_id)
    ids = [str(value) for value in (payload.get("entry_ids") or [])[:80]]
    if not ids:
        _fail(422, "请选择要转为章节的日记")
    entries = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.owner_user_id == user.id,
        models.DiaryEntry.id.in_(ids),
    ).order_by(models.DiaryEntry.entry_date.asc()).all()
    if len(entries) != len(set(ids)):
        _fail(409, "部分日记不存在或不属于当前用户")
    title = str(payload.get("title") or "").strip()[:120] or "由日记生成的章节"
    body = "\n\n".join(
        f"## {item.title or item.entry_date}\n{item.content}" for item in entries
    )
    max_order = db.query(models.UserBiographyChapter).filter(
        models.UserBiographyChapter.biography_id == biography_id
    ).count()
    row = models.UserBiographyChapter(
        biography_id=biography_id,
        title=title,
        summary=str(payload.get("summary") or "")[:1000],
        content=body[:50000],
        order_index=max_order,
        source_entry_ids=[item.id for item in entries],
        status="draft",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _chapter_row(row)


@router.patch("/api/journal/biographies/{biography_id}/chapters/{chapter_id}")
def update_chapter(biography_id: str, chapter_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _chapter(db, user.id, biography_id, chapter_id)
    for key, limit in (("title", 120), ("summary", 1000), ("content", 50000)):
        if key in payload:
            value = str(payload.get(key) or "")[:limit]
            if key == "title" and not value.strip():
                _fail(422, "章节标题不能为空")
            setattr(row, key, value)
    if "order_index" in payload:
        try:
            row.order_index = int(payload.get("order_index"))
        except (TypeError, ValueError):
            _fail(422, "章节顺序必须是整数")
    if "status" in payload:
        row.status = str(payload.get("status") or "")[:20]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _chapter_row(row)


@router.delete("/api/journal/biographies/{biography_id}/chapters/{chapter_id}")
def delete_chapter(biography_id: str, chapter_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _chapter(db, user.id, biography_id, chapter_id)
    db.delete(row)
    db.commit()
    _invalidate_chapter(chapter_id)
    return {"status": "removed"}


# ---------------------------------------------------------------------
# 来源引用
# ---------------------------------------------------------------------
@router.get("/api/journal/citations")
def list_citations(
    request: Request, target_type: str = "", target_id: str = "",
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    query = db.query(models.JournalCitation).filter(
        models.JournalCitation.owner_user_id == user.id
    )
    if target_type:
        query = query.filter(models.JournalCitation.target_type == target_type)
    if target_id:
        query = query.filter(models.JournalCitation.target_id == target_id)
    return [_citation_row(db, row) for row in query.order_by(models.JournalCitation.created_at.desc()).all()]


@router.post("/api/journal/citations")
def create_citation(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    target_type = str(payload.get("target_type") or "")
    target_id = str(payload.get("target_id") or "")
    source_id = str(payload.get("source_id") or "")
    if target_type not in {"journal_entry", "user_biography_chapter"}:
        _fail(422, "引用目标类型不合法")
    if not target_id or not source_id:
        _fail(422, "引用目标与来源不能为空")
    if target_type == "journal_entry":
        exists = db.query(models.DiaryEntry).filter(
            models.DiaryEntry.id == target_id,
            models.DiaryEntry.owner_user_id == user.id,
        ).first()
    else:
        exists = db.query(models.UserBiographyChapter).join(
            models.UserBiography,
            models.UserBiography.id == models.UserBiographyChapter.biography_id,
        ).filter(
            models.UserBiographyChapter.id == target_id,
            models.UserBiography.owner_user_id == user.id,
        ).first()
    if not exists:
        _fail(409, "引用目标不存在或不属于当前用户")
    source = db.query(models.InformationSource).filter(
        models.InformationSource.id == source_id,
        models.InformationSource.owner_user_id == user.id,
    ).first()
    if not source:
        _fail(409, "信息来源不存在或不属于当前用户")
    row = db.query(models.JournalCitation).filter(
        models.JournalCitation.target_type == target_type,
        models.JournalCitation.target_id == target_id,
        models.JournalCitation.source_id == source_id,
    ).first()
    if row:
        return _citation_row(db, row)
    row = models.JournalCitation(
        owner_user_id=user.id,
        target_type=target_type,
        target_id=target_id,
        source_id=source_id,
        excerpt=str(payload.get("excerpt") or "")[:1000],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _citation_row(db, row)


@router.delete("/api/journal/citations/{citation_id}")
def delete_citation(citation_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.JournalCitation).filter(
        models.JournalCitation.id == citation_id,
        models.JournalCitation.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "引用不存在")
    db.delete(row)
    db.commit()
    return {"status": "removed"}
