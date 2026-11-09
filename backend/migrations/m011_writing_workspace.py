"""M011 写作工作台：章节元数据列 + 写作草稿索引。"""

from .util import add_column, create_index

VERSION = "M011"


def apply(conn):
    add_column(conn, "stories", "title", "TEXT DEFAULT '未命名章节'")
    add_column(conn, "stories", "plain_text", "TEXT DEFAULT ''")
    add_column(conn, "stories", "word_count", "INTEGER DEFAULT 0")
    add_column(conn, "stories", "mode", "TEXT DEFAULT 'architect'")
    add_column(conn, "stories", "status", "TEXT DEFAULT 'draft'")
    add_column(conn, "stories", "source_event_ids", "TEXT DEFAULT '[]'")
    add_column(conn, "stories", "source_simulation_ids", "TEXT DEFAULT '[]'")
    add_column(conn, "stories", "updated_at", "DATETIME")
    conn.exec_driver_sql(
        "UPDATE stories SET updated_at = created_at WHERE updated_at IS NULL"
    )
    conn.exec_driver_sql(
        "UPDATE stories SET title = '第 ' || rowid || ' 章' WHERE title IS NULL OR title = ''"
    )
    create_index(conn, "ix_stories_world_updated", "stories", "world_id, updated_at")
