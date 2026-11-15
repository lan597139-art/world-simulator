"""M050 头像图片 URL。"""

from .util import add_column

VERSION = "M050"


def apply(conn):
    add_column(conn, "app_users", "avatar_url", "TEXT")
