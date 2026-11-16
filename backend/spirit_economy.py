"""灵果与灵植经济核心：账户、库存、兑换、流水、赠送与打赏。

资源只通过服务端变更；前端不能写余额。交易写入用户级流水并保留兑换历史单价。
管理员调整仅对站长开放。世界/OC 创建消耗留在后续接入点，本模块先提供完整账户闭环。
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["spirit-economy"])

DEFAULT_CATALOG = (
    {
        "key": "world_seed",
        "name": "建界灵植",
        "category": "world",
        "description": "用于创建与扩展世界的基础灵植。",
        "price_fruit": 60,
        "unit": "株",
        "sort_order": 10,
    },
    {
        "key": "oc_seed",
        "name": "塑人灵植",
        "category": "oc",
        "description": "用于创建 OC、人物与角色形象的基础灵植。",
        "price_fruit": 60,
        "unit": "株",
        "sort_order": 20,
    },
)

STARTER_FRUIT = 120
MAX_GIFT = 100000


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _user(request: Request, db: Session) -> models.AppUser:
    return current_user(request, db)


def ensure_spirit_catalog(db: Session) -> None:
    changed = False
    for row in DEFAULT_CATALOG:
        exists = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == row["key"]).first()
        if not exists:
            db.add(models.SpiritPlantType(
                key=row["key"],
                name=row["name"],
                category=row["category"],
                description=row["description"],
                price_fruit=row["price_fruit"],
                unit=row["unit"],
                sort_order=row["sort_order"],
                is_active=True,
            ))
            changed = True
    if changed:
        db.commit()


def _ensure_account(db: Session, user: models.AppUser, starter: bool = True) -> models.SpiritAccount:
    account = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == user.id).first()
    if account:
        return account
    account = models.SpiritAccount(
        user_id=user.id,
        fruit_balance=STARTER_FRUIT if starter else 0,
        developer_exempt=bool(user.is_owner),
    )
    db.add(account)
    db.flush()
    if starter and account.fruit_balance:
        db.add(models.SpiritTransaction(
            user_id=user.id,
            kind="reward",
            fruit_amount=account.fruit_balance,
            balance_after=account.fruit_balance,
            note="初始灵果",
            ref_type="account",
            ref_id="starter",
        ))
    db.commit()
    db.refresh(account)
    return account


def _plant_json(row: models.SpiritPlantType) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "category": row.category,
        "description": row.description or "",
        "price_fruit": row.price_fruit,
        "unit": row.unit or "株",
        "sort_order": row.sort_order,
        "is_active": bool(row.is_active),
    }


def _inventory_json(rows: list[tuple[models.SpiritInventory, models.SpiritPlantType]]) -> list[dict]:
    return [
        {
            "plant_type_id": plant.id,
            "key": plant.key,
            "name": plant.name,
            "category": plant.category,
            "quantity": inventory.quantity,
            "unit": plant.unit or "株",
        }
        for inventory, plant in rows
        if inventory.quantity > 0
    ]


def _transaction_json(row: models.SpiritTransaction) -> dict:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "kind": row.kind,
        "fruit_amount": row.fruit_amount,
        "plant_type_id": row.plant_type_id,
        "plant_quantity": row.plant_quantity,
        "unit_price": (row.meta or {}).get("unit_price"),
        "counterparty_user_id": row.counterparty_user_id,
        "ref_type": row.ref_type or "",
        "ref_id": row.ref_id or "",
        "note": row.note or "",
        "balance_after": row.balance_after,
        "created_at": _iso(row.created_at),
    }


def _inventory_rows(db: Session, user_id: str):
    return (
        db.query(models.SpiritInventory, models.SpiritPlantType)
        .join(models.SpiritPlantType, models.SpiritPlantType.id == models.SpiritInventory.plant_type_id)
        .filter(models.SpiritInventory.user_id == user_id, models.SpiritInventory.quantity > 0)
        .order_by(models.SpiritPlantType.sort_order.asc(), models.SpiritPlantType.name.asc())
        .all()
    )


def _positive_int(value, field: str, *, maximum: int = MAX_GIFT) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{field}必须是整数")
    if number <= 0 or number > maximum:
        raise HTTPException(status_code=422, detail=f"{field}超出允许范围")
    return number


def _get_target(db: Session, user_id: str) -> models.AppUser:
    row = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="接收用户不存在")
    return row


def _move_fruit(
    db: Session,
    *,
    source: models.SpiritAccount,
    target: models.SpiritAccount,
    amount: int,
    kind: str,
    note: str,
    ref_type: str = "",
    ref_id: str = "",
) -> None:
    if source.fruit_balance < amount:
        raise HTTPException(status_code=409, detail="灵果余额不足")
    source.fruit_balance -= amount
    target.fruit_balance += amount
    source.updated_at = _now()
    target.updated_at = _now()
    group = uuid.uuid4().hex
    db.add_all([
        models.SpiritTransaction(
            user_id=source.user_id,
            kind=kind,
            fruit_amount=-amount,
            balance_after=source.fruit_balance,
            counterparty_user_id=target.user_id,
            ref_type=ref_type,
            ref_id=ref_id or group,
            note=note,
        ),
        models.SpiritTransaction(
            user_id=target.user_id,
            kind=kind,
            fruit_amount=amount,
            balance_after=target.fruit_balance,
            counterparty_user_id=source.user_id,
            ref_type=ref_type,
            ref_id=ref_id or group,
            note=note,
        ),
    ])


@router.get("/api/spirit/summary")
def spirit_summary(request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    ensure_spirit_catalog(db)
    account = _ensure_account(db, user)
    plants = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.is_active.is_(True)).order_by(
        models.SpiritPlantType.sort_order.asc(), models.SpiritPlantType.name.asc()
    ).all()
    transactions = db.query(models.SpiritTransaction).filter(
        models.SpiritTransaction.user_id == user.id
    ).order_by(models.SpiritTransaction.created_at.desc()).limit(20).all()
    return {
        "account": {
            "user_id": account.user_id,
            "fruit_balance": account.fruit_balance,
            "developer_exempt": bool(account.developer_exempt),
            "updated_at": _iso(account.updated_at),
        },
        "inventory": _inventory_json(_inventory_rows(db, user.id)),
        "plants": [_plant_json(row) for row in plants],
        "transactions": [_transaction_json(row) for row in transactions],
    }


@router.get("/api/spirit/transactions")
def spirit_transactions(request: Request, limit: int = 80, kind: Optional[str] = None, db: Session = Depends(get_db)):
    user = _user(request, db)
    query = db.query(models.SpiritTransaction).filter(models.SpiritTransaction.user_id == user.id)
    if kind:
        query = query.filter(models.SpiritTransaction.kind == kind)
    rows = query.order_by(models.SpiritTransaction.created_at.desc()).limit(max(1, min(limit, 200))).all()
    return [_transaction_json(row) for row in rows]


@router.post("/api/spirit/exchange")
def exchange_plant(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    ensure_spirit_catalog(db)
    account = _ensure_account(db, user)
    plant_id = str(payload.get("plant_type_id") or "").strip()
    plant = db.query(models.SpiritPlantType).filter(
        models.SpiritPlantType.id == plant_id,
        models.SpiritPlantType.is_active.is_(True),
    ).first()
    if not plant:
        raise HTTPException(status_code=404, detail="灵植类型不存在")
    quantity = _positive_int(payload.get("quantity"), "兑换数量", maximum=99)
    total = int(plant.price_fruit) * quantity
    if account.fruit_balance < total:
        raise HTTPException(status_code=409, detail="灵果余额不足")
    inventory = db.query(models.SpiritInventory).filter(
        models.SpiritInventory.user_id == user.id,
        models.SpiritInventory.plant_type_id == plant.id,
    ).first()
    if not inventory:
        inventory = models.SpiritInventory(user_id=user.id, plant_type_id=plant.id, quantity=0)
        db.add(inventory)
    account.fruit_balance -= total
    account.updated_at = _now()
    inventory.quantity += quantity
    inventory.updated_at = _now()
    db.add(models.SpiritTransaction(
        user_id=user.id,
        kind="exchange",
        fruit_amount=-total,
        plant_type_id=plant.id,
        plant_quantity=quantity,
        balance_after=account.fruit_balance,
        note=f"兑换 {plant.name} × {quantity}",
        ref_type="plant",
        ref_id=plant.id,
        meta={"unit_price": int(plant.price_fruit), "total": total},
    ))
    db.commit()
    return {
        "account": {
            "user_id": account.user_id,
            "fruit_balance": account.fruit_balance,
            "developer_exempt": bool(account.developer_exempt),
            "updated_at": _iso(account.updated_at),
        },
        "inventory": _inventory_json(_inventory_rows(db, user.id)),
    }


@router.post("/api/spirit/gift")
def gift_fruit(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    account = _ensure_account(db, user)
    target_id = str(payload.get("to_user_id") or "").strip()
    if target_id == user.id:
        raise HTTPException(status_code=422, detail="不能给自己赠送灵果")
    target_user = _get_target(db, target_id)
    target = _ensure_account(db, target_user, starter=False)
    amount = _positive_int(payload.get("amount"), "赠送数量")
    note = str(payload.get("note") or "").strip()[:240]
    kind = "tip" if payload.get("kind") == "tip" else "gift"
    ref_type = str(payload.get("ref_type") or "").strip()[:40]
    ref_id = str(payload.get("ref_id") or "").strip()[:160]
    _move_fruit(
        db, source=account, target=target, amount=amount,
        kind=kind, note=note or ("作品打赏" if kind == "tip" else "灵果赠送"),
        ref_type=ref_type, ref_id=ref_id,
    )
    db.commit()
    return {"status": "ok", "kind": kind, "balance": account.fruit_balance}


@router.post("/api/spirit/admin/adjust")
def admin_adjust(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅站长可调整灵果")
    target_id = str(payload.get("user_id") or "").strip()
    target_user = _get_target(db, target_id)
    target = _ensure_account(db, target_user, starter=False)
    try:
        amount = int(payload.get("amount"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="调整数量必须是整数")
    if amount == 0 or abs(amount) > 1000000:
        raise HTTPException(status_code=422, detail="调整数量非法")
    if target.fruit_balance + amount < 0:
        raise HTTPException(status_code=409, detail="调整后余额不能为负")
    target.fruit_balance += amount
    target.updated_at = _now()
    db.add(models.SpiritTransaction(
        user_id=target.user_id,
        kind="admin",
        fruit_amount=amount,
        balance_after=target.fruit_balance,
        counterparty_user_id=user.id,
        note=str(payload.get("note") or "").strip()[:240] or "站长调整",
        ref_type="admin",
        ref_id=user.id,
    ))
    db.commit()
    return {"status": "ok", "user_id": target.user_id, "balance": target.fruit_balance}
