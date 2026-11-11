"""J2 人物故事线 / 事件多线引用 / DAG 关系。"""

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
    world = client.post("/api/worlds", json={"name": f"人物线-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    a = client.post("/api/characters", json={"world_id": wid, "name": "主角"}).json()
    b = client.post("/api/characters", json={"world_id": wid, "name": "配角"}).json()
    e1 = client.post("/api/events", json={"world_id": wid, "name": "共同事件"}).json()
    e2 = client.post("/api/events", json={"world_id": wid, "name": "配角事件"}).json()
    story = client.post("/api/stories", json={"world_id": wid, "title": "测试故事"}).json()
    sid = story["id"]

    main_line = client.post(f"/api/stories/{sid}/threads", json={
        "title": "主角主线", "kind": "main", "character_id": a["id"],
    })
    check("创建主角主线", main_line.status_code == 200 and main_line.json()["character_name"] == "主角", main_line.text)
    mid = main_line.json()["id"]

    side = client.post(f"/api/stories/{sid}/threads", json={
        "title": "配角独立主线", "kind": "main", "character_id": b["id"],
    })
    check("配角可建独立主线", side.status_code == 200 and side.json()["kind"] == "main", side.text)
    bid = side.json()["id"]

    check("事件挂主角线", client.post(f"/api/story-threads/{mid}/events", json={"event_id": e1["id"]}).status_code == 200)
    check("同一事件挂配角线", client.post(f"/api/story-threads/{bid}/events", json={"event_id": e1["id"]}).status_code == 200)
    check("同线重复挂接被拒", client.post(f"/api/story-threads/{mid}/events", json={"event_id": e1["id"]}).status_code == 409)

    listing = client.get(f"/api/stories/{sid}/threads").json()
    check("两条线都引用同一事件", all(len(t["events"]) == 1 for t in listing), listing)

    edge = client.post(f"/api/stories/{sid}/thread-edges", json={
        "from_thread_id": mid, "to_thread_id": bid, "edge_type": "impact",
    })
    check("DAG 影响边可建", edge.status_code == 200 and edge.json()["edge_type"] == "impact", edge.text)

    client.delete(f"/api/story-threads/{bid}")
    db = SessionLocal()
    event_alive = db.query(models.Event).filter(models.Event.id == e1["id"]).first() is not None
    db.close()
    check("删除人物线不删事件", event_alive)

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
