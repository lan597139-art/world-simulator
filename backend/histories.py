"""状态历史查询：时间线与实体历史的统一入口。"""

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from common import entity_name, get_world
from database import get_db

router = APIRouter()


@router.get("/api/worlds/{world_id}/histories")
def list_histories(
    world_id: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    event_id: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    query = db.query(models.StateHistory).filter(models.StateHistory.world_id == world_id)
    if entity_type:
        query = query.filter(models.StateHistory.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.StateHistory.entity_id == entity_id)
    if event_id:
        query = query.filter(models.StateHistory.event_id == event_id)
    rows = (
        query.order_by(models.StateHistory.occurred_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "entity_name": entity_name(db, row.entity_type, row.entity_id),
            "field": row.field,
            "old_value": row.old_value,
            "new_value": row.new_value,
            "event_id": row.event_id,
            "reason": row.reason,
            "source": row.source,
            "occurred_at": row.occurred_at,
        }
        for row in rows
    ]
