"""时空结构：时间设置（手动/实时双模式）与时代。"""

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

import models
from common import fail, get_or_404, get_world, parse_datetime, sync_world_time, utcnow
from database import get_db

router = APIRouter()

TIME_MODES = {"manual", "realtime"}


def _time_dict(ts: models.TimeSettings) -> dict:
    return {
        "world_id": ts.world_id,
        "calendar_type": ts.calendar_type or "gregorian",
        "day_length_hours": ts.day_length_hours or 24,
        "time_unit": ts.time_unit or "day",
        "timezone": ts.timezone or "UTC",
        "current_time": ts.current_time,
        "current_era_id": ts.current_era_id,
        "allow_regional_time": bool(ts.allow_regional_time),
        "time_mode": ts.time_mode or "manual",
        "real_seconds_per_world_day": ts.real_seconds_per_world_day or 86400,
        "last_sync_at": ts.last_sync_at,
        "config": ts.config or {},
    }


@router.get("/api/worlds/{world_id}/time-settings")
def get_time_settings(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    ts = sync_world_time(db, world_id)
    db.commit()
    return _time_dict(ts)


@router.put("/api/worlds/{world_id}/time-settings")
@router.patch("/api/worlds/{world_id}/time-settings")
def update_time_settings(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    ts = sync_world_time(db, world_id)

    if "time_mode" in payload:
        mode = payload["time_mode"]
        if mode not in TIME_MODES:
            fail(422, "VALIDATION_ERROR", "time_mode 只能是 manual 或 realtime")
        ts.time_mode = mode
        ts.last_sync_at = utcnow()

    if "current_time" in payload and payload["current_time"]:
        from datetime import datetime

        raw = payload["current_time"]
        try:
            ts.current_time = datetime.fromisoformat(str(raw)[:26])
        except ValueError:
            fail(422, "VALIDATION_ERROR", "current_time 不是合法时间")

    for key in (
        "calendar_type", "day_length_hours", "time_unit", "timezone",
        "current_era_id", "allow_regional_time", "real_seconds_per_world_day", "config",
    ):
        if key in payload:
            setattr(ts, key, payload[key])

    if ts.real_seconds_per_world_day is not None and ts.real_seconds_per_world_day <= 0:
        fail(422, "VALIDATION_ERROR", "real_seconds_per_world_day 必须大于 0")

    ts.updated_at = utcnow()
    db.commit()
    return _time_dict(ts)


@router.post("/api/worlds/{world_id}/time/advance")
def advance_time(world_id: str, payload: dict = Body(default={}), db: Session = Depends(get_db)):
    get_world(db, world_id)
    ts = sync_world_time(db, world_id)
    days = float(payload.get("days") or 0)
    hours = float(payload.get("hours") or 0)
    minutes = float(payload.get("minutes") or 0)
    delta = timedelta(days=days, hours=hours, minutes=minutes)
    if delta.total_seconds() == 0:
        fail(422, "VALIDATION_ERROR", "请指定要推进的时间")
    if delta.total_seconds() < 0:
        fail(422, "VALIDATION_ERROR", "暂不支持时间倒流")

    ts.current_time = (ts.current_time or utcnow()) + delta
    ts.last_sync_at = utcnow()
    ts.updated_at = utcnow()
    db.commit()
    return _time_dict(ts)


@router.get("/api/worlds/{world_id}/eras")
def list_eras(world_id: str, db: Session = Depends(get_db)):
    get_world(db, world_id)
    rows = (
        db.query(models.Era)
        .filter(models.Era.world_id == world_id)
        .order_by(models.Era.sort_order)
        .all()
    )
    return [
        {
            "id": row.id,
            "world_id": row.world_id,
            "name": row.name,
            "start_time": row.start_time,
            "end_time": row.end_time,
            "description": row.description or "",
            "sort_order": row.sort_order,
        }
        for row in rows
    ]


@router.post("/api/worlds/{world_id}/eras")
def create_era(world_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    get_world(db, world_id)
    name = (payload.get("name") or "").strip()
    if not name:
        fail(422, "VALIDATION_ERROR", "时代名称不能为空")
    era = models.Era(
        world_id=world_id,
        name=name,
        start_time=parse_datetime(payload.get("start_time")),
        end_time=parse_datetime(payload.get("end_time")),
        description=payload.get("description") or "",
        sort_order=payload.get("sort_order") or 0,
    )
    db.add(era)
    db.commit()
    db.refresh(era)
    return {"id": era.id, "name": era.name}


@router.patch("/api/eras/{era_id}")
def update_era(era_id: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    era = get_or_404(db, models.Era, era_id, "时代")
    for key in ("name", "start_time", "end_time", "description", "sort_order"):
        if key in payload:
            setattr(era, key, payload[key])
    db.commit()
    return {"status": "ok"}


@router.delete("/api/eras/{era_id}")
def delete_era(era_id: str, db: Session = Depends(get_db)):
    era = get_or_404(db, models.Era, era_id, "时代")
    db.query(models.TimeSettings).filter(models.TimeSettings.current_era_id == era.id).update(
        {"current_era_id": None}
    )
    db.delete(era)
    db.commit()
    return {"status": "ok"}
