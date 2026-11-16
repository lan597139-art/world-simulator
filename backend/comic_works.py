"""漫画工作台：章节、页面、排序与作品内图片资产。

首版以图片页/长条页为核心，不承担专业绘画与分镜绘制工具。
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["comic-works"])

PAGE_KINDS = {"page", "strip", "panel", "sketch"}
ASSET_KINDS = {"illustration", "manuscript", "panel", "character", "cover", "other"}


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _work(db: Session, request: Request, work_id: str) -> models.CreativeWork:
    user = current_user(request, db)
    work = db.query(models.CreativeWork).filter(
        models.CreativeWork.id == work_id,
        models.CreativeWork.owner_user_id == user.id,
    ).first()
    if not work:
        raise HTTPException(status_code=404, detail="漫画作品不存在")
    if work.scene != "comic":
        raise HTTPException(status_code=422, detail="该作品不是漫画场景")
    return work


def _chapter(db: Session, work: models.CreativeWork, chapter_id: str) -> models.ComicChapter:
    row = db.query(models.ComicChapter).filter(
        models.ComicChapter.id == chapter_id,
        models.ComicChapter.work_id == work.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="章节不存在")
    return row


def _page(db: Session, work: models.CreativeWork, page_id: str) -> models.ComicPage:
    row = db.query(models.ComicPage).filter(
        models.ComicPage.id == page_id,
        models.ComicPage.work_id == work.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="页面不存在")
    return row


def _chapter_json(row: models.ComicChapter, pages: list[models.ComicPage]) -> dict:
    return {
        "id": row.id,
        "work_id": row.work_id,
        "title": row.title,
        "summary": row.summary or "",
        "order_index": row.order_index,
        "status": row.status,
        "page_count": len(pages),
        "pages": [_page_json(page) for page in pages],
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _page_json(row: models.ComicPage) -> dict:
    return {
        "id": row.id,
        "work_id": row.work_id,
        "chapter_id": row.chapter_id,
        "caption": row.caption or "",
        "image_url": row.image_url,
        "kind": row.kind,
        "order_index": row.order_index,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _asset_json(row: models.ComicAsset) -> dict:
    return {
        "id": row.id,
        "work_id": row.work_id,
        "kind": row.kind,
        "title": row.title,
        "file_url": row.file_url,
        "mime_type": row.mime_type or "",
        "file_size": row.file_size or 0,
        "created_at": _iso(row.created_at),
    }


def _workspace(db: Session, work: models.CreativeWork) -> dict:
    chapters = db.query(models.ComicChapter).filter(
        models.ComicChapter.work_id == work.id
    ).order_by(models.ComicChapter.order_index.asc(), models.ComicChapter.created_at.asc()).all()
    pages = db.query(models.ComicPage).filter(
        models.ComicPage.work_id == work.id
    ).order_by(models.ComicPage.order_index.asc(), models.ComicPage.created_at.asc()).all()
    grouped: dict[str, list[models.ComicPage]] = {chapter.id: [] for chapter in chapters}
    for page in pages:
        grouped.setdefault(page.chapter_id, []).append(page)
    assets = db.query(models.ComicAsset).filter(
        models.ComicAsset.work_id == work.id
    ).order_by(models.ComicAsset.created_at.desc()).all()
    return {
        "work": {
            "id": work.id,
            "title": work.title,
            "summary": work.summary or "",
            "cover_url": work.cover_url or "",
            "status": work.status,
            "category": work.category,
        },
        "chapters": [_chapter_json(chapter, grouped.get(chapter.id, [])) for chapter in chapters],
        "assets": [_asset_json(asset) for asset in assets],
        "page_count": len(pages),
    }


@router.get("/api/comic-works/{work_id}")
def get_comic_workspace(work_id: str, request: Request, db: Session = Depends(get_db)):
    return _workspace(db, _work(db, request, work_id))


@router.post("/api/comic-works/{work_id}/chapters")
def create_chapter(work_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="章节标题不能为空")
    max_order = db.query(models.ComicChapter).filter(models.ComicChapter.work_id == work.id).count()
    row = models.ComicChapter(
        work_id=work.id,
        title=title[:160],
        summary=str(payload.get("summary") or "").strip()[:1000],
        order_index=max_order,
        status="draft",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _chapter_json(row, [])


@router.patch("/api/comic-works/{work_id}/chapters/{chapter_id}")
def update_chapter(work_id: str, chapter_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    row = _chapter(db, work, chapter_id)
    if "title" in payload:
        title = str(payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=422, detail="章节标题不能为空")
        row.title = title[:160]
    if "summary" in payload:
        row.summary = str(payload.get("summary") or "").strip()[:1000]
    if "status" in payload:
        status = str(payload.get("status") or "draft")
        if status not in {"draft", "in_progress", "completed"}:
            raise HTTPException(status_code=422, detail="章节状态非法")
        row.status = status
    row.updated_at = _now()
    db.commit()
    pages = db.query(models.ComicPage).filter(models.ComicPage.chapter_id == row.id).order_by(models.ComicPage.order_index.asc()).all()
    return _chapter_json(row, pages)


@router.delete("/api/comic-works/{work_id}/chapters/{chapter_id}")
def delete_chapter(work_id: str, chapter_id: str, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    row = _chapter(db, work, chapter_id)
    db.query(models.ComicPage).filter(models.ComicPage.chapter_id == row.id).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.post("/api/comic-works/{work_id}/chapters/reorder")
def reorder_chapters(work_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    ids = payload.get("chapter_ids") or []
    if not isinstance(ids, list):
        raise HTTPException(status_code=422, detail="章节顺序格式错误")
    rows = {row.id: row for row in db.query(models.ComicChapter).filter(models.ComicChapter.work_id == work.id).all()}
    if len(ids) != len(rows) or set(ids) != set(rows):
        raise HTTPException(status_code=422, detail="章节顺序必须覆盖当前全部章节")
    for index, chapter_id in enumerate(ids):
        rows[chapter_id].order_index = index
        rows[chapter_id].updated_at = _now()
    db.commit()
    return _workspace(db, work)


@router.post("/api/comic-works/{work_id}/chapters/{chapter_id}/pages")
def create_page(work_id: str, chapter_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    chapter = _chapter(db, work, chapter_id)
    image_url = str(payload.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(status_code=422, detail="页面图片不能为空")
    kind = str(payload.get("kind") or "page")
    if kind not in PAGE_KINDS:
        raise HTTPException(status_code=422, detail="页面类型非法")
    order = db.query(models.ComicPage).filter(models.ComicPage.chapter_id == chapter.id).count()
    row = models.ComicPage(
        work_id=work.id,
        chapter_id=chapter.id,
        image_url=image_url[:1000],
        caption=str(payload.get("caption") or "").strip()[:600],
        kind=kind,
        order_index=order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _page_json(row)


@router.patch("/api/comic-works/{work_id}/pages/{page_id}")
def update_page(work_id: str, page_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    row = _page(db, work, page_id)
    if "caption" in payload:
        row.caption = str(payload.get("caption") or "").strip()[:600]
    if "image_url" in payload:
        image_url = str(payload.get("image_url") or "").strip()
        if not image_url:
            raise HTTPException(status_code=422, detail="页面图片不能为空")
        row.image_url = image_url[:1000]
    if "kind" in payload:
        kind = str(payload.get("kind") or "page")
        if kind not in PAGE_KINDS:
            raise HTTPException(status_code=422, detail="页面类型非法")
        row.kind = kind
    row.updated_at = _now()
    db.commit()
    return _page_json(row)


@router.delete("/api/comic-works/{work_id}/pages/{page_id}")
def delete_page(work_id: str, page_id: str, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    row = _page(db, work, page_id)
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.post("/api/comic-works/{work_id}/chapters/{chapter_id}/pages/reorder")
def reorder_pages(work_id: str, chapter_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    chapter = _chapter(db, work, chapter_id)
    ids = payload.get("page_ids") or []
    if not isinstance(ids, list):
        raise HTTPException(status_code=422, detail="页面顺序格式错误")
    rows = {row.id: row for row in db.query(models.ComicPage).filter(models.ComicPage.chapter_id == chapter.id).all()}
    if len(ids) != len(rows) or set(ids) != set(rows):
        raise HTTPException(status_code=422, detail="页面顺序必须覆盖当前章节全部页面")
    for index, page_id in enumerate(ids):
        rows[page_id].order_index = index
        rows[page_id].updated_at = _now()
    db.commit()
    return _workspace(db, work)


@router.post("/api/comic-works/{work_id}/assets")
def create_asset(work_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    file_url = str(payload.get("file_url") or "").strip()
    if not file_url:
        raise HTTPException(status_code=422, detail="资产文件不能为空")
    kind = str(payload.get("kind") or "illustration")
    if kind not in ASSET_KINDS:
        raise HTTPException(status_code=422, detail="资产类型非法")
    row = models.ComicAsset(
        work_id=work.id,
        kind=kind,
        title=str(payload.get("title") or "未命名图片").strip()[:160] or "未命名图片",
        file_url=file_url[:1000],
        mime_type=str(payload.get("mime_type") or "")[:120],
        file_size=int(payload.get("file_size") or 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _asset_json(row)


@router.delete("/api/comic-works/{work_id}/assets/{asset_id}")
def delete_asset(work_id: str, asset_id: str, request: Request, db: Session = Depends(get_db)):
    work = _work(db, request, work_id)
    row = db.query(models.ComicAsset).filter(
        models.ComicAsset.id == asset_id, models.ComicAsset.work_id == work.id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="资产不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok"}
