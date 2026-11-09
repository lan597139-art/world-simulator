"""M003 组织：organizations 扩展列。"""

from sqlalchemy import text

from .util import add_column

VERSION = "M003"


def apply(conn):
    add_column(conn, "organizations", "organization_type", "TEXT DEFAULT 'company'")
    add_column(conn, "organizations", "mission", "TEXT DEFAULT ''")
    add_column(conn, "organizations", "founded_at", "DATETIME")
    add_column(conn, "organizations", "dissolved_at", "DATETIME")
    add_column(conn, "organizations", "status", "TEXT DEFAULT 'normal'")
    add_column(conn, "organizations", "headquarters_location_id", "TEXT REFERENCES locations(id)")
    add_column(conn, "organizations", "attributes", "JSON DEFAULT '{}'")
    add_column(conn, "organizations", "society_id", "TEXT REFERENCES societies(id)")
    add_column(conn, "organizations", "updated_at", "DATETIME")

    conn.execute(
        text("UPDATE organizations SET organization_type='company' WHERE organization_type IS NULL")
    )
