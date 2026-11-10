"""统一时间线：只读取事件、状态历史、资源流水，不维护第二套历史。"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from common import entity_name, get_world
from database import get_db

router = APIRouter()

SCOPES = {"world", "character", "organization", "location", "resource", "social_group"}


def _event_items(db: Session, world_id: str, scope: str, entity_id: Optional[str]):
    query = db.query(models.Event).filter(
        models.Event.world_id == world_id, models.Event.branch_id.is_(None)
    )
    if scope != "world" and entity_id:
        linked = {
            row[0]
            for row in db.query(models.EventEntity.event_id)
            .filter(
                models.EventEntity.world_id == world_id,
                models.EventEntity.entity_type == scope,
                models.EventEntity.entity_id == entity_id,
            )
            .all()
        }
        if scope == "location":
            linked |= {
                row[0]
                for row in db.query(models.Event.id)
                .filter(
                    models.Event.world_id == world_id,
                    models.Event.location_id == entity_id,
                    models.Event.branch_id.is_(None),
                )
                .all()
            }
        if scope == "organization":
            linked |= {
                row[0]
                for row in db.query(models.Event.id)
                .filter(
                    models.Event.world_id == world_id,
                    models.Event.organization_id == entity_id,
                    models.Event.branch_id.is_(None),
                )
                .all()
            }
        if not linked:
            return []
        query = query.filter(models.Event.id.in_(linked))

    items = []
    for event in query.all():
        items.append(
            {
                "kind": "event",
                "id": event.id,
                "occurred_at": event.occurred_at or event.created_at,
                "title": event.name,
                "description": event.description or "",
                "entity_type": "event",
                "entity_id": event.id,
                "event_id": event.id,
                "meta": {
                    "polarity": event.polarity,
                    "intensity": event.intensity,
                    "storyline": event.storyline,
                    "scale": event.scale,
                    "domain": event.domain or [],
                    "story_time": event.story_time,
                },
            }
        )
    return items


def _appointment_label(db: Session, appointment_id: str) -> str:
    appt = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.id == appointment_id)
        .first()
    )
    if not appt:
        return "任职"
    character = (
        db.query(models.Character)
        .filter(models.Character.id == appt.character_id)
        .first()
    )
    position = (
        db.query(models.OrganizationPosition)
        .filter(models.OrganizationPosition.id == appt.position_id)
        .first()
    )
    return f"{character.name if character else '人物'} — {position.name if position else '职位'}（任职）"


def _relationship_label(db: Session, relationship_id: str) -> str:
    rel = (
        db.query(models.Relationship)
        .filter(models.Relationship.id == relationship_id)
        .first()
    )
    if not rel:
        return "关系"
    source = entity_name(db, rel.source_type or "character", rel.source_id)
    target = entity_name(db, rel.target_type or "character", rel.target_id)
    return f"{source or '未知'} — {rel.relation_type or '关系'} — {target or '未知'}"


def _history_items(db: Session, world_id: str, scope: str, entity_id: Optional[str]):
    query = db.query(models.StateHistory).filter(models.StateHistory.world_id == world_id)

    if scope == "character" and entity_id:
        appointment_ids = [
            row[0]
            for row in db.query(models.CharacterAppointment.id)
            .filter(models.CharacterAppointment.character_id == entity_id)
            .all()
        ]
        rel_ids = [
            row[0]
            for row in db.query(models.Relationship.id)
            .filter(
                models.Relationship.world_id == world_id,
                (
                    ((models.Relationship.source_type == "character")
                     & (models.Relationship.source_id == entity_id))
                    | ((models.Relationship.target_type == "character")
                       & (models.Relationship.target_id == entity_id))
                ),
            )
            .all()
        ]
        query = query.filter(
            (
                (models.StateHistory.entity_type == "character")
                & (models.StateHistory.entity_id == entity_id)
            )
            | (
                (models.StateHistory.entity_type == "appointment")
                & (models.StateHistory.entity_id.in_(appointment_ids or [""]))
            )
            | (
                (models.StateHistory.entity_type == "relationship")
                & (models.StateHistory.entity_id.in_(rel_ids or [""]))
            )
        )
    elif scope == "organization" and entity_id:
        unit_ids = [
            row[0]
            for row in db.query(models.OrganizationUnit.id)
            .filter(models.OrganizationUnit.organization_id == entity_id)
            .all()
        ]
        position_ids = [
            row[0]
            for row in db.query(models.OrganizationPosition.id)
            .filter(models.OrganizationPosition.organization_id == entity_id)
            .all()
        ]
        appointment_ids = [
            row[0]
            for row in db.query(models.CharacterAppointment.id)
            .filter(models.CharacterAppointment.organization_id == entity_id)
            .all()
        ]
        rel_ids = [
            row[0]
            for row in db.query(models.Relationship.id)
            .filter(
                models.Relationship.world_id == world_id,
                (
                    ((models.Relationship.source_type == "organization")
                     & (models.Relationship.source_id == entity_id))
                    | ((models.Relationship.target_type == "organization")
                       & (models.Relationship.target_id == entity_id))
                ),
            )
            .all()
        ]
        query = query.filter(
            (
                (models.StateHistory.entity_type == "organization")
                & (models.StateHistory.entity_id == entity_id)
            )
            | (
                (models.StateHistory.entity_type == "organization_unit")
                & (models.StateHistory.entity_id.in_(unit_ids or [""]))
            )
            | (
                (models.StateHistory.entity_type == "organization_position")
                & (models.StateHistory.entity_id.in_(position_ids or [""]))
            )
            | (
                (models.StateHistory.entity_type == "appointment")
                & (models.StateHistory.entity_id.in_(appointment_ids or [""]))
            )
            | (
                (models.StateHistory.entity_type == "relationship")
                & (models.StateHistory.entity_id.in_(rel_ids or [""]))
            )
        )
    elif scope in {"location", "resource", "social_group"} and entity_id:
        query = query.filter(
            models.StateHistory.entity_type == scope,
            models.StateHistory.entity_id == entity_id,
        )

    items = []
    for row in query.all():
        if row.entity_type == "relationship":
            display = _relationship_label(db, row.entity_id)
        elif row.entity_type == "appointment":
            display = _appointment_label(db, row.entity_id)
        else:
            display = entity_name(db, row.entity_type, row.entity_id) or row.entity_type
        items.append(
            {
                "kind": "history",
                "id": row.id,
                "occurred_at": row.occurred_at,
                "title": f"{display} · {row.field}",
                "description": f"{row.old_value} → {row.new_value}",
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "event_id": row.event_id,
                "meta": {
                    "field": row.field,
                    "old_value": row.old_value,
                    "new_value": row.new_value,
                    "reason": row.reason,
                    "source": row.source,
                },
            }
        )
    return items


def _transaction_items(db: Session, world_id: str, scope: str, entity_id: Optional[str]):
    query = db.query(models.ResourceTransaction).filter(
        models.ResourceTransaction.world_id == world_id
    )
    if scope == "resource" and entity_id:
        query = query.filter(models.ResourceTransaction.resource_id == entity_id)
    elif scope not in {"world", "resource"}:
        return []

    items = []
    for row in query.all():
        resource = (
            db.query(models.Resource).filter(models.Resource.id == row.resource_id).first()
        )
        items.append(
            {
                "kind": "transaction",
                "id": row.id,
                "occurred_at": row.occurred_at,
                "title": f"资源变动 · {resource.name if resource else '资源'}",
                "description": f"{row.amount:+g} {resource.unit if resource else ''} {row.reason}".strip(),
                "entity_type": "resource",
                "entity_id": row.resource_id,
                "event_id": row.event_id,
                "meta": {
                    "amount": row.amount,
                    "reason": row.reason,
                    "quantity": resource.quantity if resource else None,
                },
            }
        )
    return items


@router.get("/api/worlds/{world_id}/timeline")
def get_timeline(
    world_id: str,
    scope: str = "world",
    entity_id: Optional[str] = None,
    kinds: str = "event,history,transaction",
    limit: int = 300,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    if scope not in SCOPES:
        scope = "world"
    wanted = {item.strip() for item in kinds.split(",") if item.strip()}

    items = []
    if "event" in wanted:
        items += _event_items(db, world_id, scope, entity_id)
    if "history" in wanted:
        items += _history_items(db, world_id, scope, entity_id)
    if "transaction" in wanted:
        items += _transaction_items(db, world_id, scope, entity_id)

    items.sort(key=lambda item: (item["occurred_at"] is None, item["occurred_at"]), reverse=True)
    limited = items[: max(1, min(limit, 500))]

    counts = {"event": 0, "history": 0, "transaction": 0}
    for item in items:
        counts[item["kind"]] = counts.get(item["kind"], 0) + 1

    return {"scope": scope, "entity_id": entity_id, "counts": counts, "items": limited}
