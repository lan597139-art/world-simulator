"""Phase N1-M4：AI 分级信息授权、访问审计与记忆来源追溯。

原则：
- 授权对象是 PersonaInstance，且必须属于当前用户。
- 默认无授权；读取时实时校验 status/expiry/scope/purpose。
- 访问日志只记范围元数据，不记正文。
- 撤销授权后立即失效派生记忆并清空正文；保留来源映射审计。
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from feature_flags import require
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["ai-grants"], dependencies=[require("ai_info_grants")])

LEVELS = {
    1: "基础个人信息",
    2: "指定个人经历",
    3: "深度经历、关系、思想",
    4: "持续读取指定范围",
}
PURPOSES = {"chat_context", "memory_capture", "profile_summary", "biography_draft", "test"}
SCOPE_TYPES = {"category", "entry", "biography", "biography_chapter", "collection"}
REDACTIONS = {"none", "names", "dates", "sensitive"}
DEFAULT_PURPOSE = ["chat_context"]
CONSENT_VERSION = "n1-1"


def _fail(code: int, message: str):
    raise HTTPException(status_code=code, detail=message)


def _iso(value):
    return value.isoformat() if value else None


def _hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _instance(db: Session, owner: str, instance_id: str) -> models.PersonaInstance:
    row = db.query(models.PersonaInstance).filter(
        models.PersonaInstance.id == instance_id,
        models.PersonaInstance.owner_user_id == owner,
        models.PersonaInstance.status == "active",
    ).first()
    if not row:
        _fail(404, "AI 实例不存在或不属于当前用户")
    return row


def _parse_time(value) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        _fail(422, "到期时间格式不合法")


def _expire(db: Session, grants: list[models.AiInfoGrant]) -> None:
    now = datetime.utcnow()
    changed = False
    for row in grants:
        if row.status == "active" and row.expires_at and row.expires_at <= now:
            row.status = "expired"
            row.updated_at = now
            changed = True
    if changed:
        db.commit()


def _scopes(db: Session, grant_id: str) -> list[models.AiInfoGrantScope]:
    return db.query(models.AiInfoGrantScope).filter(
        models.AiInfoGrantScope.grant_id == grant_id
    ).order_by(models.AiInfoGrantScope.created_at.asc()).all()


def _scope_row(row: models.AiInfoGrantScope) -> dict:
    return {
        "id": row.id,
        "scope_type": row.scope_type,
        "scope_id": row.scope_id or "",
        "scope_key": row.scope_key or "",
        "scope_label": row.scope_label or "",
    }


def _grant_row(db: Session, row: models.AiInfoGrant) -> dict:
    return {
        "id": row.id,
        "owner_user_id": row.owner_user_id,
        "grantee_instance_id": row.grantee_instance_id,
        "access_level": row.access_level,
        "access_level_label": LEVELS.get(row.access_level, "未开放"),
        "allowed_purposes": row.allowed_purposes or [],
        "allow_memory": bool(row.allow_memory),
        "redaction": row.redaction,
        "status": row.status,
        "expires_at": _iso(row.expires_at),
        "request_id": row.request_id,
        "consent_version": row.consent_version,
        "grant_version": row.grant_version,
        "scopes": [_scope_row(item) for item in _scopes(db, row.id)],
        "created_at": _iso(row.created_at),
        "confirmed_at": _iso(row.confirmed_at),
        "revoked_at": _iso(row.revoked_at),
        "updated_at": _iso(row.updated_at),
    }


def _log(
    db: Session, *, owner: str, instance_id: str, grant_id: str | None,
    action: str, allowed: bool, scope_type: str = "", scope_id: str = "",
    purpose: str = "", reason: str = "", memory_ids: list[str] | None = None,
    request_id: str | None = None,
) -> models.AiInfoAccessLog:
    row = models.AiInfoAccessLog(
        owner_user_id=owner,
        instance_id=instance_id,
        grant_id=grant_id,
        request_id=request_id,
        scope_type=scope_type,
        scope_id=scope_id,
        purpose=purpose,
        action=action,
        allowed=allowed,
        reason=reason,
        memory_ids=memory_ids or [],
    )
    db.add(row)
    return row


def _active_grants(db: Session, owner: str, instance_id: str) -> list[models.AiInfoGrant]:
    grants = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.owner_user_id == owner,
        models.AiInfoGrant.grantee_instance_id == instance_id,
        models.AiInfoGrant.status == "active",
    ).all()
    _expire(db, grants)
    return [row for row in grants if row.status == "active"]


def _scope_matches(scope: models.AiInfoGrantScope, entry: models.DiaryEntry) -> bool:
    if scope.scope_type == "entry":
        return scope.scope_id == entry.id
    if scope.scope_type == "category":
        return bool(scope.scope_key) and scope.scope_key in {entry.info_class, entry.entry_type}
    return False


def _redact(content: str, redaction: str) -> str:
    # 保守的轻量脱敏；不试图替代完整 PII 服务。
    if redaction == "names":
        return content.replace("我", "用户")
    if redaction == "dates":
        return content
    if redaction == "sensitive":
        return content
    return content


def _entry_content(db: Session, entry_id: str, owner: str) -> models.DiaryEntry | None:
    return db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id,
        models.DiaryEntry.owner_user_id == owner,
        models.DiaryEntry.status == "active",
    ).first()


def authorized_entries(
    db: Session, owner: str, instance_id: str, *,
    purpose: str = "chat_context", limit: int = 8, log: bool = True,
) -> list[dict]:
    """返回当前实例已被授权的日记条目；无授权时返回空。"""
    if purpose not in PURPOSES:
        return []
    result: list[dict] = []
    seen: set[str] = set()
    for grant in _active_grants(db, owner, instance_id):
        if grant.access_level <= 0 or purpose not in (grant.allowed_purposes or []):
            continue
        for scope in _scopes(db, grant.id):
            if len(result) >= limit:
                break
            if scope.scope_type == "entry":
                entry = _entry_content(db, scope.scope_id, owner)
                rows = [entry] if entry else []
            elif scope.scope_type == "category":
                rows = db.query(models.DiaryEntry).filter(
                    models.DiaryEntry.owner_user_id == owner,
                    models.DiaryEntry.status == "active",
                    (models.DiaryEntry.info_class == scope.scope_key)
                    | (models.DiaryEntry.entry_type == scope.scope_key),
                ).order_by(models.DiaryEntry.entry_date.desc()).limit(limit).all()
            else:
                rows = []
            for entry in rows:
                if not entry or entry.id in seen or not _scope_matches(scope, entry):
                    continue
                seen.add(entry.id)
                result.append({
                    "grant_id": grant.id,
                    "scope_type": scope.scope_type,
                    "scope_id": scope.scope_id or "",
                    "entry_id": entry.id,
                    "title": entry.title or "",
                    "entry_date": entry.entry_date,
                    "entry_type": entry.entry_type,
                    "info_class": entry.info_class,
                    "content": _redact(entry.content or "", grant.redaction),
                })
                if log:
                    _log(
                        db, owner=owner, instance_id=instance_id, grant_id=grant.id,
                        action="read", allowed=True, scope_type=scope.scope_type,
                        scope_id=scope.scope_id or "", purpose=purpose,
                    )
                if len(result) >= limit:
                    break
    if log:
        db.commit()
    return result


def _grant_for_source(
    db: Session, owner: str, instance_id: str, grant_id: str, scope_type: str, source_id: str,
) -> models.AiInfoGrant:
    grant = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == owner,
        models.AiInfoGrant.grantee_instance_id == instance_id,
    ).first()
    if not grant:
        _fail(404, "授权不存在")
    _expire(db, [grant])
    if grant.status != "active":
        _fail(403, "授权已失效")
    if grant.access_level <= 0:
        _fail(403, "授权等级为 0")
    if not any(
        (scope.scope_type == "entry" and scope.scope_id == source_id)
        or (scope.scope_type == "category" and scope.scope_key == scope_type)
        for scope in _scopes(db, grant.id)
    ):
        _fail(403, "来源不在授权范围内")
    return grant


def capture_memory(
    db: Session, owner: str, instance_id: str, grant_id: str, *,
    source_type: str, source_id: str, content: str | None = None,
) -> tuple[models.PersonaMemory, models.AiMemorySource]:
    grant = _grant_for_source(db, owner, instance_id, grant_id, source_type, source_id)
    if not grant.allow_memory:
        _fail(403, "该授权不允许形成长期记忆")
    text = str(content or "").strip()
    if not text:
        if source_type == "journal_entry":
            entry = _entry_content(db, source_id, owner)
            text = entry.content if entry else ""
        elif source_type == "biography_chapter":
            chapter = db.query(models.UserBiographyChapter).join(
                models.UserBiography,
                models.UserBiography.id == models.UserBiographyChapter.biography_id,
            ).filter(
                models.UserBiographyChapter.id == source_id,
                models.UserBiography.owner_user_id == owner,
            ).first()
            text = chapter.content if chapter else ""
    if not text:
        _fail(422, "没有可写入记忆的来源内容")
    instance = db.query(models.PersonaInstance).filter(
        models.PersonaInstance.id == instance_id,
        models.PersonaInstance.owner_user_id == owner,
    ).first()
    if not instance or not instance.legacy_persona_id:
        _fail(409, "AI 实例缺少可用的旧人格投影，不能写入记忆")
    memory = models.PersonaMemory(
        persona_id=instance.legacy_persona_id,
        owner_user_id=owner,
        persona_instance_id=instance_id,
        source_grant_id=grant.id,
        source_kind="journal_entry" if source_type == "journal_entry" else "biography_chapter",
        status="active",
        content=text[:4000],
        importance=0.6,
        source="authorized_source",
        content_hash=_hash(text),
    )
    db.add(memory)
    db.flush()
    source = models.AiMemorySource(
        memory_id=memory.id,
        source_type=source_type,
        source_id=source_id,
        grant_id=grant.id,
        excerpt_hash=_hash(text[:500]),
        status="active",
    )
    db.add(source)
    _log(
        db, owner=owner, instance_id=instance_id, grant_id=grant.id,
        action="memory_write", allowed=True, scope_type="entry" if source_type == "journal_entry" else "biography_chapter",
        scope_id=source_id, purpose="memory_capture", memory_ids=[memory.id],
    )
    db.commit()
    db.refresh(memory)
    db.refresh(source)
    return memory, source


def invalidate_memories_for_source(db: Session, source_type: str, source_id: str, reason: str) -> list[str]:
    sources = db.query(models.AiMemorySource).filter(
        models.AiMemorySource.source_type == source_type,
        models.AiMemorySource.source_id == source_id,
    ).all()
    touched: list[str] = []
    now = datetime.utcnow()
    for source in sources:
        source.status = "revoked"
        source.revoked_at = now
        memory = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.id == source.memory_id
        ).first()
        if not memory:
            continue
        active_sources = db.query(models.AiMemorySource).filter(
            models.AiMemorySource.memory_id == memory.id,
            models.AiMemorySource.status == "active",
        ).count()
        if active_sources == 0:
            memory.status = "invalidated"
            memory.invalidated_at = now
            memory.invalidated_reason = reason
            memory.content = ""
        else:
            memory.status = "needs_recompute"
            memory.invalidated_reason = reason
        touched.append(memory.id)
    return touched


def revoke_grant(db: Session, grant: models.AiInfoGrant) -> list[str]:
    now = datetime.utcnow()
    grant.status = "revoked"
    grant.revoked_at = now
    grant.updated_at = now
    memories = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.source_grant_id == grant.id,
    ).all()
    ids = []
    for memory in memories:
        memory.status = "invalidated"
        memory.invalidated_at = now
        memory.invalidated_reason = "grant_revoked"
        memory.content = ""
        ids.append(memory.id)
    db.query(models.AiMemorySource).filter(
        models.AiMemorySource.grant_id == grant.id,
    ).update({"status": "revoked", "revoked_at": now}, synchronize_session=False)
    return ids


# ---------------------------------------------------------------------
# API
# ---------------------------------------------------------------------
@router.get("/api/ai-grants/presets")
def presets():
    return {
        "levels": [{"key": key, "label": value} for key, value in LEVELS.items()],
        "purposes": [{"key": key, "label": key} for key in sorted(PURPOSES)],
        "scope_types": [{"key": key, "label": key} for key in sorted(SCOPE_TYPES)],
        "redactions": [{"key": key, "label": key} for key in sorted(REDACTIONS)],
    }


@router.get("/api/ai-grants")
def list_grants(
    request: Request, instance_id: str = "", status: str = "",
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    query = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.owner_user_id == user.id
    )
    if instance_id:
        query = query.filter(models.AiInfoGrant.grantee_instance_id == instance_id)
    if status:
        query = query.filter(models.AiInfoGrant.status == status)
    rows = query.order_by(models.AiInfoGrant.created_at.desc()).all()
    _expire(db, rows)
    return [_grant_row(db, row) for row in rows]


@router.post("/api/ai-grants")
def create_grant(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    instance_id = str(payload.get("instance_id") or payload.get("grantee_instance_id") or "").strip()
    _instance(db, user.id, instance_id)
    try:
        level = int(payload.get("access_level", 1))
    except (TypeError, ValueError):
        _fail(422, "授权等级必须是 1-4")
    if level not in LEVELS:
        _fail(422, "授权等级必须是 1-4")
    purposes = payload.get("allowed_purposes") if isinstance(payload.get("allowed_purposes"), list) else DEFAULT_PURPOSE
    purposes = [str(value) for value in purposes if str(value) in PURPOSES][:10]
    if not purposes:
        _fail(422, "至少选择一个授权用途")
    scopes = payload.get("scopes") if isinstance(payload.get("scopes"), list) else []
    if not scopes:
        _fail(422, "至少选择一个授权范围")
    expires = _parse_time(payload.get("expires_at"))
    if not expires:
        expires = datetime.utcnow() + timedelta(days=30 if level == 4 else 7)
    row = models.AiInfoGrant(
        owner_user_id=user.id,
        grantee_instance_id=instance_id,
        access_level=level,
        allowed_purposes=purposes,
        allow_memory=bool(payload.get("allow_memory")),
        redaction=str(payload.get("redaction") or "none") if str(payload.get("redaction") or "none") in REDACTIONS else "none",
        status="active",
        expires_at=expires,
        consent_version=str(payload.get("consent_version") or CONSENT_VERSION)[:40],
        confirmed_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    for raw in scopes[:50]:
        if not isinstance(raw, dict):
            continue
        scope_type = str(raw.get("scope_type") or "")
        if scope_type not in SCOPE_TYPES:
            continue
        db.add(models.AiInfoGrantScope(
            grant_id=row.id,
            scope_type=scope_type,
            scope_id=str(raw.get("scope_id") or "") or None,
            scope_key=str(raw.get("scope_key") or "") or None,
            scope_label=str(raw.get("scope_label") or "")[:120],
        ))
    db.commit()
    db.refresh(row)
    return _grant_row(db, row)


@router.get("/api/ai-grants/{grant_id}")
def get_grant(grant_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "授权不存在")
    _expire(db, [row])
    return _grant_row(db, row)


@router.post("/api/ai-grants/{grant_id}/pause")
def pause_grant(grant_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "授权不存在")
    if row.status == "active":
        row.status = "paused"
        row.paused_at = datetime.utcnow()
        db.commit()
    return _grant_row(db, row)


@router.post("/api/ai-grants/{grant_id}/resume")
def resume_grant(grant_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "授权不存在")
    if row.status == "paused" and (not row.expires_at or row.expires_at > datetime.utcnow()):
        row.status = "active"
        row.paused_at = None
        db.commit()
    return _grant_row(db, row)


@router.post("/api/ai-grants/{grant_id}/revoke")
def revoke(grant_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "授权不存在")
    ids = revoke_grant(db, row)
    db.commit()
    return {"status": "revoked", "memory_ids": ids, **_grant_row(db, row)}


@router.post("/api/ai-grants/{grant_id}/read")
def read_grant(grant_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    instance_id = str(payload.get("instance_id") or "").strip()
    grant = db.query(models.AiInfoGrant).filter(
        models.AiInfoGrant.id == grant_id,
        models.AiInfoGrant.owner_user_id == user.id,
    ).first()
    if not grant:
        _fail(404, "授权不存在")
    _expire(db, [grant])
    purpose = str(payload.get("purpose") or "chat_context")
    if grant.status != "active" or purpose not in (grant.allowed_purposes or []):
        _log(db, owner=user.id, instance_id=instance_id or grant.grantee_instance_id,
             grant_id=grant.id, action="denied", allowed=False,
             purpose=purpose, reason="grant_inactive_or_purpose_denied")
        db.commit()
        _fail(403, "授权已失效或用途不允许")
    scopes = _scopes(db, grant.id)
    entries = []
    for scope in scopes:
        if scope.scope_type == "entry":
            entry = _entry_content(db, scope.scope_id, user.id)
            if entry:
                entries.append((scope, entry))
        elif scope.scope_type == "category":
            rows = db.query(models.DiaryEntry).filter(
                models.DiaryEntry.owner_user_id == user.id,
                models.DiaryEntry.status == "active",
                (models.DiaryEntry.info_class == scope.scope_key)
                | (models.DiaryEntry.entry_type == scope.scope_key),
            ).limit(8).all()
            entries.extend((scope, item) for item in rows)
    seen = set()
    result = []
    for scope, entry in entries:
        if entry.id in seen:
            continue
        seen.add(entry.id)
        result.append({
            "entry_id": entry.id,
            "title": entry.title or "",
            "entry_date": entry.entry_date,
            "content": _redact(entry.content or "", grant.redaction),
        })
        _log(db, owner=user.id, instance_id=grant.grantee_instance_id,
             grant_id=grant.id, action="read", allowed=True,
             scope_type=scope.scope_type, scope_id=scope.scope_id or "",
             purpose=purpose)
    db.commit()
    return {"grant_id": grant.id, "entries": result}


@router.post("/api/ai-grants/{grant_id}/memory")
def memory_from_grant(grant_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    instance_id = str(payload.get("instance_id") or "").strip()
    memory, source = capture_memory(
        db, user.id, instance_id, grant_id,
        source_type=str(payload.get("source_type") or "journal_entry"),
        source_id=str(payload.get("source_id") or ""),
        content=payload.get("content"),
    )
    return {
        "memory_id": memory.id,
        "source_id": source.id,
        "status": memory.status,
        "content_hash": memory.content_hash,
    }


@router.get("/api/ai-grants/audit/logs")
def access_logs(
    request: Request, instance_id: str = "", limit: int = 100,
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    query = db.query(models.AiInfoAccessLog).filter(
        models.AiInfoAccessLog.owner_user_id == user.id
    )
    if instance_id:
        query = query.filter(models.AiInfoAccessLog.instance_id == instance_id)
    rows = query.order_by(models.AiInfoAccessLog.created_at.desc()).limit(max(1, min(limit, 500))).all()
    return [
        {
            "id": row.id, "instance_id": row.instance_id, "grant_id": row.grant_id,
            "scope_type": row.scope_type, "scope_id": row.scope_id,
            "purpose": row.purpose, "action": row.action, "allowed": bool(row.allowed),
            "reason": row.reason, "memory_ids": row.memory_ids or [],
            "created_at": _iso(row.created_at),
        }
        for row in rows
    ]


@router.get("/api/ai-grants/requests/list")
def list_requests(request: Request, status: str = "", db: Session = Depends(get_db)):
    user = current_user(request, db)
    query = db.query(models.AiInfoRequest).filter(
        models.AiInfoRequest.owner_user_id == user.id
    )
    if status:
        query = query.filter(models.AiInfoRequest.status == status)
    rows = query.order_by(models.AiInfoRequest.created_at.desc()).all()
    return [
        {
            "id": row.id, "requester_instance_id": row.requester_instance_id,
            "requested_scopes": row.requested_scopes or [], "requested_level": row.requested_level,
            "reason": row.reason, "status": row.status,
            "created_at": _iso(row.created_at), "responded_at": _iso(row.responded_at),
        }
        for row in rows
    ]


@router.post("/api/ai-grants/requests")
def create_request(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    instance_id = str(payload.get("instance_id") or "").strip()
    _instance(db, user.id, instance_id)
    row = models.AiInfoRequest(
        owner_user_id=user.id,
        requester_instance_id=instance_id,
        requested_scopes=payload.get("scopes") if isinstance(payload.get("scopes"), list) else [],
        requested_level=max(1, min(4, int(payload.get("access_level") or 1))),
        reason=str(payload.get("reason") or "")[:2000],
        relationship_context=payload.get("relationship_context") if isinstance(payload.get("relationship_context"), dict) else {},
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status}


@router.post("/api/ai-grants/requests/{request_id}/deny")
def deny_request(request_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoRequest).filter(
        models.AiInfoRequest.id == request_id,
        models.AiInfoRequest.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "请求不存在")
    row.status = "denied"
    row.responded_at = datetime.utcnow()
    db.commit()
    return {"id": row.id, "status": row.status}


@router.post("/api/ai-grants/requests/{request_id}/approve")
def approve_request(request_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.AiInfoRequest).filter(
        models.AiInfoRequest.id == request_id,
        models.AiInfoRequest.owner_user_id == user.id,
    ).first()
    if not row:
        _fail(404, "请求不存在")
    body = dict(payload or {})
    body.setdefault("instance_id", row.requester_instance_id)
    body.setdefault("access_level", row.requested_level)
    body.setdefault("scopes", row.requested_scopes)
    grant = create_grant(body, request, db)
    row.status = "approved"
    row.responded_at = datetime.utcnow()
    db.commit()
    return {"request_id": row.id, "status": row.status, "grant": grant}
