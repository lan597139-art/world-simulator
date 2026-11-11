"""M027 本地账号口令与会话。"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M027"


def apply(conn):
    add_column(conn, "app_users", "password_hash", "TEXT")
    add_column(conn, "app_users", "is_active", "INTEGER DEFAULT 1")
    add_column(conn, "app_users", "updated_at", "DATETIME")
    conn.execute(text("UPDATE app_users SET is_active = 1 WHERE is_active IS NULL"))
    create_index(conn, "ix_auth_sessions_user_id", "auth_sessions", "user_id")
    create_index(conn, "ix_auth_sessions_token_hash", "auth_sessions", "token_hash")
