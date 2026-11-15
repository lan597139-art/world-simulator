"""M048 写作敏感词：每个用户可维护自己的发布风险词表。"""

from sqlalchemy import text

VERSION = "M048"

TABLES = [
    """CREATE TABLE IF NOT EXISTS writing_sensitive_words (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        word TEXT NOT NULL,
        category TEXT DEFAULT '通用',
        severity TEXT DEFAULT 'warn',
        created_at DATETIME,
        updated_at DATETIME
    )""",
]

INDEXES = [
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_writing_sensitive_owner_word ON writing_sensitive_words(owner_user_id, word)",
]


def apply(conn):
    for sql in TABLES:
        conn.execute(text(sql))
    for sql in INDEXES:
        conn.execute(text(sql))
