"""M009 关系类型补充：跨类别的「控制 / 拥有」等，避免同名类型误判。"""

import json
import uuid

from sqlalchemy import text

from .util import utcnow

VERSION = "M009"

CHAR = ["character"]
ORG = ["organization"]
LOC = ["location"]
RES = ["resource"]

TYPES = [
    ("控制", "character_organization", CHAR, ORG, True),
    ("控制", "organization_location", ORG, LOC, True),
    ("控制", "character_location", CHAR, LOC, True),
    ("控制", "resource", CHAR + ORG, RES, True),
    ("拥有", "organization_location", ORG, LOC, True),
    ("拥有", "resource", CHAR + ORG, RES, True),
    ("管理", "organization_location", ORG, LOC, True),
    ("使用", "organization_location", ORG, LOC, True),
    ("合作", "organization", ORG, ORG, False),
    ("竞争", "organization", ORG, ORG, False),
    ("依赖", "organization", ORG, ORG, True),
    ("位于", "character_organization", CHAR, ORG, True),
]


def apply(conn):
    for order, (name, category, source_allowed, target_allowed, directional) in enumerate(TYPES):
        exists = conn.execute(
            text(
                "SELECT 1 FROM relationship_types WHERE world_id IS NULL "
                "AND name=:n AND category=:c"
            ),
            {"n": name, "c": category},
        ).first()
        if exists:
            continue
        conn.execute(
            text(
                """INSERT INTO relationship_types
                   (id, world_id, name, category, source_allowed_types, target_allowed_types,
                    is_directional, description, sort_order, status, created_at)
                   VALUES (:id, NULL, :n, :c, :s, :t, :d, '', :o, 'active', :now)"""
            ),
            {
                "id": f"rt-{uuid.uuid4().hex[:10]}",
                "n": name,
                "c": category,
                "s": json.dumps(source_allowed),
                "t": json.dumps(target_allowed),
                "d": 1 if directional else 0,
                "o": 900 + order * 10,
                "now": utcnow(),
            },
        )
