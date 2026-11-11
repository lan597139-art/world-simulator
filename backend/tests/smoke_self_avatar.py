"""K1 自我人物 / 伴侣用户身份。"""

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
    world = client.post("/api/worlds", json={"name": f"伴侣-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    me = client.post("/api/characters", json={
        "world_id": wid, "name": "我的化身", "persona_type": "self",
        "basic_profile": {"name": "我的化身", "identity": "散修", "background": "来自现代"},
    })
    check("创建自我人物", me.status_code == 200 and me.json()["persona_type"] == "self", me.text)
    me_id = me.json()["id"]
    check("自我人物归属本地用户", me.json().get("owner_user_id") == "local", me.text)

    dup = client.post("/api/characters", json={"world_id": wid, "name": "第二个我", "persona_type": "self"})
    check("同世界自我人物唯一", dup.status_code == 409, dup.text)

    other = client.post("/api/characters", json={"world_id": wid, "name": "AI 角色"})
    check("普通角色默认 npc", other.json().get("persona_type") == "npc", other.text)

    thread = client.post("/api/chat/threads", json={
        "world_id": wid, "kind": "private", "character_id": other.json()["id"],
    }).json()
    bad = client.patch(f"/api/chat/threads/{thread['id']}", json={"settings": {"user_character_id": "missing"}})
    check("无效自我人物被拒", bad.status_code == 409, bad.text)

    patched = client.patch(f"/api/chat/threads/{thread['id']}", json={"settings": {"user_character_id": me_id}})
    check("会话绑定自我人物", patched.status_code == 200, patched.text)

    from chat import _user_identity_line
    db = SessionLocal()
    row = db.query(models.ChatThread).filter(models.ChatThread.id == thread["id"]).first()
    line = _user_identity_line(row, db)
    db.close()
    check("提示词读取自我人物身份", "我的化身" in line and "散修" in line, line)

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
