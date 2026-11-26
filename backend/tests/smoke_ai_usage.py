"""主线四验收：现金商业体系已移除，AI 用量日志能力保留。

平台统一以灵果作为资源消耗单位，取消人民币充值、现金消费、提现及结算。
AI 调用不消耗灵果，也不建立 AI 专属资源账户，因此这里只验证：
1. 旧现金业务路由已不存在（404，而非仅前端隐藏入口）；
2. AI 用量日志仍按路由、来源与状态码记录，且不记录非 AI 路由。
"""

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
user_ids = []


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


def create_user():
    db = SessionLocal()
    username = f"aiusage-{suffix}"
    user = models.AppUser(username=username, display_name="AI 用量测试用户", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    user_ids.append(user.id)
    response = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if response.status_code != 200:
        raise RuntimeError(response.text)
    return {"Authorization": f"Bearer {response.json()['token']}"}


def main_test():
    headers = create_user()

    # 1. 现金商业路由已彻底移除（服务端不存在，而非仅前端隐藏）
    cash_routes = [
        ("get", "/api/billing/overview"),
        ("get", "/api/billing/orders"),
        ("post", "/api/billing/orders"),
        ("post", "/api/billing/orders/any/pay"),
        ("post", "/api/billing/orders/any/cancel"),
        ("patch", "/api/billing/membership"),
        ("get", "/api/billing/records"),
        ("get", "/api/billing/settlements"),
        ("post", "/api/billing/settlements/run"),
    ]
    for method, path in cash_routes:
        response = client.request(method, path, headers=headers, json={} if method in ("post", "patch") else None)
        check(f"现金路由已移除 {method.upper()} {path}", response.status_code == 404, response.status_code)

    # 2. AI 用量日志：AI 路由被记录
    response = client.post(
        "/api/assistant/chat",
        headers={**headers, "X-AI-API-Key": "sk-test", "X-AI-Model": "test-model"},
        json={"message": "hi"},
    )
    check("AI 路由可被调用（不依赖真实 Key）", response.status_code in {200, 400, 401, 402, 422, 500, 502, 503}, response.status_code)

    db = SessionLocal()
    rows = db.query(models.BillingAiUsage).filter(models.BillingAiUsage.user_id == user_ids[0]).all()
    check("AI 调用写入用量记录", len(rows) >= 1, len(rows))
    if rows:
        row = rows[0]
        check("用量记录来源为个人 Key", row.provider == "personal", row.provider)
        check("用量记录保留模型名", row.model == "test-model", row.model)
    db.close()

    # 3. 非 AI 路由不写用量
    db = SessionLocal()
    db.query(models.BillingAiUsage).filter(models.BillingAiUsage.user_id == user_ids[0]).delete(synchronize_session=False)
    db.commit()
    db.close()
    client.get("/api/spirit/summary", headers=headers)
    db = SessionLocal()
    count = db.query(models.BillingAiUsage).filter(models.BillingAiUsage.user_id == user_ids[0]).count()
    check("非 AI 路由不写用量", count == 0, count)
    db.close()

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


def cleanup():
    db = SessionLocal()
    try:
        for uid in user_ids:
            db.query(models.BillingAiUsage).filter(models.BillingAiUsage.user_id == uid).delete(synchronize_session=False)
            db.query(models.UserSettings).filter(models.UserSettings.user_id == uid).delete(synchronize_session=False)
            db.query(models.AuthSession).filter(models.AuthSession.user_id == uid).delete(synchronize_session=False)
            db.query(models.AppUser).filter(models.AppUser.id == uid).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main_test())
    finally:
        cleanup()
