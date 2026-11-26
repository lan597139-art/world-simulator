"""灵果与灵植经济核心：账户、库存、兑换、流水、赠送与打赏。

资源只通过服务端变更；前端不能写余额。交易写入用户级流水并保留兑换历史单价。
管理员调整仅对站长开放。世界/OC 创建消耗留在后续接入点，本模块先提供完整账户闭环。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db
from user_analytics import user_activity_overview

router = APIRouter(tags=["spirit-economy"])

DEFAULT_CATALOG = (
    {
        "key": "world_seed",
        "name": "建界灵植",
        "category": "world",
        "description": "用于创建与扩展世界的基础灵植。",
        "price_fruit": 100,
        "unit": "株",
        "sort_order": 10,
    },
    {
        "key": "oc_seed",
        "name": "塑人灵植",
        "category": "oc",
        "description": "用于创建 OC、人物与角色形象的基础灵植。",
        "price_fruit": 30,
        "unit": "株",
        "sort_order": 20,
    },
)

# 新账户初始资源：500 灵果 + 1 株世界灵植。
STARTER_FRUIT = 500
MAX_GIFT = 100000

REWARD_CATALOG = (
    {
        "key": "registration_bonus", "name": "注册奖励", "description": "新账号初始化时自动发放。",
        "category": "registration", "fruit_amount": 500, "claim_mode": "once",
        "condition": {"type": "registration"}, "daily_limit": 1, "total_limit": 1,
        "sort_order": 0,
    },
    {
        "key": "daily_checkin", "name": "每日签到", "description": "每天登录后领取一次灵果。",
        "category": "community", "fruit_amount": 10, "claim_mode": "daily",
        "condition": {"type": "daily_checkin"}, "daily_limit": 1, "total_limit": 0,
        "sort_order": 10,
    },
    {
        "key": "profile_complete", "name": "完善个人资料", "description": "填写简介并设置头像后领取一次。",
        "category": "creation", "fruit_amount": 30, "claim_mode": "once",
        "condition": {"type": "profile_complete"}, "daily_limit": 1, "total_limit": 1,
        "sort_order": 20,
    },
    {
        "key": "first_work", "name": "创作第一件作品", "description": "创作中心拥有至少一件作品后领取一次。",
        "category": "creation", "fruit_amount": 50, "claim_mode": "once",
        "condition": {"type": "has_work"}, "daily_limit": 1, "total_limit": 1,
        "sort_order": 30,
    },
    {
        "key": "first_world", "name": "建立第一个世界", "description": "拥有至少一个世界后领取一次。",
        "category": "creation", "fruit_amount": 30, "claim_mode": "once",
        "condition": {"type": "has_world"}, "daily_limit": 1, "total_limit": 1,
        "sort_order": 40,
    },
    {
        "key": "community_share", "name": "社区分享", "description": "发布一条个人动态后每天领取一次。",
        "category": "community", "fruit_amount": 5, "claim_mode": "daily",
        "condition": {"type": "has_post"}, "daily_limit": 1, "total_limit": 0,
        "sort_order": 50,
    },
)

ALLOWED_CONDITIONS = {"registration", "daily_checkin", "profile_complete", "has_work", "has_world", "has_post", "manual"}


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _parse_expiry(value) -> datetime | None:
    """解析活动灵植截止时间；空值表示长期有效。"""
    if value is None or str(value).strip() in {"", "null", "None"}:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip())
    except ValueError:
        raise HTTPException(status_code=422, detail="截止时间格式错误，应为 ISO 时间")
    if parsed.tzinfo is not None:
        # 统一存为 naive UTC，便于与 utcnow() 比较。
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


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


def ensure_reward_rules(db: Session) -> None:
    changed = False
    for row in REWARD_CATALOG:
        exists = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == row["key"]).first()
        if exists:
            continue
        db.add(models.SpiritRewardRule(
            key=row["key"], name=row["name"], description=row["description"],
            category=row["category"], fruit_amount=row["fruit_amount"],
            claim_mode=row["claim_mode"], condition=row["condition"],
            daily_limit=row["daily_limit"], total_limit=row["total_limit"],
            enabled=True,
        ))
        changed = True
    if changed:
        db.commit()


def _rule_json(db: Session, row: models.SpiritRewardRule, user_id: str | None = None) -> dict:
    plant = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.id == row.plant_type_id).first() if row.plant_type_id else None
    result = {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "description": row.description or "",
        "category": row.category,
        "fruit_amount": row.fruit_amount,
        "plant_type_id": row.plant_type_id,
        "plant_name": plant.name if plant else "",
        "plant_quantity": row.plant_quantity,
        "claim_mode": row.claim_mode,
        "condition": row.condition or {},
        "enabled": bool(row.enabled),
        "daily_limit": row.daily_limit,
        "total_limit": row.total_limit,
        "cooldown_seconds": row.cooldown_seconds,
        "starts_at": _iso(row.starts_at),
        "ends_at": _iso(row.ends_at),
    }
    if user_id:
        now = _now()
        today = now.date().isoformat()
        if row.claim_mode == "daily":
            claim_key = today
        else:
            claim_key = "once"
        claimed = db.query(models.SpiritRewardClaim).filter(
            models.SpiritRewardClaim.rule_id == row.id,
            models.SpiritRewardClaim.user_id == user_id,
        ).order_by(models.SpiritRewardClaim.created_at.desc()).first()
        count_total = db.query(func.count(models.SpiritRewardClaim.id)).filter(
            models.SpiritRewardClaim.rule_id == row.id,
            models.SpiritRewardClaim.user_id == user_id,
        ).scalar() or 0
        count_today = db.query(func.count(models.SpiritRewardClaim.id)).filter(
            models.SpiritRewardClaim.rule_id == row.id,
            models.SpiritRewardClaim.user_id == user_id,
            models.SpiritRewardClaim.claim_key == today,
        ).scalar() or 0
        exact_claim = db.query(models.SpiritRewardClaim).filter(
            models.SpiritRewardClaim.rule_id == row.id,
            models.SpiritRewardClaim.user_id == user_id,
            models.SpiritRewardClaim.claim_key == claim_key,
        ).first()
        cooldown_until = None
        if claimed and row.cooldown_seconds:
            cooldown_until = claimed.created_at + timedelta(seconds=row.cooldown_seconds)
        result["claim_status"] = {
            "claimed": exact_claim is not None,
            "claimed_count": count_total,
            "claimed_today": count_today,
            "daily_remaining": max(0, row.daily_limit - count_today) if row.daily_limit else None,
            "total_remaining": max(0, row.total_limit - count_total) if row.total_limit else None,
            "cooldown_until": _iso(cooldown_until),
            "claim_key": claim_key,
            "last_claimed_at": _iso(claimed.created_at) if claimed else None,
        }
    return result


def _condition_ready(db: Session, user: models.AppUser, condition: dict) -> bool:
    kind = str((condition or {}).get("type") or "manual")
    if kind == "daily_checkin":
        return True
    if kind == "profile_complete":
        return bool((user.bio or "").strip() and (user.avatar or user.avatar_url))
    if kind == "has_work":
        return (db.query(func.count(models.CreativeWork.id)).filter(models.CreativeWork.owner_user_id == user.id).scalar() or 0) > 0
    if kind == "has_world":
        return (db.query(func.count(models.World.id)).filter(
            models.World.owner_id == user.id,
            models.World.deleted_at.is_(None),
        ).scalar() or 0) > 0
    if kind == "has_post":
        return (db.query(func.count(models.SocialPost.id)).filter(models.SocialPost.author_id == user.id).scalar() or 0) > 0
    if kind == "manual":
        return True
    return False


def _account_json(account: models.SpiritAccount) -> dict:
    return {
        "user_id": account.user_id,
        "fruit_balance": account.fruit_balance,
        "developer_exempt": bool(account.developer_exempt),
        "updated_at": _iso(account.updated_at),
    }


def _apply_reward(db: Session, user: models.AppUser, rule: models.SpiritRewardRule, claim_key: str) -> models.SpiritRewardClaim:
    now = _now()
    if not rule.enabled:
        raise HTTPException(status_code=409, detail="奖励规则未启用")
    if rule.starts_at and now < rule.starts_at:
        raise HTTPException(status_code=409, detail="奖励活动尚未开始")
    if rule.ends_at and now > rule.ends_at:
        raise HTTPException(status_code=409, detail="奖励活动已结束")
    if not _condition_ready(db, user, rule.condition or {}):
        raise HTTPException(status_code=409, detail="尚未满足领取条件")
    existing = db.query(models.SpiritRewardClaim).filter(
        models.SpiritRewardClaim.rule_id == rule.id,
        models.SpiritRewardClaim.user_id == user.id,
        models.SpiritRewardClaim.claim_key == claim_key,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="该奖励已领取")
    today = now.date().isoformat()
    total_count = db.query(func.count(models.SpiritRewardClaim.id)).filter(
        models.SpiritRewardClaim.rule_id == rule.id,
        models.SpiritRewardClaim.user_id == user.id,
    ).scalar() or 0
    if rule.total_limit and total_count >= rule.total_limit:
        raise HTTPException(status_code=409, detail="该奖励领取次数已达上限")
    today_count = db.query(func.count(models.SpiritRewardClaim.id)).filter(
        models.SpiritRewardClaim.rule_id == rule.id,
        models.SpiritRewardClaim.user_id == user.id,
        models.SpiritRewardClaim.claim_key == today,
    ).scalar() or 0
    if rule.daily_limit and today_count >= rule.daily_limit:
        raise HTTPException(status_code=409, detail="今日领取次数已达上限")
    if rule.cooldown_seconds:
        last = db.query(models.SpiritRewardClaim).filter(
            models.SpiritRewardClaim.rule_id == rule.id,
            models.SpiritRewardClaim.user_id == user.id,
        ).order_by(models.SpiritRewardClaim.created_at.desc()).first()
        if last and now < last.created_at + timedelta(seconds=rule.cooldown_seconds):
            raise HTTPException(status_code=429, detail="奖励领取冷却中")
    account = _ensure_account(db, user, commit=False)
    claim = models.SpiritRewardClaim(
        rule_id=rule.id, user_id=user.id, claim_key=claim_key,
        fruit_amount=rule.fruit_amount, plant_type_id=rule.plant_type_id,
        plant_quantity=rule.plant_quantity,
    )
    db.add(claim)
    if rule.fruit_amount:
        account.fruit_balance += rule.fruit_amount
        account.updated_at = now
        db.add(models.SpiritTransaction(
            user_id=user.id, kind="reward", fruit_amount=rule.fruit_amount,
            balance_after=account.fruit_balance, ref_type="reward", ref_id=rule.id,
            note=rule.name, meta={"rule_key": rule.key},
        ))
    if rule.plant_quantity and rule.plant_type_id:
        plant = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.id == rule.plant_type_id).first()
        if plant:
            inventory = db.query(models.SpiritInventory).filter(
                models.SpiritInventory.user_id == user.id,
                models.SpiritInventory.plant_type_id == plant.id,
            ).first()
            if not inventory:
                inventory = models.SpiritInventory(user_id=user.id, plant_type_id=plant.id, quantity=0)
                db.add(inventory)
            inventory.quantity += rule.plant_quantity
            inventory.updated_at = now
    db.commit()
    db.refresh(claim)
    return claim


def _ensure_not_duplicate_operation(db: Session, user_id: str, operation: str, key: str) -> None:
    existing = db.query(models.SpiritOperation).filter(
        models.SpiritOperation.user_id == user_id,
        models.SpiritOperation.operation == operation,
        models.SpiritOperation.idempotency_key == key,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="重复操作已处理，未重复扣除")


def consume_for_creation(
    db: Session, user: models.AppUser, *, action: str, plant_key: str,
    idempotency_key: str | None = None, ref_id: str | None = None,
) -> dict:
    """在创建实体前扣 1 株灵植；调用方负责最终 commit / rollback。"""
    ensure_spirit_catalog(db)
    key = (idempotency_key or "").strip()[:160] or uuid.uuid4().hex
    _ensure_not_duplicate_operation(db, user.id, action, key)
    plant = db.query(models.SpiritPlantType).filter(
        models.SpiritPlantType.key == plant_key,
        models.SpiritPlantType.is_active.is_(True),
    ).first()
    if not plant:
        raise HTTPException(status_code=404, detail="灵植类型不存在")
    account = _ensure_account(db, user, commit=False)
    exempt = bool(user.is_owner or account.developer_exempt)
    inventory = db.query(models.SpiritInventory).filter(
        models.SpiritInventory.user_id == user.id,
        models.SpiritInventory.plant_type_id == plant.id,
    ).first()
    if not exempt:
        if not inventory or inventory.quantity < 1:
            raise HTTPException(status_code=409, detail=f"{plant.name}库存不足，无法创建")
        inventory.quantity -= 1
        inventory.updated_at = _now()
    transaction = models.SpiritTransaction(
        user_id=user.id, kind="consume", fruit_amount=0,
        plant_type_id=plant.id, plant_quantity=(0 if exempt else -1),
        balance_after=account.fruit_balance, ref_type=action, ref_id=ref_id or "",
        note=("开发者豁免：" if exempt else "") + f"{action} 消耗 {plant.name}",
        meta={"exempt": exempt, "operation_key": key},
    )
    db.add(transaction)
    db.add(models.SpiritOperation(
        user_id=user.id, operation=action, idempotency_key=key,
        result={"plant_type_id": plant.id, "exempt": exempt, "ref_id": ref_id or ""},
    ))
    db.flush()
    return {"transaction_id": transaction.id, "plant_type_id": plant.id, "exempt": exempt, "key": key}


def consume_for_experience(
    db: Session, user: models.AppUser, *,
    publication: models.CommunityPublication,
    idempotency_key: str | None = None,
) -> dict:
    """用户确认后按作品配置扣除灵果并记录体验消耗；调用方负责最终 commit / rollback。

    仅当作品已发布、开放灵果体验且已配置消耗数量时执行。消耗数量为空表示尚未定价，
    不得默认收费。已授权用户重复请求幂等返回，不重复扣费。
    """
    ensure_spirit_catalog(db)
    if publication.status != "published":
        raise HTTPException(status_code=409, detail="作品未发布，无法体验")
    if not publication.experience_enabled:
        raise HTTPException(status_code=409, detail="该作品未开放灵果体验")
    fruit_amount = publication.experience_fruit
    if fruit_amount is None or int(fruit_amount) <= 0:
        raise HTTPException(status_code=409, detail="灵果体验尚未配置消耗数量")
    version = db.query(models.CommunityPublicationVersion).filter(
        models.CommunityPublicationVersion.id == publication.current_version_id
    ).first()
    if not version or not version.experience_snapshot:
        raise HTTPException(status_code=409, detail="该作品暂无灵果体验内容")
    key = (idempotency_key or "").strip()[:160] or uuid.uuid4().hex
    _ensure_not_duplicate_operation(db, user.id, "experience", key)
    grant = db.query(models.CommunityExperienceGrant).filter(
        models.CommunityExperienceGrant.publication_id == publication.id,
        models.CommunityExperienceGrant.user_id == user.id,
    ).first()
    if grant:
        return {"granted": True, "transaction_id": grant.transaction_id, "fruit_amount": 0, "balance_after": None, "exempt": True, "key": key}
    account = _ensure_account(db, user, commit=False)
    exempt = bool(user.is_owner or account.developer_exempt)
    amount = 0 if exempt else int(fruit_amount)
    if not exempt and account.fruit_balance < amount:
        raise HTTPException(status_code=409, detail="灵果余额不足，无法体验")
    if not exempt:
        account.fruit_balance -= amount
        account.updated_at = _now()
    transaction = models.SpiritTransaction(
        user_id=user.id, kind="experience", fruit_amount=-amount,
        balance_after=account.fruit_balance, ref_type="publication",
        ref_id=publication.id,
        note=("开发者豁免：" if exempt else "") + f"灵果体验《{publication.title}》",
        meta={"exempt": exempt, "operation_key": key, "fruit_amount": int(fruit_amount)},
    )
    db.add(transaction)
    db.add(models.CommunityExperienceGrant(
        publication_id=publication.id, user_id=user.id,
        fruit_amount=amount, transaction_id=transaction.id,
    ))
    db.add(models.SpiritOperation(
        user_id=user.id, operation="experience", idempotency_key=key,
        result={"publication_id": publication.id, "exempt": exempt, "fruit_amount": amount},
    ))
    db.flush()
    return {
        "granted": True,
        "transaction_id": transaction.id,
        "fruit_amount": amount,
        "balance_after": account.fruit_balance,
        "exempt": exempt,
        "key": key,
    }


def _ensure_account(db: Session, user: models.AppUser, starter: bool = True, commit: bool = True) -> models.SpiritAccount:
    account = db.query(models.SpiritAccount).filter(models.SpiritAccount.user_id == user.id).first()
    if account:
        return account
    rule = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == "registration_bonus").first()
    bonus = STARTER_FRUIT
    if rule is not None:
        bonus = max(0, int(rule.fruit_amount)) if rule.enabled else 0
    account = models.SpiritAccount(
        user_id=user.id,
        fruit_balance=bonus if starter else 0,
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
            note="注册奖励" if rule is not None else "初始灵果",
            ref_type="reward" if rule is not None else "account",
            ref_id=rule.id if rule is not None else "starter",
        ))
        if rule is not None:
            # 账号被清理后重建时，旧的领取记录可能仍在；重复插入会触发唯一约束。
            existing_claim = db.query(models.SpiritRewardClaim).filter(
                models.SpiritRewardClaim.rule_id == rule.id,
                models.SpiritRewardClaim.user_id == user.id,
                models.SpiritRewardClaim.claim_key == "registration",
            ).first()
            if existing_claim is None:
                db.add(models.SpiritRewardClaim(
                    rule_id=rule.id, user_id=user.id, claim_key="registration",
                    fruit_amount=account.fruit_balance,
                ))
    if starter:
        # 新账户赠送 1 株世界灵植，直接进入世界灵植库存；不扣除灵果。
        world_plant = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == "world_seed").first()
        if world_plant:
            db.add(models.SpiritInventory(user_id=user.id, plant_type_id=world_plant.id, quantity=1))
            db.add(models.SpiritTransaction(
                user_id=user.id, kind="reward", fruit_amount=0,
                plant_type_id=world_plant.id, plant_quantity=1,
                balance_after=account.fruit_balance,
                note="新账户世界灵植", ref_type="account", ref_id="starter_plant",
            ))
    if commit:
        db.commit()
        db.refresh(account)
    else:
        db.flush()
    return account


def grant_invite_rewards(db: Session, invite: models.InviteCode, user_id: str) -> dict:
    """D3：注册成功后按邀请码发放邀请人/被邀请人奖励；同一兑换只发一次。"""
    redemption = db.query(models.InviteRedemption).filter(
        models.InviteRedemption.invite_id == invite.id,
        models.InviteRedemption.user_id == user_id,
    ).first()
    if not redemption or redemption.reward_granted_at is not None:
        return {"granted": False}
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        return {"granted": False}
    now = _now()
    granted = {"granted": True, "fruit": 0, "plant_quantity": 0, "inviter_fruit": 0}
    account = _ensure_account(db, user, commit=False)
    if invite.reward_fruit:
        account.fruit_balance += int(invite.reward_fruit)
        account.updated_at = now
        granted["fruit"] = int(invite.reward_fruit)
        db.add(models.SpiritTransaction(
            user_id=user.id, kind="reward", fruit_amount=int(invite.reward_fruit),
            balance_after=account.fruit_balance, ref_type="invite", ref_id=invite.id,
            note="邀请码注册奖励", meta={"invite_kind": invite.kind, "batch": invite.batch},
        ))
    if invite.reward_plant_quantity and invite.reward_plant_type_id:
        plant = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.id == invite.reward_plant_type_id).first()
        if plant:
            inventory = db.query(models.SpiritInventory).filter(
                models.SpiritInventory.user_id == user.id,
                models.SpiritInventory.plant_type_id == plant.id,
            ).first()
            if not inventory:
                inventory = models.SpiritInventory(user_id=user.id, plant_type_id=plant.id, quantity=0)
                db.add(inventory)
            inventory.quantity += int(invite.reward_plant_quantity)
            inventory.updated_at = now
            granted["plant_quantity"] = int(invite.reward_plant_quantity)
            db.add(models.SpiritTransaction(
                user_id=user.id, kind="reward", fruit_amount=0,
                plant_type_id=plant.id, plant_quantity=int(invite.reward_plant_quantity),
                balance_after=account.fruit_balance, ref_type="invite", ref_id=invite.id,
                note="邀请码灵植奖励", meta={"invite_kind": invite.kind, "batch": invite.batch},
            ))
    if invite.inviter_reward_fruit and invite.created_by and invite.created_by != user.id:
        inviter = db.query(models.AppUser).filter(models.AppUser.id == invite.created_by).first()
        if inviter and inviter.is_active:
            inviter_account = _ensure_account(db, inviter, commit=False)
            inviter_account.fruit_balance += int(invite.inviter_reward_fruit)
            inviter_account.updated_at = now
            granted["inviter_fruit"] = int(invite.inviter_reward_fruit)
            db.add(models.SpiritTransaction(
                user_id=inviter.id, kind="reward", fruit_amount=int(invite.inviter_reward_fruit),
                balance_after=inviter_account.fruit_balance, counterparty_user_id=user.id,
                ref_type="invite", ref_id=invite.id,
                note="邀请新用户奖励", meta={"invite_kind": invite.kind, "batch": invite.batch},
            ))
    redemption.reward_fruit = int(invite.reward_fruit)
    redemption.reward_granted_at = now
    db.flush()
    return granted


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
        "expires_at": _iso(row.expires_at),
        "is_expired": bool(row.expires_at and row.expires_at <= _now()),
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
    if plant.expires_at and plant.expires_at <= _now():
        raise HTTPException(status_code=409, detail="该活动灵植已截止，无法兑换")
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


def _owner(request: Request, db: Session) -> models.AppUser:
    user = _user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅站长可以管理经济后台")
    return user


def _rule_admin_json(db: Session, row: models.SpiritRewardRule) -> dict:
    data = _rule_json(db, row)
    data["sort_order"] = row.id
    return data


@router.get("/api/spirit/rewards")
def spirit_rewards(request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    ensure_reward_rules(db)
    rows = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key != "registration_bonus").order_by(models.SpiritRewardRule.created_at.asc()).all()
    items = []
    for row in rows:
        data = _rule_json(db, row, user.id)
        data["condition_ready"] = _condition_ready(db, user, row.condition or {})
        data["can_claim"] = bool(
            row.enabled and data["condition_ready"]
            and not data["claim_status"]["claimed"]
            and (not row.daily_limit or data["claim_status"]["claimed_today"] < row.daily_limit)
            and (not row.total_limit or data["claim_status"]["claimed_count"] < row.total_limit)
        )
        items.append(data)
    return {"items": items}


@router.post("/api/spirit/rewards/{key}/claim")
def claim_spirit_reward(key: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    ensure_reward_rules(db)
    rule = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == key).first()
    if not rule:
        raise HTTPException(status_code=404, detail="奖励规则不存在")
    if rule.claim_mode == "daily":
        claim_key = _now().date().isoformat()
    elif rule.claim_mode == "event":
        claim_key = str(payload.get("claim_key") or "").strip()[:120]
        if not claim_key:
            raise HTTPException(status_code=422, detail="活动奖励需要 claim_key")
    else:
        claim_key = "once"
    claim = _apply_reward(db, user, rule, claim_key)
    account = _ensure_account(db, user)
    return {
        "status": "ok",
        "claim": {
            "id": claim.id,
            "rule_key": rule.key,
            "fruit_amount": claim.fruit_amount,
            "plant_quantity": claim.plant_quantity,
            "claim_key": claim.claim_key,
            "created_at": _iso(claim.created_at),
        },
        "account": _account_json(account),
        "rule": _rule_json(db, rule, user.id),
    }


@router.post("/api/spirit/consume")
def consume_spirit(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _user(request, db)
    action = str(payload.get("action") or "").strip()
    if action not in {"world_create", "oc_create", "manual"}:
        raise HTTPException(status_code=422, detail="不支持的消耗动作")
    plant_key = str(payload.get("plant_key") or ("world_seed" if action == "world_create" else "oc_seed")).strip()
    result = consume_for_creation(
        db, user, action=action, plant_key=plant_key,
        idempotency_key=str(payload.get("idempotency_key") or ""),
        ref_id=str(payload.get("ref_id") or ""),
    )
    db.commit()
    account = _ensure_account(db, user)
    return {"status": "ok", **result, "account": _account_json(account)}


@router.get("/api/spirit/admin/overview")
def spirit_admin_overview(q: str = "", request: Request = None, db: Session = Depends(get_db)):
    _owner(request, db)
    ensure_spirit_catalog(db)
    ensure_reward_rules(db)
    query = db.query(models.SpiritAccount, models.AppUser).join(
        models.AppUser, models.AppUser.id == models.SpiritAccount.user_id
    )
    text = q.strip()
    if text:
        query = query.filter(or_(
            models.AppUser.username.ilike(f"%{text}%"),
            models.AppUser.display_name.ilike(f"%{text}%"),
        ))
    rows = query.order_by(models.SpiritAccount.fruit_balance.desc()).limit(50).all()
    accounts = [
        {
            "user_id": account.user_id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "fruit_balance": account.fruit_balance,
            "developer_exempt": bool(account.developer_exempt),
            "is_owner": bool(user.is_owner),
            "updated_at": _iso(account.updated_at),
        }
        for account, user in rows
    ]
    rules = [_rule_json(db, row) for row in db.query(models.SpiritRewardRule).order_by(models.SpiritRewardRule.created_at.asc()).all()]
    plants = [_plant_json(row) for row in db.query(models.SpiritPlantType).order_by(models.SpiritPlantType.sort_order.asc()).all()]
    transactions = [
        _transaction_json(row) for row in db.query(models.SpiritTransaction)
        .order_by(models.SpiritTransaction.created_at.desc()).limit(30).all()
    ]
    return {"accounts": accounts, "rules": rules, "plants": plants, "transactions": transactions}


@router.get("/api/admin/user-activity")
def admin_user_activity(q: str = "", request: Request = None, db: Session = Depends(get_db)):
    """站长可见：所有用户的参与活跃概览（登录会话、动态、评论、作品、互动）。"""
    _owner(request, db)
    return {"items": user_activity_overview(db, q)}


@router.post("/api/spirit/admin/rewards")
def create_reward_rule(payload: dict, request: Request, db: Session = Depends(get_db)):
    _owner(request, db)
    key = str(payload.get("key") or "").strip().lower()
    if not key or len(key) > 60 or not key.replace("_", "").isalnum():
        raise HTTPException(status_code=422, detail="规则 key 只能包含字母、数字和下划线")
    if db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.key == key).first():
        raise HTTPException(status_code=409, detail="规则 key 已存在")
    condition = payload.get("condition") or {"type": "manual"}
    if str(condition.get("type") or "") not in ALLOWED_CONDITIONS:
        raise HTTPException(status_code=422, detail="不支持的领取条件")
    claim_mode = str(payload.get("claim_mode") or "once")
    if claim_mode not in {"once", "daily", "event"}:
        raise HTTPException(status_code=422, detail="不支持的领取模式")
    row = models.SpiritRewardRule(
        key=key,
        name=str(payload.get("name") or key)[:120],
        description=str(payload.get("description") or "")[:500],
        category=str(payload.get("category") or "event")[:40],
        fruit_amount=max(0, int(payload.get("fruit_amount") or 0)),
        plant_type_id=str(payload.get("plant_type_id") or "") or None,
        plant_quantity=max(0, int(payload.get("plant_quantity") or 0)),
        claim_mode=claim_mode,
        condition=condition,
        enabled=bool(payload.get("enabled", True)),
        daily_limit=max(0, int(payload.get("daily_limit") or 0)),
        total_limit=max(0, int(payload.get("total_limit") or 0)),
        cooldown_seconds=max(0, int(payload.get("cooldown_seconds") or 0)),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _rule_json(db, row)


@router.patch("/api/spirit/admin/rewards/{rule_id}")
def update_reward_rule(rule_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    _owner(request, db)
    row = db.query(models.SpiritRewardRule).filter(models.SpiritRewardRule.id == rule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="奖励规则不存在")
    if "name" in payload:
        row.name = str(payload.get("name") or row.name)[:120]
    if "description" in payload:
        row.description = str(payload.get("description") or "")[:500]
    if "category" in payload:
        row.category = str(payload.get("category") or row.category)[:40]
    if "fruit_amount" in payload:
        row.fruit_amount = max(0, int(payload.get("fruit_amount") or 0))
    if "plant_type_id" in payload:
        row.plant_type_id = str(payload.get("plant_type_id") or "") or None
    if "plant_quantity" in payload:
        row.plant_quantity = max(0, int(payload.get("plant_quantity") or 0))
    if "claim_mode" in payload:
        mode = str(payload.get("claim_mode") or row.claim_mode)
        if mode not in {"once", "daily", "event"}:
            raise HTTPException(status_code=422, detail="不支持的领取模式")
        row.claim_mode = mode
    if "condition" in payload:
        condition = payload.get("condition") or {"type": "manual"}
        if str(condition.get("type") or "") not in ALLOWED_CONDITIONS:
            raise HTTPException(status_code=422, detail="不支持的领取条件")
        row.condition = condition
    if "enabled" in payload:
        row.enabled = bool(payload.get("enabled"))
    if "daily_limit" in payload:
        row.daily_limit = max(0, int(payload.get("daily_limit") or 0))
    if "total_limit" in payload:
        row.total_limit = max(0, int(payload.get("total_limit") or 0))
    if "cooldown_seconds" in payload:
        row.cooldown_seconds = max(0, int(payload.get("cooldown_seconds") or 0))
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _rule_json(db, row)


@router.post("/api/spirit/admin/plants")
def create_spirit_plant(payload: dict, request: Request, db: Session = Depends(get_db)):
    _owner(request, db)
    key = str(payload.get("key") or "").strip().lower()
    if not key or len(key) > 50 or not key.replace("_", "").isalnum():
        raise HTTPException(status_code=422, detail="灵植 key 只能包含字母、数字和下划线")
    if db.query(models.SpiritPlantType).filter(models.SpiritPlantType.key == key).first():
        raise HTTPException(status_code=409, detail="灵植 key 已存在")
    category = str(payload.get("category") or "world").strip()
    if category not in {"world", "oc"}:
        raise HTTPException(status_code=422, detail="灵植分类只能是 world/oc")
    try:
        price = int(payload.get("price_fruit") or 60)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="兑换价格必须是整数")
    if price < 1 or price > 100000:
        raise HTTPException(status_code=422, detail="兑换价格超出允许范围")
    row = models.SpiritPlantType(
        key=key, name=str(payload.get("name") or key)[:80],
        category=category, description=str(payload.get("description") or "")[:500],
        price_fruit=price, unit=str(payload.get("unit") or "株")[:20],
        sort_order=int(payload.get("sort_order") or 100), is_active=True,
        expires_at=_parse_expiry(payload.get("expires_at")),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _plant_json(row)


@router.patch("/api/spirit/admin/plants/{plant_id}")
def update_spirit_plant(plant_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    _owner(request, db)
    row = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.id == plant_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="灵植类型不存在")
    if "name" in payload:
        row.name = str(payload.get("name") or row.name)[:80]
    if "description" in payload:
        row.description = str(payload.get("description") or "")[:500]
    if "price_fruit" in payload:
        price = int(payload.get("price_fruit") or 0)
        if price < 1 or price > 100000:
            raise HTTPException(status_code=422, detail="兑换价格超出允许范围")
        row.price_fruit = price
    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))
    if "expires_at" in payload:
        row.expires_at = _parse_expiry(payload.get("expires_at"))
    row.updated_at = _now()
    db.commit()
    db.refresh(row)
    return _plant_json(row)


@router.get("/api/spirit/admin/transactions")
def spirit_admin_transactions(
    user_id: str = "", kind: str = "", limit: int = 100,
    request: Request = None, db: Session = Depends(get_db),
):
    _owner(request, db)
    query = db.query(models.SpiritTransaction)
    if user_id.strip():
        query = query.filter(models.SpiritTransaction.user_id == user_id.strip())
    if kind.strip():
        query = query.filter(models.SpiritTransaction.kind == kind.strip())
    rows = query.order_by(models.SpiritTransaction.created_at.desc()).limit(max(1, min(500, limit))).all()
    return {"items": [_transaction_json(row) for row in rows]}


@router.get("/api/spirit/admin/claims")
def spirit_admin_claims(limit: int = 100, request: Request = None, db: Session = Depends(get_db)):
    _owner(request, db)
    rows = db.query(models.SpiritRewardClaim, models.SpiritRewardRule).join(
        models.SpiritRewardRule, models.SpiritRewardRule.id == models.SpiritRewardClaim.rule_id
    ).order_by(models.SpiritRewardClaim.created_at.desc()).limit(max(1, min(500, limit))).all()
    return {"items": [
        {
            "id": claim.id, "rule_key": rule.key, "rule_name": rule.name,
            "user_id": claim.user_id, "fruit_amount": claim.fruit_amount,
            "plant_quantity": claim.plant_quantity, "claim_key": claim.claim_key,
            "created_at": _iso(claim.created_at),
        }
        for claim, rule in rows
    ]}
