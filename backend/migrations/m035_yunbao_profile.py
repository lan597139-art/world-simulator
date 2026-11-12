"""M035 云宝单一 AI 人格、所有者标记与人格扩展字段。

保留既有 personal_personas 数据：旧人格 system_key 为空，不合并、不迁移。
"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M035"


def apply(conn):
    # 系统所有者：本地初始化账号是所有者；后续普通账号默认非所有者。
    add_column(conn, "app_users", "is_owner", "INTEGER NOT NULL DEFAULT 0")
    conn.execute(text("UPDATE app_users SET is_owner = 1 WHERE id = 'local'"))

    add_column(conn, "personal_personas", "system_key", "TEXT")
    add_column(conn, "personal_personas", "maturity", "TEXT DEFAULT ''")
    add_column(conn, "personal_personas", "biography", "TEXT DEFAULT ''")
    add_column(conn, "personal_personas", "growth_experience", "JSON DEFAULT '[]'")
    add_column(conn, "personal_personas", "states", "JSON DEFAULT '[]'")
    add_column(conn, "personal_personas", "active_state", "TEXT DEFAULT ''")

    # 每个所有者最多一条云宝；旧人格 system_key 为 NULL，不受唯一约束影响。
    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_personal_personas_yunbao "
        "ON personal_personas(owner_user_id, system_key) WHERE system_key = 'yunbao'"
    ))
    create_index(conn, "ix_personal_personas_system_key", "personal_personas", "system_key")
