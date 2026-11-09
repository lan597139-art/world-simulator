"""M006 资源：系统默认资源类型。"""

from sqlalchemy import text

from .util import utcnow

VERSION = "M006"

DEFAULTS = [
    ("natural", "自然资源", "水、矿产、土地等", "rt-natural-0b2bb3"),
    ("material", "物质资源", "设备、物资、产能等", "rt-material-d4c8ff"),
    ("financial", "资金资源", "现金、信贷、预算等", "rt-financial-bbf325"),
    ("human", "人力资源", "人力、组织能力等", "rt-human-4396c8"),
    ("information", "信息资源", "情报、数据、话语权等", "rt-information-454ec4"),
    ("power", "权力资源", "权限、影响力、武力等", "rt-power-547a20"),
]


def apply(conn):
    for order, (category, name, desc, fixed_id) in enumerate(DEFAULTS):
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
                "id": fixed_id,
                "name": name,
                "c": category,
                "d": desc,
                "t": utcnow(),
            },
        )
