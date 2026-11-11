from datetime import datetime
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from ai_engine import reset_request_ai_config, set_request_ai_config
from database import SessionLocal, engine, get_db
from migrations.runner import run_migrations

# 领域路由
from nodes import router as nodes_router, seed_world
from users import router as users_router, ensure_local_user
from event_choices import router as event_choices_router
from story_threads import router as story_threads_router
from story_tree import router as story_tree_router
from axis_objects import router as axis_objects_router, seed_official_axis_objects
from personas import router as personas_router
from event_sandbox import router as event_sandbox_router
from diary import router as diary_router
from auth import router as auth_router, auth_middleware
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
from multipath import router as multipath_router
from assistant import router as assistant_router
from writing import router as writing_router
from archive import router as archive_router
from trash import router as trash_router
from snapshots import router as snapshots_router
from biography import router as biography_router
from official import ensure_official_world, router as official_router
from official_storyline import ensure_official_storyline
from story_tree_seed import seed_official_tree
from supplement_demo import seed_supplement_demo
from storyline import router as storyline_router
from chat import router as chat_router

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


app.middleware("http")(auth_middleware)


for router in (
    character_router,
    relationship_router,
    event_router,
    event_links_router,
    simulation_router,
    users_router,
    event_choices_router,
    story_threads_router,
    story_tree_router,
    axis_objects_router,
    personas_router,
    event_sandbox_router,
    diary_router,
    auth_router,
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
    archive_router,
    trash_router,
    snapshots_router,
    biography_router,
    official_router,
    multipath_router,
    assistant_router,
    storyline_router,
    chat_router,
):
    app.include_router(router)

# 官方演示世界：首次启动自动内置；已存在则仅锁定，不覆盖用户当前数据。
try:
    with SessionLocal() as db:
        ensure_official_world(db)
        ensure_official_storyline(db)
        seed_official_tree(db)
        seed_official_axis_objects(db)
        seed_supplement_demo(db)
except Exception as exc:  # 数据缺失不应阻止后端启动
    print(f"官方演示世界初始化跳过: {exc}")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.1.0"}


def _current_user_id(request: Request) -> str:
    return str(getattr(request.state, "user_id", None) or "local")


def _owned(world: models.World, request: Request):
    if world.owner_id and world.owner_id != _current_user_id(request):
        raise HTTPException(status_code=404, detail="World not found")


@app.get("/api/worlds", response_model=List[schemas.WorldResponse])
def get_worlds(request: Request, product_scene: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.World).filter(
        models.World.deleted_at.is_(None), models.World.archived_at.is_(None)
    )
    query = query.filter(
        (models.World.owner_id == _current_user_id(request)) | (models.World.is_official.is_(True))
    )
    if product_scene:
        query = query.filter(models.World.product_scene == product_scene)
    return query.order_by(models.World.updatedAt.desc()).all()


@app.get("/api/worlds/{world_id}", response_model=schemas.WorldResponse)
def get_world(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="World not found")
    _owned(world, request)
    return world


@app.post("/api/worlds", response_model=schemas.WorldResponse)
def create_world(world: schemas.WorldCreate, request: Request, db: Session = Depends(get_db)):
    if world.product_scene and world.product_scene not in {"game", "literature", "companion", "diary"}:
        raise HTTPException(status_code=422, detail="product_scene 只能是 game/literature/companion/diary")
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
        owner_id=_current_user_id(request),
        product_scene=world.product_scene,
    )
    db.add(db_world)
    db.flush()
    seed_world(db, db_world.id)
    db.commit()
    db.refresh(db_world)
    return db_world


@app.put("/api/worlds/{world_id}")
@app.patch("/api/worlds/{world_id}")
def update_world(world_id: str, world: schemas.WorldUpdate, request: Request, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world:
        raise HTTPException(status_code=404, detail="World not found")
    _owned(db_world, request)

    for key, value in world.model_dump(exclude_unset=True).items():
        setattr(db_world, key, value)

    db_world.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    return {"status": "ok"}


@app.delete("/api/worlds/{world_id}")
def delete_world(world_id: str, request: Request, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world or db_world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="World not found")
    _owned(db_world, request)
    if db_world.is_official:
        raise HTTPException(status_code=409, detail="官方演示世界已锁定，不能删除；可使用“重置演示世界”。")
    from trash_service import trash_world

    entry = trash_world(db, db_world)
    return {"status": "ok", "trashed": True, "trash_id": entry.id}
