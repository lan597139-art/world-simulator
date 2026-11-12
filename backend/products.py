"""产品配置与产品工作空间 API。"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import product_config as pc
from database import get_db
from nodes import seed_world
from users import LOCAL_USER_ID

router = APIRouter(tags=["products"])


def _owner(request: Request) -> str:
    return str(getattr(request.state, "user_id", None) or "local")


def _require_yunbao_owner(product: str, request: Request, db: Session) -> None:
    if product != "yunbao":
        return
    user = db.query(models.AppUser).filter(models.AppUser.id == _owner(request)).first()
    if not user or not user.is_owner:
        raise HTTPException(status_code=403, detail="云宝工作台仅限开发者访问")


def _world_row(world: models.World) -> dict:
    return {
        "id": world.id,
        "name": world.name,
        "description": world.description or "",
        "type": world.type,
        "background": world.background or "",
        "product_scene": world.product_scene,
        "is_product_workspace": bool(world.is_product_workspace),
        "createdAt": world.createdAt,
        "updatedAt": world.updatedAt,
        "status": world.status,
        "time_status": world.time_status,
    }


@router.get("/api/products/config")
def product_config():
    return pc.matrix()


@router.get("/api/products/{product}/config")
def single_product_config(product: str):
    try:
        return pc.config_for(product)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/api/products/{product}/access/{module}")
def product_module_access(product: str, module: str):
    try:
        allowed = pc.module_allowed(product, module)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"product": product, "module": module, "allowed": allowed}


@router.get("/api/products/{product}/workspace")
def get_product_workspace(product: str, request: Request, db: Session = Depends(get_db)):
    try:
        product = pc.normalize_product(product)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not pc.AUTO_WORKSPACE[product]:
        return {"product": product, "world": None, "auto_workspace": False}
    _require_yunbao_owner(product, request, db)
    owner = LOCAL_USER_ID if product == "yunbao" else _owner(request)
    world = db.query(models.World).filter(
        models.World.owner_id == owner,
        models.World.product_scene == product,
        models.World.is_product_workspace.is_(True),
        models.World.deleted_at.is_(None),
    ).order_by(models.World.createdAt.asc()).first()
    return {"product": product, "world": _world_row(world) if world else None, "auto_workspace": True}


@router.post("/api/products/{product}/workspace")
def ensure_product_workspace(product: str, request: Request, db: Session = Depends(get_db)):
    try:
        product = pc.normalize_product(product)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not pc.AUTO_WORKSPACE[product]:
        raise HTTPException(status_code=409, detail="该产品使用普通世界，不创建隐藏工作空间")
    _require_yunbao_owner(product, request, db)
    owner = LOCAL_USER_ID if product == "yunbao" else _owner(request)
    world = db.query(models.World).filter(
        models.World.owner_id == owner,
        models.World.product_scene == product,
        models.World.is_product_workspace.is_(True),
        models.World.deleted_at.is_(None),
    ).order_by(models.World.createdAt.asc()).first()
    if not world:
        now = datetime.utcnow().isoformat()
        world = models.World(
            name=pc.WORKSPACE_NAME[product],
            description=("云宝的完整工作领域；可在世界管理中查看与维护。" if product == "yunbao" else "产品自动工作空间，不在世界管理中展示；数据只属于本产品。"),
            type="reality" if product == "diary" else "experimental",
            owner_id=owner,
            product_scene=product,
            is_product_workspace=True,
            background="",
            createdAt=now,
            updatedAt=now,
            world_scale="city",
            status="draft",
            time_status="paused",
            settings={"product_workspace": True, "product": product},
        )
        db.add(world)
        db.flush()
        seed_world(db, world.id)
        if product == "companion":
            # 给 AI 伴侣产品一个可立即开始的伴侣角色；它是普通人物，与个人 AI 人格分开。
            db.add(models.Character(
                world_id=world.id,
                name="小满",
                persona_type="npc",
                owner_user_id=owner,
                basic_profile={
                    "gender": "女",
                    "age": "25",
                    "identity": "你的 AI 伴侣角色",
                    "description": "温和、敏锐、愿意长期记住与你相处细节的伴侣角色。",
                },
                engines={"V": 60, "O": 55, "D": 35, "E": 50, "T": 65},
            ))
        try:
            db.commit()
        except IntegrityError:
            # 并发请求同时创建：让唯一索引兜底，返回先创建的空间。
            db.rollback()
            world = db.query(models.World).filter(
                models.World.owner_id == owner,
                models.World.product_scene == product,
                models.World.is_product_workspace.is_(True),
                models.World.deleted_at.is_(None),
            ).order_by(models.World.createdAt.asc()).first()
        db.refresh(world)
    return {"product": product, "world": _world_row(world), "auto_workspace": True}
