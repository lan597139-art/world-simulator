"""M039 Phase N1-M4：AI 信息授权、访问审计与记忆来源。"""

from .util import add_column, create_index, table_exists

VERSION = "M039"


def apply(conn):
    # 记忆来源引用：JSON 快照；撤销原因；不存正文
    add_column(conn, "persona_memories", "source_refs", "TEXT")
    add_column(conn, "persona_memories", "invalidated_reason", "TEXT")
    create_index(conn, "ix_persona_memories_grant", "persona_memories", "source_grant_id")

    for table, indexes in {
        "ai_info_grants": [
            ("ix_ai_info_grants_owner_status", "owner_user_id, status"),
            ("ix_ai_info_grants_instance", "grantee_instance_id, status"),
        ],
        "ai_info_grant_scopes": [
            ("ix_ai_info_grant_scopes_grant", "grant_id"),
            ("ix_ai_info_grant_scopes_scope", "scope_type, scope_id"),
        ],
        "ai_info_requests": [
            ("ix_ai_info_requests_owner_status", "owner_user_id, status"),
            ("ix_ai_info_requests_instance", "requester_instance_id, status"),
        ],
        "ai_info_access_logs": [
            ("ix_ai_info_access_logs_owner_time", "owner_user_id, created_at"),
            ("ix_ai_info_access_logs_instance", "instance_id, created_at"),
        ],
        "ai_memory_sources": [
            ("ix_ai_memory_sources_source", "source_type, source_id"),
            ("ix_ai_memory_sources_grant", "grant_id"),
            ("ix_ai_memory_sources_memory", "memory_id"),
        ],
    }.items():
        if table_exists(conn, table):
            for name, columns in indexes:
                create_index(conn, name, table, columns)
