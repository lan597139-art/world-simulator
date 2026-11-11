"""K3 传记引用来源。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def run():
    global passed, failed
    suffix = uuid.uuid4().hex[:6]
    world = client.post("/api/worlds", json={"name": f"传记-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    char = client.post("/api/characters", json={"world_id": wid, "name": "传主"}).json()
    other = client.post("/api/characters", json={"world_id": wid, "name": "旁观者"}).json()
    e1 = client.post("/api/events", json={
        "world_id": wid, "name": "传主事件", "description": "他经历了这件事", "participants": [char["id"]],
    }).json()
    client.post("/api/events", json={
        "world_id": wid, "name": "无关事件", "participants": [other["id"]],
    })
    diary = client.post("/api/diary/entries", json={
        "world_id": wid, "character_id": char["id"], "entry_date": "2026-11-09",
        "title": "传主日记", "content": "我记下了这一天。", "source_type": "user",
    }).json()

    data = client.get(f"/api/characters/{char['id']}/biography")
    check("传记接口可读", data.status_code == 200, data.text)
    citations = data.json().get("citations") or []
    check("引用包含参与事件", any(c["kind"] == "event" and c["id"] == e1["id"] for c in citations), citations)
    check("引用排除无关事件", all(c["title"] != "无关事件" for c in citations), citations)
    check("引用包含人物日记", any(c["kind"] == "diary" and c["id"] == diary["id"] for c in citations), citations)

    saved = client.post(f"/api/characters/{char['id']}/biography", json={
        "content": "我的一生。", "title": "测试自传",
    })
    check("手动保存传记", saved.status_code == 200 and saved.json()["engine"] == "manual", saved.text)
    check("保存时固化引用", isinstance(saved.json().get("citations"), list) and len(saved.json()["citations"]) >= 2, saved.text)

    latest = client.get(f"/api/characters/{char['id']}/biography").json()["latest"]
    check("最新传记保留引用", any(c["kind"] == "event" for c in (latest.get("citations") or [])), latest)

    client.delete(f"/api/diary/entries/{diary['id']}")
    from world_lifecycle import _cascade_delete_world
    db = SessionLocal()
    row = db.query(models.World).filter(models.World.id == wid).first()
    if row:
        _cascade_delete_world(db, wid)
        db.delete(row)
        db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
