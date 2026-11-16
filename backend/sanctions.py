"""平台治理动作：警告、禁言、封禁、申诉与撤销。"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter()
ACTIONS = {"warning", "mute", "ban"}
DEFAULT_HOURS = {"mute": 24, "ban": 72}


def active_sanction(db: Session, user_id: str, action: str | None = None) -> models.UserSanction | None:
    now = datetime.utcnow()
    query = db.query(models.UserSanction).filter(
        models.UserSanction.user_id == user_id,
        models.UserSanction.revoked_at.is_(None),
        models.UserSanction.starts_at <= now,
        or_(models.UserSanction.expires_at.is_(None), models.UserSanction.expires_at > now),
    )
    if action:
        query = query.filter(models.UserSanction.action == action)
    return query.order_by(models.UserSanction.created_at.desc()).first()


def target_author_id(db: Session, target_type: str, target_id: str) -> str | None:
    mapping = {
        "post": (models.SocialPost, "author_id"),
        "comment": (models.SocialPostComment, "author_id"),
        "topic": (models.CommunityTopic, "owner_user_id"),
        "work": (models.CreativeWork, "owner_user_id"),
        "message": (models.DirectMessage, "sender_id"),
        "user": (models.AppUser, "id"),
    }
    if target_type not in mapping:
        return None
    model, field = mapping[target_type]
    row = db.query(model).filter(model.id == target_id).first()
    return getattr(row, field, None) if row else None


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else None


def _row(row: models.UserSanction, db: Session):
    target = db.query(models.AppUser).filter(models.AppUser.id == row.user_id).first()
    actor = db.query(models.AppUser).filter(models.AppUser.id == row.created_by).first()
    return {
        "id": row.id,
        "user_id": row.user_id,
        "user_name": (target.display_name or target.username) if target else row.user_id,
        "action": row.action,
        "reason": row.reason or "",
        "report_id": row.report_id or "",
        "created_by": row.created_by,
        "created_by_name": (actor.display_name or actor.username) if actor else row.created_by,
        "starts_at": _iso(row.starts_at),
        "expires_at": _iso(row.expires_at),
        "revoked_at": _iso(row.revoked_at),
        "revoked_by": row.revoked_by or "",
        "revoke_note": row.revoke_note or "",
        "appeal_note": row.appeal_note or "",
        "appealed_at": _iso(row.appealed_at),
        "active": row.revoked_at is None and (row.expires_at is None or row.expires_at > datetime.utcnow()),
        "created_at": _iso(row.created_at),
    }


def _notify(db: Session, user_id: str, sanction: models.UserSanction):
    label = {"warning": "平台警告", "mute": "账号禁言", "ban": "账号封禁"}[sanction.action]
    body = sanction.reason or label
    if sanction.expires_at:
        body += f"\n解除时间：{sanction.expires_at.strftime('%Y-%m-%d %H:%M')} UTC"
    db.add(models.CommunityNotification(
        user_id=user_id,
        type="moderation",
        actor_id=sanction.created_by,
        object_type="sanction",
        object_id=sanction.id,
        title=label,
        body=body,
    ))


def _create(db: Session, user_id: str, action: str, reason: str, actor_id: str, hours: int | None, report_id: str = ""):
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail="治理动作无效")
    target = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="目标用户不存在")
    if target.is_owner:
        raise HTTPException(status_code=400, detail="不能处置开发者账号")
    if action in {"mute", "ban"}:
        existing = active_sanction(db, user_id, action)
        if existing:
            raise HTTPException(status_code=409, detail="该用户已有同类生效中的处置")
    duration = hours if hours and hours > 0 else (None if action == "warning" else DEFAULT_HOURS[action])
    now = datetime.utcnow()
    row = models.UserSanction(
        user_id=user_id,
        action=action,
        reason=reason[:2000],
        report_id=report_id,
        created_by=actor_id,
        starts_at=now,
        expires_at=None if not duration else now + timedelta(hours=min(duration, 24 * 365)),
    )
    db.add(row)
    db.flush()
    _notify(db, user_id, row)
    if report_id:
        report = db.query(models.ContentReport).filter(models.ContentReport.id == report_id).first()
        if report:
            report.status = "resolved"
            report.resolver_id = actor_id
            report.resolution_note = f"已处置：{action}；{reason}"[:2000]
            report.resolved_at = now
    db.commit()
    db.refresh(row)
    return row


@router.post("/api/admin/reports/{report_id}/sanction")
def sanction_from_report(report_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    actor = current_user(request, db)
    if not actor.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可执行治理动作")
    report = db.query(models.ContentReport).filter(models.ContentReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="举报不存在")
    author_id = target_author_id(db, report.target_type, report.target_id)
    if not author_id:
        raise HTTPException(status_code=422, detail="无法确定被举报内容的作者")
    action = str(payload.get("action") or "warning").strip()
    reason = str(payload.get("reason") or report.detail or report.reason).strip()[:2000]
    hours = payload.get("hours")
    try:
        hours = int(hours) if hours not in (None, "") else None
    except (TypeError, ValueError):
        hours = None
    row = _create(db, author_id, action, reason, actor.id, hours, report.id)
    return _row(row, db)


@router.post("/api/admin/users/{user_id}/sanctions")
def create_user_sanction(user_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    actor = current_user(request, db)
    if not actor.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可执行治理动作")
    action = str(payload.get("action") or "warning").strip()
    reason = str(payload.get("reason") or "").strip()[:2000]
    if not reason:
        raise HTTPException(status_code=422, detail="请填写处置原因")
    hours = payload.get("hours")
    try:
        hours = int(hours) if hours not in (None, "") else None
    except (TypeError, ValueError):
        hours = None
    row = _create(db, user_id, action, reason, actor.id, hours)
    return _row(row, db)


@router.get("/api/admin/sanctions")
def list_sanctions(
    request: Request,
    active: bool = Query(False),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    actor = current_user(request, db)
    if not actor.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可查看治理记录")
    query = db.query(models.UserSanction)
    if active:
        now = datetime.utcnow()
        query = query.filter(
            models.UserSanction.revoked_at.is_(None),
            models.UserSanction.starts_at <= now,
            or_(models.UserSanction.expires_at.is_(None), models.UserSanction.expires_at > now),
        )
    rows = query.order_by(models.UserSanction.created_at.desc()).limit(limit).all()
    return {"items": [_row(row, db) for row in rows]}


@router.post("/api/admin/sanctions/{sanction_id}/revoke")
def revoke_sanction(sanction_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    actor = current_user(request, db)
    if not actor.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可撤销治理动作")
    row = db.query(models.UserSanction).filter(models.UserSanction.id == sanction_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="处置记录不存在")
    if row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        row.revoked_by = actor.id
        row.revoke_note = str(payload.get("note") or "").strip()[:2000]
        db.add(models.CommunityNotification(
            user_id=row.user_id,
            type="moderation",
            actor_id=actor.id,
            object_type="sanction",
            object_id=row.id,
            title="平台处置已撤销",
            body=row.revoke_note or "你的账号限制已解除。",
        ))
        db.commit()
        db.refresh(row)
    return _row(row, db)


@router.get("/api/account/sanctions")
def my_sanctions(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    rows = db.query(models.UserSanction).filter(models.UserSanction.user_id == user.id).order_by(models.UserSanction.created_at.desc()).limit(100).all()
    return {"items": [_row(row, db) for row in rows], "active": [ _row(row, db) for row in rows if row.revoked_at is None and (row.expires_at is None or row.expires_at > datetime.utcnow()) ]}


@router.post("/api/account/sanctions/{sanction_id}/appeal")
def appeal_sanction(sanction_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.UserSanction).filter(models.UserSanction.id == sanction_id, models.UserSanction.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="处置记录不存在")
    if row.appealed_at:
        raise HTTPException(status_code=409, detail="该处置已经提交过申诉")
    row.appeal_note = str(payload.get("note") or "").strip()[:2000]
    row.appealed_at = datetime.utcnow()
    db.add(models.CommunityNotification(
        user_id=row.created_by,
        type="moderation_appeal",
        actor_id=user.id,
        object_type="sanction",
        object_id=row.id,
        title="收到治理申诉",
        body=f"{user.display_name or user.username} 对 {row.action} 处置提交了申诉。",
    ))
    db.commit()
    db.refresh(row)
    return _row(row, db)
