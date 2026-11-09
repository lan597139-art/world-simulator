"""M006 资源：系统默认资源类型。"""

import uuid

from sqlalchemy import text

from .util import utcnow

VERSION = "M006"

DEFAULTS = [
    ("natural", "自然资源", "水、矿产、土地等"),
    ("material", "物质资源", "设备、物资、产能等"),
    ("financial", "资金资源", "现金、信贷、预算等"),
    ("human", "人力资源", "人力、组织能力等"),
    ("information", "信息资源", "情报、数据、话语权等"),
    ("power", "权力资源", "权限、影响力、武力等"),
]


def apply(conn):
    for order, (category, name, desc) in enumerate(DEFAULTS):
        exists = conn.execute(
            text("SELECT 1 FROM resource_types WHERE world_id IS NULL AND category=:c"),
            {"c": category},
        ).first()
        if exists:
            continue
        conn.execute(
            text(
                """INSERT INTO resource_types
                   (id, world_id, name, category, unit, description, created_at)
                   VALUES (:id, NULL, :name, :c, '', :d, :t)"""
            ),
            {
                "id": f"rt-{category}-{uuid.uuid4().hex[:6]}",
                "name": name,
                "c": category,
                "d": desc,
                "t": utcnow(),
            },
        )
