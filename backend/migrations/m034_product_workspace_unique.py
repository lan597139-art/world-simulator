"""M034 保证每个用户每种自动产品只有一个隐藏工作空间。"""

from sqlalchemy import text

from .util import create_index

VERSION = "M034"

def apply(conn):
    # SQLite 支持部分索引；只约束 is_product_workspace=1 的自动空间。
    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_worlds_product_workspace "
        "ON worlds(owner_id, product_scene) WHERE is_product_workspace = 1"
    ))
    # 兼容不支持部分索引的旧实现：普通索引仍可加速查询。
    create_index(conn, "ix_worlds_owner_product_workspace", "worlds", "owner_id, product_scene")
