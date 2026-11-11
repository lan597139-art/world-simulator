"""M031 个人 AI 人格、独立会话与记忆。"""

from .util import create_index

VERSION = "M031"


def apply(conn):
    create_index(conn, "ix_persona_threads_persona_id", "persona_threads", "persona_id")
    create_index(conn, "ix_persona_messages_thread_id", "persona_messages", "thread_id")
    create_index(conn, "ix_persona_memories_persona_id", "persona_memories", "persona_id")
