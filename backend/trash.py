"""全局回收站 API：列出、恢复、彻底清空。"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_

import models
from database import get_db
from trash_service import LABEL_BY_TYPE, list_entries, restore_entry

router = APIRouter()


def _owner(request: Request) -> str:
    return str(getattr(request.state, "user_id", None) or "local")


def _entry_for(db: Session, request: Request, trash_id: str) -> models.TrashEntry:
    entry = db.query(models.TrashEntry).filter(models.TrashEntry.id == trash_id).first()
    if not entry or (entry.owner_user_id or "local") != _owner(request):
        raise HTTPException(status_code=404, detail="回收站记录不存在")
    return entry


@router.get("/api/trash")
def get_trash(request: Request, world_id: str = "", db: Session = Depends(get_db)):
    owner = _owner(request)
    rows = list_entries(db, world_id, owner)
    if owner == "local":
        legacy = db.query(models.TrashEntry).filter(
            or_(models.TrashEntry.owner_user_id.is_(None), models.TrashEntry.owner_user_id == "")
        ).all()
        seen = {row.id for row in rows}
        rows = rows + [row for row in legacy if row.id not in seen]
        rows.sort(key=lambda row: row.deleted_at or datetime.min, reverse=True)
    world_names = {world.id: world.name for world in db.query(models.World).all()}
    return [
        {
            "id": row.id,
            "entity_type": row.entity_type,
            "entity_type_label": LABEL_BY_TYPE.get(row.entity_type, row.entity_type),
            "entity_id": row.entity_id,
            "name": row.name,
            "world_id": row.world_id,
            "world_name": world_names.get(row.world_id, ""),
            "deleted_at": row.deleted_at,
            "can_restore": row.entity_type in {
                "world", "character", "location", "event", "organization", "relationship", "story"
            },
        }
        for row in rows
    ]


@router.post("/api/trash/{trash_id}/restore")
def restore_trash_item(trash_id: str, request: Request, db: Session = Depends(get_db)):
    entry = _entry_for(db, request, trash_id)
    try:
        row = restore_entry(db, entry)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"status": "ok", "restored": True, "id": getattr(row, "id", None)}


@router.delete("/api/trash/{trash_id}")
def discard_trash_item(trash_id: str, request: Request, db: Session = Depends(get_db)):
    entry = _entry_for(db, request, trash_id)
    if entry.entity_type == "world":
        world = db.query(models.World).filter(models.World.id == entry.entity_id).first()
        if world:
            # 彻底删除，连同世界内数据。
            from world_lifecycle import _cascade_delete_world

            _cascade_delete_world(db, world.id)
            db.delete(world)
    db.delete(entry)
    db.commit()
    return {"status": "ok", "discarded": True}


@router.delete("/api/trash")
def empty_trash(request: Request, db: Session = Depends(get_db)):
    owner = _owner(request)
    if owner == "local":
        entries = db.query(models.TrashEntry).filter(
            or_(models.TrashEntry.owner_user_id == "local", models.TrashEntry.owner_user_id.is_(None), models.TrashEntry.owner_user_id == "")
        ).all()
    else:
        entries = db.query(models.TrashEntry).filter(models.TrashEntry.owner_user_id == owner).all()
    for entry in entries:
        if entry.entity_type == "world":
            world = db.query(models.World).filter(models.World.id == entry.entity_id).first()
            if world:
                from world_lifecycle import _cascade_delete_world

                _cascade_delete_world(db, world.id)
                db.delete(world)
        db.delete(entry)
    db.commit()
    return {"status": "ok", "count": len(entries)}
