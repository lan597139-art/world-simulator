from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import models
import schemas
from database import engine, get_db
# 👇 新增导入
from characters import router as character_router 
from relationships import router as relationship_router
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="世界模拟器 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 👇 在这里挂载新路由（必须在 app 创建之后）
app.include_router(character_router)
app.include_router(relationship_router)
@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

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
        updatedAt=now
    )
    db.add(db_world)
    db.commit()
    db.refresh(db_world)
    return db_world

@app.put("/api/worlds/{world_id}")
def update_world(world_id: str, world: schemas.WorldUpdate, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world:
        raise HTTPException(status_code=404, detail="World not found")
    
    for key, value in world.dict(exclude_unset=True).items():
        setattr(db_world, key, value)
    
    db_world.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    return {"status": "ok"}

@app.delete("/api/worlds/{world_id}")
def delete_world(world_id: str, db: Session = Depends(get_db)):
    db_world = db.query(models.World).filter(models.World.id == world_id).first()
    if not db_world:
        raise HTTPException(status_code=404, detail="World not found")
    db.delete(db_world)
    db.commit()
    return {"status": "ok"}