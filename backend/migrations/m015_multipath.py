"""M015 多路径推演：分支字段与分支沙盒表索引。

四张新表由 models.Base.metadata.create_all 建出；本迁移只负责已有表加列与索引，
保证老库平滑升级。
"""

from .util import add_column, create_index

VERSION = "M015"


def apply(conn):
    add_column(conn, "events", "branch_id", "TEXT")
    add_column(conn, "simulation_runs", "branch_id", "TEXT")

    create_index(conn, "ix_events_branch_id", "events", "branch_id")
    create_index(conn, "ix_simulation_runs_branch_id", "simulation_runs", "branch_id")
    create_index(conn, "ix_simulation_directions_event_id", "simulation_directions", "event_id")
    create_index(conn, "ix_simulation_branches_world_id", "simulation_branches", "world_id")
    create_index(conn, "ix_simulation_branches_parent_branch_id", "simulation_branches", "parent_branch_id")
    create_index(conn, "ix_simulation_branch_nodes_branch_id", "simulation_branch_nodes", "branch_id")
    create_index(conn, "ix_simulation_endings_branch_id", "simulation_endings", "branch_id")
    create_index(conn, "ix_simulation_endings_node_id", "simulation_endings", "node_id")
