"""M046 写作目录：卷表与章节排序/大纲目标字段。"""

from sqlalchemy import text

VERSION = "M046"

TABLES = [
    """CREATE TABLE IF NOT EXISTS story_volumes (
        id TEXT PRIMARY KEY,
        world_id TEXT NOT NULL,
        owner_user_id TEXT DEFAULT 'local',
        title TEXT DEFAULT '未命名卷',
        summary TEXT DEFAULT '',
        act TEXT DEFAULT 'setup',
        outline_goal TEXT DEFAULT '',
        target_words INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        created_at DATETIME,
        updated_at DATETIME
    )""",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_story_volumes_world_order ON story_volumes(world_id, sort_order)",
]


def _columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add_column(conn, table: str, name: str, ddl: str) -> None:
    if name not in _columns(conn, table):
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def apply(conn):
    for sql in TABLES:
        conn.execute(text(sql))
    for sql in INDEXES:
        conn.execute(text(sql))

    _add_column(conn, "stories", "volume_id", "TEXT")
    _add_column(conn, "stories", "sort_order", "INTEGER DEFAULT 0")
    _add_column(conn, "stories", "summary", "TEXT DEFAULT ''")
    _add_column(conn, "stories", "outline_goal", "TEXT DEFAULT ''")
    _add_column(conn, "stories", "target_words", "INTEGER DEFAULT 0")
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stories_volume_order ON stories(volume_id, sort_order)"))

    # 旧章节没有卷：按世界 + 创建时间回填稳定顺序，避免前端首次打开全部 0。
    rows = conn.execute(
        text(
            "SELECT id, world_id FROM stories "
            "WHERE archived_at IS NULL ORDER BY world_id, created_at, id"
        )
    ).fetchall()
    counters: dict[str, int] = {}
    for story_id, world_id in rows:
        key = world_id or ""
        index = counters.get(key, 0)
        conn.execute(
            text("UPDATE stories SET sort_order = :index WHERE id = :id"),
            {"index": index, "id": story_id},
        )
        counters[key] = index + 1
