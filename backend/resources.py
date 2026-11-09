"""资源：类型、资源实体、持有角色、流水。"""

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, parse_datetime, record_history, resolve_entity, utcnow
from database import get_db
from reference_guard import assert_not_referenced

router = APIRouter()

CATEGORIES = {"natural", "material", "financial", "human", "information", "power"}
HOLDER_TYPES = {
    "character", "organization", "organization_unit", "social_group", "location",
}
ROLES = {"holder", "manager", "user", "beneficiary"}


def _resource_dict(row: models.Resource) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "resource_type_id": row.resource_type_id,
        "name": row.name,
        "description": row.description or "",
        "quantity": row.quantity,
        "unit": row.unit or "",
        "location_id": row.location_id,
        "status": row.status or "active",
        "data": row.data or {},
    }


def _holding_dict(row: models.ResourceHolding) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "resource_id": row.resource_id,
        "holder_type": row.holder_type,
        "holder_id": row.holder_id,
        "role": row.role,
        "share": row.share,
        "status": row.status,
        "start_time": row.start_time,
        "end_time": row.end_time,
    }


@router.get("/api/worlds/{world_id}/resource-types")
def list_types(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.ResourceType)
        .filter(
            (models.ResourceType.world_id == world_id)
            | (models.ResourceType.world_id.is_(None))
        )
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "name": row.name,
            "category": row.category,
            "unit": row.unit,
            "description": row.description or "",
            "system": row.world_id is None,
        }
        for row in rows
    ]


@router.post("/api/worlds/{world_id}/resource-types")
def create_type(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    category = payload.get("category")
    if not name or category not in CATEGORIES:
        fail(422, "VALIDATION_ERROR", "名称或分类非法")
    row = models.ResourceType(
        world_id=world_id,
        name=name,
        category=category,
        unit=payload.get("unit") or "",
        description=payload.get("description") or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name}


@router.get("/api/worlds/{world_id}/resources")
def list_resources(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.Resource)
        .filter(models.Resource.world_id == world_id)
        .order_by(models.Resource.created_at)
        .all()
    )
    return [_resource_dict(row) for row in rows]


@router.post("/api/worlds/{world_id}/resources")
def create_resource(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    resource_type_id = payload.get("resource_type_id")
    if not name or not resource_type_id:
        fail(422, "VALIDATION_ERROR", "缺少名称或资源类型")
    rtype = get_or_404(db, models.ResourceType, resource_type_id, "资源类型")
    if rtype.world_id and rtype.world_id != world_id:
        fail(409, "WORLD_MISMATCH", "资源类型不属于当前世界")

    row = models.Resource(
        world_id=world_id,
        resource_type_id=rtype.id,
        name=name,
        description=payload.get("description") or "",
        quantity=float(payload.get("quantity") or 0),
        unit=payload.get("unit") or rtype.unit or "",
        location_id=payload.get("location_id"),
        status=payload.get("status") or "active",
        data=payload.get("data") or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _resource_dict(row)


@router.patch("/api/resources/{resource_id}")
def update_resource(resource_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    row = get_or_404(db, models.Resource, resource_id, "资源")
    for key in ("name", "description", "unit", "location_id", "status", "data"):
        if key in payload:
            setattr(row, key, payload[key])
    if "quantity" in payload:
        new_quantity = float(payload["quantity"])
        record_history(
            db, row.world_id, "resource", row.id, "quantity",
            row.quantity, new_quantity, reason=payload.get("reason") or "直接调整数量",
        )
        row.quantity = new_quantity
    row.updated_at = utcnow()
    db.commit()
    return _resource_dict(row)


@router.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.Resource, resource_id, "资源")
    assert_not_referenced(db, row.world_id, "resource", row.id, "资源")
    db.query(models.ResourceHolding).filter(models.ResourceHolding.resource_id == row.id).delete()
    db.query(models.ResourceTransaction).filter(
        models.ResourceTransaction.resource_id == row.id
    ).delete()
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/worlds/{world_id}/resource-holdings")
def list_holdings(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.ResourceHolding)
        .filter(models.ResourceHolding.world_id == world_id)
        .all()
    )
    return [_holding_dict(row) for row in rows]


@router.post("/api/resource-holdings")
def create_holding(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    resource_id = payload.get("resource_id")
    holder_type = payload.get("holder_type")
    holder_id = payload.get("holder_id")
    role = payload.get("role") or "holder"
    if not (world_id and resource_id and holder_type and holder_id):
        fail(422, "VALIDATION_ERROR", "缺少必要字段")
    if holder_type not in HOLDER_TYPES:
        fail(422, "VALIDATION_ERROR", "holder_type 非法")
    if role not in ROLES:
        fail(422, "VALIDATION_ERROR", "role 非法")

    get_world(db, world_id)
    resource = get_or_404(db, models.Resource, resource_id, "资源")
    if resource.world_id != world_id:
        fail(409, "WORLD_MISMATCH", "资源不属于当前世界")
    if holder_type == "organization_unit":
        unit = get_or_404(db, models.OrganizationUnit, holder_id, "组织单元")
        if unit.world_id != world_id:
            fail(409, "WORLD_MISMATCH", "组织单元不属于当前世界")
    else:
        resolve_entity(db, world_id, holder_type, holder_id)

    row = models.ResourceHolding(
        world_id=world_id,
        resource_id=resource.id,
        holder_type=holder_type,
        holder_id=holder_id,
        role=role,
        share=payload.get("share"),
        status="active",
        start_time=parse_datetime(payload.get("start_time")) or utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _holding_dict(row)


@router.delete("/api/resource-holdings/{holding_id}")
def delete_holding(holding_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.ResourceHolding, holding_id, "持有记录")
    row.status = "ended"
    row.end_time = utcnow()
    db.commit()
    return {"status": "ok"}


@router.get("/api/worlds/{world_id}/resource-transactions")
def list_transactions(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.ResourceTransaction)
        .filter(models.ResourceTransaction.world_id == world_id)
        .order_by(models.ResourceTransaction.occurred_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "resource_id": row.resource_id,
            "amount": row.amount,
            "from_holder_id": row.from_holder_id,
            "to_holder_id": row.to_holder_id,
            "event_id": row.event_id,
            "reason": row.reason,
            "occurred_at": row.occurred_at,
        }
        for row in rows
    ]


@router.post("/api/resource-transactions")
def create_transaction(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    resource_id = payload.get("resource_id")
    amount = payload.get("amount")
    if not (world_id and resource_id) or amount is None:
        fail(422, "VALIDATION_ERROR", "缺少 world_id / resource_id / amount")

    get_world(db, world_id)
    resource = get_or_404(db, models.Resource, resource_id, "资源")
    if resource.world_id != world_id:
        fail(409, "WORLD_MISMATCH", "资源不属于当前世界")

    delta = float(amount)
    old = resource.quantity or 0
    resource.quantity = old + delta
    resource.updated_at = utcnow()

    row = models.ResourceTransaction(
        world_id=world_id,
        resource_id=resource.id,
        amount=delta,
        from_holder_id=payload.get("from_holder_id"),
        to_holder_id=payload.get("to_holder_id"),
        event_id=payload.get("event_id"),
        reason=payload.get("reason") or "",
        occurred_at=parse_datetime(payload.get("occurred_at")) or utcnow(),
    )
    db.add(row)
    record_history(
        db, world_id, "resource", resource.id, "quantity", old, resource.quantity,
        event_id=payload.get("event_id"), reason=payload.get("reason") or "资源变动",
        occurred_at=row.occurred_at,
    )
    db.commit()
    db.refresh(row)
    return {"id": row.id, "quantity": resource.quantity}
