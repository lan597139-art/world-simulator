"""M029 真实故事树节点。"""

from .util import create_index

VERSION = "M029"


def apply(conn):
    # 表本身由 create_all 建立；迁移只补索引，保证空库/旧库一致。
    create_index(conn, "ix_story_tree_nodes_story_id", "story_tree_nodes", "story_id")
    create_index(conn, "ix_story_tree_nodes_thread_id", "story_tree_nodes", "thread_id")
    create_index(conn, "ix_story_tree_nodes_event_id", "story_tree_nodes", "event_id")
