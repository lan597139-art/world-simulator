"""M033 四产品功能配置：产品工作空间、人格/日记产品归属、信息来源表索引。"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M033"


def apply(conn):
    add_column(conn, "worlds", "is_product_workspace", "BOOLEAN DEFAULT 0")
    add_column(conn, "personal_personas", "product_key", "TEXT DEFAULT 'companion'")
    add_column(conn, "diary_entries", "product_key", "TEXT DEFAULT 'diary'")

    # 旧数据回填：旧世界默认属于完整游戏创作；旧人格属于 AI 伴侣；旧日记属于日记产品。
    conn.execute(text(
        "UPDATE worlds SET product_scene = 'game' WHERE product_scene IS NULL OR product_scene = ''"
    ))
    conn.execute(text(
        "UPDATE personal_personas SET product_key = 'companion' "
        "WHERE product_key IS NULL OR product_key = ''"
    ))
    conn.execute(text(
        "UPDATE diary_entries SET product_key = 'diary' WHERE product_key IS NULL OR product_key = ''"
    ))

    create_index(conn, "ix_worlds_product_workspace", "worlds", "is_product_workspace")
    create_index(conn, "ix_personas_product_key", "personal_personas", "product_key")
    create_index(conn, "ix_diary_product_key", "diary_entries", "product_key")
    create_index(conn, "ix_info_sources_owner", "information_sources", "owner_user_id")
    create_index(conn, "ix_info_sources_product", "information_sources", "product_key")
    create_index(conn, "ix_info_sources_character", "information_sources", "character_id")
    create_index(conn, "ix_info_sources_event", "information_sources", "event_id")
