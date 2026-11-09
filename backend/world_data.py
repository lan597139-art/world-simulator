from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import models
from database import get_db

router = APIRouter()

# ================= 地点管理 =================
@router.post("/api/locations")
def create_location(data: dict, db: Session = Depends(get_db)):
    new_item = models.Location(**data)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.get("/api/locations")
def list_locations(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Location)
    if world_id:
        query = query.filter(models.Location.world_id == world_id)
    return query.order_by(models.Location.created_at.desc()).all()

@router.delete("/api/locations/{id}")
def delete_location(id: str, db: Session = Depends(get_db)):
    item = db.query(models.Location).filter(models.Location.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"status": "ok"}

# ================= 组织管理 =================
@router.post("/api/organizations")
def create_organization(data: dict, db: Session = Depends(get_db)):
    new_item = models.Organization(**data)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.get("/api/organizations")
def list_organizations(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Organization)
    if world_id:
        query = query.filter(models.Organization.world_id == world_id)
    return query.order_by(models.Organization.created_at.desc()).all()

@router.delete("/api/organizations/{id}")
def delete_organization(id: str, db: Session = Depends(get_db)):
    item = db.query(models.Organization).filter(models.Organization.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"status": "ok"}