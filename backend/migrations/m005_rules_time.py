"""M005 时空：为每个世界创建时间设置（默认手动推进）。"""

from datetime import datetime

from sqlalchemy import text

from .util import utcnow

VERSION = "M005"


def _parse(value):
    if not value:
        return utcnow()
    if isinstance(value, datetime):
        return value
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(value)[:26], fmt)
        except ValueError:
            continue
    return utcnow()


def apply(conn):
    worlds = conn.execute(text("SELECT id, createdAt FROM worlds")).fetchall()
    for world_id, created_at in worlds:
        exists = conn.execute(
            text("SELECT 1 FROM time_settings WHERE world_id=:w"), {"w": world_id}
        ).first()
        if exists:
            continue
        start = _parse(created_at)
        conn.execute(
            text(
                """INSERT INTO time_settings
                   (world_id, calendar_type, day_length_hours, time_unit, timezone,
                    current_time, current_era_id, allow_regional_time, time_mode,
                    real_seconds_per_world_day, last_sync_at, config, updated_at)
                   VALUES (:w, 'gregorian', 24, 'day', 'UTC', :t, NULL, 0, 'manual',
                           86400, :t, '{}', :t)"""
            ),
            {"w": world_id, "t": start},
        )
