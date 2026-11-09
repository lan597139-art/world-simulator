"""跨实体关系：类型化端点、方向、状态与历史。"""

from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import (
    fail,
    get_or_404,
    get_world,
    record_history,
    parse_datetime,
    relationship_history,
    world_now,
    resolve_entity,
    utcnow,
)
from database import get_db
from relationship_types import resolve_type

router = APIRouter()

RELATION_FIELDS = {
    "relation_type", "description", "is_bidirectional", "status", "strength_level",
    "valid_from", "valid_until",
    "source_quadrant", "source_strength", "source_power", "source_value",
    "target_quadrant", "target_strength", "target_power", "target_value",
}


def _rel_dict(rel: models.Relationship, history=None) -> dict:
    return {
        "id": rel.id,
        "world_id": rel.world_id,
        "source_type": rel.source_type or "character",
        "source_id": rel.source_id,
        "target_type": rel.target_type or "character",
        "target_id": rel.target_id,
        "relation_type": rel.relation_type or "",
        "description": rel.description or "",
        "is_bidirectional": bool(rel.is_bidirectional),
        "status": rel.status or "active",
        "strength_level": rel.strength_level,
        "valid_from": rel.valid_from,
        "valid_until": rel.valid_until,
        "source_quadrant": rel.source_quadrant,
        "source_strength": rel.source_strength,
        "source_power": rel.source_power,
        "source_value": rel.source_value,
        "target_quadrant": rel.target_quadrant,
        "target_strength": rel.target_strength,
        "target_power": rel.target_power,
        "target_value": rel.target_value,
        "created_at": rel.created_at,
        "updated_at": rel.updated_at,
        "history": history or [],
    }


def _with_history(db: Session, rows):
    ids = [r.id for r in rows]
    histories = relationship_history(db, ids)
    return [_rel_dict(r, histories.get(r.id, [])) for r in rows]


@router.get("/api/relationships")
def list_relationships(
    world_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    relation_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Relationship)
    if world_id:
        get_world(db, world_id)
        query = query.filter(models.Relationship.world_id == world_id)
    if entity_type and entity_id:
        query = query.filter(
            ((models.Relationship.source_type == entity_type)
             & (models.Relationship.source_id == entity_id))
            | ((models.Relationship.target_type == entity_type)
               & (models.Relationship.target_id == entity_id))
        )
    elif entity_id:
        query = query.filter(
            (models.Relationship.source_id == entity_id)
            | (models.Relationship.target_id == entity_id)
        )
    if relation_type:
        query = query.filter(models.Relationship.relation_type == relation_type)
    if status:
        query = query.filter(models.Relationship.status == status)
    rows = query.order_by(models.Relationship.created_at.desc()).all()
    return _with_history(db, rows)


@router.post("/api/relationships")
def create_relationship(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    if not world_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id（必须绑定世界）")
    get_world(db, world_id)

    source_type = payload.get("source_type") or "character"
    target_type = payload.get("target_type") or "character"
    source_id = payload.get("source_id")
    target_id = payload.get("target_id")
    if not source_id or not target_id:
        fail(422, "VALIDATION_ERROR", "缺少关系两端")
    if source_id == target_id:
        fail(422, "VALIDATION_ERROR", "关系两端不能是同一对象")

    resolve_entity(db, world_id, source_type, source_id)
    resolve_entity(db, world_id, target_type, target_id)

    relation_type = (payload.get("relation_type") or "").strip()
    if not relation_type:
        fail(422, "VALIDATION_ERROR", "关系类型不能为空")

    duplicate = (
        db.query(models.Relationship)
        .filter(
            models.Relationship.world_id == world_id,
            models.Relationship.source_type == source_type,
            models.Relationship.source_id == source_id,
            models.Relationship.target_type == target_type,
            models.Relationship.target_id == target_id,
            models.Relationship.relation_type == relation_type,
            models.Relationship.status.in_(["active", "strained"]),
        )
        .first()
    )
    if duplicate:
        fail(409, "INVALID_STATE", "相同方向与类型的关系已存在")

    # 关系类型配置：校验端点类型组合，并按定义决定默认方向
    type_def = resolve_type(db, world_id, relation_type, source_type, target_type)
    bidirectional = payload.get("is_bidirectional")
    if bidirectional is None:
        bidirectional = not type_def.is_directional if type_def else False

    rel = models.Relationship(
        world_id=world_id,
        source_type=source_type,
        source_id=source_id,
        target_type=target_type,
        target_id=target_id,
        relation_type=relation_type,
        description=payload.get("description") or "",
        is_bidirectional=bool(bidirectional),
        status=payload.get("status") or "active",
        strength_level=payload.get("strength_level"),
        valid_from=parse_datetime(payload.get("valid_from")) or utcnow(),
        valid_until=parse_datetime(payload.get("valid_until")),
        source_quadrant=payload.get("source_quadrant") or "漠视",
        source_strength=payload.get("source_strength") or "中",
        source_power=payload.get("source_power") or "对等",
        source_value=payload.get("source_value") or "利己",
        target_quadrant=payload.get("target_quadrant"),
        target_strength=payload.get("target_strength"),
        target_power=payload.get("target_power"),
        target_value=payload.get("target_value"),
    )
    db.add(rel)
    db.flush()
    record_history(
        db, world_id, "relationship", rel.id, "status", None, rel.status,
        reason="建立关系",
        occurred_at=parse_datetime(payload.get("occurred_at")) or world_now(db, world_id),
    )
    db.commit()
    db.refresh(rel)
    return _rel_dict(rel, relationship_history(db, [rel.id]).get(rel.id, []))


def _apply_update(db: Session, rel: models.Relationship, payload: dict):
    happened_at = parse_datetime(payload.get("occurred_at")) or world_now(db, rel.world_id)
    if "relation_type" in payload and payload["relation_type"] != rel.relation_type:
        resolve_type(
            db, rel.world_id, payload["relation_type"],
            rel.source_type or "character", rel.target_type or "character",
        )
    for field in ("status", "relation_type", "is_bidirectional", "strength_level"):
        if field in payload and payload[field] != getattr(rel, field):
            record_history(
                db, rel.world_id, "relationship", rel.id, field,
                getattr(rel, field), payload[field], reason="关系变更",
                occurred_at=happened_at,
            )
    for key in RELATION_FIELDS:
        if key in payload:
            value = payload[key]
            if key in ("valid_from", "valid_until"):
                value = parse_datetime(value)
            setattr(rel, key, value)
    if payload.get("status") == "ended" and not rel.valid_until:
        rel.valid_until = utcnow()
    rel.updated_at = utcnow()


@router.put("/api/relationships/{relation_id}")
@router.patch("/api/relationships/{relation_id}")
def update_relationship(relation_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    rel = get_or_404(db, models.Relationship, relation_id, "关系")
    if rel.status == "ended" and payload.get("status") == "active":
        fail(409, "INVALID_STATE", "已结束的关系不能直接恢复，请新建关系")
    _apply_update(db, rel, payload)
    db.commit()
    db.refresh(rel)
    return _rel_dict(rel, relationship_history(db, [rel.id]).get(rel.id, []))


@router.delete("/api/relationships/{relation_id}")
def delete_relationship(relation_id: str, db: Session = Depends(get_db)):
    rel = get_or_404(db, models.Relationship, relation_id, "关系")
    if rel.status != "ended":
        record_history(
            db, rel.world_id, "relationship", rel.id, "status", rel.status, "ended",
            reason="删除关系（软删除）",
            occurred_at=world_now(db, rel.world_id),
        )
        rel.status = "ended"
        rel.valid_until = utcnow()
        rel.updated_at = utcnow()
        db.commit()
    return {"status": "ok", "soft_deleted": True}


@router.get("/api/relationships/{relation_id}/history")
def get_relationship_history(relation_id: str, db: Session = Depends(get_db)):
    rel = get_or_404(db, models.Relationship, relation_id, "关系")
    return relationship_history(db, [rel.id]).get(rel.id, [])


@router.get("/api/worlds/{world_id}/relationships")
def list_world_relationships(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.Relationship)
        .filter(models.Relationship.world_id == world_id)
        .order_by(models.Relationship.created_at.desc())
        .all()
    )
    return _with_history(db, rows)
