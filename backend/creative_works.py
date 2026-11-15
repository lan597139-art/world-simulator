"""创作中心统一作品：四个场景共享的作品元数据与引用关系。

作品只保存元数据、封面和引用，不复制世界/人物/章节内容；打开作品后仍进入
对应产品工作台创作。这样游戏、文学、虚拟角色、日记与传记不会产生四套作品库。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import access
import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["creative-works"])

SCENES = {"game", "literature", "companion", "diary"}
STATUSES = {"draft", "in_progress", "completed", "archived"}

SCENE_CATEGORIES = {
    "game": ["世界观", "角色扮演", "剧情互动", "模拟经营", "其他"],
    "literature": ["长篇小说", "短篇小说", "系列作品", "同人创作", "其他"],
    "companion": ["AI 角色", "陪伴角色", "群像角色", "其他"],
    "diary": ["日记", "人物传记", "回忆录", "人生记录", "其他"],
}

MAX_TITLE = 160
MAX_CATEGORY = 60
MAX_COVER = 1200
MAX_LINKS = 200


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _ids(value) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        key = str(item or "").strip()
        if key and key not in result:
            result.append(key)
        if len(result) >= MAX_LINKS:
            break
    return result


def _row(row: models.CreativeWork) -> dict:
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "scene": row.scene,
        "title": row.title,
        "summary": row.summary or "",
        "category": row.category or "",
        "status": row.status or "draft",
        "cover_url": row.cover_url or "",
        "world_ids": row.world_ids or [],
        "character_ids": row.character_ids or [],
        "settings": row.settings or {},
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _me(request: Request, db: Session) -> models.AppUser:
    return current_user(request, db)


def _get_work(db: Session, user: models.AppUser, work_id: str) -> models.CreativeWork:
    row = db.query(models.CreativeWork).filter(
        models.CreativeWork.id == work_id,
        models.CreativeWork.owner_user_id == user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="作品不存在")
    return row


def _validate_scene(scene: str) -> str:
    if scene not in SCENES:
        raise HTTPException(status_code=422, detail="创作场景非法")
    return scene


def _validate_status(status: str) -> str:
    if status not in STATUSES:
        raise HTTPException(status_code=422, detail="作品状态非法")
    return status


def _validate_category(scene: str, category: str) -> str:
    allowed = SCENE_CATEGORIES[scene]
    if category and category not in allowed:
        raise HTTPException(status_code=422, detail="作品分类不属于当前创作场景")
    return category or allowed[-1]


def _validate_links(db: Session, request: Request, world_ids: list[str], character_ids: list[str]) -> None:
    for world_id in world_ids:
        access.assert_world_access(db, world_id, request, write=False)
    if character_ids:
        rows = db.query(models.Character).filter(models.Character.id.in_(character_ids)).all()
        found = {row.id for row in rows}
        missing = [item for item in character_ids if item not in found]
        if missing:
            raise HTTPException(status_code=422, detail="部分关联人物不存在")
        world_ids_for_people = {row.world_id for row in rows if row.world_id}
        for world_id in world_ids_for_people:
            access.assert_world_access(db, world_id, request, write=False)


def _apply_payload(
    db: Session,
    request: Request,
    row: models.CreativeWork,
    payload: dict,
    *,
    creating: bool,
) -> None:
    if creating or "scene" in payload:
        scene = _validate_scene(str(payload.get("scene") or row.scene))
        if not creating and scene != row.scene:
            raise HTTPException(status_code=422, detail="作品创建后不能切换创作场景")
        row.scene = scene
    else:
        scene = row.scene

    if creating or "title" in payload:
        title = _text(payload.get("title"), MAX_TITLE)
        if not title:
            raise HTTPException(status_code=422, detail="作品名称不能为空")
        row.title = title
    if "summary" in payload or creating:
        row.summary = _text(payload.get("summary"), 20000)
    if "category" in payload or creating:
        row.category = _validate_category(scene, _text(payload.get("category"), MAX_CATEGORY))
    if "status" in payload or creating:
        row.status = _validate_status(str(payload.get("status") or "draft"))
    if "cover_url" in payload:
        row.cover_url = _text(payload.get("cover_url"), MAX_COVER)
    if "world_ids" in payload or creating:
        row.world_ids = _ids(payload.get("world_ids"))
    if "character_ids" in payload or creating:
        row.character_ids = _ids(payload.get("character_ids"))
    if "settings" in payload:
        settings = payload.get("settings")
        row.settings = settings if isinstance(settings, dict) else {}
    _validate_links(db, request, row.world_ids or [], row.character_ids or [])


@router.get("/api/creative-works/summary")
def work_summary(request: Request, db: Session = Depends(get_db)):
    user = _me(request, db)
    rows = db.query(models.CreativeWork).filter(models.CreativeWork.owner_user_id == user.id).all()
    by_scene = {scene: 0 for scene in SCENES}
    by_status = {status: 0 for status in STATUSES}
    for row in rows:
        if row.scene in by_scene:
            by_scene[row.scene] += 1
        if row.status in by_status:
            by_status[row.status] += 1
    return {"total": len(rows), "by_scene": by_scene, "by_status": by_status}


@router.get("/api/creative-works")
def list_works(
    request: Request,
    scene: Optional[str] = None,
    status: Optional[str] = None,
    world_id: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
):
    user = _me(request, db)
    query = db.query(models.CreativeWork).filter(models.CreativeWork.owner_user_id == user.id)
    if scene:
        query = query.filter(models.CreativeWork.scene == _validate_scene(scene))
    if status:
        query = query.filter(models.CreativeWork.status == _validate_status(status))
    if q:
        needle = f"%{q.strip()[:80]}%"
        query = query.filter(or_(
            models.CreativeWork.title.ilike(needle),
            models.CreativeWork.summary.ilike(needle),
            models.CreativeWork.category.ilike(needle),
        ))
    rows = query.order_by(models.CreativeWork.updated_at.desc(), models.CreativeWork.created_at.desc()).all()
    if world_id:
        rows = [row for row in rows if world_id in (row.world_ids or [])]
    return [_row(row) for row in rows]


@router.post("/api/creative-works")
def create_work(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _me(request, db)
    row = models.CreativeWork(owner_user_id=user.id, scene="game", title="", status="draft")
    try:
        _apply_payload(db, request, row, payload, creating=True)
    except HTTPException:
        raise
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row(row)


@router.get("/api/creative-works/{work_id}")
def get_work(work_id: str, request: Request, db: Session = Depends(get_db)):
    user = _me(request, db)
    return _row(_get_work(db, user, work_id))


@router.patch("/api/creative-works/{work_id}")
def update_work(work_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _me(request, db)
    row = _get_work(db, user, work_id)
    _apply_payload(db, request, row, payload, creating=False)
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _row(row)


@router.delete("/api/creative-works/{work_id}")
def delete_work(work_id: str, request: Request, db: Session = Depends(get_db)):
    user = _me(request, db)
    row = _get_work(db, user, work_id)
    db.delete(row)
    db.commit()
    return {"status": "ok"}
