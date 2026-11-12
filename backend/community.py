"""Phase N1-M5/M6：社区公开作品、不可变版本、评论与收藏。

公开读取不要求登录；作者接口按当前用户。公开 DTO 不暴露 owner_user_id、
私人条目 ID 或 source_refs。撤回只影响公开状态，不回写私人原稿。
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from feature_flags import require
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["community"], dependencies=[require("community_publications")])

WORK_TYPES = {"diary_essay", "biography", "biography_serial", "story"}


def _fail(code: int, message: str):
    raise HTTPException(status_code=code, detail=message)


def _iso(value):
    return value.isoformat() if value else None


def _hash(value) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _author_name(user: models.AppUser) -> str:
    return (user.display_name or user.username or "创作者")[:80]


def _publication(db: Session, owner: str, publication_id: str) -> models.CommunityPublication:
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.id == publication_id,
        models.CommunityPublication.owner_user_id == owner,
    ).first()
    if not row:
        _fail(404, "公开作品不存在")
    return row


def _version(db: Session, row: models.CommunityPublication) -> models.CommunityPublicationVersion | None:
    if not row.current_version_id:
        return None
    return db.query(models.CommunityPublicationVersion).filter(
        models.CommunityPublicationVersion.id == row.current_version_id
    ).first()


def _author_row(db: Session, row: models.CommunityPublication) -> dict:
    current = _version(db, row)
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "public_id": row.public_id,
        "work_type": row.work_type,
        "title": row.title,
        "summary": row.summary or "",
        "anonymous": bool(row.anonymous),
        "author_display": row.author_display or "",
        "status": row.status,
        "current_version_id": row.current_version_id,
        "current_version": _version_row(current) if current else None,
        "published_at": _iso(row.published_at),
        "withdrawn_at": _iso(row.withdrawn_at),
        "view_count": row.view_count or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _version_row(row: models.CommunityPublicationVersion) -> dict:
    return {
        "id": row.id,
        "version_no": row.version_no,
        "title": row.title,
        "summary": row.summary or "",
        "content_snapshot": row.content_snapshot or {},
        "source_refs": row.source_refs or [],
        "content_hash": row.content_hash or "",
        "change_summary": row.change_summary or "",
        "status": row.status,
        "published_at": _iso(row.published_at),
    }


def _public_row(db: Session, row: models.CommunityPublication) -> dict:
    current = _version(db, row)
    comments = db.query(models.CommunityComment).filter(
        models.CommunityComment.publication_id == row.id,
        models.CommunityComment.status == "visible",
    ).count()
    favorites = db.query(models.CommunityFavorite).filter(
        models.CommunityFavorite.publication_id == row.id
    ).count()
    return {
        "public_id": row.public_id,
        "work_type": row.work_type,
        "title": row.title,
        "summary": row.summary or "",
        "author_display": row.author_display or ("匿名用户" if row.anonymous else "创作者"),
        "anonymous": bool(row.anonymous),
        "cover": row.cover or "",
        "published_at": _iso(row.published_at),
        "view_count": row.view_count or 0,
        "comment_count": comments,
        "favorite_count": favorites,
        "content": {
            "version_id": current.id if current else None,
            "version_no": current.version_no if current else None,
            "snapshot": (current.content_snapshot if current else {}),
            "content_hash": current.content_hash if current else "",
        },
    }


def _snapshot_from_source(db: Session, owner: str, payload: dict) -> tuple[dict, list[dict], str]:
    source_type = str(payload.get("source_type") or "direct")
    source_ids = [str(value) for value in (payload.get("source_ids") or [])][:50]
    if source_type == "journal_entry":
        if not source_ids:
            _fail(422, "请选择日记")
        entries = db.query(models.DiaryEntry).filter(
            models.DiaryEntry.owner_user_id == owner,
            models.DiaryEntry.id.in_(source_ids),
        ).order_by(models.DiaryEntry.entry_date.asc()).all()
        if len(entries) != len(set(source_ids)):
            _fail(409, "部分日记不存在或不属于当前用户")
        items = [
            {"title": item.title or "", "date": item.entry_date, "content": item.content}
            for item in entries
        ]
        refs = [{"source_type": "journal_entry", "source_id": item.id} for item in entries]
        return {"kind": "journal_entries", "items": items}, refs, "diary_essay"
    if source_type == "biography":
        biography_id = str(payload.get("source_id") or (source_ids[0] if source_ids else ""))
        bio = db.query(models.UserBiography).filter(
            models.UserBiography.id == biography_id,
            models.UserBiography.owner_user_id == owner,
        ).first()
        if not bio:
            _fail(404, "用户传记不存在")
        chapters = db.query(models.UserBiographyChapter).filter(
            models.UserBiographyChapter.biography_id == bio.id
        ).order_by(models.UserBiographyChapter.order_index.asc()).all()
        items = [
            {"title": item.title, "content": item.content, "order_index": item.order_index}
            for item in chapters
        ]
        refs = [{"source_type": "biography_chapter", "source_id": item.id} for item in chapters]
        return {"kind": "biography", "items": items, "title": bio.title, "subtitle": bio.subtitle}, refs, "biography"
    if source_type == "biography_chapter":
        chapter_id = str(payload.get("source_id") or (source_ids[0] if source_ids else ""))
        chapter = db.query(models.UserBiographyChapter).join(
            models.UserBiography,
            models.UserBiography.id == models.UserBiographyChapter.biography_id,
        ).filter(
            models.UserBiographyChapter.id == chapter_id,
            models.UserBiography.owner_user_id == owner,
        ).first()
        if not chapter:
            _fail(404, "传记章节不存在")
        return {
            "kind": "biography_chapters",
            "items": [{"title": chapter.title, "content": chapter.content}],
        }, [{"source_type": "biography_chapter", "source_id": chapter.id}], "biography_serial"
    if source_type == "story":
        story_id = str(payload.get("source_id") or (source_ids[0] if source_ids else ""))
        story = db.query(models.Story).filter(
            models.Story.id == story_id,
            models.Story.owner_user_id == owner,
            models.Story.archived_at.is_(None),
        ).first()
        if not story:
            _fail(404, "写作章节不存在")
        return {
            "kind": "story", "items": [{"title": story.title, "content": story.plain_text or story.content}],
        }, [{"source_type": "story", "source_id": story.id}], "story"

    content = str(payload.get("content") or "").strip()
    if not content:
        _fail(422, "公开作品正文不能为空")
    chapters = payload.get("chapters") if isinstance(payload.get("chapters"), list) else []
    items = []
    if chapters:
        for index, item in enumerate(chapters[:100]):
            if not isinstance(item, dict):
                continue
            items.append({
                "title": str(item.get("title") or f"第 {index + 1} 章")[:160],
                "content": str(item.get("content") or "")[:50000],
            })
    else:
        items = [{"title": str(payload.get("title") or "")[:160], "content": content[:50000]}]
    return {"kind": "direct", "items": items}, [], str(payload.get("work_type") or "diary_essay")


def _create_version(
    db: Session, row: models.CommunityPublication, *,
    title: str, summary: str, snapshot: dict, refs: list[dict], change_summary: str,
) -> models.CommunityPublicationVersion:
    last = db.query(models.CommunityPublicationVersion).filter(
        models.CommunityPublicationVersion.publication_id == row.id
    ).order_by(models.CommunityPublicationVersion.version_no.desc()).first()
    version_no = (last.version_no + 1) if last else 1
    version = models.CommunityPublicationVersion(
        publication_id=row.id,
        version_no=version_no,
        title=title,
        summary=summary,
        content_snapshot=snapshot,
        source_refs=refs,
        content_hash=_hash(snapshot),
        change_summary=change_summary[:500],
        status="published",
    )
    db.add(version)
    db.flush()
    if last:
        last.status = "superseded"
    row.current_version_id = version.id
    row.title = title
    row.summary = summary
    row.published_at = datetime.utcnow()
    row.updated_at = datetime.utcnow()
    return version


@router.get("/api/community/publications")
def list_my_publications(
    request: Request, status: str = "", limit: int = 100,
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    query = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.owner_user_id == user.id
    )
    if status:
        query = query.filter(models.CommunityPublication.status == status)
    rows = query.order_by(models.CommunityPublication.updated_at.desc()).limit(max(1, min(limit, 200))).all()
    return [_author_row(db, row) for row in rows]


@router.post("/api/community/publications")
def create_publication(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    title = str(payload.get("title") or "").strip()[:160]
    if not title:
        _fail(422, "公开标题不能为空")
    snapshot, refs, work_type = _snapshot_from_source(db, user.id, payload)
    if work_type not in WORK_TYPES:
        work_type = "diary_essay"
    anonymous = bool(payload.get("anonymous"))
    row = models.CommunityPublication(
        owner_user_id=user.id,
        public_id=secrets.token_urlsafe(12),
        work_type=work_type,
        title=title,
        summary=str(payload.get("summary") or "")[:4000],
        anonymous=anonymous,
        author_display="匿名用户" if anonymous else _author_name(user),
        cover=str(payload.get("cover") or "")[:500],
        status="published",
        published_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    _create_version(
        db, row, title=title, summary=row.summary,
        snapshot=snapshot, refs=refs,
        change_summary=str(payload.get("change_summary") or "首次发布"),
    )
    db.commit()
    db.refresh(row)
    return _author_row(db, row)


@router.get("/api/community/publications/{publication_id}")
def get_my_publication(publication_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return _author_row(db, _publication(db, user.id, publication_id))


@router.patch("/api/community/publications/{publication_id}")
def update_publication(publication_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _publication(db, user.id, publication_id)
    if "title" in payload:
        title = str(payload.get("title") or "").strip()[:160]
        if not title:
            _fail(422, "公开标题不能为空")
        row.title = title
    if "summary" in payload:
        row.summary = str(payload.get("summary") or "")[:4000]
    if "anonymous" in payload:
        row.anonymous = bool(payload.get("anonymous"))
        row.author_display = "匿名用户" if row.anonymous else _author_name(user)
    if "cover" in payload:
        row.cover = str(payload.get("cover") or "")[:500]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _author_row(db, row)


@router.post("/api/community/publications/{publication_id}/versions")
def publish_new_version(publication_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _publication(db, user.id, publication_id)
    if row.status != "published":
        _fail(409, "只有已发布作品可以发布新版本")
    title = str(payload.get("title") or row.title).strip()[:160]
    summary = str(payload.get("summary") or row.summary or "")[:4000]
    if payload.get("source_type"):
        snapshot, refs, _ = _snapshot_from_source(db, user.id, payload)
    else:
        snapshot, refs = (payload.get("content_snapshot") if isinstance(payload.get("content_snapshot"), dict) else {}), []
        if not snapshot:
            _fail(422, "新版本内容不能为空")
    _create_version(
        db, row, title=title, summary=summary, snapshot=snapshot, refs=refs,
        change_summary=str(payload.get("change_summary") or "发布新版本"),
    )
    db.commit()
    db.refresh(row)
    return _author_row(db, row)


@router.post("/api/community/publications/{publication_id}/withdraw")
def withdraw_publication(publication_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _publication(db, user.id, publication_id)
    row.status = "withdrawn"
    row.withdrawn_at = datetime.utcnow()
    current = _version(db, row)
    if current:
        current.status = "withdrawn"
    db.commit()
    return _author_row(db, row)


@router.delete("/api/community/publications/{publication_id}")
def delete_publication(publication_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _publication(db, user.id, publication_id)
    row.status = "removed"
    row.withdrawn_at = datetime.utcnow()
    db.commit()
    return {"status": "removed"}


# ---------------------------------------------------------------------
# 公开读取
# ---------------------------------------------------------------------
@router.get("/api/community/public")
def public_feed(
    work_type: str = "", limit: int = 30, offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.status == "published"
    )
    if work_type:
        query = query.filter(models.CommunityPublication.work_type == work_type)
    rows = query.order_by(
        models.CommunityPublication.published_at.desc(),
        models.CommunityPublication.created_at.desc(),
    ).offset(max(0, offset)).limit(max(1, min(limit, 100))).all()
    return [_public_row(db, row) for row in rows]


@router.get("/api/community/public/{public_id}")
def public_detail(public_id: str, db: Session = Depends(get_db)):
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.public_id == public_id,
        models.CommunityPublication.status == "published",
    ).first()
    if not row:
        _fail(404, "公开作品不存在或已撤回")
    row.view_count = (row.view_count or 0) + 1
    db.commit()
    return _public_row(db, row)


@router.get("/api/community/public/{public_id}/comments")
def public_comments(public_id: str, db: Session = Depends(get_db)):
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.public_id == public_id,
        models.CommunityPublication.status == "published",
    ).first()
    if not row:
        _fail(404, "公开作品不存在或已撤回")
    comments = db.query(models.CommunityComment).filter(
        models.CommunityComment.publication_id == row.id,
        models.CommunityComment.status == "visible",
    ).order_by(models.CommunityComment.created_at.asc()).all()
    return [
        {
            "id": item.id, "body": item.body, "reply_to_id": item.reply_to_id,
            "created_at": _iso(item.created_at),
        }
        for item in comments
    ]


@router.post("/api/community/public/{public_id}/comments")
def create_comment(public_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.public_id == public_id,
        models.CommunityPublication.status == "published",
    ).first()
    if not row:
        _fail(404, "公开作品不存在或已撤回")
    body = str(payload.get("body") or "").strip()
    if not body:
        _fail(422, "评论不能为空")
    item = models.CommunityComment(
        publication_id=row.id,
        version_id=row.current_version_id,
        owner_user_id=user.id,
        body=body[:4000],
        reply_to_id=str(payload.get("reply_to_id") or "") or None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "body": item.body, "created_at": _iso(item.created_at)}


@router.delete("/api/community/comments/{comment_id}")
def delete_comment(comment_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    item = db.query(models.CommunityComment).filter(
        models.CommunityComment.id == comment_id,
        models.CommunityComment.owner_user_id == user.id,
    ).first()
    if not item:
        _fail(404, "评论不存在")
    item.status = "deleted"
    db.commit()
    return {"status": "removed"}


@router.post("/api/community/public/{public_id}/favorite")
def favorite(public_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.public_id == public_id,
        models.CommunityPublication.status == "published",
    ).first()
    if not row:
        _fail(404, "公开作品不存在或已撤回")
    exists = db.query(models.CommunityFavorite).filter(
        models.CommunityFavorite.publication_id == row.id,
        models.CommunityFavorite.owner_user_id == user.id,
    ).first()
    if not exists:
        db.add(models.CommunityFavorite(publication_id=row.id, owner_user_id=user.id))
        db.commit()
    return {"favorited": True}


@router.delete("/api/community/public/{public_id}/favorite")
def unfavorite(public_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.public_id == public_id
    ).first()
    if not row:
        _fail(404, "公开作品不存在")
    db.query(models.CommunityFavorite).filter(
        models.CommunityFavorite.publication_id == row.id,
        models.CommunityFavorite.owner_user_id == user.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"favorited": False}
