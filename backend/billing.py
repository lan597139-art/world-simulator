"""商业与服务中心：会员、余额、充值、订单、AI 用量与创作者结算。

当前项目没有接入真实支付机构，因此在 localhost 默认提供显式的「本地沙盒」充值：
只写本地账本，不产生真实扣款。远程部署默认关闭；可用 WS_BILLING_SANDBOX=1/0
显式开启或关闭。关闭后充值订单会保持待支付，会员仍可使用已有余额开通。
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import SessionLocal, get_db

router = APIRouter(tags=["billing"])

CURRENCY = "CNY"
CREATOR_FEE_RATE = 0.10
MIN_SETTLEMENT_CENTS = 10000  # ¥100

PLANS = [
    {
        "key": "free",
        "label": "免费用户",
        "tagline": "体验世界与人物创作的基础能力",
        "monthly_cents": 0,
        "yearly_cents": 0,
        "included_calls": 20,
        "features": ["完整世界与人物编辑", "基础 AI 调用额度", "社区讨论与小组", "本地数据导出"],
    },
    {
        "key": "creator",
        "label": "创作者会员",
        "tagline": "面向持续写作与长期世界维护",
        "monthly_cents": 2900,
        "yearly_cents": 29900,
        "included_calls": 500,
        "features": ["每月 500 次平台 AI 调用", "完整人物种子与传记工具", "内容社区创作身份标识", "优先导出与归档"],
    },
    {
        "key": "pro",
        "label": "专业会员",
        "tagline": "面向高强度推演与商业创作",
        "monthly_cents": 9900,
        "yearly_cents": 99900,
        "included_calls": 2000,
        "features": ["每月 2000 次平台 AI 调用", "多路径推演与长线叙事", "云宝工作台只读访问", "创作者结算优先处理"],
    },
]

RECHARGE_PACKAGES = [
    {"key": "recharge_10", "label": "¥10", "amount_cents": 1000, "note": "适合轻度体验"},
    {"key": "recharge_30", "label": "¥30", "amount_cents": 3000, "note": "常用额度"},
    {"key": "recharge_50", "label": "¥50", "amount_cents": 5000, "note": "长期创作"},
    {"key": "recharge_100", "label": "¥100", "amount_cents": 10000, "note": "团队与深度使用"},
]

PLAN_BY_KEY = {item["key"]: item for item in PLANS}
PACKAGE_BY_KEY = {item["key"]: item for item in RECHARGE_PACKAGES}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _sandbox_enabled(request: Request | None = None) -> bool:
    """沙盒默认只在 localhost 开启；远程部署默认关闭，避免自助增发余额。"""
    raw = os.getenv("WS_BILLING_SANDBOX")
    if raw is not None:
        return (raw or "").strip().lower() not in {"0", "false", "no", "off"}
    if request is None:
        return False
    host = (request.url.hostname or "").lower()
    return host in {"127.0.0.1", "localhost", "::1"}


def _money(cents: int) -> str:
    return f"¥{cents / 100:.2f}"


def _account(db: Session, user: models.AppUser) -> models.BillingAccount:
    row = db.query(models.BillingAccount).filter(models.BillingAccount.user_id == user.id).first()
    if not row:
        row = models.BillingAccount(user_id=user.id, balance_cents=0, currency=CURRENCY)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _membership(db: Session, user: models.AppUser) -> models.BillingMembership:
    row = db.query(models.BillingMembership).filter(models.BillingMembership.user_id == user.id).first()
    if not row:
        row = models.BillingMembership(user_id=user.id, plan="free", status="active", auto_renew=False)
        db.add(row)
        db.commit()
        db.refresh(row)
    if row.plan != "free" and row.status == "active" and row.expires_at and row.expires_at < _now():
        row.status = "expired"
        row.auto_renew = False
        row.updated_at = _now()
        db.commit()
        db.refresh(row)
    return row


def _plan(plan_key: str) -> dict:
    return PLAN_BY_KEY.get(plan_key, PLAN_BY_KEY["free"])


def _membership_row(db: Session, user: models.AppUser) -> dict:
    row = _membership(db, user)
    plan = _plan(row.plan)
    included = plan["included_calls"]
    return {
        "plan": row.plan,
        "plan_label": plan["label"],
        "status": row.status,
        "cycle": row.cycle or "",
        "started_at": _iso(row.started_at),
        "expires_at": _iso(row.expires_at),
        "auto_renew": bool(row.auto_renew),
        "included_calls": included,
        "features": plan["features"],
    }


def _order_row(row: models.BillingOrder) -> dict:
    return {
        "id": row.id,
        "kind": row.kind,
        "sku": row.sku,
        "title": row.title,
        "amount_cents": row.amount_cents,
        "amount_display": _money(row.amount_cents),
        "currency": row.currency,
        "status": row.status,
        "payment_method": row.payment_method or "",
        "paid_at": _iso(row.paid_at),
        "created_at": _iso(row.created_at),
        "details": row.details or {},
    }


def _ledger_row(row: models.BillingLedgerEntry) -> dict:
    return {
        "id": row.id,
        "order_id": row.order_id,
        "entry_type": row.entry_type,
        "amount_cents": row.amount_cents,
        "amount_display": f"{'+' if row.amount_cents >= 0 else '-'}{_money(abs(row.amount_cents))}",
        "balance_after_cents": row.balance_after_cents,
        "description": row.description,
        "created_at": _iso(row.created_at),
        "details": row.details or {},
    }


def _usage_row(row: models.BillingAiUsage) -> dict:
    return {
        "id": row.id,
        "route": row.route,
        "provider": row.provider,
        "model": row.model or "",
        "status_code": row.status_code,
        "units": row.units,
        "created_at": _iso(row.created_at),
    }


def _month_start(now: datetime | None = None) -> datetime:
    now = now or _now()
    return datetime(now.year, now.month, 1)


def _usage_summary(db: Session, user: models.AppUser, days: int = 30) -> dict:
    membership = _membership(db, user)
    plan = _plan(membership.plan)
    since = _month_start()
    rows = db.query(models.BillingAiUsage).filter(
        models.BillingAiUsage.user_id == user.id,
        models.BillingAiUsage.created_at >= since,
    ).all()
    platform_calls = sum(item.units for item in rows if item.provider != "personal")
    personal_calls = sum(item.units for item in rows if item.provider == "personal")
    total_calls = platform_calls + personal_calls

    today = _now().date()
    daily = []
    for offset in range(max(1, min(days, 90)) - 1, -1, -1):
        day = today - timedelta(days=offset)
        start = datetime(day.year, day.month, day.day)
        end = start + timedelta(days=1)
        day_rows = db.query(models.BillingAiUsage).filter(
            models.BillingAiUsage.user_id == user.id,
            models.BillingAiUsage.created_at >= start,
            models.BillingAiUsage.created_at < end,
        ).all()
        daily.append({
            "date": day.isoformat(),
            "calls": sum(item.units for item in day_rows),
            "platform": sum(item.units for item in day_rows if item.provider != "personal"),
            "personal": sum(item.units for item in day_rows if item.provider == "personal"),
        })

    recent = db.query(models.BillingAiUsage).filter(
        models.BillingAiUsage.user_id == user.id
    ).order_by(models.BillingAiUsage.created_at.desc()).limit(30).all()
    account = _account(db, user)
    limit = int(account.ai_monthly_call_limit or 0)
    return {
        "month": since.strftime("%Y-%m"),
        "platform_calls": platform_calls,
        "personal_calls": personal_calls,
        "total_calls": total_calls,
        "included_calls": plan["included_calls"] if membership.status == "active" else 20,
        "remaining_calls": max(0, (plan["included_calls"] if membership.status == "active" else 20) - platform_calls),
        "monthly_call_limit": limit,
        "limit_used_ratio": round(platform_calls / limit, 4) if limit else 0,
        "daily": daily,
        "recent": [_usage_row(item) for item in recent],
    }


def _settlement_rows(db: Session, user: models.AppUser) -> list[dict]:
    rows = db.query(models.BillingSettlement).filter(
        models.BillingSettlement.creator_id == user.id
    ).order_by(models.BillingSettlement.created_at.desc()).all()
    return [{
        "id": row.id,
        "period_start": _iso(row.period_start),
        "period_end": _iso(row.period_end),
        "gross_cents": row.gross_cents,
        "platform_fee_cents": row.platform_fee_cents,
        "net_cents": row.net_cents,
        "net_display": _money(row.net_cents),
        "status": row.status,
        "created_at": _iso(row.created_at),
        "paid_at": _iso(row.paid_at),
    } for row in rows]


def _settlement_summary(db: Session, user: models.AppUser) -> dict:
    earnings = db.query(func.coalesce(func.sum(models.BillingLedgerEntry.amount_cents), 0)).filter(
        models.BillingLedgerEntry.user_id == user.id,
        models.BillingLedgerEntry.entry_type == "creator_earning",
        models.BillingLedgerEntry.amount_cents > 0,
    ).scalar() or 0
    rows = db.query(models.BillingSettlement).filter(models.BillingSettlement.creator_id == user.id).all()
    settled_gross = sum(row.gross_cents for row in rows)
    pending = sum(row.net_cents for row in rows if row.status == "pending")
    paid = sum(row.net_cents for row in rows if row.status == "paid")
    return {
        "total_earned_cents": int(earnings),
        "available_cents": max(0, int(earnings) - settled_gross),
        "pending_cents": pending,
        "paid_cents": paid,
        "minimum_cents": MIN_SETTLEMENT_CENTS,
        "fee_rate": CREATOR_FEE_RATE,
        "records": [{
            "id": row.id,
            "period_start": _iso(row.period_start),
            "period_end": _iso(row.period_end),
            "gross_cents": row.gross_cents,
            "platform_fee_cents": row.platform_fee_cents,
            "net_cents": row.net_cents,
            "net_display": _money(row.net_cents),
            "status": row.status,
            "created_at": _iso(row.created_at),
            "paid_at": _iso(row.paid_at),
        } for row in sorted(rows, key=lambda item: item.created_at or datetime.min, reverse=True)],
    }


def _service_records(db: Session, user: models.AppUser) -> list[dict]:
    rows = db.query(models.BillingOrder).filter(
        models.BillingOrder.user_id == user.id,
        models.BillingOrder.status == "paid",
        models.BillingOrder.kind == "membership",
    ).order_by(models.BillingOrder.paid_at.desc()).all()
    now = _now()
    records = []
    for row in rows:
        details = row.details or {}
        expires = None
        raw_expires = details.get("expires_at")
        if raw_expires:
            try:
                expires = datetime.fromisoformat(raw_expires)
            except ValueError:
                expires = None
        records.append({
            "id": row.id,
            "service_type": "membership",
            "title": row.title,
            "amount_cents": row.amount_cents,
            "amount_display": _money(row.amount_cents),
            "status": "active" if expires and expires > now else "expired",
            "started_at": _iso(row.paid_at),
            "expires_at": _iso(expires),
        })
    return records


@router.get("/api/billing/overview")
def billing_overview(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    account = _account(db, user)
    membership = _membership_row(db, user)
    usage = _usage_summary(db, user, 14)
    settlement = _settlement_summary(db, user)
    orders = db.query(models.BillingOrder).filter(
        models.BillingOrder.user_id == user.id
    ).order_by(models.BillingOrder.created_at.desc()).limit(6).all()
    ledger = db.query(models.BillingLedgerEntry).filter(
        models.BillingLedgerEntry.user_id == user.id
    ).order_by(models.BillingLedgerEntry.created_at.desc()).limit(6).all()
    paid_total = db.query(func.coalesce(func.sum(models.BillingOrder.amount_cents), 0)).filter(
        models.BillingOrder.user_id == user.id,
        models.BillingOrder.status == "paid",
    ).scalar() or 0
    pending_count = db.query(models.BillingOrder).filter(
        models.BillingOrder.user_id == user.id,
        models.BillingOrder.status == "pending",
    ).count()
    sandbox = _sandbox_enabled(request)
    return {
        "mode": {
            "sandbox": sandbox,
            "provider": "local-sandbox" if sandbox else "",
            "provider_label": "本地沙盒" if sandbox else "支付通道未配置",
            "currency": CURRENCY,
        },
        "account": {
            "balance_cents": account.balance_cents,
            "balance_display": _money(account.balance_cents),
            "currency": account.currency,
            "ai_monthly_call_limit": account.ai_monthly_call_limit,
        },
        "membership": membership,
        "plans": PLANS,
        "recharge_packages": RECHARGE_PACKAGES,
        "usage": usage,
        "settlement": settlement,
        "summary": {
            "pending_orders": pending_count,
            "paid_total_cents": int(paid_total),
            "paid_total_display": _money(int(paid_total)),
            "creator_available_cents": settlement["available_cents"],
            "creator_available_display": _money(settlement["available_cents"]),
        },
        "recent_orders": [_order_row(row) for row in orders],
        "recent_ledger": [_ledger_row(row) for row in ledger],
    }


@router.get("/api/billing/orders")
def list_orders(request: Request, status: str = "", db: Session = Depends(get_db)):
    user = current_user(request, db)
    query = db.query(models.BillingOrder).filter(models.BillingOrder.user_id == user.id)
    if status:
        if status not in {"pending", "paid", "cancelled"}:
            raise HTTPException(status_code=422, detail="订单状态无效")
        query = query.filter(models.BillingOrder.status == status)
    rows = query.order_by(models.BillingOrder.created_at.desc()).limit(100).all()
    return [_order_row(row) for row in rows]


@router.post("/api/billing/orders")
def create_order(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    kind = str(payload.get("kind") or "").strip()
    sku = str(payload.get("sku") or "").strip()
    if kind == "recharge":
        package = PACKAGE_BY_KEY.get(sku)
        if not package:
            raise HTTPException(status_code=422, detail="充值套餐不存在")
        amount = package["amount_cents"]
        title = f"账户充值 · {package['label']}"
        details = {"package": package["key"], "note": package["note"]}
    elif kind == "membership":
        plan = PLAN_BY_KEY.get(sku)
        cycle = str(payload.get("cycle") or "monthly").strip()
        if not plan or plan["key"] == "free":
            raise HTTPException(status_code=422, detail="会员套餐不存在")
        if cycle not in {"monthly", "yearly"}:
            raise HTTPException(status_code=422, detail="计费周期无效")
        amount = plan[f"{cycle}_cents"]
        title = f"{plan['label']} · {'年付' if cycle == 'yearly' else '月付'}"
        details = {"plan": plan["key"], "cycle": cycle}
    else:
        raise HTTPException(status_code=422, detail="订单类型无效")

    row = models.BillingOrder(
        user_id=user.id,
        kind=kind,
        sku=sku,
        title=title,
        amount_cents=amount,
        currency=CURRENCY,
        status="pending",
        details=details,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"order": _order_row(row), "account": {
        "balance_cents": _account(db, user).balance_cents,
        "balance_display": _money(_account(db, user).balance_cents),
    }}


@router.post("/api/billing/orders/{order_id}/pay")
def pay_order(order_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    order = db.query(models.BillingOrder).filter(
        models.BillingOrder.id == order_id,
        models.BillingOrder.user_id == user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="订单当前状态不可支付")

    account = _account(db, user)
    now = _now()
    if order.kind == "recharge":
        if not _sandbox_enabled(request):
            raise HTTPException(status_code=409, detail="支付通道未配置，充值订单暂时只能保留为待支付")
        if not bool(payload.get("confirm_sandbox")):
            raise HTTPException(status_code=400, detail="本地沙盒充值需要明确确认")
        account.balance_cents += order.amount_cents
        account.updated_at = now
        db.add(models.BillingLedgerEntry(
            user_id=user.id, order_id=order.id, entry_type="topup",
            amount_cents=order.amount_cents, balance_after_cents=account.balance_cents,
            description=f"本地沙盒充值 · {_money(order.amount_cents)}",
            details={"sandbox": True},
        ))
        order.payment_method = "local-sandbox"
    elif order.kind == "membership":
        if account.balance_cents < order.amount_cents:
            raise HTTPException(status_code=402, detail="账户余额不足，请先充值")
        account.balance_cents -= order.amount_cents
        account.updated_at = now
        plan_key = str((order.details or {}).get("plan") or order.sku)
        cycle = str((order.details or {}).get("cycle") or "monthly")
        plan = PLAN_BY_KEY.get(plan_key)
        if not plan:
            raise HTTPException(status_code=422, detail="订单会员套餐无效")
        membership = _membership(db, user)
        base = now
        if membership.plan == plan_key and membership.status == "active" and membership.expires_at and membership.expires_at > now:
            base = membership.expires_at
        expires = base + timedelta(days=365 if cycle == "yearly" else 30)
        membership.plan = plan_key
        membership.status = "active"
        membership.cycle = cycle
        membership.started_at = membership.started_at or now
        membership.expires_at = expires
        membership.auto_renew = False
        membership.updated_at = now
        order.details = {**(order.details or {}), "expires_at": expires.isoformat()}
        db.add(models.BillingLedgerEntry(
            user_id=user.id, order_id=order.id, entry_type="membership",
            amount_cents=-order.amount_cents, balance_after_cents=account.balance_cents,
            description=f"开通{plan['label']} · {order.title}",
            details={"plan": plan_key, "cycle": cycle, "expires_at": expires.isoformat()},
        ))
        order.payment_method = "balance"
    else:
        raise HTTPException(status_code=422, detail="订单类型无效")

    order.status = "paid"
    order.paid_at = now
    order.updated_at = now
    db.commit()
    db.refresh(order)
    return {
        "order": _order_row(order),
        "account": {"balance_cents": account.balance_cents, "balance_display": _money(account.balance_cents)},
        "membership": _membership_row(db, user),
        "usage": _usage_summary(db, user, 14),
    }


@router.post("/api/billing/orders/{order_id}/cancel")
def cancel_order(order_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    order = db.query(models.BillingOrder).filter(
        models.BillingOrder.id == order_id,
        models.BillingOrder.user_id == user.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "pending":
        raise HTTPException(status_code=409, detail="只有待支付订单可以取消")
    order.status = "cancelled"
    order.updated_at = _now()
    db.commit()
    return {"status": "cancelled", "order": _order_row(order)}


@router.patch("/api/billing/membership")
def patch_membership(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _membership(db, user)
    if "auto_renew" in payload:
        if not isinstance(payload["auto_renew"], bool):
            raise HTTPException(status_code=422, detail="auto_renew 必须是布尔值")
        row.auto_renew = payload["auto_renew"]
        row.updated_at = _now()
        db.commit()
    return _membership_row(db, user)


@router.get("/api/billing/usage")
def billing_usage(request: Request, days: int = 14, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return _usage_summary(db, user, days)


@router.patch("/api/billing/usage")
def patch_usage(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    account = _account(db, user)
    if "monthly_call_limit" in payload:
        value = payload["monthly_call_limit"]
        if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > 100000:
            raise HTTPException(status_code=422, detail="调用上限必须是 0–100000 的整数（0 表示不设提醒）")
        account.ai_monthly_call_limit = value
        account.updated_at = _now()
        db.commit()
    return _usage_summary(db, user, 14)


@router.get("/api/billing/records")
def billing_records(request: Request, limit: int = 100, db: Session = Depends(get_db)):
    user = current_user(request, db)
    safe_limit = max(1, min(limit, 200))
    ledger = db.query(models.BillingLedgerEntry).filter(
        models.BillingLedgerEntry.user_id == user.id
    ).order_by(models.BillingLedgerEntry.created_at.desc()).limit(safe_limit).all()
    return {
        "ledger": [_ledger_row(row) for row in ledger],
        "services": _service_records(db, user),
    }


@router.get("/api/billing/settlements")
def billing_settlements(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    return _settlement_summary(db, user)


@router.post("/api/billing/settlements/run")
def run_settlement(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    existing = db.query(models.BillingSettlement).filter(
        models.BillingSettlement.creator_id == user.id,
        models.BillingSettlement.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="已有一笔待处理的结算单")
    summary = _settlement_summary(db, user)
    available = summary["available_cents"]
    if available < MIN_SETTLEMENT_CENTS:
        raise HTTPException(
            status_code=400,
            detail=f"可结算收入不足 {_money(MIN_SETTLEMENT_CENTS)}，当前 {_money(available)}",
        )
    fee = int(round(available * CREATOR_FEE_RATE))
    now = _now()
    period_end = now.replace(day=1) - timedelta(seconds=1)
    period_start = period_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    row = models.BillingSettlement(
        creator_id=user.id,
        period_start=period_start,
        period_end=period_end,
        gross_cents=available,
        platform_fee_cents=fee,
        net_cents=available - fee,
        status="pending",
        details={"fee_rate": CREATOR_FEE_RATE, "source": "creator_earning"},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"settlement": {
        "id": row.id,
        "period_start": _iso(row.period_start),
        "period_end": _iso(row.period_end),
        "gross_cents": row.gross_cents,
        "platform_fee_cents": row.platform_fee_cents,
        "net_cents": row.net_cents,
        "status": row.status,
    }, "summary": _settlement_summary(db, user)}


_AI_ROUTE_PATTERNS = (
    re.compile(r"^/api/simulate$"),
    re.compile(r"^/api/assistant/chat$"),
    re.compile(r"^/api/writing/(generate|assist|extract)$"),
    re.compile(r"^/api/branches/"),
    re.compile(r"^/api/writings/[^/]+/(analyze|extract)$"),
    re.compile(r"^/api/characters/[^/]+/biography/generate$"),
    re.compile(r"^/api/events/[^/]+/directions/suggest$"),
    re.compile(r"^/api/personas/[^/]+/chat$"),
    re.compile(r"^/api/chat/threads/[^/]+/(messages|turns|memories/summarize|impact/preview)$"),
)


def is_ai_usage_route(path: str) -> bool:
    if path == "/api/ai/status":
        return False
    return any(pattern.search(path) for pattern in _AI_ROUTE_PATTERNS)


def record_ai_usage(user_id: str, path: str, personal: bool, status_code: int, model: str = "", method: str = "POST") -> None:
    """轻量记录 AI 调用次数；不记录提示词、响应或 Key。"""
    if not user_id or method.upper() == "GET" or not is_ai_usage_route(path):
        return
    if (os.getenv("WS_BILLING_USAGE_LOG", "1") or "").strip().lower() in {"0", "false", "no", "off"}:
        return
    db = SessionLocal()
    try:
        db.add(models.BillingAiUsage(
            user_id=user_id,
            route=path[:160],
            provider="personal" if personal else "platform",
            model=(model or "")[:120],
            status_code=int(status_code),
            units=1,
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
