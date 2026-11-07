from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
from database import get_db

router = APIRouter()

@router.get("/api/worlds/{world_id}/characters")
def get_characters(world_id: str, db: Session = Depends(get_db)):
    return db.query(models.Character).filter(models.Character.world_id == world_id).all()

@router.post("/api/characters")
def create_character(char_data: dict, db: Session = Depends(get_db)):
    # 简单版：直接接收字典并存入
    new_char = models.Character(**char_data)
    db.add(new_char)
    db.commit()
    db.refresh(new_char)
    return new_char
@router.get("/api/characters")
def list_characters(db: Session = Depends(get_db)):
    return db.query(models.Character).order_by(models.Character.created_at.desc()).all()

@router.get("/api/characters/{character_id}")
def get_character(character_id: str, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character
@router.put("/api/characters/{character_id}")
def update_character(character_id: str, char_data: dict, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # 更新允许修改的字段
    for key, value in char_data.items():
        if hasattr(character, key):
            setattr(character, key, value)

    db.commit()
    db.refresh(character)
    return character
@router.delete("/api/characters/{character_id}")
def delete_character(character_id: str, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    db.delete(character)
    db.commit()
    return {"status": "ok", "message": "Character deleted"}