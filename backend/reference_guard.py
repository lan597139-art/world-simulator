"""删除前的引用检查：任何被引用的实体都不允许静默删除。

设计原则：不是简单拒绝，而是告诉调用方「被谁引用」，前端可据此提示先解绑。
"""

from sqlalchemy.orm import Session

import models
from common import fail

ENTITY_LABELS = {
    "character": "人物",
    "organization": "组织",
    "organization_unit": "部门",
    "organization_position": "职位",
    "location": "地点",
    "social_group": "群体",
    "society": "社会实体",
    "resource": "资源",
    "rule": "规则",
    "era": "时代",
    "event": "事件",
}


def _node_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.WorldNode)
        .filter(
            models.WorldNode.world_id == world_id,
            models.WorldNode.ref_type == entity_type,
            models.WorldNode.ref_id == entity_id,
        )
        .all()
    )
    return [{"kind": "目录节点", "name": row.name, "detail": f"节点 {row.name}"} for row in rows]


def _relationship_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.Relationship)
        .filter(
            models.Relationship.world_id == world_id,
            models.Relationship.status != "ended",
            (
                ((models.Relationship.source_type == entity_type)
                 & (models.Relationship.source_id == entity_id))
                | ((models.Relationship.target_type == entity_type)
                   & (models.Relationship.target_id == entity_id))
            ),
        )
        .all()
    )
    return [
        {
            "kind": "关系",
            "name": row.relation_type,
            "detail": f"关系「{row.relation_type}」（{row.status}）",
        }
        for row in rows
    ]


def _rule_scope_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.RuleScope, models.WorldRule)
        .join(models.WorldRule, models.WorldRule.id == models.RuleScope.rule_id)
        .filter(
            models.WorldRule.world_id == world_id,
            models.RuleScope.scope_type == entity_type,
            models.RuleScope.scope_id == entity_id,
        )
        .all()
    )
    return [
        {"kind": "规则适用范围", "name": rule.name, "detail": f"规则「{rule.name}」"}
        for _, rule in rows
    ]


def _event_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.EventEntity, models.Event)
        .join(models.Event, models.Event.id == models.EventEntity.event_id)
        .filter(
            models.EventEntity.world_id == world_id,
            models.EventEntity.entity_type == entity_type,
            models.EventEntity.entity_id == entity_id,
        )
        .all()
    )
    return [
        {"kind": "事件参与/影响", "name": event.name, "detail": f"事件「{event.name}」"}
        for _, event in rows
    ]


def _holding_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.ResourceHolding)
        .filter(
            models.ResourceHolding.world_id == world_id,
            models.ResourceHolding.status == "active",
            models.ResourceHolding.holder_type == entity_type,
            models.ResourceHolding.holder_id == entity_id,
        )
        .all()
    )
    return [
        {"kind": "资源持有", "name": row.role, "detail": f"资源持有角色「{row.role}」"}
        for row in rows
    ]


def _membership_refs(db: Session, world_id: str, entity_type: str, entity_id: str):
    rows = (
        db.query(models.GroupMembership)
        .filter(
            models.GroupMembership.world_id == world_id,
            models.GroupMembership.member_type == entity_type,
            models.GroupMembership.member_id == entity_id,
            models.GroupMembership.status == "active",
        )
        .all()
    )
    return [{"kind": "群体成员", "name": row.role, "detail": "群体成员记录"} for row in rows]


def _characters_extra(db: Session, world_id: str, entity_id: str):
    refs = []
    appointments = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.character_id == entity_id)
        .count()
    )
    if appointments:
        refs.append({"kind": "任职记录", "name": str(appointments), "detail": f"{appointments} 条任职记录（含历史）"})
    perceptions = (
        db.query(models.CharacterEventPerception)
        .filter(models.CharacterEventPerception.character_id == entity_id)
        .count()
    )
    if perceptions:
        refs.append({"kind": "事件认知", "name": str(perceptions), "detail": f"{perceptions} 条事件认知"})
    return refs


def _organizations_extra(db: Session, world_id: str, entity_id: str):
    refs = []
    units = (
        db.query(models.OrganizationUnit)
        .filter(models.OrganizationUnit.organization_id == entity_id)
        .count()
    )
    if units:
        refs.append({"kind": "部门", "name": str(units), "detail": f"{units} 个部门"})
    appointments = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.organization_id == entity_id)
        .count()
    )
    if appointments:
        refs.append({"kind": "任职记录", "name": str(appointments), "detail": f"{appointments} 条任职记录（含历史）"})
    return refs


def _locations_extra(db: Session, world_id: str, entity_id: str):
    refs = []
    hq = (
        db.query(models.Organization)
        .filter(models.Organization.headquarters_location_id == entity_id)
        .count()
    )
    if hq:
        refs.append({"kind": "组织总部", "name": str(hq), "detail": f"{hq} 个组织以此为总部"})
    events = db.query(models.Event).filter(models.Event.location_id == entity_id).count()
    if events:
        refs.append({"kind": "事件地点", "name": str(events), "detail": f"{events} 个事件发生于此"})
    return refs


def _units_extra(db: Session, world_id: str, entity_id: str):
    refs = []
    positions = (
        db.query(models.OrganizationPosition)
        .filter(models.OrganizationPosition.unit_id == entity_id)
        .count()
    )
    if positions:
        refs.append({"kind": "职位", "name": str(positions), "detail": f"{positions} 个职位"})
    children = (
        db.query(models.OrganizationUnit)
        .filter(models.OrganizationUnit.parent_unit_id == entity_id)
        .count()
    )
    if children:
        refs.append({"kind": "下级部门", "name": str(children), "detail": f"{children} 个下级部门"})
    return refs


def _positions_extra(db: Session, world_id: str, entity_id: str):
    total = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.position_id == entity_id)
        .count()
    )
    if total:
        return [{"kind": "任职记录", "name": str(total), "detail": f"{total} 条任职记录（含历史），删除会破坏历史"}]
    return []


def _resources_extra(db: Session, world_id: str, entity_id: str):
    active = (
        db.query(models.ResourceHolding)
        .filter(
            models.ResourceHolding.resource_id == entity_id,
            models.ResourceHolding.status == "active",
        )
        .count()
    )
    if active:
        return [{"kind": "持有关系", "name": str(active), "detail": f"{active} 条持有/管理/使用关系"}]
    return []


def _societies_extra(db: Session, world_id: str, entity_id: str):
    refs = []
    orgs = (
        db.query(models.Organization)
        .filter(models.Organization.society_id == entity_id)
        .count()
    )
    if orgs:
        refs.append({"kind": "归属组织", "name": str(orgs), "detail": f"{orgs} 个组织归属该社会"})
    groups = (
        db.query(models.SocialGroup)
        .filter(models.SocialGroup.society_id == entity_id)
        .count()
    )
    if groups:
        refs.append({"kind": "社会群体", "name": str(groups), "detail": f"{groups} 个群体"})
    return refs


def collect_references(db: Session, world_id: str, entity_type: str, entity_id: str):
    """返回 [{kind, name, detail}]，空列表表示可以安全删除。"""
    refs = []
    refs += _node_refs(db, world_id, entity_type, entity_id)
    refs += _relationship_refs(db, world_id, entity_type, entity_id)
    refs += _rule_scope_refs(db, world_id, entity_type, entity_id)
    refs += _event_refs(db, world_id, entity_type, entity_id)
    refs += _holding_refs(db, world_id, entity_type, entity_id)
    refs += _membership_refs(db, world_id, entity_type, entity_id)

    extra = {
        "character": _characters_extra,
        "organization": _organizations_extra,
        "location": _locations_extra,
        "organization_unit": _units_extra,
        "organization_position": _positions_extra,
        "resource": _resources_extra,
        "society": _societies_extra,
    }.get(entity_type)
    if extra:
        refs += extra(db, world_id, entity_id)
    return refs


def assert_not_referenced(db: Session, world_id: str, entity_type: str, entity_id: str, label: str):
    refs = collect_references(db, world_id, entity_type, entity_id)
    if not refs:
        return
    preview = "、".join(f"{item['kind']}（{item['name']}）" for item in refs[:5])
    more = f" 等 {len(refs)} 处" if len(refs) > 5 else ""
    fail(409, "HAS_DEPENDENTS", f"{label}仍被引用：{preview}{more}。请先解绑或删除引用")


def delete_entity(db: Session, model, entity_type: str, entity_id: str):
    """统一删除入口：先查引用，再删除。"""
    row = db.query(model).filter(model.id == entity_id).first()
    if not row:
        fail(404, "NOT_FOUND", f"{ENTITY_LABELS.get(entity_type, '对象')}不存在")
    assert_not_referenced(db, row.world_id, entity_type, entity_id, ENTITY_LABELS.get(entity_type, "对象"))
    db.delete(row)
    db.commit()
    return {"status": "ok"}
