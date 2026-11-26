"""世界创作导航接口：背景 / 地图册 / 插画集 / 共创选择 / 世界作品 / 世界社区。

对应创作导航中的 7 个条目，全部以世界为作用域：
- 背景：复用世界本体的 background / description（由 /api/worlds/{id} 维护），此处只读回显。
- 设定：复用既有世界设定（地点 / 组织 / 资源），不在本模块重复实现。
- 地图：世界地图册，一个世界可有多张不同尺度的地图。
- 作品：聚合引用了当前世界的创意作品，并给出主作品 / 副作品 / 同人文 / 传记的归类。
- 插画集：世界相关插画。
- 共创：世界共创的开发选择，配合既有协作成员邀请使用。
- 社区：该世界下的讨论话题与群组，与全站公共社区（world_id 为 NULL）隔离。
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from access import current_user_id, get_world_for_request, world_role
from database import get_db

router = APIRouter(prefix="/api")

WRITE_ROLES = {"owner", "editor"}
MAP_SCALES = {"world", "region", "city", "district", "building", "other"}


def _iso(value) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else (str(value) if value else None)


def _clip(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _require_read(world: models.World, user_id: str, db: Session) -> None:
    if world_role(world, user_id, db) == "none":
        raise HTTPException(status_code=403, detail="无权访问该世界")


def _require_write(world: models.World, user_id: str, db: Session) -> None:
    if world_role(world, user_id, db) not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="需要世界编辑权限")


def _map_row(row: models.WorldMap) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "name": row.name,
        "description": row.description or "",
        "image_url": row.image_url or "",
        "map_scale": row.map_scale or "world",
        "sort_order": row.sort_order or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _illustration_row(row: models.WorldIllustration) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "title": row.title,
        "description": row.description or "",
        "image_url": row.image_url or "",
        "sort_order": row.sort_order or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _choice_row(row: models.WorldCocreationChoice) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "title": row.title,
        "description": row.description or "",
        "sort_order": row.sort_order or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _work_kind(row: models.CreativeWork, main_id: str | None) -> str:
    category = row.category or ""
    if "同人" in category:
        return "fanfic"
    if "传记" in category or row.scene == "diary":
        return "biography"
    return "main" if row.id == main_id else "side"


def _work_row(row: models.CreativeWork, main_id: str | None) -> dict:
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
        "work_kind": _work_kind(row, main_id),
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


# ---------------------------------------------------------------------------
# 地图册
# ---------------------------------------------------------------------------

@router.get("/worlds/{world_id}/maps")
def list_maps(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    rows = (
        db.query(models.WorldMap)
        .filter(models.WorldMap.world_id == world.id)
        .order_by(models.WorldMap.sort_order.asc(), models.WorldMap.created_at.desc())
        .all()
    )
    return [_map_row(row) for row in rows]


@router.post("/worlds/{world_id}/maps")
def create_map(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    name = _clip(payload.get("name"), 160)
    if not name:
        raise HTTPException(status_code=422, detail="地图名称不能为空")
    row = models.WorldMap(
        world_id=world.id,
        name=name,
        description=_clip(payload.get("description"), 5000),
        image_url=_clip(payload.get("image_url"), 1200),
        map_scale=_clip(payload.get("map_scale"), 24) or "world",
        sort_order=int(payload.get("sort_order") or 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _map_row(row)


@router.patch("/worlds/{world_id}/maps/{map_id}")
def update_map(world_id: str, map_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldMap).filter(
        models.WorldMap.id == map_id, models.WorldMap.world_id == world.id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="地图不存在")
    if "name" in payload:
        name = _clip(payload.get("name"), 160)
        if not name:
            raise HTTPException(status_code=422, detail="地图名称不能为空")
        row.name = name
    if "description" in payload:
        row.description = _clip(payload.get("description"), 5000)
    if "image_url" in payload:
        row.image_url = _clip(payload.get("image_url"), 1200)
    if "map_scale" in payload:
        scale = _clip(payload.get("map_scale"), 24) or "world"
        if scale not in MAP_SCALES:
            raise HTTPException(status_code=422, detail="地图尺度非法")
        row.map_scale = scale
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or 0)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _map_row(row)


@router.delete("/worlds/{world_id}/maps/{map_id}")
def delete_map(world_id: str, map_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldMap).filter(
        models.WorldMap.id == map_id, models.WorldMap.world_id == world.id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="地图不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 插画集
# ---------------------------------------------------------------------------

@router.get("/worlds/{world_id}/illustrations")
def list_illustrations(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    rows = (
        db.query(models.WorldIllustration)
        .filter(models.WorldIllustration.world_id == world.id)
        .order_by(models.WorldIllustration.sort_order.asc(), models.WorldIllustration.created_at.desc())
        .all()
    )
    return [_illustration_row(row) for row in rows]


@router.post("/worlds/{world_id}/illustrations")
def create_illustration(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    title = _clip(payload.get("title"), 160)
    if not title:
        raise HTTPException(status_code=422, detail="插画标题不能为空")
    row = models.WorldIllustration(
        world_id=world.id,
        title=title,
        description=_clip(payload.get("description"), 5000),
        image_url=_clip(payload.get("image_url"), 1200),
        sort_order=int(payload.get("sort_order") or 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _illustration_row(row)


@router.patch("/worlds/{world_id}/illustrations/{illustration_id}")
def update_illustration(world_id: str, illustration_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldIllustration).filter(
        models.WorldIllustration.id == illustration_id,
        models.WorldIllustration.world_id == world.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="插画不存在")
    if "title" in payload:
        title = _clip(payload.get("title"), 160)
        if not title:
            raise HTTPException(status_code=422, detail="插画标题不能为空")
        row.title = title
    if "description" in payload:
        row.description = _clip(payload.get("description"), 5000)
    if "image_url" in payload:
        row.image_url = _clip(payload.get("image_url"), 1200)
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or 0)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _illustration_row(row)


@router.delete("/worlds/{world_id}/illustrations/{illustration_id}")
def delete_illustration(world_id: str, illustration_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldIllustration).filter(
        models.WorldIllustration.id == illustration_id,
        models.WorldIllustration.world_id == world.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="插画不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 共创开发选择
# ---------------------------------------------------------------------------

@router.get("/worlds/{world_id}/cocreation-choices")
def list_cocreation_choices(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    rows = (
        db.query(models.WorldCocreationChoice)
        .filter(models.WorldCocreationChoice.world_id == world.id)
        .order_by(models.WorldCocreationChoice.sort_order.asc(), models.WorldCocreationChoice.created_at.desc())
        .all()
    )
    return [_choice_row(row) for row in rows]


@router.post("/worlds/{world_id}/cocreation-choices")
def create_cocreation_choice(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    title = _clip(payload.get("title"), 160)
    if not title:
        raise HTTPException(status_code=422, detail="选择项名称不能为空")
    row = models.WorldCocreationChoice(
        world_id=world.id,
        title=title,
        description=_clip(payload.get("description"), 5000),
        sort_order=int(payload.get("sort_order") or 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _choice_row(row)


@router.patch("/worlds/{world_id}/cocreation-choices/{choice_id}")
def update_cocreation_choice(world_id: str, choice_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldCocreationChoice).filter(
        models.WorldCocreationChoice.id == choice_id,
        models.WorldCocreationChoice.world_id == world.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="共创选择不存在")
    if "title" in payload:
        title = _clip(payload.get("title"), 160)
        if not title:
            raise HTTPException(status_code=422, detail="选择项名称不能为空")
        row.title = title
    if "description" in payload:
        row.description = _clip(payload.get("description"), 5000)
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or 0)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _choice_row(row)


@router.delete("/worlds/{world_id}/cocreation-choices/{choice_id}")
def delete_cocreation_choice(world_id: str, choice_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    row = db.query(models.WorldCocreationChoice).filter(
        models.WorldCocreationChoice.id == choice_id,
        models.WorldCocreationChoice.world_id == world.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="共创选择不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# 世界作品
# ---------------------------------------------------------------------------

@router.get("/worlds/{world_id}/works")
def list_world_works(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    rows = db.query(models.CreativeWork).filter(
        models.CreativeWork.status != "archived"
    ).order_by(models.CreativeWork.created_at.asc()).all()
    matched = [row for row in rows if world.id in (row.world_ids or [])]
    main_id = matched[0].id if matched else None
    return [_work_row(row, main_id) for row in matched]


# ---------------------------------------------------------------------------
# 世界社区
# ---------------------------------------------------------------------------

@router.get("/worlds/{world_id}/community")
def world_community(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    topics = (
        db.query(models.CommunityTopic)
        .filter(
            models.CommunityTopic.world_id == world.id,
            models.CommunityTopic.status == "active",
        )
        .order_by(models.CommunityTopic.created_at.desc())
        .limit(100)
        .all()
    )
    groups = (
        db.query(models.CommunityGroup)
        .filter(
            models.CommunityGroup.world_id == world.id,
            models.CommunityGroup.status == "active",
        )
        .order_by(models.CommunityGroup.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "topics": [
            {
                "id": row.id,
                "owner_user_id": row.owner_user_id,
                "category": row.category,
                "title": row.title,
                "body": row.body or "",
                "tags": row.tags or [],
                "view_count": row.view_count or 0,
                "created_at": _iso(row.created_at),
                "updated_at": _iso(row.updated_at),
            }
            for row in topics
        ],
        "groups": [
            {
                "id": row.id,
                "owner_user_id": row.owner_user_id,
                "name": row.name,
                "description": row.description or "",
                "category": row.category,
                "visibility": row.visibility,
                "created_at": _iso(row.created_at),
            }
            for row in groups
        ],
    }


@router.post("/worlds/{world_id}/community/topics")
def create_world_topic(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_read(world, current_user_id(request), db)
    user_id = current_user_id(request)
    title = _clip(payload.get("title"), 120)
    body = _clip(payload.get("body"), 20000)
    if len(title) < 2:
        raise HTTPException(status_code=422, detail="标题至少 2 个字符")
    if len(body) < 2:
        raise HTTPException(status_code=422, detail="正文至少 2 个字符")
    row = models.CommunityTopic(
        owner_user_id=user_id,
        world_id=world.id,
        category=_clip(payload.get("category"), 40) or "discussion",
        title=title,
        body=body,
        tags=[_clip(item, 24) for item in (payload.get("tags") if isinstance(payload.get("tags"), list) else [])][:8],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "world_id": row.world_id,
        "category": row.category,
        "title": row.title,
        "body": row.body or "",
        "tags": row.tags or [],
        "view_count": row.view_count or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


@router.post("/worlds/{world_id}/community/groups")
def create_world_group(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    _require_write(world, current_user_id(request), db)
    name = _clip(payload.get("name"), 120)
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="群组名称至少 2 个字符")
    row = models.CommunityGroup(
        owner_user_id=current_user_id(request),
        world_id=world.id,
        name=name,
        description=_clip(payload.get("description"), 5000),
        category=_clip(payload.get("category"), 40) or "interest",
        visibility=_clip(payload.get("visibility"), 16) or "public",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "world_id": row.world_id,
        "name": row.name,
        "description": row.description or "",
        "category": row.category,
        "visibility": row.visibility,
        "created_at": _iso(row.created_at),
    }
