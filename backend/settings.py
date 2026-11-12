"""设置中心：个人资料扩展、偏好、隐私、通知、安全、数据与关于。"""

from __future__ import annotations

import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import _bearer, _token_hash, current_user
from database import engine, get_db

router = APIRouter(tags=["settings"])

DEFAULT_PREFERENCES = {
    "language": "zh",
    "theme": "system",
    "density": "comfortable",
    "font_size": "medium",
    "reduce_motion": False,
    "show_tips": True,
    "auto_save": True,
}

DEFAULT_PRIVACY = {
    "public_profile": True,
    "show_activity": True,
    "allow_follow": True,
    "allow_friend_requests": True,
    "allow_group_invites": True,
    "allow_ai_private_context": False,
}

DEFAULT_NOTIFICATIONS = {
    "community_reply": True,
    "friend_request": True,
    "follow": True,
    "group_activity": True,
    "system": True,
    "weekly_digest": False,
}

_ENUMS = {
    "language": {"zh", "en"},
    "theme": {"system", "light", "dark"},
    "density": {"compact", "comfortable", "spacious"},
    "font_size": {"small", "medium", "large"},
}
_BOOL_KEYS = {
    "preferences": {"reduce_motion", "show_tips", "auto_save"},
    "privacy": set(DEFAULT_PRIVACY),
    "notifications": set(DEFAULT_NOTIFICATIONS),
}


def _merge(default: dict, value) -> dict:
    out = dict(default)
    if isinstance(value, dict):
        for key in default:
            if key in value:
                out[key] = value[key]
    return out


def _settings(db: Session, user: models.AppUser) -> models.UserSettings:
    row = db.query(models.UserSettings).filter(models.UserSettings.user_id == user.id).first()
    if not row:
        row = models.UserSettings(
            user_id=user.id,
            preferences=dict(DEFAULT_PREFERENCES),
            privacy=dict(DEFAULT_PRIVACY),
            notifications=dict(DEFAULT_NOTIFICATIONS),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _clean_section(name: str, raw) -> dict:
    if not isinstance(raw, dict):
        raise HTTPException(status_code=422, detail=f"{name} 必须是对象")
    defaults = {
        "preferences": DEFAULT_PREFERENCES,
        "privacy": DEFAULT_PRIVACY,
        "notifications": DEFAULT_NOTIFICATIONS,
    }[name]
    out = {}
    for key in defaults:
        if key not in raw:
            continue
        value = raw[key]
        if key in _ENUMS:
            if value not in _ENUMS[key]:
                raise HTTPException(status_code=422, detail=f"{key} 取值无效")
            out[key] = value
        elif key in _BOOL_KEYS[name]:
            if not isinstance(value, bool):
                raise HTTPException(status_code=422, detail=f"{key} 必须是布尔值")
            out[key] = value
    return out


def _iso(value):
    return value.isoformat() if value else None


def _profile(user: models.AppUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name or user.username,
        "bio": user.bio or "",
        "avatar": user.avatar or "",
        "is_owner": bool(user.is_owner),
        "created_at": _iso(user.created_at),
    }


def _owned_world_ids(db: Session, user: models.AppUser) -> list[str]:
    rows = db.query(models.World.id).filter(
        models.World.owner_id == user.id, models.World.deleted_at.is_(None)
    ).all()
    return [row[0] for row in rows]


def _stats(db: Session, user: models.AppUser) -> dict:
    world_ids = _owned_world_ids(db, user)
    def count(model, *conditions):
        query = db.query(model)
        if conditions:
            query = query.filter(*conditions)
        return query.count()
    characters = count(models.Character, or_(
        models.Character.owner_user_id == user.id,
        models.Character.world_id.in_(world_ids) if world_ids else False,
    ))
    events = count(models.Event, models.Event.world_id.in_(world_ids)) if world_ids else 0
    return {
        "worlds": len(world_ids),
        "characters": characters,
        "events": events,
        "stories": count(models.Story, models.Story.owner_user_id == user.id),
        "journal_entries": count(models.DiaryEntry, models.DiaryEntry.owner_user_id == user.id),
        "publications": count(models.CommunityPublication, models.CommunityPublication.owner_user_id == user.id),
        "personas": count(models.PersonalPersona, models.PersonalPersona.owner_user_id == user.id),
        "memories": count(models.PersonaMemory, models.PersonaMemory.owner_user_id == user.id),
        "sessions": count(models.AuthSession, models.AuthSession.user_id == user.id),
    }


def _database_size() -> int:
    path = engine.url.database
    if not path or path == ":memory:":
        return 0
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


@router.get("/api/settings")
def get_settings(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _settings(db, user)
    return {
        "profile": _profile(user),
        "preferences": _merge(DEFAULT_PREFERENCES, row.preferences),
        "privacy": _merge(DEFAULT_PRIVACY, row.privacy),
        "notifications": _merge(DEFAULT_NOTIFICATIONS, row.notifications),
        "account": {
            "is_owner": bool(user.is_owner),
            "created_at": _iso(user.created_at),
            "sessions": db.query(models.AuthSession).filter(models.AuthSession.user_id == user.id).count(),
        },
        "stats": _stats(db, user),
        "storage": {"database_bytes": _database_size()},
    }


@router.patch("/api/settings")
def update_settings(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _settings(db, user)
    changed = False
    for name in ("preferences", "privacy", "notifications"):
        if name not in payload:
            continue
        cleaned = _clean_section(name, payload[name])
        current = _merge({
            "preferences": DEFAULT_PREFERENCES,
            "privacy": DEFAULT_PRIVACY,
            "notifications": DEFAULT_NOTIFICATIONS,
        }[name], getattr(row, name))
        current.update(cleaned)
        setattr(row, name, current)
        changed = True
    if changed:
        row.updated_at = datetime.utcnow()
        db.commit()
    return get_settings(request, db)


@router.get("/api/settings/sessions")
def list_sessions(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    token = _bearer(request)
    current_hash = _token_hash(token) if token else ""
    rows = db.query(models.AuthSession).filter(
        models.AuthSession.user_id == user.id
    ).order_by(models.AuthSession.created_at.desc()).all()
    return [{
        "id": row.id,
        "created_at": _iso(row.created_at),
        "expires_at": _iso(row.expires_at),
        "current": row.token_hash == current_hash,
    } for row in rows]


@router.delete("/api/settings/sessions/{session_id}")
def revoke_session(session_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AuthSession).filter(
        models.AuthSession.id == session_id,
        models.AuthSession.user_id == user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    token = _bearer(request)
    if row.token_hash == (_token_hash(token) if token else ""):
        raise HTTPException(status_code=409, detail="不能在这里退出当前会话")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/settings/export")
def export_data(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = _settings(db, user)
    worlds = db.query(models.World).filter(
        models.World.owner_id == user.id, models.World.deleted_at.is_(None)
    ).all()
    stories = db.query(models.Story).filter(
        models.Story.owner_user_id == user.id, models.Story.archived_at.is_(None)
    ).all()
    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "profile": _profile(user),
        "preferences": _merge(DEFAULT_PREFERENCES, row.preferences),
        "privacy": _merge(DEFAULT_PRIVACY, row.privacy),
        "notifications": _merge(DEFAULT_NOTIFICATIONS, row.notifications),
        "stats": _stats(db, user),
        "worlds": [{"id": item.id, "name": item.name, "product_scene": item.product_scene, "created_at": item.createdAt} for item in worlds],
        "stories": [{"id": item.id, "title": item.title, "status": item.status, "updated_at": _iso(item.updated_at)} for item in stories],
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    return {"filename": f"world-simulator-export-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json", "content": body}


@router.get("/api/settings/about")
def about():
    return {
        "name": "世界模拟器",
        "version": "1.0.0",
        "api_version": "1.1.0",
        "description": "游戏、文学、日记与云宝工作台一体化的世界创作系统。",
        "docs": [
            {"title": "产品与权限", "href": "/docs/PHASE-N1-云宝独立工作台迁移报告.md"},
            {"title": "设置与账户", "href": "/docs/settings-and-community.md"},
        ],
        "support": "本地工作区由开发者维护；数据保存在本机 SQLite。",
    }
