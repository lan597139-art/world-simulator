"""M022 05 事件选择/结果/后续事件。"""

from .util import create_index

VERSION = "M022"


def apply(conn):
    create_index(conn, "ix_event_choices_world_id", "event_choices", "world_id")
    create_index(conn, "ix_event_choices_event_id", "event_choices", "event_id")
    create_index(conn, "ix_event_choice_options_world_id", "event_choice_options", "world_id")
    create_index(conn, "ix_event_choice_options_choice_id", "event_choice_options", "choice_id")
