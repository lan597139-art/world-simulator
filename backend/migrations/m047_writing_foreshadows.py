"""M047 写作伏笔：独立于 05 事件的伏笔债务表。"""

from sqlalchemy import text

VERSION = "M047"

TABLES = [
    """CREATE TABLE IF NOT EXISTS writing_foreshadows (
        id TEXT PRIMARY KEY,
        world_id TEXT NOT NULL,
        owner_user_id TEXT DEFAULT 'local',
        story_id TEXT,
        event_id TEXT,
        text TEXT DEFAULT '',
        promise TEXT DEFAULT '',
        cost TEXT DEFAULT '',
        planned_story_id TEXT,
        resolved_story_id TEXT,
        payoff_form TEXT DEFAULT '信息',
        status TEXT DEFAULT 'pending',
        tags JSON DEFAULT '[]',
        created_at DATETIME,
        updated_at DATETIME
    )""",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_writing_foreshadows_world_status ON writing_foreshadows(world_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_writing_foreshadows_story ON writing_foreshadows(story_id, status)",
]


def apply(conn):
    for sql in TABLES:
        conn.execute(text(sql))
    for sql in INDEXES:
        conn.execute(text(sql))
