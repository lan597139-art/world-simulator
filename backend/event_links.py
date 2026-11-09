"""事件参与方：event_entities 的增删查，并与旧 participants/affected 字段同步。"""

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, resolve_entity, utcnow
from database import get_db

router = APIRouter()

ROLES = {"participant", "affected", "location", "organization", "trigger"}


def _dict(row: models.EventEntity) -> dict:
    return {
        "id": row.id,
        "event_id": row.event_id,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "role": row.role,
        "impact": row.impact or "",
    }


@router.get("/api/events/{event_id}/entities")
def list_event_entities(event_id: str, db: Session = Depends(get_db)):
    get_or_404(db, models.Event, event_id, "事件")
    rows = (
        db.query(models.EventEntity)
        .filter(models.EventEntity.event_id == event_id)
        .all()
    )
    return [_dict(row) for row in rows]


@router.post("/api/events/{event_id}/entities")
def add_event_entity(event_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    event = get_or_404(db, models.Event, event_id, "事件")
    if not event.world_id:
        fail(409, "INVALID_STATE", "事件未绑定世界，不能关联实体")
    role = payload.get("role") or "participant"
    entity_type = payload.get("entity_type") or "character"
    entity_id = payload.get("entity_id")
    if role not in ROLES or not entity_id:
        fail(422, "VALIDATION_ERROR", "参数非法")
    resolve_entity(db, event.world_id, entity_type, entity_id)

    existing = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.event_id == event.id,
            models.EventEntity.entity_type == entity_type,
            models.EventEntity.entity_id == entity_id,
            models.EventEntity.role == role,
        )
        .first()
    )
    if existing:
        return _dict(existing)

    row = models.EventEntity(
        world_id=event.world_id,
        event_id=event.id,
        entity_type=entity_type,
        entity_id=entity_id,
        category="impact" if role == "affected" else "participant",
        role=role,
        impact=payload.get("impact") or "",
        description=payload.get("impact") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dict(row)


@router.delete("/api/event-entities/{entity_id}")
def delete_event_entity(entity_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.EventEntity, entity_id, "事件参与方")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


def sync_event_entities(db: Session, event: models.Event):
    """把旧 participants/affected/location_id/organization_id 同步成 event_entities。

    只覆盖 participant/affected 两类，location/organization 只在缺失时补，避免覆盖手工配置。
    """
    if not event.world_id:
        return
    db.query(models.EventEntity).filter(
        models.EventEntity.event_id == event.id,
        models.EventEntity.category.in_(["participant", "impact"]),
    ).delete(synchronize_session=False)

    pairs = [("character", pid, "participant", "participant") for pid in (event.participants or []) if pid]
    pairs += [("character", pid, "impact", "affected") for pid in (event.affected or []) if pid]
    seen = set()
    for entity_type, entity_id, category, role in pairs:
        key = (entity_type, entity_id, category)
        if key in seen:
            continue
        seen.add(key)
        db.add(
            models.EventEntity(
                world_id=event.world_id,
                event_id=event.id,
                entity_type=entity_type,
                entity_id=entity_id,
                category=category,
                role=role,
            )
        )

    for entity_type, entity_id, role in (
        ("location", event.location_id, "location"),
        ("organization", event.organization_id, "organization"),
    ):
        if not entity_id:
            continue
        exists = (
            db.query(models.EventEntity)
            .filter(
                models.EventEntity.event_id == event.id,
                models.EventEntity.role == role,
            )
            .first()
        )
        if exists:
            continue
        db.add(
            models.EventEntity(
                world_id=event.world_id,
                event_id=event.id,
                entity_type=entity_type,
                entity_id=entity_id,
                role=role,
            )
        )
