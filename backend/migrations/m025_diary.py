"""M025 独立日记（不随世界快照/删除）。"""

from .util import create_index

VERSION = "M025"


def apply(conn):
    for name, column in [
        ("ix_diary_entries_owner_user_id", "owner_user_id"),
        ("ix_diary_entries_world_id", "world_id"),
        ("ix_diary_entries_entry_date", "entry_date"),
        ("ix_diary_entries_source_type", "source_type"),
    ]:
        create_index(conn, name, "diary_entries", column)
