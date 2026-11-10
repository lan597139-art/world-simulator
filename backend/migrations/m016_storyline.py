"""M016 故事线：8 张新表由 create_all 建出，本迁移只补索引。

不改动既有表；故事线结构不进入世界快照，由 world_lifecycle 显式清理。
"""

from .util import create_index

VERSION = "M016"


def apply(conn):
    create_index(conn, "ix_story_projects_world_id", "story_projects", "world_id")
    create_index(conn, "ix_story_spaces_story_id", "story_spaces", "story_id")
    create_index(conn, "ix_story_spaces_world_id", "story_spaces", "world_id")
    create_index(conn, "ix_story_spaces_parent_space_id", "story_spaces", "parent_space_id")
    create_index(conn, "ix_story_units_story_id", "story_units", "story_id")
    create_index(conn, "ix_story_units_space_id", "story_units", "space_id")
    create_index(conn, "ix_story_unit_events_unit_id", "story_unit_events", "unit_id")
    create_index(conn, "ix_story_unit_events_event_id", "story_unit_events", "event_id")
    create_index(conn, "ix_story_choices_space_id", "story_choices", "space_id")
    create_index(conn, "ix_story_choice_options_choice_id", "story_choice_options", "choice_id")
    create_index(conn, "ix_story_endings_space_id", "story_endings", "space_id")
    create_index(conn, "ix_story_rejoins_story_id", "story_rejoins", "story_id")
