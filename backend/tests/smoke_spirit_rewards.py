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
    owner = client.get("/api/auth/me").json()
    owner_id = owner["id"]
    db = SessionLocal()
    owner_row = db.query(models.AppUser).filter(models.AppUser.id == owner_id).first()
    owner_row.bio = "有简介"
    owner_row.avatar = "🌱"
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
    tx = client.get("/api/spirit/admin/transactions?limit=10")
    check("后台流水", tx.status_code == 200 and tx.json()["items"], tx.text)

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

    print(f"\n===== {passed} passed, {failed} failed =====")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    run()
