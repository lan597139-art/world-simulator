"""K2 独立日记与来源标签。"""

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
    plain = client.post("/api/diary/entries", json={
        "entry_date": "2026-11-11", "title": "无世界日记", "content": "今天只是散步。", "source_type": "user",
    })
    check("日记可不依赖世界", plain.status_code == 200 and plain.json()["world_id"] is None, plain.text)
    pid = plain.json()["id"]

    world = client.post("/api/worlds", json={"name": f"日记世界-{suffix}", "type": "fiction"}).json()
    linked = client.post("/api/diary/entries", json={
        "world_id": world["id"], "entry_date": "2026-11-10", "title": "世界内日记",
        "content": "韩立今天入山。", "source_type": "event", "source_ref": {"event_id": "e1"},
    })
    check("日记可关联世界与来源", linked.status_code == 200 and linked.json()["source_type"] == "event", linked.text)
    lid = linked.json()["id"]

    bad_source = client.post("/api/diary/entries", json={"content": "x", "source_type": "unknown"})
    check("非法来源被拒", bad_source.status_code == 422, bad_source.text)
    bad_date = client.post("/api/diary/entries", json={"content": "x", "entry_date": "11/11/2026"})
    check("非法日期被拒", bad_date.status_code == 422, bad_date.text)

    filtered = client.get("/api/diary/entries?source_type=event").json()
    check("按来源筛选", any(item["id"] == lid for item in filtered) and all(item["source_type"] == "event" for item in filtered), filtered)

    updated = client.patch(f"/api/diary/entries/{pid}", json={"title": "改名", "tags": ["散步"]})
    check("日记可编辑", updated.status_code == 200 and updated.json()["title"] == "改名", updated.text)

    client.delete(f"/api/worlds/{world['id']}")
    db = SessionLocal()
    from world_lifecycle import _cascade_delete_world
    row = db.query(models.World).filter(models.World.id == world["id"]).first()
    if row:
        _cascade_delete_world(db, world["id"])
        db.delete(row)
        db.commit()
    kept = db.query(models.DiaryEntry).filter(models.DiaryEntry.id == lid).first()
    db.close()
    check("删除世界不删除日记", kept is not None)

    for eid in (pid, lid):
        client.delete(f"/api/diary/entries/{eid}")
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
