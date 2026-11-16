"""账号与鉴权：单开发者初始化 + 邀请码注册 + 可选邮箱验证 + 会话。"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from database import SessionLocal, get_db
from users import LOCAL_USER_ID, ensure_local_user
from i18n_errors import english_detail
from access import guard_request_world

router = APIRouter(tags=["auth"])
logger = logging.getLogger("auth")

SESSION_DAYS = 30
PBKDF2_ITERATIONS = 210_000
VERIFICATION_MINUTES = 15
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
USERNAME_RE = re.compile(r"^[\w\u4e00-\u9fff.-]{2,32}$", re.UNICODE)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/status",
    "/api/auth/setup",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/register/verify",
    "/api/auth/register/resend",
    "/api/settings/about",
    "/api/creator-assets/public",
}
PUBLIC_READ_PREFIXES = ("/api/community/public",)

# 简易登录失败限速：单进程内生效；生产多实例时应换 Redis/数据库。
_LOGIN_FAILURES: dict[str, list[datetime]] = {}
_LOGIN_WINDOW = timedelta(minutes=10)
_LOGIN_MAX_FAILURES = 8


def public_read(path: str, method: str) -> bool:
    if method != "GET":
        return False
    return any(path == prefix or path.startswith(prefix + "/") for prefix in PUBLIC_READ_PREFIXES)


def auth_disabled() -> bool:
    return os.getenv("WS_AUTH_DISABLED", "").strip().lower() in {"1", "true", "yes"}


def registration_enabled() -> bool:
    return os.getenv("WS_REGISTRATION_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}


def invite_required() -> bool:
    return os.getenv("WS_INVITE_REQUIRED", "1").strip().lower() not in {"0", "false", "no", "off"}


def email_mode() -> str:
    value = (os.getenv("WS_EMAIL_MODE") or os.getenv("WS_EMAIL_VERIFICATION") or "off").strip().lower()
    return value if value in {"off", "dev", "smtp"} else "off"


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
    """所有 /api/* 默认必须登录；仅健康检查、登录、注册与初始化公开。"""
    path = request.url.path
    if (
        request.method == "OPTIONS"
        or not path.startswith("/api/")
        or path in PUBLIC_PATHS
        or public_read(path, request.method)
    ):
        return await call_next(request)
    if auth_disabled():
        request.state.user_id = LOCAL_USER_ID
        return await call_next(request)

    token = _bearer(request)
    db = SessionLocal()
    try:
        user = user_from_token(db, token)
        if not user:
            detail = "登录已失效，请重新登录"
            if request.headers.get("accept-language", "").lower().startswith("en"):
                detail = english_detail(detail, 401)
            return JSONResponse(status_code=401, content={"detail": detail})
        if (
            request.headers.get("x-yunbao-workspace") == "1"
            and request.method not in {"GET", "HEAD", "OPTIONS"}
            and not user.is_owner
            and not (request.method == "POST" and request.url.path == "/api/products/yunbao/workspace")
        ):
            detail = "云宝工作台仅开发者可编辑，当前账号为只读"
            if request.headers.get("accept-language", "").lower().startswith("en"):
                detail = "Yunbao Workspace is owner-editable; this account is read-only"
            return JSONResponse(status_code=403, content={"detail": detail})
        request.state.user_id = user.id
        blocked = guard_request_world(request, user.id, db)
        if blocked is not None:
            return blocked
    finally:
        db.close()
    return await call_next(request)


def _row(user: models.AppUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "email": user.email or "",
        "email_verified": bool(user.email_verified_at),
        "is_owner": bool(user.is_owner),
        "bio": user.bio or "",
        "avatar": user.avatar or "",
        "avatar_url": user.avatar_url or "",
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _normalize_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def _invite_hash(code: str) -> str:
    return hashlib.sha256(_normalize_code(code).encode("utf-8")).hexdigest()


def _validate_invite(db: Session, code: str) -> models.InviteCode:
    normalized = _normalize_code(code)
    if len(normalized) < 8:
        raise HTTPException(status_code=422, detail="请输入有效的邀请码")
    invite = db.query(models.InviteCode).filter(
        models.InviteCode.code_hash == _invite_hash(code)
    ).first()
    if not invite or invite.revoked_at is not None:
        raise HTTPException(status_code=404, detail="邀请码无效或已停用")
    if invite.expires_at and invite.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="邀请码已过期")
    if invite.used_count >= invite.max_uses:
        raise HTTPException(status_code=409, detail="邀请码使用次数已用完")
    return invite


def _consume_invite(db: Session, invite: models.InviteCode, user_id: str) -> None:
    """条件更新，保证并发注册不会超过 max_uses。"""
    updated = db.query(models.InviteCode).filter(
        models.InviteCode.id == invite.id,
        models.InviteCode.revoked_at.is_(None),
        models.InviteCode.used_count < models.InviteCode.max_uses,
    ).update(
        {
            models.InviteCode.used_count: models.InviteCode.used_count + 1,
            models.InviteCode.last_used_at: datetime.utcnow(),
        },
        synchronize_session=False,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="邀请码已被用完，请联系开发者获取新邀请码")
    db.add(models.InviteRedemption(invite_id=invite.id, user_id=user_id))
    db.flush()
    from spirit_economy import grant_invite_rewards
    grant_invite_rewards(db, invite, user_id)


def _verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_verification_email(to: str, code: str) -> None:
    mode = email_mode()
    if mode == "off":
        return
    if mode == "dev":
        logger.warning("[auth-dev] verification code for %s: %s", to, code)
        print(f"[auth-dev] verification code for {to}: {code}", flush=True)
        return
    host = os.getenv("WS_SMTP_HOST", "").strip()
    sender = os.getenv("WS_SMTP_FROM", "").strip()
    if not host or not sender:
        raise HTTPException(status_code=503, detail="邮件服务未配置，请联系开发者")
    port = int(os.getenv("WS_SMTP_PORT", "587"))
    username = os.getenv("WS_SMTP_USER", "").strip()
    password = os.getenv("WS_SMTP_PASSWORD", "")
    use_ssl = os.getenv("WS_SMTP_SSL", "").strip().lower() in {"1", "true", "yes"}
    use_tls = os.getenv("WS_SMTP_TLS", "1").strip().lower() in {"1", "true", "yes"}
    message = EmailMessage()
    message["Subject"] = "世界模拟器 · 注册验证码"
    message["From"] = sender
    message["To"] = to
    message.set_content(
        f"你的注册验证码是 {code}。\n\n"
        f"验证码 {VERIFICATION_MINUTES} 分钟内有效，只能使用一次。\n"
        "如果不是你本人操作，请忽略这封邮件。"
    )
    try:
        smtp = smtplib.SMTP_SSL(host, port, timeout=15) if use_ssl else smtplib.SMTP(host, port, timeout=15)
        with smtp:
            if not use_ssl and use_tls:
                smtp.starttls()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
    except Exception:
        logger.exception("failed to send verification email to %s", to)
        raise HTTPException(status_code=502, detail="验证邮件发送失败，请稍后重试")


def _check_username(value: str) -> str:
    username = str(value or "").strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=422, detail="用户名 2–32 位，只能包含中英文、数字、下划线、点和短横线")
    return username


def _check_email(value: str) -> str:
    email = str(value or "").strip().lower()
    if len(email) > 160 or not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="请输入有效的邮箱地址")
    return email


def _check_password(value: str) -> str:
    password = str(value or "")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="密码至少 8 个字符")
    if len(password) > 200:
        raise HTTPException(status_code=422, detail="密码过长")
    return password


def _create_registered_user(
    db: Session,
    *,
    username: str,
    email: str,
    display_name: str,
    password_hash: str,
    invite: models.InviteCode | None,
) -> models.AppUser:
    exists = db.query(models.AppUser).filter(
        or_(models.AppUser.username == username, models.AppUser.email == email)
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="用户名或邮箱已被注册")
    user = models.AppUser(
        username=username,
        email=email,
        display_name=(display_name or username)[:80],
        password_hash=password_hash,
        email_verified_at=datetime.utcnow(),
        is_active=True,
        is_owner=False,
    )
    db.add(user)
    try:
        db.flush()
        if invite is not None:
            _consume_invite(db, invite, user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="用户名或邮箱已被注册")
    except Exception:
        db.rollback()
        raise
    db.refresh(user)
    return user


def _login_failure_key(request: Request, identifier: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}|{identifier.lower()}"


def _check_login_rate(request: Request, identifier: str) -> None:
    key = _login_failure_key(request, identifier)
    now = datetime.utcnow()
    recent = [item for item in _LOGIN_FAILURES.get(key, []) if now - item < _LOGIN_WINDOW]
    _LOGIN_FAILURES[key] = recent
    if len(recent) >= _LOGIN_MAX_FAILURES:
        raise HTTPException(status_code=429, detail="登录尝试过多，请 10 分钟后再试")


def _record_login_failure(request: Request, identifier: str) -> None:
    key = _login_failure_key(request, identifier)
    _LOGIN_FAILURES.setdefault(key, []).append(datetime.utcnow())


def _clear_login_failures(request: Request, identifier: str) -> None:
    _LOGIN_FAILURES.pop(_login_failure_key(request, identifier), None)


@router.get("/api/auth/status")
def auth_status(request: Request, db: Session = Depends(get_db)):
    local = ensure_local_user(db)
    user = user_from_token(db, _bearer(request))
    setup_required = not bool(local.password_hash)
    return {
        "setup_required": setup_required,
        "authenticated": bool(user),
        "user": _row(user) if user else None,
        "auth_disabled": auth_disabled(),
        "setup_token_required": bool(os.getenv("WS_SETUP_TOKEN", "").strip()),
        "registration_enabled": registration_enabled() and not setup_required,
        "invite_required": invite_required(),
        "email_verification": email_mode(),
    }


@router.post("/api/auth/setup")
def setup(payload: dict, db: Session = Depends(get_db)):
    local = ensure_local_user(db)
    if local.password_hash:
        raise HTTPException(status_code=409, detail="账号已完成初始化")
    required = os.getenv("WS_SETUP_TOKEN", "").strip()
    if required and not hmac.compare_digest(str(payload.get("setup_token") or ""), required):
        raise HTTPException(status_code=403, detail="初始化令牌不正确")
    username = _check_username(payload.get("username"))
    password = _check_password(payload.get("password"))
    email = _check_email(payload["email"]) if payload.get("email") else None
    if email and db.query(models.AppUser).filter(models.AppUser.email == email).first():
        raise HTTPException(status_code=409, detail="邮箱已被使用")
    exists = db.query(models.AppUser).filter(
        models.AppUser.username == username, models.AppUser.id != LOCAL_USER_ID
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="用户名已存在")
    local.username = username
    local.password_hash = hash_password(password)
    local.display_name = str(payload.get("display_name") or username)[:80]
    if email:
        local.email = email
        local.email_verified_at = datetime.utcnow()
    local.updated_at = datetime.utcnow()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="用户名或邮箱已存在")
    token = _create_session(db, local.id)
    return {"token": token, "user": _row(local)}


@router.post("/api/auth/login")
def login(payload: dict, request: Request, db: Session = Depends(get_db)):
    identifier = str(payload.get("username") or payload.get("identifier") or "").strip()
    password = str(payload.get("password") or "")
    _check_login_rate(request, identifier)
    user = db.query(models.AppUser).filter(
        or_(models.AppUser.username == identifier, models.AppUser.email == identifier.lower())
    ).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        _record_login_failure(request, identifier)
        raise HTTPException(status_code=401, detail="用户名或密码不正确")
    _clear_login_failures(request, identifier)
    db.query(models.AuthSession).filter(models.AuthSession.expires_at <= datetime.utcnow()).delete(
        synchronize_session=False
    )
    db.commit()
    token = _create_session(db, user.id)
    return {"token": token, "user": _row(user)}


@router.post("/api/auth/register")
def register(payload: dict, db: Session = Depends(get_db)):
    local = ensure_local_user(db)
    if not local.password_hash:
        raise HTTPException(status_code=409, detail="站点尚未完成开发者初始化，暂不开放注册")
    if not registration_enabled():
        raise HTTPException(status_code=403, detail="当前站点暂未开放注册")
    username = _check_username(payload.get("username"))
    email = _check_email(payload.get("email"))
    password = _check_password(payload.get("password"))
    display_name = str(payload.get("display_name") or username)[:80]
    invite = _validate_invite(db, payload.get("invite_code") or "") if invite_required() else None
    mode = email_mode()
    if mode == "off":
        user = _create_registered_user(
            db, username=username, email=email, display_name=display_name,
            password_hash=hash_password(password), invite=invite,
        )
        token = _create_session(db, user.id)
        return {"token": token, "user": _row(user), "verification_required": False}
    if db.query(models.AppUser).filter(
        or_(models.AppUser.username == username, models.AppUser.email == email)
    ).first():
        raise HTTPException(status_code=409, detail="用户名或邮箱已被注册")
    code = _verification_code()
    now = datetime.utcnow()
    pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.email == email,
        models.PendingRegistration.consumed_at.is_(None),
        models.PendingRegistration.code_expires_at > now,
    ).first()
    if pending and pending.username != username:
        raise HTTPException(status_code=409, detail="该邮箱已有待验证注册，请使用原用户名或换一个邮箱")
    if not pending:
        pending = models.PendingRegistration(
            email=email, username=username, display_name=display_name,
            password_hash=hash_password(password), invite_id=invite.id if invite else "",
            code_hash=hashlib.sha256(code.encode()).hexdigest(),
            code_expires_at=now + timedelta(minutes=VERIFICATION_MINUTES),
            last_sent_at=now,
        )
        db.add(pending)
    else:
        pending.username = username
        pending.display_name = display_name
        pending.password_hash = hash_password(password)
        pending.invite_id = invite.id if invite else ""
        pending.code_hash = hashlib.sha256(code.encode()).hexdigest()
        pending.code_expires_at = now + timedelta(minutes=VERIFICATION_MINUTES)
        pending.attempts = 0
        pending.last_sent_at = now
    db.commit()
    db.refresh(pending)
    _send_verification_email(email, code)
    return {
        "verification_required": True,
        "registration_id": pending.id,
        "email": email,
        "email_mode": mode,
        "dev_code": code if mode == "dev" else None,
    }


@router.post("/api/auth/register/verify")
def verify_registration(payload: dict, db: Session = Depends(get_db)):
    if email_mode() == "off":
        raise HTTPException(status_code=409, detail="当前站点不需要邮箱验证")
    registration_id = str(payload.get("registration_id") or "").strip()
    code = str(payload.get("code") or "").strip()
    pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.id == registration_id
    ).first()
    if not pending or pending.consumed_at is not None:
        raise HTTPException(status_code=404, detail="注册请求不存在或已完成")
    if pending.code_expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="验证码已过期，请重新发送")
    if pending.attempts >= 6:
        raise HTTPException(status_code=429, detail="验证码尝试次数过多，请重新发送")
    if not hmac.compare_digest(pending.code_hash, hashlib.sha256(code.encode()).hexdigest()):
        pending.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="验证码不正确")
    invite = db.query(models.InviteCode).filter(models.InviteCode.id == pending.invite_id).first() if pending.invite_id else None
    if invite_required() and not invite:
        raise HTTPException(status_code=409, detail="邀请码记录已失效，请联系开发者")
    if invite is not None:
        if invite.revoked_at is not None or invite.used_count >= invite.max_uses:
            raise HTTPException(status_code=409, detail="邀请码已失效或用完，请联系开发者")
    user = _create_registered_user(
        db, username=pending.username, email=pending.email,
        display_name=pending.display_name, password_hash=pending.password_hash, invite=invite,
    )
    pending.consumed_at = datetime.utcnow()
    db.commit()
    token = _create_session(db, user.id)
    return {"token": token, "user": _row(user), "verification_required": False}


@router.post("/api/auth/register/resend")
def resend_registration(payload: dict, db: Session = Depends(get_db)):
    if email_mode() == "off":
        raise HTTPException(status_code=409, detail="当前站点不需要邮箱验证")
    registration_id = str(payload.get("registration_id") or "").strip()
    pending = db.query(models.PendingRegistration).filter(
        models.PendingRegistration.id == registration_id
    ).first()
    if not pending or pending.consumed_at is not None:
        raise HTTPException(status_code=404, detail="注册请求不存在或已完成")
    now = datetime.utcnow()
    if pending.last_sent_at and now - pending.last_sent_at < timedelta(seconds=60):
        raise HTTPException(status_code=429, detail="发送过于频繁，请 1 分钟后再试")
    code = _verification_code()
    pending.code_hash = hashlib.sha256(code.encode()).hexdigest()
    pending.code_expires_at = now + timedelta(minutes=VERIFICATION_MINUTES)
    pending.attempts = 0
    pending.last_sent_at = now
    db.commit()
    _send_verification_email(pending.email, code)
    return {"status": "ok", "email_mode": email_mode(), "dev_code": code if email_mode() == "dev" else None}


@router.get("/api/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    return _row(current_user(request, db))


@router.patch("/api/auth/profile")
def update_profile(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if "display_name" in payload:
        display_name = str(payload.get("display_name") or "").strip()
        if not display_name:
            raise HTTPException(status_code=422, detail="显示名称不能为空")
        if len(display_name) > 80:
            raise HTTPException(status_code=422, detail="显示名称最多 80 个字符")
        user.display_name = display_name
    if "bio" in payload:
        user.bio = str(payload.get("bio") or "").strip()[:500]
    if "avatar" in payload:
        user.avatar = str(payload.get("avatar") or "").strip()[:16]
    if "avatar_url" in payload:
        avatar_url = str(payload.get("avatar_url") or "").strip()
        if avatar_url and not (avatar_url.startswith("http://") or avatar_url.startswith("https://") or avatar_url.startswith("/uploads/")):
            raise HTTPException(status_code=422, detail="头像地址必须是 http(s) 或 /uploads/ 路径")
        user.avatar_url = avatar_url[:500]
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return _row(user)


@router.post("/api/auth/change-password")
def change_password(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    current = str(payload.get("current_password") or "")
    new = str(payload.get("new_password") or "")
    if not verify_password(current, user.password_hash):
        raise HTTPException(status_code=403, detail="当前密码不正确")
    if len(new) < 8:
        raise HTTPException(status_code=422, detail="新密码至少 8 个字符")
    if current == new:
        raise HTTPException(status_code=422, detail="新密码不能与当前密码相同")
    user.password_hash = hash_password(new)
    user.updated_at = datetime.utcnow()
    token = _bearer(request)
    keep = _token_hash(token) if token else ""
    db.query(models.AuthSession).filter(
        models.AuthSession.user_id == user.id,
        models.AuthSession.token_hash != keep,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "ok", "message": "密码已更新，其他设备已退出登录"}


@router.post("/api/auth/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = _bearer(request)
    if token:
        db.query(models.AuthSession).filter(models.AuthSession.token_hash == _token_hash(token)).delete(
            synchronize_session=False
        )
        db.commit()
    return {"status": "ok"}


def _require_owner(request: Request, db: Session) -> models.AppUser:
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可以管理邀请码")
    return user


def _invite_row(invite: models.InviteCode) -> dict:
    now = datetime.utcnow()
    status = "active"
    if invite.revoked_at is not None:
        status = "revoked"
    elif invite.expires_at and invite.expires_at <= now:
        status = "expired"
    elif invite.used_count >= invite.max_uses:
        status = "exhausted"
    return {
        "id": invite.id,
        "code_prefix": invite.code_prefix,
        "label": invite.label,
        "max_uses": invite.max_uses,
        "used_count": invite.used_count,
        "status": status,
        "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
        "revoked_at": invite.revoked_at.isoformat() if invite.revoked_at else None,
        "created_at": invite.created_at.isoformat() if invite.created_at else None,
        "last_used_at": invite.last_used_at.isoformat() if invite.last_used_at else None,
        "kind": invite.kind or "normal",
        "batch": invite.batch or "",
        "scope": invite.scope or "registration",
        "reward_fruit": invite.reward_fruit or 0,
        "reward_plant_type_id": invite.reward_plant_type_id,
        "reward_plant_quantity": invite.reward_plant_quantity or 0,
        "inviter_reward_fruit": invite.inviter_reward_fruit or 0,
    }


def _invite_int(payload: dict, key: str, default: int = 0, minimum: int = 0, maximum: int = 1000000) -> int:
    try:
        value = int(payload.get(key, default) or default)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail=f"{key} 必须是整数")
    return max(minimum, min(maximum, value))


@router.get("/api/auth/invites")
def list_invites(batch: str = "", request: Request = None, db: Session = Depends(get_db)):
    _require_owner(request, db)
    all_rows = db.query(models.InviteCode).order_by(models.InviteCode.created_at.desc()).all()
    batches = sorted({row.batch for row in all_rows if row.batch})
    selected = batch.strip()
    rows = [row for row in all_rows if not selected or row.batch == selected]
    return {"items": [_invite_row(row) for row in rows], "batches": batches}


@router.post("/api/auth/invites")
def create_invite(payload: dict, request: Request, db: Session = Depends(get_db)):
    owner = _require_owner(request, db)
    kind = str(payload.get("kind") or "normal").strip().lower()
    if kind not in {"normal", "special", "developer"}:
        raise HTTPException(status_code=422, detail="邀请码类型只能是 normal/special/developer")
    scope = str(payload.get("scope") or "registration").strip().lower()
    if scope != "registration":
        raise HTTPException(status_code=422, detail="当前仅支持注册范围")
    max_uses = _invite_int(payload, "max_uses", 1, 1, 1000)
    expires_days = _invite_int(payload, "expires_days", 0, 0, 3650)
    label = str(payload.get("label") or "").strip()[:120]
    batch = str(payload.get("batch") or "").strip()[:80]
    reward_fruit = _invite_int(payload, "reward_fruit", 0, 0, 1000000)
    inviter_reward_fruit = _invite_int(payload, "inviter_reward_fruit", 0, 0, 1000000)
    plant_type_id = str(payload.get("reward_plant_type_id") or "").strip() or None
    plant_quantity = _invite_int(payload, "reward_plant_quantity", 0, 0, 1000)
    if plant_quantity and not plant_type_id:
        raise HTTPException(status_code=422, detail="灵植奖励需要选择灵植类型")
    if plant_type_id:
        plant = db.query(models.SpiritPlantType).filter(models.SpiritPlantType.id == plant_type_id).first()
        if not plant:
            raise HTTPException(status_code=422, detail="灵植类型不存在")
    raw = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(12))
    display = f"WS-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"
    invite = models.InviteCode(
        code_hash=_invite_hash(display),
        code_prefix=display[:7],
        label=label,
        created_by=owner.id,
        max_uses=max_uses,
        used_count=0,
        kind=kind,
        batch=batch,
        scope=scope,
        reward_fruit=reward_fruit,
        reward_plant_type_id=plant_type_id,
        reward_plant_quantity=plant_quantity,
        inviter_reward_fruit=inviter_reward_fruit,
        expires_at=datetime.utcnow() + timedelta(days=expires_days) if expires_days > 0 else None,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {"code": display, "invite": _invite_row(invite)}


@router.patch("/api/auth/invites/{invite_id}")
def update_invite(invite_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    _require_owner(request, db)
    invite = db.query(models.InviteCode).filter(models.InviteCode.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="邀请码不存在")
    if "label" in payload:
        invite.label = str(payload.get("label") or "").strip()[:120]
    if "kind" in payload:
        kind = str(payload.get("kind") or "").strip().lower()
        if kind not in {"normal", "special", "developer"}:
            raise HTTPException(status_code=422, detail="邀请码类型只能是 normal/special/developer")
        invite.kind = kind
    if "batch" in payload:
        invite.batch = str(payload.get("batch") or "").strip()[:80]
    if "reward_fruit" in payload:
        invite.reward_fruit = _invite_int(payload, "reward_fruit", 0, 0, 1000000)
    if "inviter_reward_fruit" in payload:
        invite.inviter_reward_fruit = _invite_int(payload, "inviter_reward_fruit", 0, 0, 1000000)
    if "reward_plant_quantity" in payload:
        invite.reward_plant_quantity = _invite_int(payload, "reward_plant_quantity", 0, 0, 1000)
    if "reward_plant_type_id" in payload:
        invite.reward_plant_type_id = str(payload.get("reward_plant_type_id") or "").strip() or None
    if "max_uses" in payload:
        used = invite.used_count or 0
        invite.max_uses = _invite_int(payload, "max_uses", invite.max_uses, max(1, used), 1000)
    if payload.get("revoked") is True:
        invite.revoked_at = datetime.utcnow()
    elif payload.get("revoked") is False:
        invite.revoked_at = None
    db.commit()
    db.refresh(invite)
    return {"invite": _invite_row(invite)}
