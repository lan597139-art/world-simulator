"""M023 故事线人物线与 DAG 关系。"""

from .util import create_index

VERSION = "M023"


def apply(conn):
    for name, table, column in [
        ("ix_story_threads_world_id", "story_threads", "world_id"),
        ("ix_story_threads_story_id", "story_threads", "story_id"),
        ("ix_story_threads_character_id", "story_threads", "character_id"),
        ("ix_story_thread_events_thread_id", "story_thread_events", "thread_id"),
        ("ix_story_thread_events_event_id", "story_thread_events", "event_id"),
        ("ix_story_thread_edges_story_id", "story_thread_edges", "story_id"),
    ]:
        create_index(conn, name, table, column)
