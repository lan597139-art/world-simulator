"""M012 人物运行态：把稳定种子与随时间变化的当前状态分开。"""

from .util import add_column

VERSION = "M012"


def apply(conn):
    add_column(conn, "characters", "runtime_state", "TEXT DEFAULT '{}'")
