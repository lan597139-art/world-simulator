from pydantic import BaseModel
from typing import Optional

class WorldBase(BaseModel):
    name: str
    description: str
    type: str
    background: str

class WorldCreate(WorldBase):
    pass

class WorldUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    background: Optional[str] = None

class WorldResponse(WorldBase):
    id: str
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True