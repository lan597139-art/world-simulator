"""M001 世界基础：worlds 扩展列、八分支目录种子、世界配置表兜底。"""

import uuid

from sqlalchemy import text

from .util import add_column, table_exists, utcnow

VERSION = "M001"

BRANCHES = [
    ("world_profile", "世界基础"),
    ("world_rules", "世界规则"),
    ("space_time", "时空结构"),
    ("geography", "地理结构"),
    ("civilization_society", "文明与社会"),
    ("organizations", "组织结构"),
    ("people_groups", "人物与群体"),
    ("resources_economy", "资源与经济"),
]


def apply(conn):
    add_column(conn, "worlds", "world_scale", "TEXT DEFAULT 'city'")
    add_column(conn, "worlds", "status", "TEXT DEFAULT 'draft'")
    add_column(conn, "worlds", "time_status", "TEXT DEFAULT 'paused'")
    add_column(conn, "worlds", "settings", "JSON DEFAULT '{}'")

    if not table_exists(conn, "world_nodes"):
        return

    worlds = conn.execute(text("SELECT id FROM worlds")).fetchall()
    for (world_id,) in worlds:
        existing = conn.execute(
            text("SELECT COUNT(*) FROM world_nodes WHERE world_id=:w AND parent_id IS NULL"),
            {"w": world_id},
        ).scalar()
        if existing:
            continue
        for order, (branch, name) in enumerate(BRANCHES):
            conn.execute(
                text(
                    """INSERT INTO world_nodes
                       (id, world_id, parent_id, branch, node_type, name, sort_order, description,
                        ref_type, ref_id, created_at, updated_at)
                       VALUES (:id, :w, NULL, :b, 'folder', :n, :o, '', NULL, NULL, :t, :t)"""
                ),
                {
                    "id": str(uuid.uuid4()),
                    "w": world_id,
                    "b": branch,
                    "n": name,
                    "o": order,
                    "t": utcnow(),
                },
            )
