"""M032 05 事件分支沙盒方案。"""

from .util import create_index

VERSION = "M032"


def apply(conn):
    create_index(conn, "ix_event_sandbox_scenarios_event_id", "event_sandbox_scenarios", "event_id")
    create_index(conn, "ix_event_sandbox_scenarios_world_id", "event_sandbox_scenarios", "world_id")
