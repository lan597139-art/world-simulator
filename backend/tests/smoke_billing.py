"""商业与服务中心：会员、余额、订单、AI 用量、结算与记录验收。"""

import os
import uuid

os.environ.pop("WS_AUTH_DISABLED", None)
os.environ["WS_BILLING_SANDBOX"] = "1"

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
    username = f"billing-{suffix}"
    user = models.AppUser(username=username, display_name="结算测试用户", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    user_ids.append(user.id)
    response = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if response.status_code != 200:
        raise RuntimeError(response.text)
    return user, {"Authorization": f"Bearer {response.json()['token']}"}


def main_test():
    user, headers = create_user()

    r = client.get("/api/billing/overview", headers=headers)
    body = r.json() if r.status_code == 200 else {}
    check("商业中心可读取", r.status_code == 200 and body.get("membership", {}).get("plan") == "free", r.text[:300])
    check("会员方案与充值套餐完整", len(body.get("plans", [])) == 3 and len(body.get("recharge_packages", [])) == 4, body)
    check("默认余额为零", body.get("account", {}).get("balance_cents") == 0, body)
    check("本地沙盒模式可见", body.get("mode", {}).get("sandbox") is True, body.get("mode"))

    r = client.get("/api/billing/overview")
    check("未登录不能读取商业中心", r.status_code == 401, r.text[:200])

    r = client.patch("/api/billing/usage", headers=headers, json={"monthly_call_limit": 25})
    check("AI 用量提醒阈值可保存", r.status_code == 200 and r.json().get("monthly_call_limit") == 25, r.text[:300])
    r = client.patch("/api/billing/usage", headers=headers, json={"monthly_call_limit": 100001})
    check("非法用量阈值被拒绝", r.status_code == 422, r.text[:200])

    r = client.post("/api/billing/orders", headers=headers, json={"kind": "recharge", "sku": "recharge_10"})
    recharge = r.json().get("order", {}) if r.status_code == 200 else {}
    check("可创建充值订单", r.status_code == 200 and recharge.get("status") == "pending" and recharge.get("amount_cents") == 1000, r.text[:300])
    r = client.post(f"/api/billing/orders/{recharge.get('id')}/pay", headers=headers, json={})
    check("沙盒充值需要确认", r.status_code == 400, r.text[:200])
    r = client.post(f"/api/billing/orders/{recharge.get('id')}/pay", headers=headers, json={"confirm_sandbox": True})
    check("沙盒充值可入账", r.status_code == 200 and r.json()["account"]["balance_cents"] == 1000, r.text[:300])

    r = client.post("/api/billing/orders", headers=headers, json={"kind": "membership", "sku": "creator", "cycle": "monthly"})
    membership_order = r.json().get("order", {}) if r.status_code == 200 else {}
    check("可创建会员订单", r.status_code == 200 and membership_order.get("amount_cents") == 2900, r.text[:300])
    r = client.post(f"/api/billing/orders/{membership_order.get('id')}/pay", headers=headers, json={})
    check("余额不足不能开通会员", r.status_code == 402, r.text[:200])

    r = client.post("/api/billing/orders", headers=headers, json={"kind": "recharge", "sku": "recharge_30"})
    second = r.json().get("order", {})
    client.post(f"/api/billing/orders/{second.get('id')}/pay", headers=headers, json={"confirm_sandbox": True})
    r = client.post(f"/api/billing/orders/{membership_order.get('id')}/pay", headers=headers, json={})
    data = r.json() if r.status_code == 200 else {}
    check("余额可支付会员订单", r.status_code == 200 and data.get("membership", {}).get("plan") == "creator", r.text[:300])
    check("会员支付后余额正确", data.get("account", {}).get("balance_cents") == 1100, data)
    check("会员额度随等级更新", data.get("membership", {}).get("included_calls") == 500, data.get("membership"))

    r = client.patch("/api/billing/membership", headers=headers, json={"auto_renew": True})
    check("续费提醒偏好可保存", r.status_code == 200 and r.json().get("auto_renew") is True, r.text[:300])

    r = client.post("/api/billing/orders", headers=headers, json={"kind": "membership", "sku": "creator", "cycle": "monthly"})
    pending = r.json().get("order", {})
    r = client.post(f"/api/billing/orders/{pending.get('id')}/pay", headers=headers, json={})
    check("余额不足的第二笔会员单被拒绝", r.status_code == 402, r.text[:200])
    r = client.post(f"/api/billing/orders/{pending.get('id')}/cancel", headers=headers)
    check("待支付订单可取消", r.status_code == 200 and r.json().get("status") == "cancelled", r.text[:300])
    r = client.post(f"/api/billing/orders/{pending.get('id')}/pay", headers=headers, json={})
    check("已取消订单不能支付", r.status_code == 409, r.text[:200])

    r = client.get("/api/billing/orders?status=paid", headers=headers)
    check("订单可按状态筛选", r.status_code == 200 and len(r.json()) >= 2, r.text[:300])
    r = client.get("/api/billing/records", headers=headers)
    records = r.json() if r.status_code == 200 else {}
    types = {row["entry_type"] for row in records.get("ledger", [])}
    check("流水包含充值与会员", {"topup", "membership"}.issubset(types), types)
    check("服务周期包含会员", any(row.get("service_type") == "membership" for row in records.get("services", [])), records.get("services"))

    # 直接写入一条创作收入，验证结算结构；不伪造支付。
    db = SessionLocal()
    db.add(models.BillingLedgerEntry(
        user_id=user.id, entry_type="creator_earning", amount_cents=12000,
        balance_after_cents=0, description="测试创作收入",
    ))
    db.commit()
    db.close()
    r = client.get("/api/billing/settlements", headers=headers)
    summary = r.json() if r.status_code == 200 else {}
    check("可结算收入正确汇总", summary.get("available_cents") == 12000, summary)
    r = client.post("/api/billing/settlements/run", headers=headers)
    data = r.json() if r.status_code == 200 else {}
    check("可生成结算单", r.status_code == 200 and data.get("settlement", {}).get("net_cents") == 10800, r.text[:300])
    r = client.get("/api/billing/settlements", headers=headers)
    summary = r.json() if r.status_code == 200 else {}
    check("结算后不再重复计算可结算收入", summary.get("available_cents") == 0 and summary.get("pending_cents") == 10800, summary)
    r = client.post("/api/billing/settlements/run", headers=headers)
    check("待处理结算单防重复", r.status_code == 409, r.text[:200])

    # 用量记录接口
    db = SessionLocal()
    db.add(models.BillingAiUsage(user_id=user.id, route="/api/simulate", provider="platform", units=2, status_code=200))
    db.add(models.BillingAiUsage(user_id=user.id, route="/api/assistant/chat", provider="personal", units=1, status_code=200))
    db.commit()
    db.close()
    r = client.get("/api/billing/usage?days=7", headers=headers)
    usage = r.json() if r.status_code == 200 else {}
    check("AI 用量按来源汇总", usage.get("platform_calls") == 2 and usage.get("personal_calls") == 1, usage)
    check("AI 用量趋势包含日期", len(usage.get("daily", [])) == 7, len(usage.get("daily", [])))

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


def cleanup():
    db = SessionLocal()
    try:
        for uid in user_ids:
            db.query(models.BillingAiUsage).filter(models.BillingAiUsage.user_id == uid).delete(synchronize_session=False)
            db.query(models.BillingSettlement).filter(models.BillingSettlement.creator_id == uid).delete(synchronize_session=False)
            db.query(models.BillingLedgerEntry).filter(models.BillingLedgerEntry.user_id == uid).delete(synchronize_session=False)
            db.query(models.BillingOrder).filter(models.BillingOrder.user_id == uid).delete(synchronize_session=False)
            db.query(models.BillingMembership).filter(models.BillingMembership.user_id == uid).delete(synchronize_session=False)
            db.query(models.BillingAccount).filter(models.BillingAccount.user_id == uid).delete(synchronize_session=False)
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
