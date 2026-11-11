"""I2 口令锁：登录、会话、全局鉴权、世界归属。"""

import os
import uuid
from datetime import datetime, timedelta

os.environ.pop("WS_AUTH_DISABLED", None)

from fastapi.testclient import TestClient

import main
import models
from auth import _token_hash, hash_password
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
suffix = uuid.uuid4().hex[:6]


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
    status = client.get("/api/auth/status")
    check("状态接口公开", status.status_code == 200 and "setup_required" in status.json(), status.text)
    check("未登录请求被拒", client.get("/api/worlds").status_code == 401)

    os.environ["WS_SETUP_TOKEN"] = "setup-secret"
    try:
        current = client.get("/api/auth/status").json()
        if current.get("setup_required"):
            required = current.get("setup_token_required")
            wrong = client.post("/api/auth/setup", json={
                "username": "hijack", "password": "hijack-password", "setup_token": "wrong",
            })
            check("初始化令牌保护", required is True and wrong.status_code == 403, (required, wrong.text))
        else:
            repeat = client.post("/api/auth/setup", json={
                "username": "hijack", "password": "hijack-password", "setup_token": "setup-secret",
            })
            check("已初始化拒绝重复 setup", repeat.status_code == 409, repeat.text)
    finally:
        os.environ.pop("WS_SETUP_TOKEN", None)

    db = SessionLocal()
    user = models.AppUser(
        username=f"auth-{suffix}", display_name="认证测试", password_hash=hash_password("correct-password"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    uid = user.id
    db.close()

    bad = client.post("/api/auth/login", json={"username": f"auth-{suffix}", "password": "wrong"})
    check("错误密码拒绝", bad.status_code == 401, bad.text)

    login = client.post("/api/auth/login", json={"username": f"auth-{suffix}", "password": "correct-password"})
    check("正确密码登录", login.status_code == 200 and login.json().get("token"), login.text)
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/api/auth/me", headers=headers)
    check("会话可读当前用户", me.status_code == 200 and me.json()["id"] == uid, me.text)

    worlds = client.get("/api/worlds", headers=headers)
    check("带令牌访问业务接口", worlds.status_code == 200, worlds.text)

    invalid = client.get("/api/worlds", headers={"Authorization": "Bearer invalid-token"})
    check("非法令牌被拒", invalid.status_code == 401)

    created = client.post("/api/worlds", headers=headers, json={"name": f"认证世界-{suffix}"})
    check("新世界归属登录用户", created.status_code == 200 and created.json().get("id"), created.text)
    wid = created.json()["id"]
    db = SessionLocal()
    owner = db.query(models.World).filter(models.World.id == wid).first().owner_id
    check("数据库 owner 正确", owner == uid, owner)

    expired_login = client.post("/api/auth/login", json={"username": f"auth-{suffix}", "password": "correct-password"})
    expired_token = expired_login.json()["token"]
    db = SessionLocal()
    session = db.query(models.AuthSession).filter(
        models.AuthSession.token_hash == _token_hash(expired_token)
    ).first()
    session.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    db.close()
    expired = client.get("/api/worlds", headers={"Authorization": f"Bearer {expired_token}"})
    check("过期会话不生效", expired.status_code == 401)

    fresh = client.post("/api/auth/login", json={"username": f"auth-{suffix}", "password": "correct-password"})
    token = fresh.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    logout = client.post("/api/auth/logout", headers=headers)
    check("登出成功", logout.status_code == 200, logout.text)
    check("登出后令牌失效", client.get("/api/worlds", headers=headers).status_code == 401)

    from world_lifecycle import _cascade_delete_world
    db = SessionLocal()
    row = db.query(models.World).filter(models.World.id == wid).first()
    if row:
        _cascade_delete_world(db, wid)
        db.delete(row)
    db.query(models.AuthSession).filter(models.AuthSession.user_id == uid).delete()
    db.query(models.AppUser).filter(models.AppUser.id == uid).delete()
    db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
