"""M013 07 推演预设：记录作者预设的推演方向与视角。"""

from .util import add_column

VERSION = "M013"


def apply(conn):
    add_column(conn, "simulation_runs", "direction", "TEXT DEFAULT ''")
    add_column(conn, "simulation_runs", "perspective", "TEXT DEFAULT ''")
    add_column(conn, "simulation_runs", "world_id", "TEXT DEFAULT ''")
