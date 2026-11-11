"""I2 本地账号口令锁：密码哈希、会话 token、全局请求鉴权。"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import models
from database import SessionLocal, get_db
from users import LOCAL_USER_ID, ensure_local_user

router = APIRouter(tags=["auth"])

SESSION_DAYS = 30
PBKDF2_ITERATIONS = 210_000
PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/status",
    "/api/auth/setup",
    "/api/auth/login",
}


def auth_disabled() -> bool:
    return os.getenv("WS_AUTH_DISABLED", "").strip().lower() in {"1", "true", "yes"}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algorithm, iterations, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_session(db: Session, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    db.add(
        models.AuthSession(
            user_id=user_id,
            token_hash=_token_hash(token),
            expires_at=datetime.utcnow() + timedelta(days=SESSION_DAYS),
        )
    )
    db.commit()
    return token


def user_from_token(db: Session, token: str) -> models.AppUser | None:
    if not token:
        return None
    row = db.query(models.AuthSession).filter(
        models.AuthSession.token_hash == _token_hash(token),
        models.AuthSession.expires_at > datetime.utcnow(),
    ).first()
    if not row:
        return None
    user = db.query(models.AppUser).filter(models.AppUser.id == row.user_id).first()
    if not user or not user.is_active:
        return None
    return user


def _bearer(request: Request) -> str:
    value = request.headers.get("authorization", "")
    return value[7:].strip() if value.lower().startswith("bearer ") else ""


def current_user(request: Request, db: Session = Depends(get_db)) -> models.AppUser:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
        if user:
            return user
    if auth_disabled():
        return ensure_local_user(db)
    raise HTTPException(status_code=401, detail="请先登录")


async def auth_middleware(request: Request, call_next):
    """所有 /api/* 默认必须登录；仅健康检查与登录/初始化公开。"""
    path = request.url.path
    if request.method == "OPTIONS" or not path.startswith("/api/") or path in PUBLIC_PATHS:
        return await call_next(request)
    if auth_disabled():
        request.state.user_id = LOCAL_USER_ID
        return await call_next(request)

    token = _bearer(request)
    db = SessionLocal()
    try:
        user = user_from_token(db, token)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "登录已失效，请重新登录"})
        request.state.user_id = user.id
    finally:
        db.close()
    return await call_next(request)


def _row(user: models.AppUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/api/auth/status")
def auth_status(request: Request, db: Session = Depends(get_db)):
    local = ensure_local_user(db)
    user = user_from_token(db, _bearer(request))
    return {
        "setup_required": not bool(local.password_hash),
        "authenticated": bool(user),
        "user": _row(user) if user else None,
        "auth_disabled": auth_disabled(),
        "setup_token_required": bool(os.getenv("WS_SETUP_TOKEN", "").strip()),
    }


@router.post("/api/auth/setup")
def setup(payload: dict, db: Session = Depends(get_db)):
    local = ensure_local_user(db)
    if local.password_hash:
        raise HTTPException(status_code=409, detail="账号已完成初始化")
    required = os.getenv("WS_SETUP_TOKEN", "").strip()
    if required and not hmac.compare_digest(str(payload.get("setup_token") or ""), required):
        raise HTTPException(status_code=403, detail="初始化令牌不正确")
    username = str(payload.get("username") or "").strip()[:40]
    password = str(payload.get("password") or "")
    if len(username) < 2:
        raise HTTPException(status_code=422, detail="用户名至少 2 个字符")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="密码至少 8 个字符")
    exists = db.query(models.AppUser).filter(
        models.AppUser.username == username, models.AppUser.id != LOCAL_USER_ID
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="用户名已存在")
    local.username = username
    local.password_hash = hash_password(password)
    local.display_name = str(payload.get("display_name") or username)[:80]
    local.updated_at = datetime.utcnow()
    db.commit()
    token = _create_session(db, local.id)
    return {"token": token, "user": _row(local)}


@router.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    user = db.query(models.AppUser).filter(models.AppUser.username == username).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码不正确")
    db.query(models.AuthSession).filter(models.AuthSession.expires_at <= datetime.utcnow()).delete(
        synchronize_session=False
    )
    db.commit()
    token = _create_session(db, user.id)
    return {"token": token, "user": _row(user)}


@router.get("/api/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    return _row(current_user(request, db))


@router.post("/api/auth/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = _bearer(request)
    if token:
        db.query(models.AuthSession).filter(models.AuthSession.token_hash == _token_hash(token)).delete(
            synchronize_session=False
        )
        db.commit()
    return {"status": "ok"}
