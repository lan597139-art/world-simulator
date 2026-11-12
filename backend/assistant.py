"""全局 AI 助手：基于当前页面上下文对话，并产出可确认的结构化操作。

前端在每次请求里带上页面、世界、当前对象、可见表单字段与选中文本；
本模块只做「上下文压缩 + 受控动作生成」，所有写操作都由用户在前端二次确认。
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from ai_engine import ai_config_status, ai_error_message, get_client, get_model
from auth import current_user
from common import fail
from database import get_db
from axis_objects import effective_objects, aggregate_axis
from yunbao import active_state, ensure_yunbao, ensure_yunbao_instance, profile_prompt
from ai_grants import authorized_entries

router = APIRouter()

PAGES = {
    "home", "overview", "world-management", "world-building", "world-data", "world-structure",
    "character-management", "relationships", "events", "timeline", "simulation",
    "multipath", "writing", "archive", "trash", "time-machine", "chat", "personas",
    "yunbao", "yunbao-seed", "memories", "companion-runtime", "information-sources", "diary", "storyline",
}

PAGE_LABELS = {
    "home": "选择产品",
    "overview": "世界总览",
    "world-management": "世界管理",
    "world-building": "世界建设配置",
    "world-data": "世界设定",
    "world-structure": "世界结构",
    "character-management": "人物管理",
    "chat": "AI 角色聊天",
    "relationships": "关系与组织",
    "events": "事件管理",
    "timeline": "时间线",
    "simulation": "模拟运行",
    "storyline": "故事线管理",
    "multipath": "多路径推演",
    "writing": "写作辅助",
    "archive": "归档库",
    "trash": "回收站",
    "time-machine": "时光机",
    "personas": "云宝人格",
    "memories": "记忆管理",
    "companion-runtime": "人格运行",
    "information-sources": "信息来源管理",
    "diary": "日记与传记",
}

ENTITY_TYPES = {"world", "character", "event", "story", "location", "organization"}

EDITABLE_FIELDS = {
    "world": {"name", "description", "background", "type"},
    "character": {"name", "basic_profile"},
    "event": {"name", "description", "polarity", "intensity", "story_time", "storyline", "scale"},
    "story": {"title", "content", "summary"},
    "location": {"name", "description", "type"},
    "organization": {"name", "description", "type"},
}

MAX_ACTIONS = 4


def _clip(value, limit: int = 600) -> str:
    text = str(value or "")
    return text if len(text) <= limit else text[:limit] + "…"


def _entity_summary(db: Session, entity_type: str, entity_id: str) -> Optional[dict]:
    if entity_type not in ENTITY_TYPES or not entity_id:
        return None
    model = {
        "world": models.World,
        "character": models.Character,
        "event": models.Event,
        "story": models.Story,
        "location": models.Location,
        "organization": models.Organization,
    }[entity_type]
    row = db.query(model).filter(model.id == entity_id).first()
    if not row:
        return None

    if entity_type == "character":
        basic = row.basic_profile if isinstance(row.basic_profile, dict) else {}
        return {
            "type": "character",
            "id": row.id,
            "name": row.name,
            "basic_profile": {
                key: (basic.get(key) if not isinstance(basic.get(key), (dict, list)) else json.dumps(basic.get(key), ensure_ascii=False)[:200])
                for key in ("name", "gender", "age", "identity", "personality", "background")
                if key in basic
            },
            "engines": row.engines if isinstance(row.engines, dict) else {},
        }
    if entity_type == "event":
        return {
            "type": "event",
            "id": row.id,
            "name": row.name,
            "description": _clip(row.description, 400),
            "polarity": row.polarity,
            "intensity": row.intensity,
            "story_time": row.story_time,
            "participants": len(row.participants or []),
        }
    if entity_type == "story":
        return {
            "type": "story",
            "id": row.id,
            "title": getattr(row, "title", ""),
            "content": _clip(getattr(row, "content", ""), 500),
        }
    if entity_type == "world":
        return {
            "type": "world",
            "id": row.id,
            "name": row.name,
            "type": row.type,
            "official": bool(row.is_official),
            "background": _clip(row.background, 500),
        }
    return {
        "type": entity_type,
        "id": row.id,
        "name": row.name,
        "description": _clip(getattr(row, "description", ""), 300),
    }


def _axis_summary(db: Session, world_id: str, settings: dict) -> dict:
    objects = effective_objects(db, world_id)
    if objects:
        return aggregate_axis(objects)
    return settings.get("six_axis") if isinstance(settings.get("six_axis"), dict) else {}


def _world_context(db: Session, world_id: str) -> Optional[dict]:
    world = db.query(models.World).filter(models.World.id == world_id).first()
    if not world:
        return None
    settings = world.settings if isinstance(world.settings, dict) else {}
    character_count = (
        db.query(models.Character)
        .filter(models.Character.world_id == world_id, models.Character.archived_at.is_(None))
        .count()
    )
    events = (
        db.query(models.Event)
        .filter(models.Event.world_id == world_id, models.Event.branch_id.is_(None))
        .order_by(models.Event.created_at.desc())
        .limit(6)
        .all()
    )
    return {
        "id": world.id,
        "name": world.name,
        "type": world.type,
        "official": bool(world.is_official),
        "background": _clip(world.background, 700),
        "six_axis": _axis_summary(db, world_id, settings),
        "axis_objects": effective_objects(db, world_id)[:24],
        "character_count": character_count,
        "recent_events": [
            {
                "name": row.name,
                "polarity": row.polarity,
                "intensity": row.intensity,
                "story_time": row.story_time,
            }
            for row in events
        ],
    }


def _clean_form(form) -> list:
    if not isinstance(form, dict):
        return []
    raw = form.get("fields")
    if not isinstance(raw, list):
        return []
    fields = []
    for item in raw[:40]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("name") or "").strip()
        if not label:
            continue
        fields.append(
            {
                "label": label[:80],
                "name": str(item.get("name") or "")[:80],
                "type": str(item.get("type") or "")[:24],
                "value": _clip(item.get("value"), 300),
            }
        )
    return fields


def _clean_targets(context: dict) -> list:
    raw = context.get("dom_targets")
    if not isinstance(raw, list):
        return []
    targets = []
    for item in raw[:40]:
        if not isinstance(item, dict):
            continue
        ai_id = str(item.get("ai_id") or "").strip()[:60]
        if not ai_id:
            continue
        kind = "input" if str(item.get("kind")) == "input" else "click"
        targets.append(
            {
                "ai_id": ai_id,
                "kind": kind,
                "label": _clip(item.get("label"), 60),
                "tag": str(item.get("tag") or "")[:16],
            }
        )
    return targets


def _context_label(
    context: dict, world: Optional[dict], entity: Optional[dict], yunbao_state: Optional[dict] = None
) -> str:
    parts = []
    if yunbao_state:
        parts.append(f"云宝 · {yunbao_state['label']}")
    if world:
        parts.append(f"世界：{world['name']}")
    page_label = str(context.get("page_label") or PAGE_LABELS.get(str(context.get("page") or ""), "当前页面"))
    parts.append(f"页面：{page_label}")
    if entity:
        parts.append(f"对象：{entity.get('name') or entity.get('title') or entity.get('id')}")
    return " · ".join(parts) if parts else "当前页面"


def _prompt(
    context: dict,
    world: Optional[dict],
    entity: Optional[dict],
    fields: list,
    selection: str,
    targets: Optional[list] = None,
    demo: bool = False,
    persona_prompt: str = "",
) -> str:
    if persona_prompt:
        prompt = persona_prompt + "\n\n"
        prompt += "你同时是「世界模拟器」的全局 AI 助手，可以结合当前页面上下文对话并给出可确认操作。\n"
    else:
        prompt = "你是「世界模拟器」内置的全局操作助手。\n"
    prompt += "规则：\n"
    prompt += "1. 只能使用下方【上下文】里的信息，不得编造人物、事件、ID 或字段值；信息不足时明确说缺什么。\n"
    prompt += "2. 中文简体；先给可执行结论，再给 1-2 句依据；总长不超过 220 字；不要 Markdown 标题与代码块。\n"
    prompt += "3. 如果用户想修改内容，把修改放进 actions，由用户确认后前端执行；不要声称已经改好。\n"
    prompt += "4. 不要提供删除、清空、归档、覆盖主时间线等不可逆操作。\n"
    if persona_prompt:
        prompt += "5. 保持云宝的当前常态与表达特征，但不得因为角色扮演而隐瞒事实或拒绝协助。\n\n"
    else:
        prompt += "\n"
    prompt += "【上下文】\n"
    prompt += "页面：" + str(context.get("page_label") or PAGE_LABELS.get(str(context.get("page") or ""), "未知")) + "\n"
    if world:
        prompt += "当前世界：" + json.dumps(world, ensure_ascii=False) + "\n"
    if entity:
        prompt += "当前对象：" + json.dumps(entity, ensure_ascii=False) + "\n"
    if fields:
        prompt += "当前可见表单字段：" + json.dumps(fields, ensure_ascii=False) + "\n"
    if selection:
        prompt += "用户选中文本：" + selection + "\n"
    if targets:
        prompt += "可操作元素（dom_targets）：" + json.dumps(targets, ensure_ascii=False) + "\n"
    if not world and not entity and not fields:
        prompt += "（当前没有可用的世界或对象上下文）\n"

    prompt += "\n【可用动作】\n"
    prompt += '- {"type":"fill_form","fields":{"表单字段label":"值"},"summary":"说明"}：只能填上面存在的字段。\n'
    prompt += (
        '- {"type":"update_entity","entity_type":"对象类型","entity_id":"对象ID","fields":{"字段":"值"},"summary":"说明"}：'
        f"entity_type ∈ {sorted(ENTITY_TYPES)}；entity_id 必须等于当前对象 ID；"
        f"fields 允许的键：{json.dumps({k: sorted(v) for k, v in EDITABLE_FIELDS.items()}, ensure_ascii=False)}。\n"
    )
    prompt += (
        '- {"type":"navigate","page":"页面key","summary":"说明"}：'
        f"page ∈ {sorted(PAGES)}。\n"
    )
    prompt += '- {"type":"click","ai_id":"dom_targets 里的 ai_id","summary":"说明"}：点击页面按钮；也可以用 text 精确匹配 dom_targets 的 label。\n'
    prompt += '- {"type":"fill","id":"dom_targets 里 kind=input 的 ai_id","value":"要填入的内容","summary":"说明"}。\n'
    prompt += "没有合适动作就返回空数组。\n\n"
    if demo:
        prompt += (
            "【演示模式（用户点了「观看 AI 演示本页」）】\n"
            "你是新手导师：用 3 步演示在当前页面创建一条分支并准备推演。\n"
            "必须一次性返回完整的 3 个动作，顺序固定，不要只返回第一步、不要分多轮：\n"
            "1) click：选中事件列表里的一个事件按钮；\n"
            "2) fill：id 用 dom_targets 中 label 含「分支名称」的 input，value 为「演示分支：隐忍」；\n"
            "3) click：ai_id 用 dom_targets 中 label 为「新建分支」的按钮。\n"
            "reply 里用「第 1/2/3 步」简述这三步，并告诉用户最后在哪里点推演；"
            "不要点击「开始推演」，只能使用 dom_targets 中存在的 ai_id。\n\n"
        )
    prompt += (
        "【输出】严格 JSON（不要 Markdown）：\n"
        '{"reply":"给用户的回答","actions":[]}\n'
    )
    return prompt


def _sanitize_actions(
    raw, context: dict, entity: Optional[dict], fields: list, targets: Optional[list] = None
) -> list:
    if not isinstance(raw, list):
        return []
    labels = {item["label"] for item in fields}
    targets = targets or []
    target_by_id = {item["ai_id"]: item for item in targets}
    context_entity_id = str(context.get("entity_id") or "")
    actions = []
    for item in raw[:MAX_ACTIONS * 2]:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type") or "")
        summary = _clip(item.get("summary"), 120)
        if kind == "fill_form":
            payload = item.get("fields")
            if not isinstance(payload, dict):
                continue
            clean = {}
            for key, value in list(payload.items())[:20]:
                if str(key) not in labels:
                    continue
                if isinstance(value, (dict, list)):
                    continue
                clean[str(key)] = _clip(value, 400)
            if clean:
                actions.append({"type": "fill_form", "fields": clean, "summary": summary})
        elif kind == "update_entity":
            entity_type = str(item.get("entity_type") or "")
            entity_id = str(item.get("entity_id") or "")
            if entity_type not in ENTITY_TYPES or not context_entity_id or entity_id != context_entity_id:
                continue
            if not entity or str(entity.get("type")) != entity_type:
                continue
            payload = item.get("fields")
            if not isinstance(payload, dict):
                continue
            allowed = EDITABLE_FIELDS[entity_type]
            clean = {}
            for key, value in list(payload.items())[:10]:
                if key not in allowed:
                    continue
                if isinstance(value, (dict, list)):
                    if key == "basic_profile" and isinstance(value, dict):
                        clean[key] = {str(k)[:40]: _clip(v, 400) for k, v in list(value.items())[:12]}
                    continue
                clean[key] = _clip(value, 1200)
            if clean:
                actions.append(
                    {
                        "type": "update_entity",
                        "entity_type": entity_type,
                        "entity_id": entity_id,
                        "fields": clean,
                        "summary": summary,
                    }
                )
        elif kind == "click":
            ai_id = str(item.get("ai_id") or "").strip()
            text = str(item.get("text") or "").strip()
            selector = str(item.get("selector") or "").strip()
            if ai_id and ai_id in target_by_id:
                actions.append({"type": "click", "ai_id": ai_id, "summary": summary})
            elif text and any(text == target["label"] or text in target["label"] for target in targets):
                actions.append({"type": "click", "text": text[:40], "summary": summary})
            elif selector:
                matched = next(
                    (
                        target
                        for target in targets
                        if selector == f'[data-ai-id="{target["ai_id"]}"]'
                    ),
                    None,
                )
                if matched:
                    actions.append({"type": "click", "ai_id": matched["ai_id"], "summary": summary})
        elif kind == "fill":
            target_id = str(item.get("id") or "").strip()
            value = item.get("value")
            target = target_by_id.get(target_id)
            if target and target["kind"] == "input" and not isinstance(value, (dict, list)):
                actions.append(
                    {"type": "fill", "id": target_id, "value": _clip(value, 200), "summary": summary}
                )
        elif kind == "navigate":
            page = str(item.get("page") or "")
            if page in PAGES:
                actions.append({"type": "navigate", "page": page, "summary": summary})
        if len(actions) >= MAX_ACTIONS:
            break
    return actions


@router.get("/api/assistant/health")
def assistant_health():
    """供前端自检：确认当前后端是否加载了助手接口。"""
    status = ai_config_status()
    return {
        "ok": True,
        "route": "/api/assistant/chat",
        "ai_configured": bool(status.get("configured")),
        "model": status.get("model"),
        "base_url": status.get("base_url"),
        "message": status.get("message"),
    }


@router.post("/api/assistant/chat")
def assistant_chat(payload: dict, request: Request, db: Session = Depends(get_db)):
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages:
        fail(422, "VALIDATION_ERROR", "缺少对话内容")
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    yunbao_request = payload.get("yunbao") if isinstance(payload.get("yunbao"), dict) else None

    history = []
    for item in messages[-18:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "")
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        history.append({"role": role, "content": _clip(content, 3000)})
    if not history:
        fail(422, "VALIDATION_ERROR", "对话内容为空")

    world_id = str(context.get("world_id") or "")
    world = _world_context(db, world_id) if world_id else None
    entity = _entity_summary(db, str(context.get("entity_type") or ""), str(context.get("entity_id") or ""))
    fields = _clean_form(context.get("form"))
    selection = _clip(context.get("selection"), 500)
    targets = _clean_targets(context)
    demo = bool(context.get("demo"))

    cloud = None
    cloud_user = None
    cloud_instance = None
    cloud_thread = None
    cloud_state = None
    cloud_memories = []
    authorized_context = []
    if yunbao_request:
        cloud_user = current_user(request, db)
        cloud = ensure_yunbao(db)
        cloud_instance = ensure_yunbao_instance(db, cloud_user)
        cloud_state = active_state(cloud)
        authorized_context = authorized_entries(
            db, cloud_user.id, cloud_instance.id, purpose="chat_context", limit=3,
        )
        thread_id = str(yunbao_request.get("thread_id") or "").strip()
        if thread_id:
            cloud_thread = db.query(models.PersonaThread).filter(
                models.PersonaThread.id == thread_id,
                models.PersonaThread.persona_id == cloud.id,
                models.PersonaThread.instance_id == cloud_instance.id,
                models.PersonaThread.owner_user_id == cloud_user.id,
                models.PersonaThread.status != "archived",
            ).first()
        if not cloud_thread:
            title = next((item["content"] for item in reversed(history) if item["role"] == "user"), "与云宝的对话")
            cloud_thread = models.PersonaThread(
                persona_id=cloud.id, owner_user_id=cloud_user.id,
                instance_id=cloud_instance.id, title=title[:40] or "与云宝的对话",
            )
            db.add(cloud_thread)
            db.flush()
        cloud_memories = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.persona_id == cloud.id,
            models.PersonaMemory.owner_user_id == cloud_user.id,
            models.PersonaMemory.persona_instance_id == cloud_instance.id,
            models.PersonaMemory.status == "active",
        ).order_by(
            models.PersonaMemory.importance.desc(), models.PersonaMemory.created_at.desc()
        ).limit(8).all()

    if not ai_config_status()["configured"]:
        raise HTTPException(status_code=503, detail=ai_config_status()["message"])

    persona_prompt = profile_prompt(cloud, cloud_memories, db, include_private=bool(cloud_user and cloud_user.is_owner)) if cloud else ""
    if authorized_context:
        lines = [
            f"- {item['entry_date']} {item['title']}：{item['content'][:500]}"
            for item in authorized_context
        ]
        persona_prompt += "\n\n【用户明确授权的私人背景】\n" + "\n".join(lines)
    system = _prompt(
        context, world, entity, fields, selection, targets, demo, persona_prompt=persona_prompt,
    )
    try:
        response = get_client().chat.completions.create(
            model=get_model(),
            messages=[{"role": "system", "content": system}] + history,
            response_format={"type": "json_object"},
            temperature=0.4,
            timeout=90.0,
        )
        data = json.loads(response.choices[0].message.content)
    except Exception as error:
        raise HTTPException(status_code=502, detail=ai_error_message(error))

    if not isinstance(data, dict):
        data = {}
    reply = str(data.get("reply") or "").strip()
    if not reply:
        if cloud:
            reply = "我在。可以再说具体一点吗？"
        else:
            reply = "我看到了当前页面，但没有拿到足够信息来回答。可以补充具体对象或问题吗？"
    actions = _sanitize_actions(data.get("actions"), context, entity, fields, targets)

    if cloud and cloud_thread and cloud_user and cloud_state:
        last_user = next((item["content"] for item in reversed(history) if item["role"] == "user"), "")
        db.add(models.PersonaMessage(
            thread_id=cloud_thread.id, persona_id=cloud.id, role="user",
            content=last_user[:4000], meta={"state": cloud_state["key"], "page": context.get("page")},
        ))
        db.add(models.PersonaMessage(
            thread_id=cloud_thread.id, persona_id=cloud.id, role="persona",
            content=reply[:8000], meta={"state": cloud_state["key"], "source": "assistant"},
        ))
        cloud_thread.updated_at = datetime.utcnow()
        cloud_thread.summary = reply[:500]
        db.commit()

    return {
        "reply": reply[:4000],
        "actions": actions,
        "context_label": _context_label(context, world, entity, cloud_state if cloud else None),
        "thread_id": cloud_thread.id if cloud_thread else None,
        "yunbao": {
            "id": cloud.id,
            "name": cloud.name,
            "instance_id": cloud_instance.id if cloud_instance else None,
            "state": cloud_state,
        } if cloud and cloud_state else None,
    }
