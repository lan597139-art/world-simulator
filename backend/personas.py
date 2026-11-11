"""个人 AI 人格：独立 ESA 配置、会话、记忆与全局 AI 接入。

人格不是世界 NPC；每条会话/记忆都按 persona_id 隔离。
公共资料只有在人格显式授权 share_public_profile 时才进入提示词。
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from ai_engine import ai_config_status, ai_error_message, get_client, get_model
from database import get_db

router = APIRouter()
OWNER = "local"


def _persona(db: Session, persona_id: str) -> models.PersonalPersona:
    row = db.query(models.PersonalPersona).filter(
        models.PersonalPersona.id == persona_id,
        models.PersonalPersona.owner_user_id == OWNER,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="个人 AI 人格不存在")
    return row


def _thread(db: Session, persona_id: str, thread_id: str) -> models.PersonaThread:
    row = db.query(models.PersonaThread).filter(
        models.PersonaThread.id == thread_id,
        models.PersonaThread.persona_id == persona_id,
        models.PersonaThread.owner_user_id == OWNER,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="人格会话不存在")
    return row


def _row(row: models.PersonalPersona) -> dict:
    policy = row.memory_policy if isinstance(row.memory_policy, dict) else {}
    return {
        "id": row.id, "name": row.name, "identity": row.identity or "",
        "description": row.description or "", "avatar": row.avatar or "",
        "esa": row.esa or {}, "traits": row.traits or [], "cognition": row.cognition or {},
        "expression": row.expression or {}, "interaction": row.interaction or {},
        "memory_policy": policy, "public_profile": row.public_profile or {},
        "tools": row.tools or [], "status": row.status or "active",
        "created_at": row.created_at, "updated_at": row.updated_at,
    }


def _message_row(row: models.PersonaMessage) -> dict:
    return {
        "id": row.id, "thread_id": row.thread_id, "persona_id": row.persona_id,
        "role": row.role, "content": row.content or "", "meta": row.meta or {},
        "created_at": row.created_at,
    }


def _clean_persona(payload: dict) -> dict:
    clean = {}
    if "name" in payload:
        name = str(payload.get("name") or "").strip()[:80]
        if not name:
            raise HTTPException(status_code=422, detail="人格名称不能为空")
        clean["name"] = name
    for key, limit in (("identity", 500), ("description", 4000), ("avatar", 300)):
        if key in payload:
            clean[key] = str(payload.get(key) or "")[:limit]
    for key in ("esa", "cognition", "expression", "interaction", "memory_policy", "public_profile"):
        if key in payload and isinstance(payload.get(key), dict):
            clean[key] = payload[key]
    for key in ("traits", "tools"):
        if key in payload and isinstance(payload.get(key), list):
            clean[key] = payload[key]
    if "status" in payload:
        status = str(payload.get("status") or "active")
        clean["status"] = status if status in {"active", "paused", "archived"} else "active"
    return clean


@router.get("/api/personas")
def list_personas(db: Session = Depends(get_db)):
    rows = db.query(models.PersonalPersona).filter(
        models.PersonalPersona.owner_user_id == OWNER,
        models.PersonalPersona.status != "archived",
    ).order_by(models.PersonalPersona.created_at.asc()).all()
    return [_row(row) for row in rows]


@router.post("/api/personas")
def create_persona(payload: dict, db: Session = Depends(get_db)):
    clean = _clean_persona(payload)
    if not clean.get("name"):
        raise HTTPException(status_code=422, detail="人格名称不能为空")
    row = models.PersonalPersona(owner_user_id=OWNER, **clean)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row(row)


@router.patch("/api/personas/{persona_id}")
def update_persona(persona_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _persona(db, persona_id)
    for key, value in _clean_persona(payload).items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row)


@router.delete("/api/personas/{persona_id}")
def delete_persona(persona_id: str, db: Session = Depends(get_db)):
    row = _persona(db, persona_id)
    db.query(models.PersonaMemory).filter(models.PersonaMemory.persona_id == row.id).delete(synchronize_session=False)
    threads = db.query(models.PersonaThread).filter(models.PersonaThread.persona_id == row.id).all()
    for thread in threads:
        db.query(models.PersonaMessage).filter(models.PersonaMessage.thread_id == thread.id).delete(synchronize_session=False)
        db.delete(thread)
    db.delete(row)
    db.commit()
    return {"status": "removed"}


@router.get("/api/personas/{persona_id}/threads")
def list_threads(persona_id: str, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    rows = db.query(models.PersonaThread).filter(
        models.PersonaThread.persona_id == persona_id,
        models.PersonaThread.status != "archived",
    ).order_by(models.PersonaThread.updated_at.desc()).all()
    return [
        {"id": row.id, "title": row.title, "summary": row.summary, "created_at": row.created_at,
         "updated_at": row.updated_at, "message_count": db.query(models.PersonaMessage).filter(models.PersonaMessage.thread_id == row.id).count()}
        for row in rows
    ]


@router.post("/api/personas/{persona_id}/threads")
def create_thread(persona_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    row = models.PersonaThread(
        persona_id=persona_id, owner_user_id=OWNER,
        title=str((payload or {}).get("title") or "新对话")[:120],
    )
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "title": row.title}


@router.delete("/api/personas/{persona_id}/threads/{thread_id}")
def delete_thread(persona_id: str, thread_id: str, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    row = _thread(db, persona_id, thread_id)
    db.query(models.PersonaMessage).filter(models.PersonaMessage.thread_id == row.id).delete(synchronize_session=False)
    db.delete(row); db.commit()
    return {"status": "removed"}


@router.get("/api/personas/{persona_id}/threads/{thread_id}/messages")
def list_messages(persona_id: str, thread_id: str, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    _thread(db, persona_id, thread_id)
    rows = db.query(models.PersonaMessage).filter(
        models.PersonaMessage.thread_id == thread_id
    ).order_by(models.PersonaMessage.created_at.asc()).all()
    return [_message_row(row) for row in rows]


@router.get("/api/personas/{persona_id}/memories")
def list_memories(persona_id: str, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    rows = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.persona_id == persona_id
    ).order_by(models.PersonaMemory.importance.desc(), models.PersonaMemory.created_at.desc()).all()
    return [
        {"id": row.id, "thread_id": row.thread_id, "kind": row.kind, "content": row.content,
         "importance": row.importance, "source": row.source, "created_at": row.created_at}
        for row in rows
    ]


@router.post("/api/personas/{persona_id}/memories")
def create_memory(persona_id: str, payload: dict, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    content = str(payload.get("content") or "").strip()[:4000]
    if not content:
        raise HTTPException(status_code=422, detail="记忆内容不能为空")
    row = models.PersonaMemory(
        persona_id=persona_id,
        thread_id=str(payload.get("thread_id") or "").strip() or None,
        kind=str(payload.get("kind") or "episodic")[:30],
        content=content,
        importance=max(0.0, min(1.0, float(payload.get("importance") or 0.4))),
        source=str(payload.get("source") or "user")[:30],
    )
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, "content": row.content, "importance": row.importance}


@router.delete("/api/personas/{persona_id}/memories/{memory_id}")
def delete_memory(persona_id: str, memory_id: str, db: Session = Depends(get_db)):
    _persona(db, persona_id)
    row = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.id == memory_id,
        models.PersonaMemory.persona_id == persona_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="记忆不存在")
    db.delete(row); db.commit()
    return {"status": "removed"}


def _prompt(persona: models.PersonalPersona, memories: list[models.PersonaMemory]) -> str:
    esa = persona.esa if isinstance(persona.esa, dict) else {}
    cognition = persona.cognition if isinstance(persona.cognition, dict) else {}
    expression = persona.expression if isinstance(persona.expression, dict) else {}
    interaction = persona.interaction if isinstance(persona.interaction, dict) else {}
    policy = persona.memory_policy if isinstance(persona.memory_policy, dict) else {}
    lines = [
        f"你是用户的个人 AI 人格「{persona.name}」。你不是世界 NPC，不代表任何虚构角色。",
        f"身份：{persona.identity or '用户的个人 AI 伙伴'}",
        f"自我描述：{persona.description or '保持稳定、诚实、可协作。'}",
        "",
        "【ESA 人格动力】",
        json.dumps(esa, ensure_ascii=False, indent=2),
        "【特征】" + "、".join(str(item) for item in (persona.traits or [])),
        "【认知倾向】" + json.dumps(cognition, ensure_ascii=False, indent=2),
        "【表达风格】" + json.dumps(expression, ensure_ascii=False, indent=2),
        "【互动关系】" + json.dumps(interaction, ensure_ascii=False, indent=2),
        "",
        "行为要求：",
        "1. 保持该人格的认知与表达方式，不要变成通用客服口吻。",
        "2. 可以日常闲聊、情感互动、知识问答、信息整理和实际任务协助。",
        "3. 不编造用户没有授权的事实；不确定时明确说明。",
        "4. 你的记忆只属于本对话与本人格，不得声称记得其他人格的私密内容。",
    ]
    if policy.get("share_public_profile") and isinstance(persona.public_profile, dict):
        lines.append("【用户授权共享的公共资料】")
        lines.append(json.dumps(persona.public_profile, ensure_ascii=False, indent=2))
    else:
        lines.append("【用户公共资料】未授权共享，不要假设或引用。")
    if memories:
        lines.append("【本人格记忆】")
        for memory in memories[:8]:
            lines.append(f"- {memory.content}")
    return "\n".join(lines)


@router.post("/api/personas/{persona_id}/chat")
def persona_chat(persona_id: str, payload: dict, db: Session = Depends(get_db)):
    persona = _persona(db, persona_id)
    text = str(payload.get("message") or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="消息不能为空")
    thread_id = str(payload.get("thread_id") or "").strip() or None
    thread = _thread(db, persona_id, thread_id) if thread_id else None
    if not thread:
        thread = models.PersonaThread(
            persona_id=persona_id, owner_user_id=OWNER,
            title=text[:40] or "新对话",
        )
        db.add(thread); db.flush()

    history = db.query(models.PersonaMessage).filter(
        models.PersonaMessage.thread_id == thread.id
    ).order_by(models.PersonaMessage.created_at.asc()).all()
    user_message = models.PersonaMessage(
        thread_id=thread.id, persona_id=persona_id, role="user", content=text[:4000],
    )
    db.add(user_message); db.flush()

    memories = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.persona_id == persona_id
    ).order_by(models.PersonaMemory.importance.desc(), models.PersonaMemory.created_at.desc()).limit(8).all()

    if not ai_config_status()["configured"]:
        db.commit()
        raise HTTPException(status_code=503, detail=ai_config_status()["message"])

    history_payload = [{"role": "user" if row.role == "user" else "assistant", "content": row.content}
                       for row in history[-14:] if row.content]
    history_payload.append({"role": "user", "content": text[:4000]})
    try:
        response = get_client().chat.completions.create(
            model=get_model(),
            messages=[{"role": "system", "content": _prompt(persona, memories)}] + history_payload,
            temperature=0.7,
            timeout=90.0,
        )
        reply = str(response.choices[0].message.content or "").strip()
    except Exception as error:
        db.commit()
        raise HTTPException(status_code=502, detail=ai_error_message(error))
    if not reply:
        reply = "我在。可以再说具体一点吗？"
    assistant_message = models.PersonaMessage(
        thread_id=thread.id, persona_id=persona_id, role="persona", content=reply[:8000],
    )
    db.add(assistant_message)
    thread.updated_at = datetime.utcnow()
    thread.summary = reply[:500]
    if payload.get("remember") and isinstance(payload.get("remember"), str):
        db.add(models.PersonaMemory(
            persona_id=persona_id, thread_id=thread.id, kind="explicit",
            content=str(payload.get("remember"))[:4000], importance=0.8, source="user",
        ))
    db.commit()
    return {
        "reply": reply, "thread_id": thread.id,
        "persona": {"id": persona.id, "name": persona.name},
        "message_id": assistant_message.id,
    }
