"""创作者文件与内容管理：文件夹树、内容资产、归档、回收站、发布记录。

核心原则：文件夹只负责组织；资产的 entity_type/entity_id 决定它和世界内容的关联。
删除前复用 reference_guard，避免把仍被故事/关系/事件引用的内容删断。
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import mimetypes
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from database import get_db
from reference_guard import collect_references
import storage
import access

router = APIRouter(tags=["creator-assets"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"}
ASSET_TYPES = {"world", "character", "location", "organization", "event", "story", "note", "image", "video", "audio"}
LINKED_TYPES = {"world", "character", "location", "organization", "event", "story"}
TYPE_LABELS = {
    "world": "世界", "character": "人物", "location": "地点", "organization": "组织",
    "event": "事件", "story": "章节/故事", "note": "笔记", "image": "图片/媒体", "video": "视频", "audio": "音频",
}
MODEL_BY_TYPE = {
    "character": models.Character,
    "location": models.Location,
    "organization": models.Organization,
    "event": models.Event,
    "story": models.Story,
}
UNFILED = "unfiled"


def _owner(request: Request) -> str:
    return str(getattr(request.state, "user_id", None) or "local")


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _clean_name(value: str, fallback: str = "未命名") -> str:
    name = str(value or "").strip()
    return (name or fallback)[:160]


def _get_folder(db: Session, owner: str, folder_id: str | None) -> models.CreatorFolder | None:
    if not folder_id or folder_id == UNFILED:
        return None
    folder = db.query(models.CreatorFolder).filter(
        models.CreatorFolder.id == folder_id,
        models.CreatorFolder.owner_id == owner,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    return folder


def _ensure_unfiled(db: Session, owner: str) -> models.CreatorFolder:
    folder = db.query(models.CreatorFolder).filter(
        models.CreatorFolder.owner_id == owner,
        models.CreatorFolder.system_key == UNFILED,
    ).first()
    if not folder:
        folder = models.CreatorFolder(
            owner_id=owner, name="未分类内容", parent_id=None,
            is_system=True, system_key=UNFILED, sort_order=999,
        )
        db.add(folder)
        db.flush()
    return folder


def _ensure_world_tree(db: Session, owner: str, world: models.World) -> dict[str, models.CreatorFolder]:
    """为一个世界建立“世界观设定 / 人物档案 / 地点档案 / 故事线 / 事件档案”子树。"""
    root = db.query(models.CreatorFolder).filter(
        models.CreatorFolder.owner_id == owner,
        models.CreatorFolder.system_key == f"world:{world.id}",
    ).first()
    if not root:
        root = models.CreatorFolder(
            owner_id=owner, world_id=world.id, name=world.name or "未命名世界",
            parent_id=None, system_key=f"world:{world.id}", sort_order=0,
        )
        db.add(root)
        db.flush()
    names = {
        "world_data": "世界观设定",
        "characters": "人物档案",
        "locations": "地点档案",
        "organizations": "组织档案",
        "stories": "故事线",
        "events": "事件档案",
    }
    result = {"root": root}
    for key, name in names.items():
        system_key = f"world:{world.id}:{key}"
        child = db.query(models.CreatorFolder).filter(
            models.CreatorFolder.owner_id == owner,
            models.CreatorFolder.system_key == system_key,
        ).first()
        if not child:
            child = models.CreatorFolder(
                owner_id=owner, world_id=world.id, name=name,
                parent_id=root.id, system_key=system_key,
            )
            db.add(child)
            db.flush()
        result[key] = child
    return result


def _folder_ids_with_descendants(db: Session, owner: str, root_id: str) -> list[str]:
    rows = db.query(models.CreatorFolder).filter(models.CreatorFolder.owner_id == owner).all()
    children: dict[str, list[str]] = {}
    for row in rows:
        if row.parent_id:
            children.setdefault(row.parent_id, []).append(row.id)
    result: list[str] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        result.append(current)
        stack.extend(children.get(current, []))
    return result


def _asset_counts(db: Session, owner: str) -> dict[str, int]:
    rows = (
        db.query(models.CreatorAsset.folder_id, func.count(models.CreatorAsset.id))
        .filter(models.CreatorAsset.owner_id == owner, models.CreatorAsset.status != "deleted")
        .group_by(models.CreatorAsset.folder_id)
        .all()
    )
    return {folder_id: count for folder_id, count in rows if folder_id}


def _folder_json(row: models.CreatorFolder, counts: dict[str, int], world_names: dict[str, str]) -> dict:
    return {
        "id": row.id,
        "owner_id": row.owner_id,
        "world_id": row.world_id,
        "world_name": world_names.get(row.world_id or "", ""),
        "parent_id": row.parent_id,
        "name": row.name,
        "sort_order": row.sort_order,
        "is_system": bool(row.is_system),
        "system_key": row.system_key,
        "asset_count": counts.get(row.id, 0),
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _asset_json(row: models.CreatorAsset, world_names: dict[str, str] | None = None) -> dict:
    world_names = world_names or {}
    return {
        "id": row.id,
        "owner_id": row.owner_id,
        "world_id": row.world_id,
        "world_name": world_names.get(row.world_id or "", ""),
        "folder_id": row.folder_id,
        "asset_type": row.asset_type,
        "asset_type_label": TYPE_LABELS.get(row.asset_type, row.asset_type),
        "entity_id": row.entity_id,
        "is_linked": bool(row.entity_id),
        "title": row.title,
        "description": row.description or "",
        "content": row.content or "",
        "file_url": row.file_url or "",
        "mime_type": row.mime_type or "",
        "file_size": row.file_size or 0,
        "status": row.status,
        "visibility": row.visibility,
        "scope": row.scope or [],
        "published_at": _iso(row.published_at),
        "archived_at": _iso(row.archived_at),
        "deleted_at": _iso(row.deleted_at),
        "original_folder_id": row.original_folder_id,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _snapshot(row: models.CreatorAsset) -> dict:
    data = _asset_json(row)
    data.pop("world_name", None)
    return data


def _references_for(db: Session, row: models.CreatorAsset) -> list[dict]:
    if not row.entity_id or row.asset_type not in {"character", "location", "organization", "event"}:
        return []
    return collect_references(db, row.world_id or "", row.asset_type, row.entity_id)


def _assert_deletable(db: Session, row: models.CreatorAsset) -> None:
    if row.asset_type == "world":
        raise HTTPException(
            status_code=409,
            detail={"code": "WORLD_MANAGED_ELSEWHERE", "message": "世界资产请使用归档；删除世界请到「世界管理」处理，避免整世界数据断裂。"},
        )
    refs = _references_for(db, row)
    if refs:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "HAS_DEPENDENTS",
                "message": f"《{row.title}》仍被 {len(refs)} 处内容引用，不能删除。请先解绑，或改为归档。",
                "references": refs,
            },
        )


def _soft_delete(db: Session, owner: str, row: models.CreatorAsset) -> models.CreatorAsset:
    if row.status == "deleted":
        return row
    _assert_deletable(db, row)
    row.deleted_from_status = row.status if row.status in {"draft", "published"} else "draft"
    row.original_folder_id = row.folder_id
    row.deleted_at = _now()
    row.status = "deleted"
    row.folder_id = None
    row.updated_at = _now()
    db.add(models.CreatorTrashEntry(
        asset_id=row.id,
        owner_id=owner,
        original_folder_id=row.original_folder_id,
        snapshot=_snapshot(row),
    ))
    db.flush()
    return row


def _new_asset(
    db: Session,
    owner: str,
    *,
    asset_type: str,
    title: str,
    folder_id: str | None,
    world_id: str | None = None,
    entity_id: str | None = None,
    description: str = "",
    content: str = "",
    file_url: str = "",
    mime_type: str = "",
    file_size: int = 0,
) -> models.CreatorAsset:
    folder = _get_folder(db, owner, folder_id)
    if not folder:
        folder = _ensure_unfiled(db, owner)
    row = models.CreatorAsset(
        owner_id=owner,
        world_id=world_id or (folder.world_id if folder else None),
        folder_id=folder.id,
        asset_type=asset_type,
        entity_id=entity_id,
        title=_clean_name(title),
        description=description or "",
        content=content or "",
        file_url=file_url or "",
        mime_type=mime_type or "",
        file_size=file_size or 0,
        status="draft",
        visibility="private",
        scope=[],
    )
    db.add(row)
    db.flush()
    return row


@router.get("/api/creator-assets/tree")
def get_tree(request: Request, world_id: str = "", db: Session = Depends(get_db)):
    owner = _owner(request)
    _ensure_unfiled(db, owner)
    db.commit()
    rows = db.query(models.CreatorFolder).filter(models.CreatorFolder.owner_id == owner).order_by(
        models.CreatorFolder.sort_order.asc(), models.CreatorFolder.name.asc()
    ).all()
    counts = _asset_counts(db, owner)
    worlds = db.query(models.World).filter(models.World.owner_id == owner).all()
    world_names = {world.id: world.name for world in worlds}
    return {
        "folders": [_folder_json(row, counts, world_names) for row in rows],
        "worlds": [{"id": w.id, "name": w.name} for w in worlds if not w.deleted_at],
        "unfiled_id": next((row.id for row in rows if row.system_key == UNFILED), None),
    }


@router.post("/api/creator-assets/folders")
def create_folder(payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    name = _clean_name(payload.get("name"), "新建文件夹")
    parent = _get_folder(db, owner, payload.get("parent_id"))
    world_id = payload.get("world_id") or (parent.world_id if parent else None)
    if world_id:
        world = db.query(models.World).filter(models.World.id == world_id, models.World.owner_id == owner).first()
        if not world:
            raise HTTPException(status_code=404, detail="世界不存在")
    duplicate = db.query(models.CreatorFolder).filter(
        models.CreatorFolder.owner_id == owner,
        models.CreatorFolder.parent_id == (parent.id if parent else None),
        models.CreatorFolder.name == name,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="同一层级下已有同名文件夹")
    row = models.CreatorFolder(
        owner_id=owner, world_id=world_id, parent_id=parent.id if parent else None,
        name=name, sort_order=int(payload.get("sort_order") or 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _folder_json(row, {}, {})


@router.patch("/api/creator-assets/folders/{folder_id}")
def update_folder(folder_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = _get_folder(db, owner, folder_id)
    if not row:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    if "name" in payload:
        if row.is_system:
            raise HTTPException(status_code=409, detail="系统文件夹不能重命名")
        row.name = _clean_name(payload.get("name"), row.name)
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or 0)
    if "parent_id" in payload:
        if row.is_system:
            raise HTTPException(status_code=409, detail="系统文件夹不能移动")
        parent = _get_folder(db, owner, payload.get("parent_id"))
        if parent:
            if parent.id == row.id:
                raise HTTPException(status_code=400, detail="不能把文件夹移动到自身")
            descendants = set(_folder_ids_with_descendants(db, owner, row.id))
            if parent.id in descendants:
                raise HTTPException(status_code=400, detail="不能把文件夹移动到自己的子文件夹")
        row.parent_id = parent.id if parent else None
        if parent:
            row.world_id = parent.world_id
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _folder_json(row, _asset_counts(db, owner), {})


@router.delete("/api/creator-assets/folders/{folder_id}")
def delete_folder(folder_id: str, request: Request, recursive: bool = False, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = _get_folder(db, owner, folder_id)
    if not row:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    if row.is_system:
        raise HTTPException(status_code=409, detail="系统文件夹不能删除")
    ids = _folder_ids_with_descendants(db, owner, row.id)
    child_count = max(0, len(ids) - 1)
    assets = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.owner_id == owner,
        models.CreatorAsset.folder_id.in_(ids),
        models.CreatorAsset.status != "deleted",
    ).all()
    if (child_count or assets) and not recursive:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "FOLDER_NOT_EMPTY",
                "message": f"文件夹内还有 {child_count} 个子文件夹、{len(assets)} 项内容。请先移动或删除，或选择连同内容移入回收站。",
                "child_folders": child_count,
                "assets": len(assets),
            },
        )
    for asset in assets:
        _soft_delete(db, owner, asset)
    for fid in reversed(ids):
        folder = db.query(models.CreatorFolder).filter(models.CreatorFolder.id == fid).first()
        if folder:
            db.delete(folder)
    db.commit()
    return {"status": "ok", "deleted_folders": len(ids), "trashed_assets": len(assets)}


@router.post("/api/creator-assets/import")
def import_world_assets(payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    world_id = str(payload.get("world_id") or "")
    world = db.query(models.World).filter(
        models.World.id == world_id, models.World.owner_id == owner, models.World.deleted_at.is_(None)
    ).first()
    if not world:
        raise HTTPException(status_code=404, detail="世界不存在或无权访问")
    tree = _ensure_world_tree(db, owner, world)
    created = 0

    def add(asset_type: str, entity_id: str, title: str, folder_key: str, description: str = ""):
        nonlocal created
        exists = db.query(models.CreatorAsset).filter(
            models.CreatorAsset.owner_id == owner,
            models.CreatorAsset.asset_type == asset_type,
            models.CreatorAsset.entity_id == entity_id,
        ).first()
        if exists:
            return
        _new_asset(
            db, owner, asset_type=asset_type, entity_id=entity_id, title=title,
            folder_id=tree[folder_key].id, world_id=world.id, description=description,
        )
        created += 1

    add("world", world.id, world.name, "world_data", world.description or "")
    for row in db.query(models.Character).filter(models.Character.world_id == world.id).all():
        add("character", row.id, row.name, "characters", (row.basic_profile or {}).get("description", "") if isinstance(row.basic_profile, dict) else "")
    for row in db.query(models.Location).filter(models.Location.world_id == world.id).all():
        add("location", row.id, row.name, "locations", row.description or "")
    for row in db.query(models.Organization).filter(models.Organization.world_id == world.id).all():
        add("organization", row.id, row.name, "organizations", row.description or "")
    for row in db.query(models.Event).filter(models.Event.world_id == world.id).all():
        add("event", row.id, row.name, "events", row.description or "")
    for row in db.query(models.Story).filter(models.Story.world_id == world.id).all():
        add("story", row.id, row.title, "stories", row.summary or "")
    db.commit()
    return {"status": "ok", "created": created, "world_id": world.id, "root_folder_id": tree["root"].id}


@router.get("/api/creator-assets")
def list_assets(
    request: Request,
    view: str = "active",
    folder_id: str = "",
    world_id: str = "",
    asset_type: str = "",
    status: str = "",
    visibility: str = "",
    q: str = "",
    include_descendants: bool = False,
    db: Session = Depends(get_db),
):
    owner = _owner(request)
    query = db.query(models.CreatorAsset).filter(models.CreatorAsset.owner_id == owner)
    if view == "archive":
        query = query.filter(models.CreatorAsset.status == "archived")
    elif view == "trash":
        query = query.filter(models.CreatorAsset.status == "deleted")
    else:
        query = query.filter(models.CreatorAsset.status.notin_(["archived", "deleted"]))
    if folder_id:
        if folder_id == UNFILED:
            query = query.filter(models.CreatorAsset.folder_id.is_(None))
        elif include_descendants:
            ids = _folder_ids_with_descendants(db, owner, folder_id)
            query = query.filter(models.CreatorAsset.folder_id.in_(ids))
        else:
            query = query.filter(models.CreatorAsset.folder_id == folder_id)
    if world_id:
        query = query.filter(models.CreatorAsset.world_id == world_id)
    if asset_type:
        query = query.filter(models.CreatorAsset.asset_type == asset_type)
    if status:
        query = query.filter(models.CreatorAsset.status == status)
    if visibility:
        query = query.filter(models.CreatorAsset.visibility == visibility)
    term = str(q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(or_(
            models.CreatorAsset.title.ilike(like),
            models.CreatorAsset.description.ilike(like),
            models.CreatorAsset.content.ilike(like),
        ))
    rows = query.order_by(models.CreatorAsset.updated_at.desc()).limit(800).all()
    worlds = db.query(models.World).all()
    world_names = {world.id: world.name for world in worlds}
    return {
        "items": [_asset_json(row, world_names) for row in rows],
        "total": len(rows),
        "view": view,
    }


@router.get("/api/creator-assets/public")
def public_assets(limit: int = 60, db: Session = Depends(get_db)):
    rows = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.status == "published",
        models.CreatorAsset.visibility == "public",
    ).order_by(models.CreatorAsset.published_at.desc()).limit(max(1, min(limit, 200))).all()
    worlds = {world.id: world.name for world in db.query(models.World).all()}
    return {"items": [_asset_json(row, worlds) for row in rows]}


@router.post("/api/creator-assets/upload")
async def upload_file(request: Request, filename: str = ""):
    raw_name = filename or request.headers.get("x-filename", "") or "upload"
    safe_name = Path(raw_name).name[:120]
    ext = Path(safe_name).suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        guessed = mimetypes.guess_extension(request.headers.get("content-type", "").split(";")[0]) or ""
        ext = guessed if guessed in IMAGE_EXTENSIONS else ""
    if not ext:
        raise HTTPException(status_code=400, detail="仅支持 png/jpg/webp/gif/svg/pdf 文件")
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="文件为空")
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="文件超过 15MB")
    stored = f"{uuid.uuid4().hex}{ext}"
    mime_type = request.headers.get("content-type", "").split(";")[0] or mimetypes.guess_type(stored)[0] or ""
    saved = storage.save(stored, body, mime_type)
    return {
        "file_url": saved["file_url"],
        "storage": saved["storage"],
        "mime_type": mime_type,
        "file_size": len(body),
        "original_name": safe_name,
    }


@router.post("/api/creator-assets")
def create_asset(payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    asset_type = str(payload.get("asset_type") or "note")
    if asset_type not in ASSET_TYPES:
        raise HTTPException(status_code=400, detail="不支持的内容类型")
    title = str(payload.get("title") or "").strip()
    entity_id = str(payload.get("entity_id") or "").strip() or None
    world_id = str(payload.get("world_id") or "").strip() or None
    if asset_type in LINKED_TYPES and not entity_id:
        raise HTTPException(status_code=400, detail="关联型内容必须提供源内容 ID；普通文件请使用笔记/图片类型")
    if asset_type in LINKED_TYPES and entity_id:
        model = MODEL_BY_TYPE.get(asset_type) or (models.World if asset_type == "world" else None)
        row = db.query(model).filter(model.id == entity_id).first() if model else None
        if not row:
            raise HTTPException(status_code=404, detail="要关联的源内容不存在")
        if asset_type == "world":
            access.assert_world_access(db, row.id, request)
        else:
            access.assert_entity_access(db, row, request, allow_free=True)
        if not title:
            title = getattr(row, "name", None) or getattr(row, "title", None) or entity_id
        if not world_id:
            world_id = getattr(row, "world_id", None) or (row.id if asset_type == "world" else None)
        exists = db.query(models.CreatorAsset).filter(
            models.CreatorAsset.owner_id == owner,
            models.CreatorAsset.asset_type == asset_type,
            models.CreatorAsset.entity_id == entity_id,
        ).first()
        if exists:
            raise HTTPException(status_code=409, detail="该内容已经存在于资产库")
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if asset_type == "image" and not payload.get("file_url"):
        raise HTTPException(status_code=400, detail="图片资产需要先上传文件")
    row = _new_asset(
        db, owner,
        asset_type=asset_type,
        title=title,
        folder_id=payload.get("folder_id"),
        world_id=world_id,
        entity_id=entity_id,
        description=str(payload.get("description") or ""),
        content=str(payload.get("content") or ""),
        file_url=str(payload.get("file_url") or ""),
        mime_type=str(payload.get("mime_type") or ""),
        file_size=int(payload.get("file_size") or 0),
    )
    db.commit()
    db.refresh(row)
    return _asset_json(row)


@router.get("/api/creator-assets/{asset_id}")
def get_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    worlds = {world.id: world.name for world in db.query(models.World).all()}
    data = _asset_json(row, worlds)
    data["references"] = _references_for(db, row)
    publications = db.query(models.CreatorPublication).filter(
        models.CreatorPublication.asset_id == row.id
    ).order_by(models.CreatorPublication.version_no.desc()).all()
    data["publications"] = [
        {
            "id": pub.id, "version_no": pub.version_no, "visibility": pub.visibility,
            "scope": pub.scope or [], "published_at": _iso(pub.published_at),
            "unpublished_at": _iso(pub.unpublished_at),
        }
        for pub in publications
    ]
    return data


@router.patch("/api/creator-assets/{asset_id}")
def update_asset(asset_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status == "deleted":
        raise HTTPException(status_code=409, detail="回收站中的内容请先恢复再编辑")
    if "title" in payload:
        row.title = _clean_name(payload.get("title"), row.title)
    if "description" in payload:
        row.description = str(payload.get("description") or "")
    if "content" in payload:
        row.content = str(payload.get("content") or "")
    if "folder_id" in payload:
        folder = _get_folder(db, owner, payload.get("folder_id"))
        row.folder_id = folder.id if folder else _ensure_unfiled(db, owner).id
        if folder and not row.world_id:
            row.world_id = folder.world_id
    if "visibility" in payload:
        visibility = str(payload.get("visibility") or row.visibility)
        if visibility not in {"private", "scoped", "public"}:
            raise HTTPException(status_code=400, detail="可见性不合法")
        if visibility != "private" and row.status != "published":
            raise HTTPException(status_code=409, detail="只有已发布内容可以设为公开或指定范围")
        row.visibility = visibility
        row.scope = payload.get("scope") if isinstance(payload.get("scope"), list) else row.scope
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _asset_json(row)


@router.post("/api/creator-assets/{asset_id}/archive")
def archive_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status == "deleted":
        raise HTTPException(status_code=409, detail="已删除内容不能归档")
    if row.status != "archived":
        row.archived_from_status = row.status if row.status in {"draft", "published"} else "draft"
        row.status = "archived"
        row.archived_at = _now()
        row.updated_at = _now()
        db.commit()
    return {"status": "ok", "asset": _asset_json(row)}


@router.post("/api/creator-assets/{asset_id}/restore-archive")
def restore_archive(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status != "archived":
        raise HTTPException(status_code=409, detail="该内容不在归档中")
    row.status = row.archived_from_status if row.archived_from_status in {"draft", "published"} else "draft"
    row.archived_at = None
    row.updated_at = _now()
    db.commit()
    return {"status": "ok", "asset": _asset_json(row)}


@router.post("/api/creator-assets/{asset_id}/publish")
def publish_asset(asset_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status in {"archived", "deleted"}:
        raise HTTPException(status_code=409, detail="归档或回收站中的内容不能直接发布")
    visibility = str(payload.get("visibility") or "public")
    if visibility not in {"private", "scoped", "public"}:
        raise HTTPException(status_code=400, detail="可见性不合法")
    scope = payload.get("scope") if isinstance(payload.get("scope"), list) else []
    if visibility == "scoped" and not scope:
        raise HTTPException(status_code=400, detail="指定范围可见需要至少一个用户/成员")
    row.status = "published"
    row.visibility = visibility
    row.scope = scope
    row.published_at = _now()
    row.updated_at = _now()
    latest = db.query(func.max(models.CreatorPublication.version_no)).filter(
        models.CreatorPublication.asset_id == row.id
    ).scalar() or 0
    pub = models.CreatorPublication(
        asset_id=row.id, owner_id=owner, version_no=latest + 1,
        title=row.title, visibility=visibility, scope=scope,
        snapshot=_snapshot(row), published_at=row.published_at,
    )
    db.add(pub)
    db.commit()
    return {"status": "ok", "asset": _asset_json(row), "publication_version": pub.version_no}


@router.post("/api/creator-assets/{asset_id}/unpublish")
def unpublish_asset(asset_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status != "published":
        raise HTTPException(status_code=409, detail="只有已发布内容可以下架")
    visibility = str(payload.get("visibility") or "private")
    if visibility not in {"private", "scoped"}:
        raise HTTPException(status_code=400, detail="下架后只能转为私密或指定范围")
    row.visibility = visibility
    row.scope = payload.get("scope") if isinstance(payload.get("scope"), list) else []
    row.updated_at = _now()
    pub = db.query(models.CreatorPublication).filter(
        models.CreatorPublication.asset_id == row.id,
        models.CreatorPublication.unpublished_at.is_(None),
    ).order_by(models.CreatorPublication.version_no.desc()).first()
    if pub:
        pub.unpublished_at = _now()
    db.commit()
    return {"status": "ok", "asset": _asset_json(row)}


@router.post("/api/creator-assets/{asset_id}/duplicate")
def duplicate_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.asset_type not in {"note", "image"}:
        raise HTTPException(status_code=409, detail="关联型内容不能复制，请在源模块中复制")
    copy = _new_asset(
        db, owner, asset_type=row.asset_type, title=f"{row.title} · 副本",
        folder_id=row.folder_id, world_id=row.world_id, description=row.description,
        content=row.content, file_url=row.file_url, mime_type=row.mime_type, file_size=row.file_size,
    )
    db.commit()
    db.refresh(copy)
    return _asset_json(copy)


@router.delete("/api/creator-assets/{asset_id}")
def delete_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    _soft_delete(db, owner, row)
    db.commit()
    return {"status": "ok", "trashed": True, "asset": _asset_json(row)}


@router.post("/api/creator-assets/{asset_id}/restore")
def restore_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status != "deleted":
        raise HTTPException(status_code=409, detail="该内容不在回收站中")
    row.status = row.deleted_from_status if row.deleted_from_status in {"draft", "published"} else "draft"
    row.deleted_at = None
    folder = db.query(models.CreatorFolder).filter(
        models.CreatorFolder.id == row.original_folder_id,
        models.CreatorFolder.owner_id == owner,
    ).first()
    row.folder_id = folder.id if folder else _ensure_unfiled(db, owner).id
    entry = db.query(models.CreatorTrashEntry).filter(
        models.CreatorTrashEntry.asset_id == row.id,
        models.CreatorTrashEntry.owner_id == owner,
        models.CreatorTrashEntry.restored_at.is_(None),
        models.CreatorTrashEntry.purged_at.is_(None),
    ).order_by(models.CreatorTrashEntry.deleted_at.desc()).first()
    if entry:
        entry.restored_at = _now()
    db.commit()
    return {"status": "ok", "asset": _asset_json(row)}


@router.delete("/api/creator-assets/{asset_id}/purge")
def purge_asset(asset_id: str, request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    row = db.query(models.CreatorAsset).filter(
        models.CreatorAsset.id == asset_id, models.CreatorAsset.owner_id == owner
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="内容不存在")
    if row.status != "deleted":
        raise HTTPException(status_code=409, detail="只有回收站中的内容可以永久移除")
    refs = _references_for(db, row)
    if refs:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "HAS_DEPENDENTS",
                "message": f"《{row.title}》仍被 {len(refs)} 处内容引用，不能永久移除。",
                "references": refs,
            },
        )
    # 资产库只永久移除资产记录；关联型内容的源数据由原模块负责，避免跨界级联删除。
    linked = bool(row.entity_id)
    file_url = row.file_url
    entry = db.query(models.CreatorTrashEntry).filter(
        models.CreatorTrashEntry.asset_id == row.id,
        models.CreatorTrashEntry.owner_id == owner,
    ).order_by(models.CreatorTrashEntry.deleted_at.desc()).first()
    if entry:
        entry.purged_at = _now()
    db.delete(row)
    db.flush()
    still_used = db.query(models.CreatorAsset).filter(models.CreatorAsset.file_url == file_url).count()
    if not still_used:
        try:
            storage.delete(file_url)
        except OSError:
            pass
    db.commit()
    return {"status": "ok", "purged": True, "source_preserved": linked}
