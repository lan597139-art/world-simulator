"""全局通知、搜索、举报审核与世界导出的最小验收。"""

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


def main_test():
    db = SessionLocal()
    user = models.AppUser(
        username=f"platform-{suffix}",
        display_name=f"平台验收 {suffix}",
        password_hash=hash_password("password-123"),
        is_owner=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    world = models.World(name=f"搜索世界 {suffix}", owner_id=user.id, product_scene="game")
    db.add(world)
    db.commit()
    db.refresh(world)
    world_id = world.id
    post = models.SocialPost(author_id=user.id, body="待举报动态", visibility="public")
    db.add(post)
    db.commit()
    db.refresh(post)
    post_id = post.id
    username = user.username
    db.close()

    login = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    check("登录成功", login.status_code == 200, login.text[:300])
    headers = {"Authorization": f"Bearer {login.json()['token']}"}

    search = client.get(f"/api/search?q=搜索世界 {suffix}", headers=headers)
    groups = search.json().get("groups", []) if search.status_code == 200 else []
    check("全局搜索可找到世界", search.status_code == 200 and any(group["key"] == "worlds" for group in groups), search.text[:300])

    notifications = client.get("/api/notifications", headers=headers)
    check("通知中心可读取", notifications.status_code == 200 and "counts" in notifications.json(), notifications.text[:300])
    read_all = client.post("/api/notifications/read-all", headers=headers, json={})
    check("通知可全部已读", read_all.status_code == 200 and read_all.json().get("ok") is True, read_all.text[:300])

    report = client.post("/api/reports", headers=headers, json={
        "target_type": "post", "target_id": post_id, "reason": "spam", "detail": "验收举报",
    })
    report_id = report.json().get("report", {}).get("id") if report.status_code == 200 else None
    check("举报可提交", report.status_code == 200 and bool(report_id), report.text[:300])
    queue = client.get("/api/admin/reports", headers=headers)
    check("审核队列可见", queue.status_code == 200 and any(row["id"] == report_id for row in queue.json().get("items", [])), queue.text[:300])
    resolved = client.patch(f"/api/admin/reports/{report_id}", headers=headers, json={"status": "resolved", "note": "已处理"})
    check("举报可处理", resolved.status_code == 200 and resolved.json().get("status") == "resolved", resolved.text[:300])

    export = client.get(f"/api/worlds/{world_id}/export", headers=headers)
    body = export.json() if export.status_code == 200 else {}
    check("世界可导出", export.status_code == 200 and body.get("format") == "world-simulator/world" and body.get("world", {}).get("id") == world_id, export.text[:300])

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
