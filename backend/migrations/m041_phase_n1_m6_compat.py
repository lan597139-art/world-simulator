"""M041 Phase N1-M6：旧 Story 与社区公开作品的兼容索引。

不自动发布旧 Story；只加可选关联与 owner 索引，便于写作库展示。
"""

from .util import add_column, create_index

VERSION = "M041"


def apply(conn):
    add_column(conn, "stories", "community_publication_id", "TEXT")
    create_index(conn, "ix_stories_owner_updated", "stories", "owner_user_id, updated_at")
    create_index(conn, "ix_stories_publication", "stories", "community_publication_id")
