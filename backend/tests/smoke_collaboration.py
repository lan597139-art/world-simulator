"""世界协作：邀请、接受、角色权限与移除。"""

import os
import uuid

os.environ.pop("WS_AUTH_DISABLED", None)

from fastapi.testclient import TestClient

import main
import models
from auth import hash_password
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
suffix = uuid.uuid4().hex[:6]


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


def make_user(label: str) -> tuple[str, dict, str]:
    db = SessionLocal()
    username = f"collab-{label}-{suffix}"
    user = models.AppUser(username=username, display_name=f"协作{label}", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()
    login = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if login.status_code != 200:
        raise RuntimeError(login.text)
    return user_id, {"Authorization": f"Bearer {login.json()['token']}"}, username


def main_test():
    owner_id, owner_h, owner_name = make_user("owner")
    editor_id, editor_h, editor_name = make_user("editor")
    viewer_id, viewer_h, viewer_name = make_user("viewer")

    db = SessionLocal()
    world = models.World(name=f"协作世界 {suffix}", owner_id=owner_id, product_scene="game", type="fiction", createdAt="2026-01-01T00:00:00", updatedAt="2026-01-01T00:00:00")
    db.add(world)
    db.commit()
    db.refresh(world)
    world_id = world.id
    db.close()

    check("创建者可见世界", client.get(f"/api/worlds/{world_id}", headers=owner_h).status_code == 200)
    check("未邀请者不可见", client.get(f"/api/worlds/{world_id}", headers=editor_h).status_code == 404)

    r = client.post(f"/api/worlds/{world_id}/collaborators", headers=editor_h, json={"username": editor_name, "role": "editor"})
    check("非创建者看不到世界", r.status_code == 404, r.text[:200])

    r = client.post(f"/api/worlds/{world_id}/collaborators", headers=owner_h, json={"username": editor_name, "role": "editor"})
    invite_id = r.json().get("item", {}).get("id") if r.status_code == 200 else None
    check("创建者可以邀请编辑者", r.status_code == 200 and bool(invite_id), r.text[:300])
    check("重复邀请会刷新待处理记录", client.post(f"/api/worlds/{world_id}/collaborators", headers=owner_h, json={"username": editor_name, "role": "editor"}).status_code == 200)

    invites = client.get("/api/collaboration/invites", headers=editor_h)
    check("被邀请者看到待处理邀请", invites.status_code == 200 and any(item["id"] == invite_id for item in invites.json().get("items", [])), invites.text[:300])
    feed = client.get("/api/notifications", headers=editor_h)
    check("邀请进入通知中心", feed.status_code == 200 and any(item["type"] == "world_collaboration" for item in feed.json().get("items", [])), feed.text[:300])

    r = client.post(f"/api/world-collaborators/{invite_id}/respond", headers=editor_h, json={"action": "accept"})
    check("被邀请者可以接受", r.status_code == 200 and r.json().get("item", {}).get("status") == "accepted", r.text[:300])
    check("接受后世界可见", client.get(f"/api/worlds/{world_id}", headers=editor_h).status_code == 200)
    check("接受后世界进入列表", any(w["id"] == world_id for w in client.get("/api/worlds", headers=editor_h).json()))
    check("编辑者不能改世界本体", client.patch(f"/api/worlds/{world_id}", headers=editor_h, json={"name": "被改成别的"}).status_code == 403)
    check("编辑者可以改内容", client.post("/api/characters", headers=editor_h, json={"world_id": world_id, "name": "编辑者角色"}).status_code in {200, 201})

    r = client.post(f"/api/worlds/{world_id}/collaborators", headers=owner_h, json={"username": viewer_name, "role": "viewer"})
    viewer_invite = r.json().get("item", {}).get("id") if r.status_code == 200 else None
    client.post(f"/api/world-collaborators/{viewer_invite}/respond", headers=viewer_h, json={"action": "accept"})
    check("只读成员可读世界", client.get(f"/api/worlds/{world_id}", headers=viewer_h).status_code == 200)
    check("只读成员不能写内容", client.post("/api/characters", headers=viewer_h, json={"world_id": world_id, "name": "只读角色"}).status_code == 403)

    r = client.patch(f"/api/world-collaborators/{invite_id}", headers=owner_h, json={"role": "viewer"})
    check("创建者可以调整角色", r.status_code == 200 and r.json().get("item", {}).get("role") == "viewer", r.text[:300])

    r = client.delete(f"/api/world-collaborators/{invite_id}", headers=owner_h)
    check("创建者可以移除成员", r.status_code == 200)
    check("移除后立即失去访问", client.get(f"/api/worlds/{world_id}", headers=editor_h).status_code == 404)

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
