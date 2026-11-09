"""M002 地理：locations 扩展列、系统默认地点类型、旧数据回填。"""

from sqlalchemy import text

from .util import add_column, column_exists, utcnow

VERSION = "M002"

SYSTEM_TYPES = [
    # (id, name, allowed_parent_type_ids, sort)
    ("lt-continent", "大陆", [], 10),
    ("lt-sea", "海域", [], 20),
    ("lt-region", "地区", ["lt-continent"], 30),
    ("lt-country", "国家", ["lt-continent", "lt-region"], 40),
    ("lt-province", "省/州", ["lt-country"], 50),
    ("lt-city", "城市", ["lt-province", "lt-country", "lt-region"], 60),
    ("lt-district", "城区", ["lt-city"], 70),
    ("lt-street", "街道", ["lt-district", "lt-city"], 80),
    ("lt-building", "建筑", ["lt-street", "lt-district", "lt-city"], 90),
    ("lt-room", "房间", ["lt-building"], 100),
]

# 仅用于旧数据回填的保守别名
GEO_TYPE_MAP = {
    "大陆": "lt-continent",
    "大陆/大洲": "lt-continent",
    "海域": "lt-sea",
    "国家": "lt-country",
    "省/州": "lt-province",
    "省": "lt-province",
    "城市": "lt-city",
    "城市/都市": "lt-city",
    "城区": "lt-district",
    "街道": "lt-street",
    "建筑": "lt-building",
    "房间": "lt-room",
}

PROVINCES = {
    "湖南", "湖北", "广东", "广西", "四川", "云南", "贵州", "浙江", "江苏", "山东",
    "山西", "河南", "河北", "陕西", "甘肃", "青海", "辽宁", "吉林", "黑龙江", "安徽",
    "福建", "江西", "海南", "台湾",
}


def _guess_type(name: str, geo_type: str) -> str:
    if name.endswith("国"):
        return "lt-country"
    if name.endswith("省") or name in PROVINCES:
        return "lt-province"
    if name.endswith("市"):
        return "lt-city"
    if name.endswith("区"):
        return "lt-district"
    if name in {"北欧", "东亚", "南亚", "欧洲", "亚洲", "非洲", "美洲"}:
        return "lt-region"
    return GEO_TYPE_MAP.get(geo_type, "lt-city")


def apply(conn):
    add_column(conn, "locations", "parent_location_id", "TEXT REFERENCES locations(id)")
    add_column(conn, "locations", "location_type_id", "TEXT REFERENCES location_types(id)")
    add_column(conn, "locations", "status", "TEXT DEFAULT 'normal'")
    add_column(conn, "locations", "coordinates", "JSON")
    add_column(conn, "locations", "environment", "JSON DEFAULT '{}'")
    add_column(conn, "locations", "population", "INTEGER")
    add_column(conn, "locations", "sort_order", "INTEGER DEFAULT 0")
    add_column(conn, "locations", "updated_at", "DATETIME")

    for type_id, name, parents, order in SYSTEM_TYPES:
        exists = conn.execute(
            text("SELECT 1 FROM location_types WHERE id=:i"), {"i": type_id}
        ).first()
        if exists:
            continue
        conn.execute(
            text(
                """INSERT INTO location_types
                   (id, world_id, name, allowed_parent_type_ids, default_child_type_ids,
                    description, sort_order, created_at)
                   VALUES (:id, NULL, :name, :parents, '[]', '', :order, :t)"""
            ),
            {
                "id": type_id,
                "name": name,
                "parents": __import__("json").dumps(parents),
                "order": order,
                "t": utcnow(),
            },
        )

    # 旧数据：按名称/geo_type 保守映射，父节点一律为空（平表 → 多个根）
    if column_exists(conn, "locations", "location_type_id"):
        rows = conn.execute(
            text("SELECT id, name, geo_type, location_type_id FROM locations")
        ).fetchall()
        for loc_id, name, geo_type, current in rows:
            if current:
                continue
            conn.execute(
                text("UPDATE locations SET location_type_id=:t, status='normal' WHERE id=:i"),
                {"t": _guess_type(name or "", geo_type or ""), "i": loc_id},
            )
