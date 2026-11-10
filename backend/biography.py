"""人物传记与履历：聚合事件、推演行动、成长记录，一键生成自传。"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from ai_engine import ai_config_status, ai_error_message, get_client, get_model
from database import get_db

router = APIRouter()


def _character_or_404(db: Session, character_id: str):
    row = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="人物不存在")
    return row


def _snippet(text: str, limit: int = 320) -> str:
    value = " ".join(str(text or "").split())
    return value if len(value) <= limit else value[:limit] + "…"


def _life_entries(character: models.Character) -> list[dict]:
    history = character.life_history
    raw = history.get("events", []) if isinstance(history, dict) else (history or [])
    if not isinstance(raw, list):
        return []
    entries = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        entries.append({
            "kind": "life",
            "time": item.get("startTime") or item.get("time") or "",
            "title": item.get("name") or "生平经历",
            "description": item.get("facts") or item.get("description") or "",
            "impact": item.get("lifeImpact") or item.get("cognition") or "",
            "polarity": item.get("polarity") or "",
            "source": "life_history",
        })
    return entries


def _timeline(db: Session, character: models.Character) -> tuple[list[dict], list[str], list[dict]]:
    world_id = character.world_id
    events = (
        db.query(models.Event)
        .filter(models.Event.world_id == world_id, models.Event.branch_id.is_(None))
        .all()
    )
    event_entities = {
        row.event_id
        for row in db.query(models.EventEntity).filter(
            models.EventEntity.world_id == world_id,
            models.EventEntity.entity_type == "character",
            models.EventEntity.entity_id == character.id,
        ).all()
    }
    involved = []
    for event in events:
        participants = event.participants or []
        affected = event.affected or []
        if (
            event.id in event_entities
            or character.id in participants
            or character.name in participants
            or character.id in affected
            or character.name in affected
        ):
            involved.append(event)
    event_ids = {event.id for event in involved}
    runs = (
        db.query(models.SimulationRun)
        .filter(
            models.SimulationRun.event_id.in_(event_ids),
            models.SimulationRun.branch_id.is_(None),
        )
        .order_by(models.SimulationRun.created_at.asc())
        .all()
        if event_ids else []
    )
    runs_by_event: dict[str, list[models.SimulationRun]] = {}
    for run in runs:
        runs_by_event.setdefault(run.event_id, []).append(run)

    chapters = (
        db.query(models.Story)
        .filter(models.Story.world_id == world_id)
        .all()
    )
    chapter_by_event: dict[str, list[str]] = {}
    for story in chapters:
        for event_id in (story.source_event_ids or []):
            chapter_by_event.setdefault(event_id, []).append(story.title)

    timeline: list[dict] = []
    for event in involved:
        actions = []
        relation_changes = []
        changes = []
        for run in runs_by_event.get(event.id, []):
            if run.world_changes:
                changes.append(_snippet(run.world_changes, 240))
            for action in (run.character_actions or []):
                if isinstance(action, dict) and character.name and character.name in str(action.get("name") or ""):
                    actions.append({
                        "engine": action.get("engine") or "",
                        "action": action.get("action") or "",
                        "status": action.get("status") or "",
                    })
        timeline.append({
            "kind": "event",
            "id": event.id,
            "time": event.story_time or (event.occurred_at.isoformat() if event.occurred_at else ""),
            "title": event.name,
            "description": _snippet(event.description),
            "polarity": event.polarity,
            "intensity": event.intensity,
            "storyline": event.storyline,
            "actions": actions,
            "world_changes": changes,
            "chapters": chapter_by_event.get(event.id, []),
        })
        relation_changes.extend([])

    timeline.extend(_life_entries(character))
    runtime = character.runtime_state or {}
    for entry in (runtime.get("growth_log") or []):
        if not isinstance(entry, dict):
            continue
        timeline.append({
            "kind": "growth",
            "time": entry.get("time") or entry.get("created_at") or "",
            "title": "成长校准",
            "description": entry.get("reason") or "",
            "impact": entry.get("main_color") or "",
            "polarity": "",
            "source": "growth",
        })

    timeline.sort(key=lambda item: (str(item.get("time") or "9999"), str(item.get("title") or "")))
    source_event_ids = [event.id for event in involved]
    return timeline, source_event_ids, [
        {
            "time": run.created_at.isoformat() if run.created_at else "",
            "world_changes": _snippet(run.world_changes, 240),
        }
        for run in runs
    ]


def _relationships(db: Session, character: models.Character) -> list[dict]:
    rows = db.query(models.Relationship).filter(
        models.Relationship.world_id == character.world_id,
        ((models.Relationship.source_id == character.id) | (models.Relationship.target_id == character.id)),
    ).all()
    result = []
    for row in rows:
        other_id = row.target_id if row.source_id == character.id else row.source_id
        other_type = row.target_type if row.source_id == character.id else row.source_type
        model = {
            "character": models.Character,
            "location": models.Location,
            "organization": models.Organization,
            "event": models.Event,
            "resource": models.Resource,
        }.get(other_type or "character")
        other = db.query(model).filter(model.id == other_id).first() if model else None
        result.append({
            "id": row.id,
            "other_id": other_id,
            "other_name": other.name if other else "未知对象",
            "other_type": other_type or "character",
            "relation_type": row.relation_type or "",
            "quadrant": row.source_quadrant if row.source_id == character.id else row.target_quadrant,
            "description": row.description or "",
        })
    return result


def _local_biography(character: models.Character, timeline: list[dict], relationships: list[dict]) -> str:
    profile = character.basic_profile or {}
    name = character.name or "无名者"
    identity = profile.get("identity") or profile.get("faction") or profile.get("origin") or ""
    lines = [f"# 《{name}·生平自传》", ""]
    intro = f"我是{name}。"
    if identity:
        intro += f"{identity}。"
    if profile.get("summary"):
        intro += str(profile["summary"])
    lines.append(intro)
    lines.append("")
    if relationships:
        lines.append("与我命运相连的人：" + "、".join(
            f"{item['other_name']}（{item['relation_type'] or item['quadrant'] or '相识'}）"
            for item in relationships[:12]
        ) + "。")
        lines.append("")
    if not timeline:
        lines.append("至今还没有被记录下来的重大经历。")
    for item in timeline:
        prefix = f"【{item.get('time') or '未记时间'}】" if item.get("time") else "【未记时间】"
        lines.append(f"{prefix}{item.get('title') or '一段经历'}")
        if item.get("description"):
            lines.append(str(item["description"]))
        if item.get("impact"):
            lines.append(f"它留给我的影响：{item['impact']}")
        for action in item.get("actions") or []:
            lines.append(f"当时我{action.get('action') or '采取了行动'}；结果：{action.get('status') or '未定'}。")
        if item.get("chapters"):
            lines.append("相关章节：" + "、".join(item["chapters"]))
        lines.append("")
    lines.append("这些经历塑造了今天的我。此后无论走到哪里，我都会记得自己是从哪一步开始的。")
    return "\n".join(lines)


def _ai_biography(character: models.Character, timeline: list[dict], relationships: list[dict]) -> tuple[str, str]:
    status = ai_config_status()
    if not status["configured"]:
        return _local_biography(character, timeline, relationships), "local"
    prompt = f"""
你是一位严谨的中文传记作者。请根据给定资料，为人物“{character.name}”写一篇第一人称自传。

要求：
1. 只使用资料中的事实，不得编造未出现的事件、人物或设定。
2. 按时间顺序组织，写出人物处境、选择、代价与变化；不要写成流水账。
3. 1200—2000 字，中文，标题用《{character.name}·生平自传》。
4. 可以描写心理，但必须从已有经历合理推断。
5. 直接输出正文，不要 Markdown 代码块。

【人物基本资料】
{json.dumps(character.basic_profile or {}, ensure_ascii=False)[:4000]}

【人物关系】
{json.dumps(relationships, ensure_ascii=False)[:4000]}

【生平时间线】
{json.dumps(timeline, ensure_ascii=False)[:24000]}
"""
    try:
        response = get_client().chat.completions.create(
            model=get_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.65,
            timeout=90.0,
        )
        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ValueError("AI 返回空内容")
        return content, "ai"
    except Exception as exc:
        fallback = _local_biography(character, timeline, relationships)
        return fallback + f"\n\n> AI 生成暂不可用：{ai_error_message(exc)}", "local"


@router.get("/api/characters/{character_id}/biography")
def get_biography(character_id: str, db: Session = Depends(get_db)):
    character = _character_or_404(db, character_id)
    timeline, source_event_ids, runs = _timeline(db, character)
    latest = (
        db.query(models.CharacterBiography)
        .filter(models.CharacterBiography.character_id == character.id)
        .order_by(models.CharacterBiography.created_at.desc())
        .first()
    )
    return {
        "character": {
            "id": character.id,
            "name": character.name,
            "world_id": character.world_id,
            "basic_profile": character.basic_profile or {},
            "archived": character.archived_at is not None,
        },
        "timeline": timeline,
        "relationships": _relationships(db, character),
        "stats": {
            "events": len([item for item in timeline if item.get("kind") == "event"]),
            "life_entries": len([item for item in timeline if item.get("kind") == "life"]),
            "growth_entries": len([item for item in timeline if item.get("kind") == "growth"]),
            "simulations": len(runs),
        },
        "source_event_ids": source_event_ids,
        "latest": {
            "id": latest.id,
            "title": latest.title,
            "content": latest.content,
            "engine": latest.engine,
            "created_at": latest.created_at,
        } if latest else None,
        "ai_configured": ai_config_status()["configured"],
    }


@router.post("/api/characters/{character_id}/biography/generate")
def generate_biography(character_id: str, payload: dict | None = None, db: Session = Depends(get_db)):
    character = _character_or_404(db, character_id)
    timeline, source_event_ids, _ = _timeline(db, character)
    relationships = _relationships(db, character)
    content, engine = _ai_biography(character, timeline, relationships)
    title = f"《{character.name}·生平自传》"
    row = models.CharacterBiography(
        world_id=character.world_id,
        character_id=character.id,
        title=title,
        content=content,
        source_event_ids=source_event_ids,
        engine=engine,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "engine": row.engine,
        "created_at": row.created_at,
    }


@router.post("/api/characters/{character_id}/biography")
def save_biography(character_id: str, payload: dict, db: Session = Depends(get_db)):
    character = _character_or_404(db, character_id)
    content = str(payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="自传内容不能为空")
    row = models.CharacterBiography(
        world_id=character.world_id,
        character_id=character.id,
        title=str(payload.get("title") or f"《{character.name}·生平自传》")[:120],
        content=content,
        source_event_ids=payload.get("source_event_ids") or [],
        engine="manual",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
