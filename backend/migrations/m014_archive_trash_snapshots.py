"""M014 归档 / 回收站 / 官方演示世界字段。"""

from .util import add_column

VERSION = "M014"


def apply(conn):
    add_column(conn, "worlds", "archived_at", "DATETIME")
    add_column(conn, "worlds", "deleted_at", "DATETIME")
    add_column(conn, "worlds", "is_official", "INTEGER NOT NULL DEFAULT 0")
    add_column(conn, "worlds", "official_key", "TEXT")
    add_column(conn, "characters", "archived_at", "DATETIME")
    add_column(conn, "stories", "archived_at", "DATETIME")
