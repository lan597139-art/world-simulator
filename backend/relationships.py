from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db

router = APIRouter()

@router.post("/api/relationships")
def create_relationship(rel_data: dict, db: Session = Depends(get_db)):
    # 简单版：直接接收字典并存入
    new_rel = models.Relationship(**rel_data)
    db.add(new_rel)
    db.commit()
    db.refresh(new_rel)
    return new_rel

@router.get("/api/relationships")
def list_relationships(db: Session = Depends(get_db)):
    return db.query(models.Relationship).order_by(models.Relationship.created_at.desc()).all()

@router.delete("/api/relationships/{relation_id}")
def delete_relationship(relation_id: str, db: Session = Depends(get_db)):
    relation = db.query(models.Relationship).filter(models.Relationship.id == relation_id).first()
    if not relation:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(relation)
    db.commit()
    return {"status": "ok", "message": "Relationship deleted"}