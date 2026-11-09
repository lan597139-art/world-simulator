"""M004 关系与历史：relationships 类型化、history JSON → state_histories、脏数据收口。"""

import json

from sqlalchemy import text

from .util import add_column, utcnow

VERSION = "M004"


def apply(conn):
    add_column(conn, "relationships", "source_type", "TEXT DEFAULT 'character'")
    add_column(conn, "relationships", "target_type", "TEXT DEFAULT 'character'")
    add_column(conn, "relationships", "status", "TEXT DEFAULT 'active'")
    add_column(conn, "relationships", "strength_level", "TEXT")
    add_column(conn, "relationships", "valid_from", "DATETIME")
    add_column(conn, "relationships", "valid_until", "DATETIME")
    add_column(conn, "relationships", "updated_at", "DATETIME")

    conn.execute(
        text("UPDATE relationships SET source_type='character' WHERE source_type IS NULL")
    )
    conn.execute(
        text("UPDATE relationships SET target_type='character' WHERE target_type IS NULL")
    )
    conn.execute(text("UPDATE relationships SET status='active' WHERE status IS NULL"))

    # 脏数据：world_id 指向不存在的世界 / 两端实体不存在 → 收口为 ended，不删
    valid_worlds = {r[0] for r in conn.execute(text("SELECT id FROM worlds")).fetchall()}
    valid_chars = {r[0] for r in conn.execute(text("SELECT id FROM characters")).fetchall()}
    rows = conn.execute(
        text("SELECT id, world_id, source_id, target_id, history, created_at FROM relationships")
    ).fetchall()
    for rel_id, world_id, source_id, target_id, history, created_at in rows:
        broken = (
            world_id not in valid_worlds
            or (source_id not in valid_chars and target_id not in valid_chars)
        )
        if broken:
            conn.execute(
                text(
                    """UPDATE relationships
                       SET status='ended', world_id=NULL,
                           description = TRIM(COALESCE(description,'') || ' [迁移：来源世界或端点不存在]')
                       WHERE id=:i"""
                ),
                {"i": rel_id},
            )
            continue

        # 历史 JSON → state_histories（只迁一次）
        already = conn.execute(
            text(
                "SELECT COUNT(*) FROM state_histories WHERE entity_type='relationship' AND entity_id=:e"
            ),
            {"e": rel_id},
        ).scalar()
        if already or not history:
            continue
        try:
            entries = json.loads(history) if isinstance(history, str) else history
        except (TypeError, ValueError):
            entries = None
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            old_status = entry.get("old_status")
            new_status = entry.get("new_status")
            reason = entry.get("reason") or ""
            stamp = entry.get("time")
            if stamp:
                reason = f"[{stamp}] {reason}".strip()
            conn.execute(
                text(
                    """INSERT INTO state_histories
                       (id, world_id, entity_type, entity_id, field, old_value, new_value,
                        event_id, reason, source, actor_id, occurred_at, created_at)
                       VALUES (:id, :w, 'relationship', :e, 'status', :old, :new,
                               NULL, :reason, 'import', NULL, :at, :now)"""
                ),
                {
                    "id": __import__("uuid").uuid4().hex,
                    "w": world_id,
                    "e": rel_id,
                    "old": json.dumps(old_status, ensure_ascii=False) if old_status is not None else None,
                    "new": json.dumps(new_status, ensure_ascii=False) if new_status is not None else None,
                    "reason": reason,
                    "at": created_at or utcnow(),
                    "now": utcnow(),
                },
            )

    # 兼容视图：关系历史
    conn.execute(
        text(
            """CREATE VIEW IF NOT EXISTS relationship_histories AS
               SELECT id, world_id, entity_id AS relationship_id, event_id,
                      old_value, new_value, occurred_at, reason
               FROM state_histories
               WHERE entity_type='relationship'"""
        )
    )
