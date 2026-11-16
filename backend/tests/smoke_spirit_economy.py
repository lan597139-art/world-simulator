"""D 核心：灵果账户、灵植库存、兑换历史单价、赠送/打赏与站长调整。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
target_id = f"spirit-target-{uuid.uuid4().hex[:8]}"


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def reset():
    db = SessionLocal()
    db.query(models.SpiritTransaction).filter(models.SpiritTransaction.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.SpiritInventory).filter(models.SpiritInventory.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.AppUser).filter(models.AppUser.id == target_id).delete(synchronize_session=False)
    db.add(models.AppUser(id=target_id, username=target_id, display_name="Spirit Target", is_active=True))
    db.commit()
    db.close()


def run():
    reset()
    summary = client.get("/api/spirit/summary")
    check("灵果账户可读", summary.status_code == 200, summary.text)
    data = summary.json()
    check("初始灵果与目录", data["account"]["fruit_balance"] == 120 and len(data["plants"]) == 2, data)
    check("初始流水", any(row["kind"] == "reward" for row in data["transactions"]), data["transactions"])

    world_plant = next(row for row in data["plants"] if row["category"] == "world")
    exchanged = client.post("/api/spirit/exchange", json={"plant_type_id": world_plant["id"], "quantity": 1})
    check("兑换灵植", exchanged.status_code == 200 and exchanged.json()["account"]["fruit_balance"] == 60, exchanged.text)
    check("库存增加", exchanged.json()["inventory"][0]["quantity"] == 2, exchanged.json())
    ledger = client.get("/api/spirit/transactions").json()
    exchange_row = next(row for row in ledger if row["kind"] == "exchange")
    check("兑换保留历史单价", exchange_row["unit_price"] == 60 and exchange_row["fruit_amount"] == -60, exchange_row)

    poor = client.post("/api/spirit/exchange", json={"plant_type_id": world_plant["id"], "quantity": 2})
    check("余额不足拒绝兑换", poor.status_code == 409, poor.text)
    bad_qty = client.post("/api/spirit/exchange", json={"plant_type_id": world_plant["id"], "quantity": 0})
    check("非法数量拒绝", bad_qty.status_code == 422, bad_qty.text)

    gift = client.post("/api/spirit/gift", json={"to_user_id": target_id, "amount": 30, "note": "测试赠送"})
    check("赠送灵果", gift.status_code == 200 and gift.json()["balance"] == 30, gift.text)
    tip = client.post("/api/spirit/gift", json={"to_user_id": target_id, "amount": 20, "kind": "tip", "ref_type": "work", "ref_id": "w1", "note": "作品打赏"})
    check("作品打赏", tip.status_code == 200 and tip.json()["kind"] == "tip", tip.text)
    self_gift = client.post("/api/spirit/gift", json={"to_user_id": "local", "amount": 1})
    check("不能给自己赠送", self_gift.status_code == 422, self_gift.text)

    adjust = client.post("/api/spirit/admin/adjust", json={"user_id": target_id, "amount": 100, "note": "测试调整"})
    check("站长调整余额", adjust.status_code == 200 and adjust.json()["balance"] == 150, adjust.text)
    negative = client.post("/api/spirit/admin/adjust", json={"user_id": target_id, "amount": -1000})
    check("调整后余额不能为负", negative.status_code == 409, negative.text)

    db = SessionLocal()
    target_rows = db.query(models.SpiritTransaction).filter(models.SpiritTransaction.user_id == target_id).all()
    check("接收方拥有独立流水", len(target_rows) >= 3, [(row.kind, row.fruit_amount) for row in target_rows])
    db.close()


try:
    run()
finally:
    db = SessionLocal()
    db.query(models.SpiritTransaction).filter(models.SpiritTransaction.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.SpiritInventory).filter(models.SpiritInventory.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id.in_(["local", target_id])).delete(synchronize_session=False)
    db.query(models.AppUser).filter(models.AppUser.id == target_id).delete(synchronize_session=False)
    db.commit()
    db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
