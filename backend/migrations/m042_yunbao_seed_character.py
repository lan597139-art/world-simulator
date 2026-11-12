"""M042 云宝人格与完整人物种子编辑器绑定。

云宝仍是唯一全局人格；seed_character_id 只指向云宝领域中的承载人物，
用于复用人物种子编辑器的 01–08 深层结构，不创建第二个人格身份。
"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M042"


def apply(conn):
    add_column(conn, "personal_personas", "seed_character_id", "TEXT")
    create_index(conn, "ix_personal_personas_seed_character", "personal_personas", "seed_character_id")
