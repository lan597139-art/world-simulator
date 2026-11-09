"""地理结构：location_types、locations 单一父节点树。"""

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
    record_history,
    utcnow,
)
from database import get_db
from reference_guard import assert_not_referenced, delete_entity

router = APIRouter()

LOCATION_FIELDS = {
    "name", "description", "parent_location_id", "location_type_id", "status",
    "coordinates", "environment", "population", "sort_order",
    "x", "y", "terrain", "climate", "nation",
}


def _loc_dict(loc: models.Location, type_names: dict) -> dict:
    return {
        "id": loc.id,
        "world_id": loc.world_id,
        "parent_location_id": loc.parent_location_id,
        "name": loc.name,
        "location_type_id": loc.location_type_id,
        "location_type_name": type_names.get(loc.location_type_id, loc.geo_type or ""),
        "description": loc.description or "",
        "status": loc.status or "normal",
        "coordinates": loc.coordinates,
        "environment": loc.environment or {},
        "population": loc.population,
        "sort_order": loc.sort_order or 0,
        "x": loc.x,
        "y": loc.y,
        "terrain": loc.terrain or "",
        "climate": loc.climate or "",
        "nation": loc.nation or "",
    }


def _type_names(db: Session, world_id: str) -> dict:
    rows = (
        db.query(models.LocationType)
        .filter(
            (models.LocationType.world_id == world_id)
            | (models.LocationType.world_id.is_(None))
        )
        .all()
    )
    return {row.id: row.name for row in rows}


def _check_type_allowed(db: Session, world_id: str, location_type_id, parent_id):
    if not location_type_id or not parent_id:
        return
    parent = get_or_404(db, models.Location, parent_id, "父地点")
    if not parent.location_type_id:
        return
    loc_type = (
        db.query(models.LocationType)
        .filter(models.LocationType.id == location_type_id)
        .first()
    )
    if not loc_type:
        return
    allowed = loc_type.allowed_parent_type_ids or []
    if allowed and parent.location_type_id not in allowed:
        names = _type_names(db, world_id)
        fail(
            409,
            "TYPE_NOT_ALLOWED",
            f"{loc_type.name} 不能挂在 {names.get(parent.location_type_id, '该类型')} 下面",
        )


def _assert_no_cycle(db: Session, location: models.Location, new_parent_id: Optional[str]):
    cursor_id = new_parent_id
    guard = 0
    while cursor_id:
        if cursor_id == location.id:
            fail(409, "CYCLE_DETECTED", "不能把地点移动到自己的后代下")
        parent = db.query(models.Location).filter(models.Location.id == cursor_id).first()
        if not parent:
            break
        cursor_id = parent.parent_location_id
        guard += 1
        if guard > 64:
            fail(409, "CYCLE_DETECTED", "地理树层级异常")


# ---------------------------------------------------------------------
# 地点类型
# ---------------------------------------------------------------------


@router.get("/api/worlds/{world_id}/location-types")
def list_location_types(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.LocationType)
        .filter(
            (models.LocationType.world_id == world_id)
            | (models.LocationType.world_id.is_(None))
        )
        .order_by(models.LocationType.sort_order)
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "name": row.name,
            "allowed_parent_type_ids": row.allowed_parent_type_ids or [],
            "description": row.description or "",
            "sort_order": row.sort_order,
            "system": row.world_id is None,
        }
        for row in rows
    ]


@router.post("/api/location-types")
def create_location_type(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    if not world_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id")
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "类型名称不能为空")
    row = models.LocationType(
        world_id=world_id,
        name=name,
        allowed_parent_type_ids=payload.get("allowed_parent_type_ids") or [],
        description=payload.get("description") or "",
        sort_order=payload.get("sort_order")
        if payload.get("sort_order") is not None
        else next_sort_order(db, models.LocationType, world_id=world_id),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name}


# ---------------------------------------------------------------------
# 地点
# ---------------------------------------------------------------------


def _location_query(db: Session, world_id: str):
    return (
        db.query(models.Location)
        .filter(models.Location.world_id == world_id)
        .order_by(models.Location.sort_order, models.Location.created_at)
    )


@router.get("/api/worlds/{world_id}/locations")
def list_locations(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    names = _type_names(db, world_id)
    return [_loc_dict(loc, names) for loc in _location_query(db, world_id).all()]


@router.get("/api/locations")
def list_locations_legacy(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    """兼容旧前端：GET /api/locations?world_id="""
    if world_id:
        get_world(db, world_id)
    query = db.query(models.Location)
    if world_id:
        query = query.filter(models.Location.world_id == world_id)
    rows = query.order_by(models.Location.created_at.desc()).all()
    names = _type_names(db, world_id) if world_id else {}
    return [_loc_dict(loc, names) for loc in rows]


@router.get("/api/worlds/{world_id}/locations/tree")
def location_tree(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    names = _type_names(db, world_id)
    rows = _location_query(db, world_id).all()
    nodes = {loc.id: {**_loc_dict(loc, names), "children": []} for loc in rows}
    roots = []
    for loc in rows:
        item = nodes[loc.id]
        parent = nodes.get(loc.parent_location_id) if loc.parent_location_id else None
        if parent:
            parent["children"].append(item)
        else:
            roots.append(item)
    return roots


@router.post("/api/locations")
def create_location(payload: dict = Body(...), db: Session = Depends(get_db)):
    world_id = payload.get("world_id")
    if not world_id:
        fail(422, "VALIDATION_ERROR", "缺少 world_id")
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "地点名称不能为空")

    parent_id = payload.get("parent_location_id")
    if parent_id:
        parent = get_or_404(db, models.Location, parent_id, "父地点")
        assert_same_world(parent, world_id, "父地点")

    location_type_id = payload.get("location_type_id")
    _check_type_allowed(db, world_id, location_type_id, parent_id)

    loc = models.Location(
        world_id=world_id,
        name=name,
        parent_location_id=parent_id,
        location_type_id=location_type_id,
        description=payload.get("description") or "",
        status=payload.get("status") or "normal",
        coordinates=payload.get("coordinates"),
        environment=payload.get("environment") or {},
        population=payload.get("population"),
        x=payload.get("x", 50),
        y=payload.get("y", 50),
        terrain=payload.get("terrain") or "",
        climate=payload.get("climate") or "",
        nation=payload.get("nation") or "",
        geo_type=payload.get("geo_type") or "",
        sort_order=payload.get("sort_order")
        if payload.get("sort_order") is not None
        else next_sort_order(db, models.Location, world_id=world_id, parent_location_id=parent_id),
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return _loc_dict(loc, _type_names(db, world_id))


@router.put("/api/locations/{location_id}")
@router.patch("/api/locations/{location_id}")
def update_location(location_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    loc = get_or_404(db, models.Location, location_id, "地点")

    if "parent_location_id" in payload and payload["parent_location_id"] != loc.parent_location_id:
        new_parent = payload["parent_location_id"]
        if new_parent:
            parent = get_or_404(db, models.Location, new_parent, "父地点")
            assert_same_world(parent, loc.world_id, "父地点")
        _assert_no_cycle(db, loc, new_parent)
        record_history(
            db, loc.world_id, "location", loc.id, "parent_location_id",
            loc.parent_location_id, new_parent, reason="移动地点",
        )
        loc.parent_location_id = new_parent
        _check_type_allowed(db, loc.world_id, payload.get("location_type_id", loc.location_type_id), new_parent)

    for key in LOCATION_FIELDS:
        if key in payload and key != "parent_location_id":
            setattr(loc, key, payload[key])
    loc.updated_at = utcnow()
    db.commit()
    db.refresh(loc)
    return _loc_dict(loc, _type_names(db, loc.world_id))


@router.post("/api/locations/{location_id}/move")
def move_location(location_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    return update_location(location_id, {"parent_location_id": payload.get("parent_location_id")}, db)


@router.delete("/api/locations/{location_id}")
def delete_location(location_id: str, db: Session = Depends(get_db)):
    loc = get_or_404(db, models.Location, location_id, "地点")
    children = db.query(models.Location).filter(models.Location.parent_location_id == loc.id).count()
    if children:
        fail(409, "HAS_CHILDREN", "请先移动或删除子地点")
    assert_not_referenced(db, loc.world_id, "location", loc.id, "地点")
    db.delete(loc)
    db.commit()
    return {"status": "ok"}
