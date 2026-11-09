"""事件参与方、影响对象、事件因果与人物事件认知。"""

from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, parse_datetime, resolve_entity, utcnow
from database import get_db

router = APIRouter()

EVENT_RELATION_TYPES = {
    "causes": "直接导致",
    "contributes_to": "促成",
    "triggers": "触发",
    "prevents": "阻止",
    "enables": "使其成为可能",
    "escalates": "加剧",
    "follows": "时间上后续",
    "correlates_with": "相关（因果未确认）",
}

PARTICIPANT_ROLES = {"发起者", "执行者", "决策者", "协助者", "见证者", "受益者", "反对者"}

IMPACT_TYPES = {"损失", "收益", "状态改变", "关系改变", "机会", "风险", "认知冲击"}


def _entity_row(row: models.EventEntity) -> dict:
    return {
        "id": row.id,
        "event_id": row.event_id,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "category": row.category or "participant",
        "role": row.role,
        "participant_role": row.participant_role,
        "impact_type": row.impact_type,
        "impact_level": row.impact_level,
        "is_confirmed": bool(row.is_confirmed) if row.is_confirmed is not None else True,
        "description": row.description or row.impact or "",
    }


def _event(db: Session, event_id: str) -> models.Event:
    event = get_or_404(db, models.Event, event_id, "事件")
    if not event.world_id:
        fail(409, "INVALID_STATE", "事件未绑定世界，不能关联实体")
    return event


# ---------------------------------------------------------------------
# 参与者
# ---------------------------------------------------------------------


@router.get("/api/events/{event_id}/participants")
def list_participants(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.event_id == event_id,
            models.EventEntity.category == "participant",
        )
        .all()
    )
    return [_entity_row(row) for row in rows]


@router.post("/api/events/{event_id}/participants")
def add_participant(event_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    event = _event(db, event_id)
    entity_type = payload.get("entity_type") or "character"
    entity_id = payload.get("entity_id")
    role = payload.get("participant_role") or "发起者"
    if not entity_id:
        fail(422, "VALIDATION_ERROR", "缺少 entity_id")
    if role not in PARTICIPANT_ROLES:
        fail(422, "VALIDATION_ERROR", f"参与者角色非法：{role}")
    resolve_entity(db, event.world_id, entity_type, entity_id)

    existing = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.event_id == event.id,
            models.EventEntity.entity_type == entity_type,
            models.EventEntity.entity_id == entity_id,
            models.EventEntity.category == "participant",
        )
        .first()
    )
    if existing:
        existing.participant_role = role
        existing.description = payload.get("description") or existing.description
        db.commit()
        return _entity_row(existing)

    row = models.EventEntity(
        world_id=event.world_id,
        event_id=event.id,
        entity_type=entity_type,
        entity_id=entity_id,
        category="participant",
        role="participant",
        participant_role=role,
        description=payload.get("description") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _entity_row(row)


# ---------------------------------------------------------------------
# 影响对象
# ---------------------------------------------------------------------


@router.get("/api/events/{event_id}/impacts")
def list_impacts(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.event_id == event_id,
            models.EventEntity.category == "impact",
        )
        .all()
    )
    return [_entity_row(row) for row in rows]


@router.post("/api/events/{event_id}/impacts")
def add_impact(event_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    event = _event(db, event_id)
    entity_type = payload.get("entity_type") or "character"
    entity_id = payload.get("entity_id")
    impact_type = payload.get("impact_type") or "状态改变"
    if not entity_id:
        fail(422, "VALIDATION_ERROR", "缺少 entity_id")
    if impact_type not in IMPACT_TYPES:
        fail(422, "VALIDATION_ERROR", f"影响类型非法：{impact_type}")
    resolve_entity(db, event.world_id, entity_type, entity_id)

    existing = (
        db.query(models.EventEntity)
        .filter(
            models.EventEntity.event_id == event.id,
            models.EventEntity.entity_type == entity_type,
            models.EventEntity.entity_id == entity_id,
            models.EventEntity.category == "impact",
        )
        .first()
    )
    if existing:
        existing.impact_type = impact_type
        existing.impact_level = payload.get("impact_level") or existing.impact_level
        existing.is_confirmed = payload.get("is_confirmed", existing.is_confirmed)
        existing.description = payload.get("description") or existing.description
        db.commit()
        return _entity_row(existing)

    row = models.EventEntity(
        world_id=event.world_id,
        event_id=event.id,
        entity_type=entity_type,
        entity_id=entity_id,
        category="impact",
        role="impact",
        impact_type=impact_type,
        impact_level=payload.get("impact_level"),
        is_confirmed=payload.get("is_confirmed", True),
        description=payload.get("description") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _entity_row(row)


# ---------------------------------------------------------------------
# 事件因果
# ---------------------------------------------------------------------


def _relation_row(row: models.EventRelation) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "source_event_id": row.source_event_id,
        "target_event_id": row.target_event_id,
        "relation_type": row.relation_type,
        "relation_label": EVENT_RELATION_TYPES.get(row.relation_type, row.relation_type),
        "description": row.description or "",
        "confidence": row.confidence,
        "evidence": row.evidence or "",
    }


@router.get("/api/worlds/{world_id}/event-relations")
def list_relations(
    world_id: str,
    event_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    query = db.query(models.EventRelation).filter(models.EventRelation.world_id == world_id)
    if event_id:
        query = query.filter(
            (models.EventRelation.source_event_id == event_id)
            | (models.EventRelation.target_event_id == event_id)
        )
    rows = query.order_by(models.EventRelation.created_at).all()
    return [_relation_row(row) for row in rows]


@router.post("/api/event-relations")
def create_relation(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    source_id = payload.get("source_event_id")
    target_id = payload.get("target_event_id")
    relation_type = payload.get("relation_type") or "causes"
    if not (world_id and source_id and target_id):
        fail(422, "VALIDATION_ERROR", "缺少 world_id / source_event_id / target_event_id")
    if source_id == target_id:
        fail(422, "VALIDATION_ERROR", "事件不能与自己建立因果关系")
    if relation_type not in EVENT_RELATION_TYPES:
        fail(422, "VALIDATION_ERROR", "因果关系类型非法")

    get_world(db, world_id)
    source = get_or_404(db, models.Event, source_id, "起因事件")
    target = get_or_404(db, models.Event, target_id, "结果事件")
    for event in (source, target):
        if event.world_id != world_id:
            fail(409, "WORLD_MISMATCH", "事件不属于当前世界")

    duplicate = (
        db.query(models.EventRelation)
        .filter(
            models.EventRelation.source_event_id == source_id,
            models.EventRelation.target_event_id == target_id,
            models.EventRelation.relation_type == relation_type,
        )
        .first()
    )
    if duplicate:
        fail(409, "INVALID_STATE", "相同的因果关联已存在")

    confidence = payload.get("confidence")
    if confidence is not None:
        confidence = float(confidence)
        if not 0 <= confidence <= 1:
            fail(422, "VALIDATION_ERROR", "confidence 必须在 0-1 之间")

    row = models.EventRelation(
        world_id=world_id,
        source_event_id=source_id,
        target_event_id=target_id,
        relation_type=relation_type,
        description=payload.get("description") or "",
        confidence=confidence,
        evidence=payload.get("evidence") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _relation_row(row)


@router.patch("/api/event-relations/{relation_id}")
def update_relation(relation_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    row = get_or_404(db, models.EventRelation, relation_id, "事件因果")
    if "relation_type" in payload and payload["relation_type"] not in EVENT_RELATION_TYPES:
        fail(422, "VALIDATION_ERROR", "因果关系类型非法")
    for key in ("relation_type", "description", "confidence", "evidence"):
        if key in payload:
            setattr(row, key, payload[key])
    row.updated_at = utcnow()
    db.commit()
    return _relation_row(row)


@router.delete("/api/event-relations/{relation_id}")
def delete_relation(relation_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.EventRelation, relation_id, "事件因果")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# 人物事件认知
# ---------------------------------------------------------------------


def _perception_row(row: models.CharacterEventPerception) -> dict:
    return {
        "id": row.id,
        "character_id": row.character_id,
        "event_id": row.event_id,
        "perceived_content": row.perceived_content or "",
        "perceived_polarity": row.perceived_polarity,
        "perceived_intensity": row.perceived_intensity,
        "attribution_target": row.attribution_target,
        "certainty": row.certainty,
        "information_source": row.information_source or "",
        "perceived_at": row.perceived_at,
    }


@router.get("/api/events/{event_id}/perceptions")
def list_perceptions(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = (
        db.query(models.CharacterEventPerception)
        .filter(models.CharacterEventPerception.event_id == event_id)
        .all()
    )
    return [_perception_row(row) for row in rows]


@router.post("/api/events/{event_id}/perceptions")
def create_perception(event_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    event = _event(db, event_id)
    character_id = payload.get("character_id")
    if not character_id:
        fail(422, "VALIDATION_ERROR", "缺少 character_id")
    character = get_or_404(db, models.Character, character_id, "人物")
    if character.world_id and character.world_id != event.world_id:
        fail(409, "WORLD_MISMATCH", "人物不属于事件所在世界")

    certainty = payload.get("certainty")
    if certainty is not None:
        certainty = float(certainty)
        if not 0 <= certainty <= 1:
            fail(422, "VALIDATION_ERROR", "certainty 必须在 0-1 之间")

    existing = (
        db.query(models.CharacterEventPerception)
        .filter(
            models.CharacterEventPerception.event_id == event.id,
            models.CharacterEventPerception.character_id == character.id,
        )
        .first()
    )
    row = existing or models.CharacterEventPerception(
        world_id=event.world_id, event_id=event.id, character_id=character.id
    )
    row.perceived_content = payload.get("perceived_content") or ""
    row.perceived_polarity = payload.get("perceived_polarity")
    row.perceived_intensity = payload.get("perceived_intensity")
    row.attribution_target = payload.get("attribution_target")
    row.certainty = certainty
    row.information_source = payload.get("information_source") or ""
    row.perceived_at = parse_datetime(payload.get("perceived_at")) or utcnow()
    if not existing:
        db.add(row)
    db.commit()
    db.refresh(row)
    return _perception_row(row)


@router.delete("/api/perceptions/{perception_id}")
def delete_perception(perception_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.CharacterEventPerception, perception_id, "事件认知")
    db.delete(row)
    db.commit()
    return {"status": "ok"}
