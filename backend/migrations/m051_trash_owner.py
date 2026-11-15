"""M051 回收站按用户隔离。"""

from .util import add_column

VERSION = "M051"


def apply(conn):
    add_column(conn, "trash_entries", "owner_user_id", "TEXT")
