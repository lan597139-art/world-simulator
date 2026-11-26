"""世界 / 人物一键重置。

用户明确要求：世界与人物的「删除」按钮全部取消，改为「一键重置」。

重置语义（与用户确认）：
- 世界：清空该世界下的派生数据，保留世界本身，并将世界元数据恢复为初始默认值。
- 人物：清空运行态与成长记录，恢复人物种子初始默认值，保留人物本身。

访问控制由 access 中间件统一拦截（POST 且带 world_id / entity world_id 时会校验
写权限），本模块额外做一次显式校验，避免绕过。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.orm import Session

import models
from access import current_user_id, world_writable
from database import get_db

router = APIRouter(prefix="/api", tags=["world-reset"])

# 世界重置后需要恢复的初始默认值。
WORLD_DEFAULTS = {
    "description": "",
    "type": "custom",
    "background": "",
    "map_image_url": "",
    "world_scale": "city",
    "status": "draft",
    "time_status": "paused",
    "settings": {},
}

# 人物种子初始默认值（运行态清空）。
CHARACTER_SEED_DEFAULTS = {
    "basic_profile": {},
    "engines": {"V": 50, "O": 50, "D": 50, "E": 50, "T": 50},
    "defense_mechanisms": {},
    "reality_conditions": {},
    "thought_imprints": [],
    "life_history": [],
    "initial_state": {},
}


def _world_scoped_models() -> list[type]:
    """返回带 world_id 列的模型，按依赖关系排序：被引用者（父）排在后面，先删子。"""
    models_with_world: list[type] = []
    for model in models.Base.registry.mappers:
        cls = model.class_
        if hasattr(cls, "world_id"):
            models_with_world.append(cls)

    # 构建依赖：若 modelA 的外键引用了 modelB，则 A 依赖 B（A 先删）。
    by_table = {cls.__tablename__: cls for cls in models_with_world}
    deps: dict[type, set[type]] = {cls: set() for cls in models_with_world}
    for cls in models_with_world:
        for fk in cls.__table__.foreign_keys:
            target_table = fk.column.table.name
            if target_table in by_table and target_table != cls.__tablename__:
                deps[cls].add(by_table[target_table])

    ordered: list[type] = []
    visiting: set[type] = set()

    def visit(cls: type) -> None:
        if cls in visiting:
            return
        visiting.add(cls)
        for dep in deps.get(cls, set()):
            visit(dep)
        visiting.discard(cls)
        if cls not in ordered:
            ordered.append(cls)

    for cls in models_with_world:
        visit(cls)
    return ordered


def _delete_world_data(db: Session, world_id: str) -> int:
    """逐表删除世界派生数据。每张表独立提交，单表失败不回滚已删数据。"""
    removed = 0
    for cls in _world_scoped_models():
        try:
            result = db.execute(delete(cls).where(cls.world_id == world_id))
            removed += result.rowcount or 0
            db.commit()
        except Exception:
            # 外键约束差异等场景：回滚该表删除，继续处理其余表。
            db.rollback()
    return removed


@router.post("/worlds/{world_id}/reset")
def reset_world(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="世界不存在")
    user_id = current_user_id(request)
    if not world_writable(world, user_id, db):
        raise HTTPException(status_code=403, detail="只有世界所有者或编辑者可以重置世界")

    removed = _delete_world_data(db, world_id)

    for field, value in WORLD_DEFAULTS.items():
        setattr(world, field, value)
    world.archived_at = None
    world.deleted_at = None
    world.updatedAt = world.updatedAt  # 保留创建时间语义，不改动时间戳
    db.commit()
    return {"status": "ok", "reset": True, "world_id": world.id, "removed_rows": removed}


@router.post("/characters/{character_id}/reset")
def reset_character(character_id: str, request: Request, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="人物不存在")
    world_id = character.world_id
    if world_id:
        world = db.query(models.World).filter(models.World.id == world_id).first()
        if not world or world.deleted_at is not None:
            raise HTTPException(status_code=404, detail="人物所在世界不存在")
        if not world_writable(world, current_user_id(request), db):
            raise HTTPException(status_code=403, detail="只有世界所有者或编辑者可以重置人物")
    else:
        owner = character.owner_user_id
        if owner != current_user_id(request) and not (not owner and current_user_id(request) == "local"):
            raise HTTPException(status_code=403, detail="只有人物所有者可以重置人物")

    character.runtime_state = {}
    for field, value in CHARACTER_SEED_DEFAULTS.items():
        if hasattr(character, field):
            setattr(character, field, value)
    character.archived_at = None

    # 清空该人物的成长 / 运行态历史记录。
    removed_history = db.execute(
        delete(models.StateHistory).where(
            models.StateHistory.entity_type == "character",
            models.StateHistory.entity_id == character_id,
        )
    ).rowcount or 0
    db.commit()
    return {
        "status": "ok",
        "reset": True,
        "character_id": character.id,
        "removed_history": removed_history,
    }
