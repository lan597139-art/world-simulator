from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WorldBase(BaseModel):
    name: str
    description: str = ""
    type: str = "custom"
    background: str = ""
    map_image_url: Optional[str] = ""
    world_scale: Optional[str] = "city"
    status: Optional[str] = "draft"
    time_status: Optional[str] = "paused"
    settings: Optional[dict] = None
    product_scene: Optional[str] = None


class WorldCreate(WorldBase):
    pass


class WorldUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    background: Optional[str] = None
    map_image_url: Optional[str] = None
    world_scale: Optional[str] = None
    status: Optional[str] = None
    time_status: Optional[str] = None
    settings: Optional[dict] = None
    product_scene: Optional[str] = None


class WorldResponse(WorldBase):
    id: str
    createdAt: str
    updatedAt: str
    is_product_workspace: Optional[bool] = False
    is_official: Optional[bool] = False
    official_key: Optional[str] = None
    archived_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
