"""M043 设置中心：用户资料扩展与偏好/隐私/通知表。"""

from sqlalchemy import text

from .util import add_column

VERSION = "M043"


def apply(conn):
    add_column(conn, "app_users", "bio", "TEXT DEFAULT ''")
    add_column(conn, "app_users", "avatar", "TEXT DEFAULT ''")
    conn.execute(text(
        """CREATE TABLE IF NOT EXISTS user_settings (
               id TEXT PRIMARY KEY,
               user_id TEXT NOT NULL UNIQUE,
               preferences JSON DEFAULT '{}',
               privacy JSON DEFAULT '{}',
               notifications JSON DEFAULT '{}',
               updated_at DATETIME
           )"""
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id)"
    ))
