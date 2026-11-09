"""文明与社会：社会实体、群体、成员、文化档案。"""

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, parse_datetime, resolve_entity
from database import get_db
from reference_guard import assert_not_referenced

router = APIRouter()


def _society_dict(row: models.Society) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "name": row.name,
        "society_type": row.society_type or "nation",
        "government_form": row.government_form or "",
        "territory_location_id": row.territory_location_id,
        "description": row.description or "",
        "founded_at": row.founded_at,
        "dissolved_at": row.dissolved_at,
        "status": row.status or "active",
    }


def _group_dict(row: models.SocialGroup) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "society_id": row.society_id,
        "name": row.name,
        "group_type": row.group_type or "class",
        "description": row.description or "",
    }


@router.get("/api/worlds/{world_id}/societies")
def list_societies(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = db.query(models.Society).filter(models.Society.world_id == world_id).all()
    return [_society_dict(row) for row in rows]


@router.post("/api/worlds/{world_id}/societies")
def create_society(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "社会实体名称不能为空")
    territory = payload.get("territory_location_id")
    if territory:
        location = get_or_404(db, models.Location, territory, "领土地点")
        if location.world_id != world_id:
            fail(409, "WORLD_MISMATCH", "领土地点不属于当前世界")
    row = models.Society(
        world_id=world_id,
        name=name,
        society_type=payload.get("society_type") or "nation",
        government_form=payload.get("government_form") or "",
        territory_location_id=territory,
        description=payload.get("description") or "",
        founded_at=parse_datetime(payload.get("founded_at")),
        status=payload.get("status") or "active",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _society_dict(row)


@router.patch("/api/societies/{society_id}")
def update_society(society_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    row = get_or_404(db, models.Society, society_id, "社会实体")
    for key in (
        "name", "society_type", "government_form", "territory_location_id",
        "description", "founded_at", "dissolved_at", "status",
    ):
        if key in payload:
            value = payload[key]
            if key in ("founded_at", "dissolved_at"):
                value = parse_datetime(value)
            setattr(row, key, value)
    db.commit()
    return _society_dict(row)


@router.delete("/api/societies/{society_id}")
def delete_society(society_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.Society, society_id, "社会实体")
    assert_not_referenced(db, row.world_id, "society", row.id, "社会实体")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/worlds/{world_id}/social-groups")
def list_groups(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = db.query(models.SocialGroup).filter(models.SocialGroup.world_id == world_id).all()
    return [_group_dict(row) for row in rows]


@router.post("/api/worlds/{world_id}/social-groups")
def create_group(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "群体名称不能为空")
    row = models.SocialGroup(
        world_id=world_id,
        society_id=payload.get("society_id"),
        name=name,
        group_type=payload.get("group_type") or "class",
        description=payload.get("description") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _group_dict(row)


@router.delete("/api/social-groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.SocialGroup, group_id, "群体")
    assert_not_referenced(db, row.world_id, "social_group", row.id, "群体")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/worlds/{world_id}/group-memberships")
def list_memberships(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.GroupMembership)
        .filter(models.GroupMembership.world_id == world_id)
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "group_id": row.group_id,
            "member_type": row.member_type,
            "member_id": row.member_id,
            "role": row.role,
            "status": row.status,
            "start_time": row.start_time,
            "end_time": row.end_time,
        }
        for row in rows
    ]


@router.post("/api/group-memberships")
def create_membership(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    group_id = payload.get("group_id")
    member_type = payload.get("member_type") or "character"
    member_id = payload.get("member_id")
    if not (world_id and group_id and member_id):
        fail(422, "VALIDATION_ERROR", "缺少 world_id / group_id / member_id")
    get_world(db, world_id)
    group = get_or_404(db, models.SocialGroup, group_id, "群体")
    if group.world_id != world_id:
        fail(409, "WORLD_MISMATCH", "群体不属于当前世界")
    resolve_entity(db, world_id, member_type, member_id)
    row = models.GroupMembership(
        world_id=world_id,
        group_id=group.id,
        member_type=member_type,
        member_id=member_id,
        role=payload.get("role") or "member",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}


@router.delete("/api/group-memberships/{membership_id}")
def delete_membership(membership_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.GroupMembership, membership_id, "成员记录")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/worlds/{world_id}/cultural-profiles")
def list_cultural(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.CulturalProfile)
        .filter(models.CulturalProfile.world_id == world_id)
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "society_id": row.society_id,
            "language": row.language,
            "religion": row.religion,
            "customs": row.customs or [],
            "taboos": row.taboos or [],
            "description": row.description or "",
        }
        for row in rows
    ]


@router.post("/api/worlds/{world_id}/cultural-profiles")
def create_cultural(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    row = models.CulturalProfile(
        world_id=world_id,
        society_id=payload.get("society_id"),
        language=payload.get("language") or "",
        religion=payload.get("religion") or "",
        customs=payload.get("customs") or [],
        taboos=payload.get("taboos") or [],
        description=payload.get("description") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id}
