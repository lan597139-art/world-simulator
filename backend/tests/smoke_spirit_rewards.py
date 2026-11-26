"""D2/D5/D7 首版：奖励领取、创建消耗、幂等与后台配置。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
import spirit_economy
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
    suffix = uuid.uuid4().hex[:6]
    setup = client.post("/api/auth/setup", json={
        "username": "owner", "display_name": "站长", "password": "test12345678",
    })
    check("初始化站长账号", setup.status_code in {200, 409}, setup.text)
    owner = client.get("/api/auth/me").json()
    owner_id = owner["id"]
    db = SessionLocal()
    owner_row = db.query(models.AppUser).filter(models.AppUser.id == owner_id).first()
    owner_row.bio = "有简介"
    owner_row.avatar = "🌱"
    db.commit()
    db.close()

    # 清理上一轮遗留的领取记录，并恢复全局默认值，保证测试可重复运行、
    # 不污染其他用例（注册奖励 500、世界灵植 100、OC 灵植 30）。
    db = SessionLocal()
    db.query(models.SpiritRewardClaim).filter(models.SpiritRewardClaim.user_id == owner_id).delete(synchronize_session=False)
    world_row = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == "world_seed").first()
    if world_row:
        world_row.price_fruit = 100
    oc_row = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == "oc_seed").first()
    if oc_row:
        oc_row.price_fruit = 30
    reg_rule = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == "registration_bonus").first()
    if reg_rule:
        reg_rule.fruit_amount = 500
    db.commit()
    db.close()

    listed = client.get("/api/spirit/rewards")
    check("奖励列表", listed.status_code == 200, listed.text)
    keys = {row["key"] for row in listed.json()["items"]}
    check("默认规则种子", {"daily_checkin", "profile_complete", "first_work", "first_world"} <= keys, str(keys))

    before = client.get("/api/spirit/summary").json()["account"]["fruit_balance"]
    claim = client.post("/api/spirit/rewards/profile_complete/claim", json={})
    check("资料奖励领取", claim.status_code == 200, claim.text)
    after = claim.json()["account"]["fruit_balance"]
    check("奖励入账", after == before + 30, f"{before}->{after}")
    duplicate = client.post("/api/spirit/rewards/profile_complete/claim", json={})
    check("重复领取拒绝", duplicate.status_code == 409, duplicate.text)

    daily = client.post("/api/spirit/rewards/daily_checkin/claim", json={})
    check("每日签到", daily.status_code == 200, daily.text)

    created = client.post("/api/spirit/admin/rewards", json={
        "key": f"event_{suffix}", "name": "测试活动", "category": "event",
        "fruit_amount": 15, "claim_mode": "event", "condition": {"type": "manual"},
        "total_limit": 2, "daily_limit": 2, "enabled": True,
    })
    check("后台新建规则", created.status_code == 200, created.text)
    rule_id = created.json()["id"]
    event_claim = client.post(f"/api/spirit/rewards/event_{suffix}/claim", json={"claim_key": "round-1"})
    check("活动奖励领取", event_claim.status_code == 200, event_claim.text)
    event_dup = client.post(f"/api/spirit/rewards/event_{suffix}/claim", json={"claim_key": "round-1"})
    check("活动重复领取拒绝", event_dup.status_code == 409, event_dup.text)
    patched = client.patch(f"/api/spirit/admin/rewards/{rule_id}", json={"enabled": False})
    check("后台停用规则", patched.status_code == 200 and not patched.json()["enabled"], patched.text)

    overview = client.get("/api/spirit/admin/overview")
    check("后台总览", overview.status_code == 200 and overview.json()["rules"], overview.text)
    plant = overview.json()["plants"][0]
    price = client.patch(f"/api/spirit/admin/plants/{plant['id']}", json={"price_fruit": 75})
    check("后台调价", price.status_code == 200 and price.json()["price_fruit"] == 75, price.text)
    # 调价仅为验证能力，立即恢复默认价，避免污染其他用例。
    client.patch(f"/api/spirit/admin/plants/{plant['id']}", json={"price_fruit": 100})
    new_plant = client.post("/api/spirit/admin/plants", json={
        "key": f"event_plant_{suffix}", "name": "活动灵植", "category": "world",
        "price_fruit": 40, "description": "D4 测试",
    })
    check("后台新增灵植类型", new_plant.status_code == 200 and new_plant.json()["price_fruit"] == 40, new_plant.text)
    tx = client.get("/api/spirit/admin/transactions?limit=10")
    check("后台流水", tx.status_code == 200 and tx.json()["items"], tx.text)

    invites = client.post("/api/auth/invites", json={
        "label": "D3 特殊批次", "kind": "special", "batch": "d3-smoke",
        "reward_fruit": 25, "inviter_reward_fruit": 10, "max_uses": 2, "expires_days": 7,
    })
    check("邀请码分层创建", invites.status_code == 200 and invites.json()["invite"]["kind"] == "special", invites.text)
    invite_code = invites.json()["code"]
    invite_id = invites.json()["invite"]["id"]
    owner_before = client.get("/api/spirit/summary").json()["account"]["fruit_balance"]
    registered = client.post("/api/auth/register", json={
        "username": f"invited_{suffix}", "display_name": "被邀请用户",
        "email": f"invited_{suffix}@example.com",
        "password": "test12345678", "invite_code": invite_code,
    })
    check("邀请码注册", registered.status_code == 200, registered.text)
    invited_id = registered.json()["user"]["id"]
    db = SessionLocal()
    invited_account = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == invited_id).first()
    invited_balance = invited_account.fruit_balance if invited_account else None
    db.close()
    check("被邀请人奖励入账", invited_balance == 525, str(invited_balance))
    owner_after = client.get("/api/spirit/summary").json()["account"]["fruit_balance"]
    check("邀请人奖励入账", owner_after == owner_before + 10, f"{owner_before}->{owner_after}")

    batches = client.get("/api/auth/invites?batch=d3-smoke")
    check("邀请码批次筛选", batches.status_code == 200 and any(row["id"] == invite_id for row in batches.json()["items"]), batches.text)

    owner_rules = client.get("/api/spirit/admin/overview").json()["rules"]
    registration_rule = next(row for row in owner_rules if row["key"] == "registration_bonus")
    changed = client.patch(f"/api/spirit/admin/rewards/{registration_rule['id']}", json={"fruit_amount": 200})
    check("注册奖励配置", changed.status_code == 200 and changed.json()["fruit_amount"] == 200, changed.text)
    invite2 = client.post("/api/auth/invites", json={"label": "零奖励", "kind": "normal", "batch": "d3-smoke", "max_uses": 1})
    registered2 = client.post("/api/auth/register", json={
        "username": f"invited2_{suffix}", "display_name": "第二被邀请",
        "email": f"invited2_{suffix}@example.com",
        "password": "test12345678", "invite_code": invite2.json()["code"],
    })
    check("第二邀请注册", registered2.status_code == 200, registered2.text)
    db = SessionLocal()
    invited2_id = registered2.json()["user"]["id"]
    invited2_account = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == invited2_id).first()
    invited2_balance = invited2_account.fruit_balance if invited2_account else None
    db.close()
    check("注册奖励读取后台配置", invited2_balance == 200, str(invited2_balance))

    # 测试临时改动了全局注册奖励，恢复为迁移默认值，避免影响其他用例。
    client.patch(f"/api/spirit/admin/rewards/{registration_rule['id']}", json={"fruit_amount": 500})

    db = SessionLocal()
    invite_row = db.query(models.InviteCode).filter(models.InviteCode.id == invite_id).first()
    before_dup = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == "local").first().fruit_balance
    again = spirit_economy.grant_invite_rewards(db, invite_row, registered.json()["user"]["id"])
    db.commit()
    after_dup = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == "local").first().fruit_balance
    db.close()
    check("邀请奖励不重复发放", again["granted"] is False and before_dup == after_dup, f"{before_dup}->{after_dup}")

    world = client.post("/api/worlds", json={"name": "豁免世界", "description": "", "type": "fantasy", "background": ""})
    check("创建世界", world.status_code == 200, world.text)
    consume_rows = client.get("/api/spirit/transactions").json()
    check("创建消耗流水", any(row["kind"] == "consume" for row in consume_rows), str(consume_rows[:3]))

    db = SessionLocal()
    user = models.AppUser(username=f"spirit_user_{suffix}", display_name="灵植用户", bio="")
    db.add(user); db.commit(); db.refresh(user)
    user_id = user.id
    account = spirit_economy._ensure_account(db, user, starter=False)
    plant_row = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == "world_seed").first()
    db.add(models.SpiritInventory(user_id=user_id, plant_type_id=plant_row.id, quantity=2))
    db.commit()
    result = spirit_economy.consume_for_creation(db, user, action="world_create", plant_key="world_seed", idempotency_key="create-1")
    check("普通用户创建扣库存", result["exempt"] is False, str(result))
    inv = db.query(models.SpiritInventory).filter(
        models.SpiritInventory.user_id == user_id,
        models.SpiritInventory.plant_type_id == plant_row.id,
    ).first()
    check("库存扣一", inv.quantity == 1, str(inv.quantity))
    db.commit()
    try:
        spirit_economy.consume_for_creation(db, user, action="world_create", plant_key="world_seed", idempotency_key="create-1")
        check("幂等重复拒绝", False, "no exception")
    except Exception as exc:
        check("幂等重复拒绝", getattr(exc, "status_code", None) == 409, str(exc))
    db.rollback()
    db.close()

    # 清理本次创建的临时规则/灵植与测试用户，避免污染其他用例。
    db = SessionLocal()
    try:
        db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == f"event_{suffix}").delete(synchronize_session=False)
        db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == f"event_plant_{suffix}").delete(synchronize_session=False)
        db.query(models.AppUser).filter(models.AppUser.username.in_([f"spirit_user_{suffix}"])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    print(f"\n===== {passed} passed, {failed} failed =====")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    run()
