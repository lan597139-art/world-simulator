"""M026 传记引用来源。"""

from sqlalchemy import text

from .util import add_column

VERSION = "M026"


def apply(conn):
    add_column(conn, "character_biographies", "citations", "JSON")
    conn.execute(text("UPDATE character_biographies SET citations = '[]' WHERE citations IS NULL"))
