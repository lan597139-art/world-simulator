from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from ai_engine import reset_request_ai_config, set_request_ai_config
from database import engine, get_db
from migrations.runner import run_migrations

# 领域路由
from nodes import router as nodes_router, seed_world
from geography import router as geography_router
from orgs import router as orgs_router
from events import router as event_router
from event_links import router as event_links_router
from relationships import router as relationship_router
from rules import router as rules_router
from worldtime import router as worldtime_router
from society import router as society_router
from resources import router as resources_router
from histories import router as histories_router
from relationship_types import router as relationship_types_router
from event_causality import router as event_causality_router
from timeline import router as timeline_router
from characters import router as character_router
from simulation import router as simulation_router
from writing import router as writing_router

# 建表（新表）+ 增量迁移（已有表加列、数据回填）
models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(title="世界模拟器 API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://world-simulator-elht.vercel.app",
    ],
    # Vercel 预览域名每天变化，允许本项目所有预览部署。
    allow_origin_regex=r"https://world-simulator-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def ai_access_context(request, call_next):
    """访客可通过请求头携带自己的 AI Key；不落库、不写日志。"""
    token = set_request_ai_config(
        request.headers.get("x-ai-api-key", ""),
        request.headers.get("x-ai-base-url", ""),
        request.headers.get("x-ai-model", ""),
    )
    try:
        return await call_next(request)
    finally:
        reset_request_ai_config(token)


for router in (
    character_router,
    relationship_router,
    event_router,
    event_links_router,
    simulation_router,
    writing_router,
    nodes_router,
    geography_router,
    orgs_router,
    rules_router,
    worldtime_router,
    society_router,
    resources_router,
    histories_router,
    relationship_types_router,
    event_causality_router,
    timeline_router,
):
    app.include_router(router)


def _cascade_delete_world(db: Session, world_id: str):
    """世界删除时清理世界内所有实体，避免孤儿数据。顺序遵循外键依赖。"""
    rule_ids = [
        row[0]
        for row in db.query(models.WorldRule.id)
        .filter(models.WorldRule.world_id == world_id)
        .all()
    ]
    if rule_ids:
        db.query(models.RuleScope).filter(models.RuleScope.rule_id.in_(rule_ids)).delete(
            synchronize_session=False
        )

    # 自引用外键（父节点/父地点/父部门）会在批量删除时触发 RESTRICT，先解除父子关系
    db.query(models.WorldNode).filter(models.WorldNode.world_id == world_id).update(
        {models.WorldNode.parent_id: None}, synchronize_session=False
    )
    db.query(models.Location).filter(models.Location.world_id == world_id).update(
        {models.Location.parent_location_id: None}, synchronize_session=False
    )
    db.query(models.OrganizationUnit).filter(
        models.OrganizationUnit.world_id == world_id
    ).update({models.OrganizationUnit.parent_unit_id: None}, synchronize_session=False)

    for model in (
        models.WorldNode,
        models.WorldSettings,
        models.TimeSettings,
        models.Era,
        models.CharacterAppointment,
        models.OrganizationPosition,
        models.OrganizationUnit,
        models.Organization,
        models.Society,
        models.GroupMembership,
        models.SocialGroup,
        models.CulturalProfile,
        models.Relationship,
        models.RelationshipType,
        models.WorldRule,
        models.ResourceHolding,
        models.ResourceTransaction,
        models.Resource,
        models.ResourceType,
        models.EventRelation,
        models.CharacterEventPerception,
        models.EventEntity,
        models.StateHistory,
        models.Event,
        models.Location,
        models.LocationType,
        models.SimulationRun,
        models.EntityDraft,
        models.Story,
        models.Character,
    ):
        db.query(model).filter(model.world_id == world_id).delete(synchronize_session=False)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.1.0"}


@app.get("/api/worlds", response_model=List[schemas.WorldResponse])
def get_worlds(db: Session = Depends(get_db)):
    return db.query(models.World).order_by(models.World.updatedAt.desc()).all()


@app.get("/api/worlds/{world_id}", response_model=schemas.WorldResponse)
def get_world(world_id: str, db: Session = Depends(get_db)):
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        raise HTTPException(status_code=404, detail="World not found")
    return world


@app.post("/api/worlds", response_model=schemas.WorldResponse)
def create_world(world: schemas.WorldCreate, db: Session = Depends(get_db)):
    now = datetime.utcnow().isoformat()
    db_world = models.World(
        name=world.name,
        description=world.description,
        type=world.type,
        background=world.background,
        createdAt=now,
        updatedAt=now,
        world_scale=world.world_scale or "city",
        status="draft",
        time_status="paused",
        settings={},
    )
    db.add(db_world)
    db.flush()
    seed_world(db, db_world.id)
    db.commit()
    db.refresh(db_world)
    return db_world


@app.put("/api/worlds/{world_id}")
@app.patch("/api/worlds/{world_id}")
def update_world(world_id: str, world: schemas.WorldUpdate, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world:
        raise HTTPException(status_code=404, detail="World not found")

    for key, value in world.model_dump(exclude_unset=True).items():
        setattr(db_world, key, value)

    db_world.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    return {"status": "ok"}


@app.delete("/api/worlds/{world_id}")
def delete_world(world_id: str, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world:
        raise HTTPException(status_code=404, detail="World not found")
    _cascade_delete_world(db, world_id)
    db.delete(db_world)
    db.commit()
    return {"status": "ok"}
