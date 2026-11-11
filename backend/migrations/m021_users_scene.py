"""M021 本地账号、世界归属、产品场景（四宫格）。"""

from sqlalchemy import text

from .util import add_column, create_index, table_exists

VERSION = "M021"
LOCAL_USER_ID = "local"


def apply(conn):
    conn.execute(
        text(
        """
        CREATE TABLE IF NOT EXISTS app_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT DEFAULT '',
            created_at DATETIME
        )
        """
        )
    )
    conn.execute(
        text(
            "INSERT OR IGNORE INTO app_users (id, username, display_name, created_at) "
            "VALUES (:id, 'local', '本地用户', datetime('now'))"
        ),
        {"id": LOCAL_USER_ID},
    )
    add_column(conn, "worlds", "owner_id", "TEXT")
    add_column(conn, "worlds", "product_scene", "TEXT")
    conn.execute(text("UPDATE worlds SET owner_id = :owner WHERE owner_id IS NULL"), {"owner": LOCAL_USER_ID})
    create_index(conn, "ix_worlds_owner_id", "worlds", "owner_id")
    create_index(conn, "ix_worlds_product_scene", "worlds", "product_scene")
