"""M018 聊天影响审计表。"""

from .util import create_index

VERSION = "M018"


def apply(conn):
    create_index(conn, "ix_chat_impacts_world_id", "chat_impacts", "world_id")
    create_index(conn, "ix_chat_impacts_thread_id", "chat_impacts", "thread_id")
