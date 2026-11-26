"""M061 创作导航补充：世界背景 / 地图册 / 插画集 / 共创选择 / 世界社区。

- 新增世界地图册表：一个世界可有多张大小不一的地图（世界 / 区域 / 城市 / 街区等）。
- 新增世界插画集表：与世界相关的插画与概念图。
- 新增世界共创开发选择表：邀请协作与创作方向的可配置项。
- 社区讨论与群组增加所属世界列：NULL 仍为全站公共内容，非 NULL 归入该世界讨论区。
  历史数据保持 NULL，不改变既有全站社区的可见性。
"""

from sqlalchemy import text

from .util import add_column, create_index, table_exists

VERSION = "M061"


def apply(conn):
    if not table_exists(conn, "world_maps"):
        conn.execute(text("""
            CREATE TABLE world_maps (
                id VARCHAR PRIMARY KEY,
                world_id VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                description TEXT DEFAULT '',
                image_url VARCHAR DEFAULT '',
                map_scale VARCHAR DEFAULT 'world',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME,
                updated_at DATETIME
            )
        """))
    create_index(conn, "ix_world_maps_world_sort", "world_maps", "world_id, sort_order")

    if not table_exists(conn, "world_illustrations"):
        conn.execute(text("""
            CREATE TABLE world_illustrations (
                id VARCHAR PRIMARY KEY,
                world_id VARCHAR NOT NULL,
                title VARCHAR NOT NULL,
                description TEXT DEFAULT '',
                image_url VARCHAR DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME,
                updated_at DATETIME
            )
        """))
    create_index(conn, "ix_world_illustrations_world_sort", "world_illustrations", "world_id, sort_order")

    if not table_exists(conn, "world_cocreation_choices"):
        conn.execute(text("""
            CREATE TABLE world_cocreation_choices (
                id VARCHAR PRIMARY KEY,
                world_id VARCHAR NOT NULL,
                title VARCHAR NOT NULL,
                description TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME,
                updated_at DATETIME
            )
        """))
    create_index(conn, "ix_world_cocreation_choices_world_sort", "world_cocreation_choices", "world_id, sort_order")

    # 社区讨论 / 群组归属世界：历史行保持 NULL（全站公共）。
    add_column(conn, "community_topics", "world_id", "VARCHAR")
    add_column(conn, "community_groups", "world_id", "VARCHAR")
    create_index(conn, "ix_community_topics_world", "community_topics", "world_id")
    create_index(conn, "ix_community_groups_world", "community_groups", "world_id")
