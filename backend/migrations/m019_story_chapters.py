"""M019 章节与故事线关联表。"""

from .util import create_index

VERSION = "M019"


def apply(conn):
    create_index(conn, "ix_story_chapter_links_world_id", "story_chapter_links", "world_id")
    create_index(conn, "ix_story_chapter_links_story_id", "story_chapter_links", "story_id")
    create_index(conn, "ix_story_chapter_links_space_id", "story_chapter_links", "space_id")
