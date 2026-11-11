"""J1 05 选择/结果/后续事件/沙盒。"""

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
    world = client.post("/api/worlds", json={"name": f"选择测试-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    a = client.post("/api/events", json={"world_id": wid, "name": "抉择", "description": "去或留"}).json()
    b = client.post("/api/events", json={"world_id": wid, "name": "后续", "description": "离开之后"}).json()

    created = client.post(f"/api/events/{a['id']}/choices", json={"title": "去留", "description": "主角必须选择"})
    check("创建选择点", created.status_code == 200 and created.json()["title"] == "去留", created.text)
    cid = created.json()["id"]

    opt = client.post(f"/api/event-choices/{cid}/options", json={
        "label": "离开", "consequence": "失去庇护", "outcome_event_id": b["id"],
    })
    check("选项绑定结果与后续事件", opt.status_code == 200 and opt.json()["outcome_event_name"] == "后续", opt.text)
    oid = opt.json()["id"]

    listing = client.get(f"/api/events/{a['id']}/choices").json()
    check("选择列表含选项", len(listing) == 1 and len(listing[0]["options"]) == 1, listing)

    other = client.post("/api/worlds", json={"name": f"选择外世界-{suffix}"}).json()
    foreign = client.post("/api/events", json={"world_id": other["id"], "name": "外部"}).json()
    bad = client.post(f"/api/event-choices/{cid}/options", json={"label": "跨世界", "outcome_event_id": foreign["id"]})
    check("跨世界后续事件被拒", bad.status_code == 409, bad.text)

    second = client.post(f"/api/event-choices/{cid}/options", json={"label": "第二分支", "consequence": "另一结果"})
    sid2 = second.json()["id"]
    moved = client.patch(f"/api/event-choice-options/{sid2}", json={"order_index": 0})
    check("结果分支可排序", moved.status_code == 200, moved.text)
    ordered = client.get(f"/api/events/{a['id']}/choices").json()[0]["options"]
    check("排序后第二分支居首", ordered[0]["id"] == sid2, ordered)

    sandbox = client.post(f"/api/event-choice-options/{oid}/sandbox", json={})
    check("选项可生成沙盒", sandbox.status_code == 200 and sandbox.json().get("branch_id"), sandbox.text)
    again = client.post(f"/api/event-choice-options/{oid}/sandbox", json={})
    check("重复生成复用沙盒", again.status_code == 200 and again.json()["existing"] is True, again.text)

    db = SessionLocal()
    original = db.query(models.Event).filter(models.Event.id == a["id"]).first()
    branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == sandbox.json()["branch_id"]).first()
    check("生成沙盒不改原事件", original.branch_id is None and branch.root_event_id == a["id"], (original.branch_id, branch.root_event_id))
    db.close()

    client.delete(f"/api/events/{a['id']}")
    check("删除事件级联选择", client.get(f"/api/events/{a['id']}/choices").status_code == 404)

    from world_lifecycle import _cascade_delete_world
    db = SessionLocal()
    for target in (wid, other["id"]):
        row = db.query(models.World).filter(models.World.id == target).first()
        if row:
            _cascade_delete_world(db, target)
            db.delete(row)
    db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
