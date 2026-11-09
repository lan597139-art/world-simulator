"""组织结构：organizations / organization_units / organization_positions / appointments。"""

from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import (
    assert_same_world,
    fail,
    get_or_404,
    get_world,
    next_sort_order,
    parse_datetime,
    record_history,
    utcnow,
)
from database import get_db
from reference_guard import assert_not_referenced

router = APIRouter()

ORG_FIELDS = {
    "name", "description", "organization_type", "mission", "founded_at", "dissolved_at",
    "status", "headquarters_location_id", "attributes", "society_id",
}
UNIT_FIELDS = {"name", "unit_type", "description", "status", "parent_unit_id", "sort_order"}
POSITION_FIELDS = {
    "name", "position_level", "responsibilities", "authority_scope", "headcount", "status", "unit_id",
}

ORG_TYPES = {
    "company", "government", "military", "family", "party", "ngo", "academic",
    "religious", "gang", "other",
}


def _org_dict(org: models.Organization, counts: Optional[dict] = None) -> dict:
    data = {
        "id": org.id,
        "world_id": org.world_id,
        "name": org.name,
        "description": org.description or "",
        "organization_type": org.organization_type or "company",
        "mission": org.mission or "",
        "founded_at": org.founded_at,
        "dissolved_at": org.dissolved_at,
        "status": org.status or "normal",
        "headquarters_location_id": org.headquarters_location_id,
        "attributes": org.attributes or {},
        "society_id": org.society_id,
        "created_at": org.created_at,
        "updated_at": org.updated_at,
    }
    if counts is not None:
        data.update(counts)
    return data


def _unit_dict(unit: models.OrganizationUnit) -> dict:
    return {
        "id": unit.id,
        "world_id": unit.world_id,
        "organization_id": unit.organization_id,
        "parent_unit_id": unit.parent_unit_id,
        "name": unit.name,
        "unit_type": unit.unit_type or "department",
        "description": unit.description or "",
        "status": unit.status or "active",
        "sort_order": unit.sort_order or 0,
    }


def _position_dict(pos: models.OrganizationPosition, holders: Optional[list] = None) -> dict:
    data = {
        "id": pos.id,
        "world_id": pos.world_id,
        "organization_id": pos.organization_id,
        "unit_id": pos.unit_id,
        "name": pos.name,
        "position_level": pos.position_level,
        "responsibilities": pos.responsibilities or "",
        "authority_scope": pos.authority_scope or {},
        "headcount": pos.headcount,
        "status": pos.status or "active",
        "holders": holders or [],
    }
    return data


def _appointment_dict(appt: models.CharacterAppointment) -> dict:
    return {
        "id": appt.id,
        "world_id": appt.world_id,
        "character_id": appt.character_id,
        "organization_id": appt.organization_id,
        "unit_id": appt.unit_id,
        "position_id": appt.position_id,
        "start_time": appt.start_time,
        "end_time": appt.end_time,
        "appointment_status": appt.appointment_status or "active",
        "note": appt.note or "",
    }


# ---------------------------------------------------------------------
# 组织
# ---------------------------------------------------------------------


@router.get("/api/worlds/{world_id}/organizations")
def list_organizations(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    orgs = (
        db.query(models.Organization)
        .filter(models.Organization.world_id == world_id)
        .order_by(models.Organization.created_at)
        .all()
    )
    return [_org_dict(org) for org in orgs]


@router.get("/api/organizations")
def list_organizations_legacy(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Organization)
    if world_id:
        query = query.filter(models.Organization.world_id == world_id)
    return [_org_dict(org) for org in query.order_by(models.Organization.created_at.desc()).all()]


@router.post("/api/organizations")
def create_organization(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    if not world_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id")
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "组织名称不能为空")

    hq = payload.get("headquarters_location_id")
    if hq:
        location = get_or_404(db, models.Location, hq, "总部地点")
        assert_same_world(location, world_id, "总部地点")

    org_type = payload.get("organization_type") or "company"
    if org_type not in ORG_TYPES:
        fail(422, "VALIDATION_ERROR", "organization_type 非法")

    org = models.Organization(
        world_id=world_id,
        name=name,
        description=payload.get("description") or "",
        organization_type=org_type,
        mission=payload.get("mission") or "",
        founded_at=payload.get("founded_at"),
        status=payload.get("status") or "normal",
        headquarters_location_id=hq,
        attributes=payload.get("attributes") or {},
        society_id=payload.get("society_id"),
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return _org_dict(org)


@router.patch("/api/organizations/{org_id}")
@router.put("/api/organizations/{org_id}")
def update_organization(org_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    org = get_or_404(db, models.Organization, org_id, "组织")
    if "headquarters_location_id" in payload and payload["headquarters_location_id"]:
        location = get_or_404(db, models.Location, payload["headquarters_location_id"], "总部地点")
        assert_same_world(location, org.world_id, "总部地点")
    if "status" in payload and payload["status"] != org.status:
        record_history(
            db, org.world_id, "organization", org.id, "status", org.status, payload["status"],
            reason="组织状态变更",
        )
    for key in ORG_FIELDS:
        if key in payload:
            setattr(org, key, payload[key])
    org.updated_at = utcnow()
    db.commit()
    db.refresh(org)
    return _org_dict(org)


@router.delete("/api/organizations/{org_id}")
def delete_organization(org_id: str, db: Session = Depends(get_db)):
    org = get_or_404(db, models.Organization, org_id, "组织")
    assert_not_referenced(db, org.world_id, "organization", org.id, "组织")
    db.delete(org)
    db.commit()
    return {"status": "ok"}


@router.get("/api/organizations/{org_id}/tree")
def organization_tree(org_id: str, db: Session = Depends(get_db)):
    org = get_or_404(db, models.Organization, org_id, "组织")
    units = (
        db.query(models.OrganizationUnit)
        .filter(models.OrganizationUnit.organization_id == org.id)
        .order_by(models.OrganizationUnit.sort_order, models.OrganizationUnit.created_at)
        .all()
    )
    positions = (
        db.query(models.OrganizationPosition)
        .filter(models.OrganizationPosition.organization_id == org.id)
        .all()
    )
    appointments = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.organization_id == org.id)
        .all()
    )
    char_names = {
        c.id: c.name
        for c in db.query(models.Character)
        .filter(models.Character.id.in_([a.character_id for a in appointments] or [""]))
        .all()
    }

    holders = {}
    for appt in appointments:
        if appt.appointment_status != "active" or appt.end_time:
            continue
        holders.setdefault(appt.position_id, []).append(
            {
                "appointment_id": appt.id,
                "character_id": appt.character_id,
                "character_name": char_names.get(appt.character_id, "未知人物"),
                "start_time": appt.start_time,
            }
        )

    position_by_unit = {}
    for pos in positions:
        position_by_unit.setdefault(pos.unit_id, []).append(
            _position_dict(pos, holders.get(pos.id, []))
        )

    nodes = {}
    for unit in units:
        item = _unit_dict(unit)
        item["positions"] = position_by_unit.get(unit.id, [])
        item["children"] = []
        nodes[unit.id] = item

    roots = []
    for unit in units:
        item = nodes[unit.id]
        if unit.parent_unit_id and unit.parent_unit_id in nodes:
            nodes[unit.parent_unit_id]["children"].append(item)
        else:
            roots.append(item)

    return {
        "organization": _org_dict(org),
        "units": roots,
        "unit_count": len(units),
        "position_count": len(positions),
        "active_appointments": sum(len(v) for v in holders.values()),
    }


# ---------------------------------------------------------------------
# 组织单元
# ---------------------------------------------------------------------


@router.post("/api/organization-units")
def create_unit(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    org_id = payload.get("organization_id")
    if not world_id or not org_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id 或 organization_id")
    org = get_or_404(db, models.Organization, org_id, "组织")
    assert_same_world(org, world_id, "组织")

    parent_id = payload.get("parent_unit_id")
    if parent_id:
        parent = get_or_404(db, models.OrganizationUnit, parent_id, "上级部门")
        assert_same_world(parent, world_id, "上级部门")
        if parent.organization_id != org.id:
            fail(409, "WORLD_MISMATCH", "上级部门不属于该组织")

    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "部门名称不能为空")

    unit = models.OrganizationUnit(
        world_id=world_id,
        organization_id=org.id,
        parent_unit_id=parent_id,
        name=name,
        unit_type=payload.get("unit_type") or "department",
        description=payload.get("description") or "",
        status=payload.get("status") or "active",
        sort_order=payload.get("sort_order")
        if payload.get("sort_order") is not None
        else next_sort_order(db, models.OrganizationUnit, organization_id=org.id,
                             parent_unit_id=parent_id),
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return _unit_dict(unit)


@router.patch("/api/organization-units/{unit_id}")
@router.put("/api/organization-units/{unit_id}")
def update_unit(unit_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    unit = get_or_404(db, models.OrganizationUnit, unit_id, "部门")
    if "parent_unit_id" in payload and payload["parent_unit_id"] != unit.parent_unit_id:
        new_parent = payload["parent_unit_id"]
        if new_parent:
            parent = get_or_404(db, models.OrganizationUnit, new_parent, "上级部门")
            assert_same_world(parent, unit.world_id, "上级部门")
            if parent.organization_id != unit.organization_id:
                fail(409, "WORLD_MISMATCH", "不能跨组织移动部门")
            cursor = parent
            while cursor is not None:
                if cursor.id == unit.id:
                    fail(409, "CYCLE_DETECTED", "不能把部门移动到自己的下级")
                cursor = (
                    db.query(models.OrganizationUnit)
                    .filter(models.OrganizationUnit.id == cursor.parent_unit_id)
                    .first()
                )
        unit.parent_unit_id = new_parent
    for key in UNIT_FIELDS:
        if key in payload and key != "parent_unit_id":
            setattr(unit, key, payload[key])
    unit.updated_at = utcnow()
    db.commit()
    db.refresh(unit)
    return _unit_dict(unit)


@router.delete("/api/organization-units/{unit_id}")
def delete_unit(unit_id: str, db: Session = Depends(get_db)):
    unit = get_or_404(db, models.OrganizationUnit, unit_id, "部门")
    assert_not_referenced(db, unit.world_id, "organization_unit", unit.id, "部门")
    db.delete(unit)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# 职位
# ---------------------------------------------------------------------


@router.post("/api/organization-positions")
def create_position(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    unit_id = payload.get("unit_id")
    if not world_id or not unit_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id 或 unit_id")
    unit = get_or_404(db, models.OrganizationUnit, unit_id, "部门")
    assert_same_world(unit, world_id, "部门")

    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "职位名称不能为空")

    pos = models.OrganizationPosition(
        world_id=world_id,
        organization_id=unit.organization_id,
        unit_id=unit.id,
        name=name,
        position_level=payload.get("position_level"),
        responsibilities=payload.get("responsibilities") or "",
        authority_scope=payload.get("authority_scope") or {},
        headcount=payload.get("headcount"),
        status=payload.get("status") or "active",
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return _position_dict(pos)


@router.patch("/api/organization-positions/{position_id}")
@router.put("/api/organization-positions/{position_id}")
def update_position(position_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    pos = get_or_404(db, models.OrganizationPosition, position_id, "职位")
    if "unit_id" in payload and payload["unit_id"] != pos.unit_id:
        unit = get_or_404(db, models.OrganizationUnit, payload["unit_id"], "部门")
        assert_same_world(unit, pos.world_id, "部门")
        if unit.organization_id != pos.organization_id:
            fail(409, "WORLD_MISMATCH", "职位不能跨组织移动")
        pos.unit_id = unit.id
    for key in POSITION_FIELDS:
        if key in payload and key != "unit_id":
            setattr(pos, key, payload[key])
    pos.updated_at = utcnow()
    db.commit()
    db.refresh(pos)
    return _position_dict(pos)


@router.delete("/api/organization-positions/{position_id}")
def delete_position(position_id: str, db: Session = Depends(get_db)):
    pos = get_or_404(db, models.OrganizationPosition, position_id, "职位")
    assert_not_referenced(db, pos.world_id, "organization_position", pos.id, "职位")
    db.delete(pos)
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------
# 任职
# ---------------------------------------------------------------------


@router.get("/api/worlds/{world_id}/appointments")
def list_appointments(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.CharacterAppointment)
        .filter(models.CharacterAppointment.world_id == world_id)
        .order_by(models.CharacterAppointment.created_at.desc())
        .all()
    )
    return [_appointment_dict(a) for a in rows]


@router.post("/api/appointments")
def create_appointment(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    character_id = payload.get("character_id")
    position_id = payload.get("position_id")
    if not (world_id and character_id and position_id):
        fail(422, "VALIDATION_ERROR", "缺少 world_id / character_id / position_id")

    character = get_or_404(db, models.Character, character_id, "人物")
    if character.world_id and character.world_id != world_id:
        fail(409, "WORLD_MISMATCH", "人物不属于当前世界")
    pos = get_or_404(db, models.OrganizationPosition, position_id, "职位")
    assert_same_world(pos, world_id, "职位")
    unit = get_or_404(db, models.OrganizationUnit, pos.unit_id, "部门")

    active = (
        db.query(models.CharacterAppointment)
        .filter(
            models.CharacterAppointment.character_id == character.id,
            models.CharacterAppointment.position_id == pos.id,
            models.CharacterAppointment.end_time.is_(None),
        )
        .first()
    )
    if active:
        fail(409, "INVALID_STATE", "该人物已在此职位在任")

    appt = models.CharacterAppointment(
        world_id=world_id,
        character_id=character.id,
        organization_id=pos.organization_id,
        unit_id=unit.id,
        position_id=pos.id,
        start_time=parse_datetime(payload.get("start_time")) or utcnow(),
        appointment_status="active",
        note=payload.get("note") or "",
    )
    db.add(appt)
    db.flush()
    record_history(
        db, world_id, "appointment", appt.id, "appointment_status", None, "active",
        reason=f"人物 {character.name} 就任 {pos.name}",
        occurred_at=appt.start_time,
    )
    db.commit()
    db.refresh(appt)
    return _appointment_dict(appt)


@router.patch("/api/appointments/{appointment_id}/end")
def end_appointment(appointment_id: str, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    appt = get_or_404(db, models.CharacterAppointment, appointment_id, "任职记录")
    if appt.end_time:
        fail(409, "INVALID_STATE", "该任职已结束")
    appt.end_time = parse_datetime(payload.get("end_time")) or utcnow()
    appt.appointment_status = "ended"
    appt.updated_at = utcnow()
    record_history(
        db, appt.world_id, "appointment", appt.id, "appointment_status", "active", "ended",
        reason=payload.get("reason") or "离任",
        occurred_at=appt.end_time,
    )
    db.commit()
    return _appointment_dict(appt)
