"""平台治理与运行监控验收：警告、禁言、封禁、申诉、撤销、前端错误采集。"""

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
    owner = models.AppUser(username=f"gov-owner-{suffix}", display_name="治理验收", password_hash=hash_password("password-123"), is_owner=True)
    target = models.AppUser(username=f"gov-target-{suffix}", display_name="被处置用户", password_hash=hash_password("password-123"))
    db.add_all([owner, target])
    db.commit()
    db.refresh(owner)
    db.refresh(target)
    owner_name, target_name, target_id = owner.username, target.username, target.id
    post = models.SocialPost(author_id=target_id, body="治理验收动态", visibility="public")
    db.add(post)
    db.commit()
    db.refresh(post)
    post_id = post.id
    db.close()

    owner_login = client.post("/api/auth/login", json={"username": owner_name, "password": "password-123"})
    target_login = client.post("/api/auth/login", json={"username": target_name, "password": "password-123"})
    oh = {"Authorization": f"Bearer {owner_login.json()['token']}"}
    th = {"Authorization": f"Bearer {target_login.json()['token']}"}

    report = client.post("/api/reports", headers=oh, json={"target_type": "post", "target_id": post_id, "reason": "harassment", "detail": "治理验收举报"})
    report_id = report.json().get("report", {}).get("id") if report.status_code == 200 else None
    queue = client.get("/api/admin/reports", headers=oh)
    row = next((item for item in queue.json().get("items", []) if item["id"] == report_id), None)
    check("举报行包含作者", queue.status_code == 200 and row is not None and row.get("target_author", {}).get("id") == target_id, queue.text[:300])

    warning = client.post(f"/api/admin/reports/{report_id}/sanction", headers=oh, json={"action": "warning", "reason": "警告一次"})
    check("举报可直接警告", warning.status_code == 200 and warning.json().get("action") == "warning", warning.text[:300])
    check("警告会通知本人", db_notifications(target_id) >= 1)

    report2 = client.post("/api/reports", headers=oh, json={"target_type": "post", "target_id": post_id, "reason": "spam", "detail": "第二次举报"})
    report2_id = report2.json().get("report", {}).get("id")
    mute = client.post(f"/api/admin/reports/{report2_id}/sanction", headers=oh, json={"action": "mute", "reason": "禁言验收", "hours": 2})
    check("举报可直接禁言", mute.status_code == 200 and mute.json().get("action") == "mute" and mute.json().get("active") is True, mute.text[:300])
    blocked_report = client.post("/api/reports", headers=th, json={"target_type": "post", "target_id": post_id, "reason": "spam"})
    check("禁言不能提交社区举报", blocked_report.status_code == 403, blocked_report.text[:300])
    still_read = client.get("/api/worlds", headers=th)
    check("禁言仍可正常读取", still_read.status_code == 200, still_read.text[:300])

    ban = client.post(f"/api/admin/users/{target_id}/sanctions", headers=oh, json={"action": "ban", "reason": "封禁验收", "hours": 3})
    ban_id = ban.json().get("id") if ban.status_code == 200 else None
    check("可按用户封禁", ban.status_code == 200 and ban.json().get("action") == "ban", ban.text[:300])
    blocked = client.get("/api/worlds", headers=th)
    check("封禁后业务接口被拦截", blocked.status_code == 403 and "封禁" in blocked.text, blocked.text[:300])
    account = client.get("/api/account/sanctions", headers=th)
    check("封禁后仍可查看治理记录", account.status_code == 200 and len(account.json().get("active", [])) >= 2, account.text[:300])
    appeal = client.post(f"/api/account/sanctions/{ban_id}/appeal", headers=th, json={"note": "申诉验收：请复核"})
    check("封禁可提交申诉", appeal.status_code == 200 and bool(appeal.json().get("appealed_at")), appeal.text[:300])
    sanctions = client.get("/api/admin/sanctions?active=true", headers=oh)
    appealed = next((item for item in sanctions.json().get("items", []) if item["id"] == ban_id), None)
    check("后台可见申诉内容", appealed is not None and "申诉验收" in appealed.get("appeal_note", ""), sanctions.text[:300])

    revoked = client.post(f"/api/admin/sanctions/{ban_id}/revoke", headers=oh, json={"note": "复核通过，解除"})
    check("后台可撤销封禁", revoked.status_code == 200 and bool(revoked.json().get("revoked_at")), revoked.text[:300])
    restored = client.get("/api/worlds", headers=th)
    check("撤销后立即恢复访问", restored.status_code == 200, restored.text[:300])

    error = client.post("/api/client-errors", headers=th, json={"message": "Smoke render failure", "stack": "at Test", "page": "chat"})
    check("前端错误可上报", error.status_code == 200 and error.json().get("ok") is True, error.text[:300])
    monitor = client.get("/api/admin/client-errors", headers=oh)
    check("开发者可查看前端错误", monitor.status_code == 200 and any(item["message"] == "Smoke render failure" for item in monitor.json().get("items", [])), monitor.text[:300])
    forbidden = client.get("/api/admin/client-errors", headers=th)
    check("普通用户不能查看错误监控", forbidden.status_code == 403, forbidden.text[:300])
    cleared = client.delete("/api/admin/client-errors", headers=oh)
    check("错误可清空", cleared.status_code == 200 and cleared.json().get("ok") is True, cleared.text[:300])

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


def db_notifications(user_id):
    db = SessionLocal()
    try:
        return db.query(models.CommunityNotification).filter(models.CommunityNotification.user_id == user_id, models.CommunityNotification.type == "moderation").count()
    finally:
        db.close()


if __name__ == "__main__":
    main_test()
