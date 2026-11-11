"""M030 六轴压强/负熵具象对象。"""

from .util import create_index

VERSION = "M030"


def apply(conn):
    create_index(conn, "ix_axis_objects_world_axis", "axis_objects", "world_id, axis")
    create_index(conn, "ix_axis_objects_event_id", "axis_objects", "event_id")
    create_index(conn, "ix_axis_objects_branch_id", "axis_objects", "branch_id")
