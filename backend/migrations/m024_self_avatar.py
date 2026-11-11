"""M024 自我人物（AI 伴侣用户侧）。"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M024"


def apply(conn):
    add_column(conn, "characters", "persona_type", "TEXT DEFAULT 'npc'")
    add_column(conn, "characters", "owner_user_id", "TEXT")
    conn.execute(text("UPDATE characters SET persona_type = 'npc' WHERE persona_type IS NULL"))
    create_index(conn, "ix_characters_persona_type", "characters", "persona_type")
