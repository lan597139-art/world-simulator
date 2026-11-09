"""M008 关系类型、事件参与/影响、事件因果、人物事件认知。"""

import uuid

from sqlalchemy import text

from .util import add_column, utcnow

VERSION = "M008"

CHAR = ["character"]
ORG = ["organization"]
LOC = ["location"]
RES = ["resource"]

# (name, category, source_allowed, target_allowed, directional)
TYPES = [
    # A 人物关系
    ("亲属", "interpersonal", CHAR, CHAR, False),
    ("朋友", "interpersonal", CHAR, CHAR, False),
    ("恋人", "interpersonal", CHAR, CHAR, False),
    ("婚姻", "interpersonal", CHAR, CHAR, False),
    ("师生", "interpersonal", CHAR, CHAR, True),
    ("同事", "interpersonal", CHAR, CHAR, False),
    ("合作", "interpersonal", CHAR, CHAR, False),
    ("竞争", "interpersonal", CHAR, CHAR, False),
    ("敌对", "interpersonal", CHAR, CHAR, False),
    ("信任", "interpersonal", CHAR, CHAR, True),
    ("不信任", "interpersonal", CHAR, CHAR, True),
    ("控制", "interpersonal", CHAR, CHAR, True),
    ("服从", "interpersonal", CHAR, CHAR, True),
    ("欠债", "interpersonal", CHAR, CHAR, True),
    ("背叛", "interpersonal", CHAR, CHAR, True),
    # B 人物与组织
    ("任职", "character_organization", CHAR, ORG, True),
    ("隶属", "character_organization", CHAR, ORG, True),
    ("成员", "character_organization", CHAR, ORG, True),
    ("领导", "character_organization", CHAR, ORG, True),
    ("代表", "character_organization", CHAR, ORG, True),
    ("顾问", "character_organization", CHAR, ORG, True),
    ("投资", "character_organization", CHAR, ORG, True),
    ("受雇", "character_organization", CHAR, ORG, True),
    # C 组织之间
    ("上级组织", "organization", ORG, ORG, True),
    ("下属组织", "organization", ORG, ORG, True),
    ("联盟", "organization", ORG, ORG, False),
    ("控制", "organization", ORG, ORG, True),
    ("从属", "organization", ORG, ORG, True),
    ("依附", "organization", ORG, ORG, True),
    ("敌对", "organization", ORG, ORG, False),
    # D 人物与地点
    ("当前位于", "character_location", CHAR, LOC, True),
    ("居住于", "character_location", CHAR, LOC, True),
    ("出生于", "character_location", CHAR, LOC, True),
    ("工作于", "character_location", CHAR, LOC, True),
    ("拥有", "character_location", CHAR, LOC, True),
    ("被限制于", "character_location", CHAR, LOC, True),
    ("经常活动于", "character_location", CHAR, LOC, True),
    # E 组织与地点
    ("总部位于", "organization_location", ORG, LOC, True),
    ("分部位于", "organization_location", ORG, LOC, True),
    ("占领", "organization_location", ORG, LOC, True),
    ("租用", "organization_location", ORG, LOC, True),
    ("管辖", "organization_location", ORG, LOC, True),
    ("活动于", "organization_location", ORG, LOC, True),
    # F 资源
    ("持有", "resource", CHAR + ORG, RES, True),
    ("管理", "resource", CHAR + ORG, RES, True),
    ("使用", "resource", CHAR + ORG, RES, True),
    ("分配", "resource", ORG, RES, True),
    ("交易", "resource", CHAR + ORG, RES, True),
    ("依赖", "resource", CHAR + ORG, RES, True),
    ("欠付", "resource", CHAR + ORG, RES, True),
]


def apply(conn):
    # events 发生时间 / 状态
    add_column(conn, "events", "occurred_at", "DATETIME")
    add_column(conn, "events", "ended_at", "DATETIME")
    add_column(conn, "events", "event_status", "TEXT DEFAULT 'occurred'")
    conn.execute(
        text("UPDATE events SET occurred_at = created_at WHERE occurred_at IS NULL")
    )
    conn.execute(
        text("UPDATE events SET event_status = 'occurred' WHERE event_status IS NULL")
    )

    # event_entities 扩展
    add_column(conn, "event_entities", "category", "TEXT DEFAULT 'participant'")
    add_column(conn, "event_entities", "participant_role", "TEXT")
    add_column(conn, "event_entities", "impact_type", "TEXT")
    add_column(conn, "event_entities", "impact_level", "TEXT")
    add_column(conn, "event_entities", "is_confirmed", "BOOLEAN DEFAULT 1")
    add_column(conn, "event_entities", "description", "TEXT DEFAULT ''")

    # 旧数据：affected → impact，其余 → participant
    conn.execute(
        text(
            "UPDATE event_entities SET category = CASE WHEN role = 'affected' THEN 'impact' "
            "ELSE 'participant' END WHERE category IS NULL OR category = 'participant'"
        )
    )
    conn.execute(
        text(
            "UPDATE event_entities SET role = 'participant' WHERE role = 'affected'"
        )
    )

    # 关系类型种子
    import json

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
                "o": order * 10,
                "now": utcnow(),
            },
        )
