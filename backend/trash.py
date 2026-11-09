"""全局回收站 API：列出、恢复、彻底清空。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from trash_service import LABEL_BY_TYPE, list_entries, restore_entry

router = APIRouter()


@router.get("/api/trash")
def get_trash(world_id: str = "", db: Session = Depends(get_db)):
    rows = list_entries(db, world_id)
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
def restore_trash_item(trash_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TrashEntry).filter(models.TrashEntry.id == trash_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="回收站记录不存在")
    try:
        row = restore_entry(db, entry)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"status": "ok", "restored": True, "id": getattr(row, "id", None)}


@router.delete("/api/trash/{trash_id}")
def discard_trash_item(trash_id: str, db: Session = Depends(get_db)):
    entry = db.query(models.TrashEntry).filter(models.TrashEntry.id == trash_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="回收站记录不存在")
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
def empty_trash(db: Session = Depends(get_db)):
    entries = db.query(models.TrashEntry).all()
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
