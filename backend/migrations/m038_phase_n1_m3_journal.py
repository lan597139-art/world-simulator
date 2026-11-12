"""M038 Phase N1-M3：用户 Journal / 个人人物 / 用户传记 / 引用索引。

新表由 create_all 建立；本迁移只补索引与幂等版本记录，不迁移 CharacterBiography。
"""

from .util import create_index, table_exists

VERSION = "M038"


def apply(conn):
    for table, indexes in {
        "journal_people": [
            ("ix_journal_people_owner_status", "owner_user_id, status"),
            ("ix_journal_people_owner_name", "owner_user_id, name"),
        ],
        "journal_relations": [
            ("ix_journal_relations_owner_person", "owner_user_id, person_id"),
            ("ix_journal_relations_owner_related", "owner_user_id, related_person_id"),
        ],
        "journal_entry_people": [
            ("ix_journal_entry_people_owner_person", "owner_user_id, person_id"),
        ],
        "user_biographies": [
            ("ix_user_biographies_owner_status", "owner_user_id, status"),
        ],
        "user_biography_chapters": [
            ("ix_user_biography_chapters_order", "biography_id, order_index"),
        ],
        "journal_citations": [
            ("ix_journal_citations_target", "target_type, target_id"),
            ("ix_journal_citations_owner", "owner_user_id"),
        ],
    }.items():
        if table_exists(conn, table):
            for name, columns in indexes:
                create_index(conn, name, table, columns)

    create_index(conn, "ix_diary_entries_owner_status", "diary_entries", "owner_user_id, status")
