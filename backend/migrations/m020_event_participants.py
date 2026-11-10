"""M020 从 event_entities 回填事件参与者（仅人物，仅空值）。

不改事件语义：只把已存在的 participant/character 关联补进 events.participants，
供写作、推演、故事线统一读取；地点/组织等实体不写入角色参与者。
"""

import json

from sqlalchemy import text

VERSION = "M020"


def apply(conn):
    rows = conn.execute(
        text(
            "SELECT event_id, entity_id FROM event_entities "
            "WHERE category = 'participant' AND entity_type = 'character' "
            "ORDER BY event_id, created_at"
        )
    ).fetchall()
    grouped = {}
    for event_id, entity_id in rows:
        grouped.setdefault(event_id, [])
        if entity_id not in grouped[event_id]:
            grouped[event_id].append(entity_id)

    for event_id, ids in grouped.items():
        raw = conn.execute(text("SELECT participants FROM events WHERE id = :id"), {"id": event_id}).scalar()
        current = []
        if raw:
            try:
                current = json.loads(raw) if isinstance(raw, str) else raw
            except Exception:
                current = []
        if not isinstance(current, list):
            current = []
        if current:
            continue
        conn.execute(
            text("UPDATE events SET participants = :participants WHERE id = :id"),
            {"participants": json.dumps(ids), "id": event_id},
        )
