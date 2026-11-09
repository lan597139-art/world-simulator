"""M007 事件：participants/affected JSON → event_entities，simulation_runs 补 world_id。"""

import json
import uuid

from sqlalchemy import text

from .util import add_column, utcnow

VERSION = "M007"


def _load(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value:
        try:
            data = json.loads(value)
            return data if isinstance(data, list) else []
        except ValueError:
            return []
    return []


def apply(conn):
    add_column(conn, "events", "updated_at", "DATETIME")
    add_column(conn, "simulation_runs", "world_id", "TEXT")

    events = conn.execute(
        text(
            "SELECT id, world_id, participants, affected, location_id, organization_id "
            "FROM events"
        )
    ).fetchall()
    for event_id, world_id, participants, affected, location_id, organization_id in events:
        if not world_id:
            continue
        existing = conn.execute(
            text("SELECT COUNT(*) FROM event_entities WHERE event_id=:e"), {"e": event_id}
        ).scalar()
        if existing:
            continue
        pairs = []
        pairs += [("character", pid, "participant") for pid in _load(participants) if pid]
        pairs += [("character", pid, "affected") for pid in _load(affected) if pid]
        if location_id:
            pairs.append(("location", location_id, "location"))
        if organization_id:
            pairs.append(("organization", organization_id, "organization"))
        seen = set()
        for entity_type, entity_id, role in pairs:
            key = (entity_type, entity_id, role)
            if key in seen:
                continue
            seen.add(key)
            conn.execute(
                text(
                    """INSERT INTO event_entities
                       (id, world_id, event_id, entity_type, entity_id, role, impact, created_at)
                       VALUES (:id, :w, :e, :et, :ei, :r, '', :t)"""
                ),
                {
                    "id": str(uuid.uuid4()),
                    "w": world_id,
                    "e": event_id,
                    "et": entity_type,
                    "ei": entity_id,
                    "r": role,
                    "t": utcnow(),
                },
            )

    # simulation_runs.world_id 由事件回填
    conn.execute(
        text(
            """UPDATE simulation_runs
               SET world_id = (SELECT world_id FROM events WHERE events.id = simulation_runs.event_id)
               WHERE world_id IS NULL"""
        )
    )
