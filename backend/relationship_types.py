"""关系类型配置：系统默认 + 世界自定义，创建关系时据此校验端点类型与方向。"""

import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import ENTITY_LABELS, fail, get_or_404, get_world
from database import get_db

router = APIRouter()

CATEGORIES = {
    "interpersonal": "人物关系",
    "character_organization": "人物与组织",
    "organization": "组织之间",
    "character_location": "人物与地点",
    "organization_location": "组织与地点",
    "resource": "资源关系",
    "cross": "跨实体",
    "custom": "自定义",
}


def _type_dict(row: models.RelationshipType) -> dict:
    return {
        "id": row.id,
        "world_id": row.world_id,
        "name": row.name,
        "category": row.category,
        "category_label": CATEGORIES.get(row.category, row.category),
        "source_allowed_types": row.source_allowed_types or [],
        "target_allowed_types": row.target_allowed_types or [],
        "is_directional": bool(row.is_directional),
        "description": row.description or "",
        "sort_order": row.sort_order,
        "status": row.status,
    }


def resolve_type(
    db: Session,
    world_id: str,
    name: str,
    source_type: str,
    target_type: str,
) -> Optional[models.RelationshipType]:
    """按名称 + 端点类型匹配类型定义；找不到名称时自动登记为该世界的自定义类型。"""
    candidates = (
        db.query(models.RelationshipType)
        .filter(
            models.RelationshipType.name == name,
            models.RelationshipType.status == "active",
            (models.RelationshipType.world_id == world_id)
            | (models.RelationshipType.world_id.is_(None)),
        )
        .all()
    )
    if not candidates:
        row = models.RelationshipType(
            world_id=world_id,
            name=name,
            category="custom",
            source_allowed_types=[],
            target_allowed_types=[],
            is_directional=True,
        )
        db.add(row)
        db.flush()
        return row

    for row in candidates:
        source_allowed = row.source_allowed_types or []
        target_allowed = row.target_allowed_types or []
        if source_allowed and source_type not in source_allowed:
            continue
        if target_allowed and target_type not in target_allowed:
            continue
        return row

    allowed_pairs = "；".join(
        f"{'/'.join(row.source_allowed_types or ['任意'])} → {'/'.join(row.target_allowed_types or ['任意'])}"
        for row in candidates
    )
    fail(
        409,
        "TYPE_NOT_ALLOWED",
        f"关系类型「{name}」不允许 {ENTITY_LABELS.get(source_type, source_type)} → "
        f"{ENTITY_LABELS.get(target_type, target_type)}（允许：{allowed_pairs}）",
    )


@router.get("/api/worlds/{world_id}/relationship-types")
def list_types(
    world_id: str,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    query = db.query(models.RelationshipType).filter(
        (models.RelationshipType.world_id == world_id)
        | (models.RelationshipType.world_id.is_(None))
    )
    if category:
        query = query.filter(models.RelationshipType.category == category)
    rows = query.order_by(
        models.RelationshipType.category, models.RelationshipType.sort_order
    ).all()
    grouped: dict[str, list] = {}
    for row in rows:
        grouped.setdefault(row.category, []).append(_type_dict(row))
    return {
        "categories": [
            {"key": key, "label": CATEGORIES.get(key, key), "types": items}
            for key, items in grouped.items()
        ],
        "total": len(rows),
    }


@router.post("/api/worlds/{world_id}/relationship-types")
def create_type(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "类型名称不能为空")
    category = payload.get("category") or "custom"
    if category not in CATEGORIES:
        fail(422, "VALIDATION_ERROR", "关系分类非法")
    duplicate = (
        db.query(models.RelationshipType)
        .filter(
            models.RelationshipType.world_id == world_id,
            models.RelationshipType.name == name,
            models.RelationshipType.category == category,
        )
        .first()
    )
    if duplicate:
        fail(409, "INVALID_STATE", "该分类下已存在同名关系类型")

    row = models.RelationshipType(
        world_id=world_id,
        name=name,
        category=category,
        source_allowed_types=payload.get("source_allowed_types") or [],
        target_allowed_types=payload.get("target_allowed_types") or [],
        is_directional=bool(payload.get("is_directional", True)),
        description=payload.get("description") or "",
        sort_order=int(payload.get("sort_order") or 999),
        status="active",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _type_dict(row)


@router.patch("/api/relationship-types/{type_id}")
def update_type(type_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    row = get_or_404(db, models.RelationshipType, type_id, "关系类型")
    if row.world_id is None:
        fail(409, "INVALID_STATE", "系统默认类型不能修改，请新建世界自定义类型")
    for key in (
        "name", "category", "source_allowed_types", "target_allowed_types",
        "is_directional", "description", "sort_order", "status",
    ):
        if key in payload:
            setattr(row, key, payload[key])
    db.commit()
    return _type_dict(row)


@router.delete("/api/relationship-types/{type_id}")
def delete_type(type_id: str, db: Session = Depends(get_db)):
    row = get_or_404(db, models.RelationshipType, type_id, "关系类型")
    if row.world_id is None:
        fail(409, "INVALID_STATE", "系统默认类型不能删除")
    used = (
        db.query(models.Relationship)
        .filter(
            models.Relationship.world_id == row.world_id,
            models.Relationship.relation_type == row.name,
        )
        .count()
    )
    if used:
        fail(409, "HAS_DEPENDENTS", f"仍有 {used} 条关系使用该类型")
    db.delete(row)
    db.commit()
    return {"status": "ok"}
