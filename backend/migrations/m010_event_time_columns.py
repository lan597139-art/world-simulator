"""M010 补齐 events 的发生时间/结束时间/状态列（M008 首版遗漏）。"""

from sqlalchemy import text

from .util import add_column

VERSION = "M010"


def apply(conn):
    add_column(conn, "events", "occurred_at", "DATETIME")
    add_column(conn, "events", "ended_at", "DATETIME")
    add_column(conn, "events", "event_status", "TEXT DEFAULT 'occurred'")
    conn.execute(text("UPDATE events SET occurred_at = created_at WHERE occurred_at IS NULL"))
    conn.execute(text("UPDATE events SET event_status = 'occurred' WHERE event_status IS NULL"))
