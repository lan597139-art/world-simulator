"""I1 本地账号 / 世界归属 / 产品场景。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def main_test():
    global passed, failed
    me = client.get("/api/users/me")
    check("本地用户可读取", me.status_code == 200 and me.json()["id"] == "local", me.text)

    db = SessionLocal()
    official = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    check("官方世界归属本地用户", bool(official and official.owner_id == "local"), official.owner_id if official else None)
    db.close()

    name = f"产品场景测试-{uuid.uuid4().hex[:6]}"
    created = client.post("/api/worlds", json={
        "name": name, "type": "fiction", "product_scene": "literature",
    })
    check("创建文学场景世界", created.status_code == 200 and created.json().get("product_scene") == "literature", created.text)
    wid = created.json()["id"]

    lit = client.get("/api/worlds?product_scene=literature").json()
    check("按场景筛选命中", any(w["id"] == wid for w in lit))
    game = client.get("/api/worlds?product_scene=game").json()
    check("按场景筛选排除", all(w["id"] != wid for w in game))

    bad = client.post("/api/worlds", json={"name": f"bad-{uuid.uuid4().hex[:6]}", "product_scene": "unknown"})
    check("非法场景被拒", bad.status_code == 422, bad.text)

    client.delete(f"/api/worlds/{wid}")
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
    raise SystemExit(main_test())
