"""时光机：世界全量快照与一键回滚。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from world_lifecycle import dump_world, restore_world, snapshot_json

router = APIRouter()


def _world_or_404(db: Session, world_id: str):
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="世界不存在")
    return world


@router.get("/api/worlds/{world_id}/snapshots")
def list_snapshots(world_id: str, db: Session = Depends(get_db)):
    _world_or_404(db, world_id)
    rows = (
        db.query(models.WorldSnapshot)
        .filter(models.WorldSnapshot.world_id == world_id)
        .order_by(models.WorldSnapshot.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "label": row.label,
            "entity_count": row.entity_count,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/api/worlds/{world_id}/snapshots")
def create_snapshot(world_id: str, payload: dict | None = None, db: Session = Depends(get_db)):
    _world_or_404(db, world_id)
    label = str((payload or {}).get("label") or "").strip()[:80]
    if not label:
        label = "手动快照 " + datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    payload_json, count, _ = snapshot_json(db, world_id)
    row = models.WorldSnapshot(
        world_id=world_id,
        label=label,
        data=payload_json,
        entity_count=count,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "world_id": row.world_id,
        "label": row.label,
        "entity_count": row.entity_count,
        "created_at": row.created_at,
    }


@router.post("/api/worlds/{world_id}/snapshots/{snapshot_id}/restore")
def restore_snapshot(world_id: str, snapshot_id: str, db: Session = Depends(get_db)):
    _world_or_404(db, world_id)
    row = db.query(models.WorldSnapshot).filter(
        models.WorldSnapshot.id == snapshot_id,
        models.WorldSnapshot.world_id == world_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="快照不存在")
    import json

    try:
        data = json.loads(row.data or "{}")
        restore_world(db, world_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"回滚失败：{exc}") from exc
    return {"status": "ok", "restored": True, "entity_count": row.entity_count}


@router.delete("/api/worlds/{world_id}/snapshots/{snapshot_id}")
def delete_snapshot(world_id: str, snapshot_id: str, db: Session = Depends(get_db)):
    row = db.query(models.WorldSnapshot).filter(
        models.WorldSnapshot.id == snapshot_id,
        models.WorldSnapshot.world_id == world_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="快照不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok"}
