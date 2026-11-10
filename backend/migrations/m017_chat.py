"""M017 AI 角色聊天室：新表由 create_all 建出，本迁移只补索引。"""

from .util import create_index

VERSION = "M017"


def apply(conn):
    create_index(conn, "ix_ai_roles_world_id", "ai_roles", "world_id")
    create_index(conn, "ix_chat_threads_world_id", "chat_threads", "world_id")
    create_index(conn, "ix_chat_participants_thread_id", "chat_participants", "thread_id")
    create_index(conn, "ix_chat_messages_thread_id", "chat_messages", "thread_id")
    create_index(conn, "ix_chat_messages_created_at", "chat_messages", "created_at")
    create_index(conn, "ix_character_memories_character_id", "character_memories", "character_id")
    create_index(conn, "ix_character_memories_thread_id", "character_memories", "thread_id")
    create_index(conn, "ix_chat_plans_thread_id", "chat_plans", "thread_id")
