"""世界规则与适用范围。"""

from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, record_history, resolve_entity, utcnow
from database import get_db

router = APIRouter()

SCOPE_TYPES = {
    "world", "location", "organization", "organization_unit",
    "social_group", "character", "resource",
}
CATEGORIES = {"natural", "social", "legal", "economic", "special"}


def _rule_dict(rule: models.WorldRule, scopes) -> dict:
    return {
        "id": rule.id,
        "world_id": rule.world_id,
        "name": rule.name,
        "rule_category": rule.rule_category,
        "description": rule.description or "",
        "conditions": rule.conditions or "",
        "consequences": rule.consequences or "",
        "priority": rule.priority,
        "status": rule.status,
        "effective_from": rule.effective_from,
        "effective_until": rule.effective_until,
        "scopes": scopes,
    }


def _scope_dict(scope: models.RuleScope) -> dict:
    return {"id": scope.id, "scope_type": scope.scope_type, "scope_id": scope.scope_id}


def _load_scopes(db: Session, rule_ids):
    rows = (
        db.query(models.RuleScope)
        .filter(models.RuleScope.rule_id.in_(rule_ids or [""]))
        .all()
    )
    grouped = {}
    for row in rows:
        grouped.setdefault(row.rule_id, []).append(_scope_dict(row))
    return grouped


def _validate_scope(db: Session, world_id: str, scope_type: str, scope_id: str):
    if scope_type not in SCOPE_TYPES:
        fail(422, "VALIDATION_ERROR", f"适用范围类型非法：{scope_type}")
    if scope_type == "world":
        if scope_id != world_id:
            fail(409, "WORLD_MISMATCH", "世界级规则只能绑定当前世界")
        return
    if scope_type == "organization_unit":
        unit = get_or_404(db, models.OrganizationUnit, scope_id, "组织单元")
        if unit.world_id != world_id:
            fail(409, "WORLD_MISMATCH", "组织单元不属于当前世界")
        return
    resolve_entity(db, world_id, scope_type, scope_id)


@router.get("/api/worlds/{world_id}/rules")
def list_rules(world_id: str, status: Optional[str] = None, db: Session = Depends(get_db)):
    get_world(db, world_id)
    query = db.query(models.WorldRule).filter(models.WorldRule.world_id == world_id)
    if status:
        query = query.filter(models.WorldRule.status == status)
    rows = query.order_by(models.WorldRule.priority.desc(), models.WorldRule.created_at).all()
    scopes = _load_scopes(db, [r.id for r in rows])
    return [_rule_dict(rule, scopes.get(rule.id, [])) for rule in rows]


@router.get("/api/worlds/{world_id}/rules/applicable")
def applicable_rules(
    world_id: str,
    scope_type: str,
    scope_id: str,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    rules = (
        db.query(models.WorldRule)
        .filter(models.WorldRule.world_id == world_id, models.WorldRule.status == "active")
        .all()
    )
    scopes = _load_scopes(db, [r.id for r in rules])
    result = []
    for rule in rules:
        for scope in scopes.get(rule.id, []):
            if scope["scope_type"] == "world" or (
                scope["scope_type"] == scope_type and scope["scope_id"] == scope_id
            ):
                result.append(_rule_dict(rule, scopes.get(rule.id, [])))
                break
    return result


@router.post("/api/worlds/{world_id}/rules")
def create_rule(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "规则名称不能为空")
    category = payload.get("rule_category") or "social"
    if category not in CATEGORIES:
        fail(422, "VALIDATION_ERROR", "规则分类非法")

    scopes = payload.get("scopes") or []
    for scope in scopes:
        _validate_scope(db, world_id, scope.get("scope_type"), scope.get("scope_id"))

    rule = models.WorldRule(
        world_id=world_id,
        name=name,
        rule_category=category,
        description=payload.get("description") or "",
        conditions=payload.get("conditions") or "",
        consequences=payload.get("consequences") or "",
        priority=int(payload.get("priority") or 0),
        status=payload.get("status") or "active",
        effective_from=payload.get("effective_from"),
        effective_until=payload.get("effective_until"),
    )
    db.add(rule)
    db.flush()
    for scope in scopes:
        db.add(
            models.RuleScope(
                rule_id=rule.id, scope_type=scope["scope_type"], scope_id=scope["scope_id"]
            )
        )
    db.commit()
    db.refresh(rule)
    return _rule_dict(rule, _load_scopes(db, [rule.id]).get(rule.id, []))


@router.patch("/api/rules/{rule_id}")
@router.put("/api/rules/{rule_id}")
def update_rule(rule_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    rule = get_or_404(db, models.WorldRule, rule_id, "规则")
    if "status" in payload and payload["status"] != rule.status:
        record_history(
            db, rule.world_id, "rule", rule.id, "status", rule.status, payload["status"],
            reason="规则状态变更",
        )
    for key in (
        "name", "rule_category", "description", "conditions", "consequences",
        "priority", "status", "effective_from", "effective_until",
    ):
        if key in payload:
            setattr(rule, key, payload[key])

    if "scopes" in payload:
        db.query(models.RuleScope).filter(models.RuleScope.rule_id == rule.id).delete()
        for scope in payload["scopes"] or []:
            _validate_scope(db, rule.world_id, scope.get("scope_type"), scope.get("scope_id"))
            db.add(
                models.RuleScope(
                    rule_id=rule.id, scope_type=scope["scope_type"], scope_id=scope["scope_id"]
                )
            )
    rule.updated_at = utcnow()
    db.commit()
    db.refresh(rule)
    return _rule_dict(rule, _load_scopes(db, [rule.id]).get(rule.id, []))


@router.delete("/api/rules/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = get_or_404(db, models.WorldRule, rule_id, "规则")
    db.query(models.RuleScope).filter(models.RuleScope.rule_id == rule.id).delete()
    db.delete(rule)
    db.commit()
    return {"status": "ok"}
