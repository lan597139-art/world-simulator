"""迁移辅助函数：全部基于原生 SQL，不依赖 ORM 模型，避免迁移与模型互相锁死。"""

from datetime import datetime, timezone

from sqlalchemy import text


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table}
    ).first()
    return row is not None


def column_exists(conn, table: str, column: str) -> bool:
    if not table_exists(conn, table):
        return False
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def add_column(conn, table: str, column: str, ddl: str):
    """ddl 形如 'TEXT NOT NULL DEFAULT \'\''。已存在则跳过。"""
    if not column_exists(conn, table, column):
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def index_exists(conn, name: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='index' AND name=:n"), {"n": name}
    ).first()
    return row is not None


def create_index(conn, name: str, table: str, columns: str):
    if not index_exists(conn, name):
        conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table}({columns})"))
