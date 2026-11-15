"""08 写作工作台：生成时的按需上下文注入。

核心原则：只注入作者勾选的块，每块单独限长，绝不一次性把整个世界塞给模型。
"""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

import models

BLOCK_LIMITS = {
    "world": 1200,
    "characters": 2000,
    "events": 1800,
    "previous": 1200,
}
TOTAL_LIMIT = 6000


def _clip(value: str, limit: int) -> str:
    text = (value or "").strip()
    return text[:limit]


def _world_block(db: Session, world: models.World) -> str:
    parts = [f"【世界】{world.name}\n{_clip(world.description, 500)}"]
    if world.background:
        parts.append(f"【世界背景】\n{_clip(world.background, 700)}")
    rules = (
        db.query(models.WorldRule)
        .filter(models.WorldRule.world_id == world.id, models.WorldRule.status == "active")
        .order_by(models.WorldRule.priority.desc(), models.WorldRule.created_at.asc())
        .limit(8)
        .all()
    )
    if rules:
        lines = []
        for rule in rules:
            detail = rule.description or rule.consequences or rule.conditions
            lines.append(f"- {rule.name}：{_clip(detail, 90)}")
        parts.append("【世界硬限制】\n" + "\n".join(lines))
    return _clip("\n\n".join(parts), BLOCK_LIMITS["world"])


def _characters_block(db: Session, world_id: str, events: list[models.Event], direction: str) -> str:
    names: set[str] = set()
    haystack_parts = [direction]
    for event in events:
        for value in event.participants or []:
            if isinstance(value, str):
                names.add(value)
        for value in event.affected or []:
            if isinstance(value, str):
                names.add(value)
        haystack_parts.append(event.description or "")
    haystack = "\n".join(haystack_parts)

    rows = db.query(models.Character).filter(models.Character.world_id == world_id).all()
    selected: list[models.Character] = []
    for row in rows:
        if row.name in names or (row.name and row.name in haystack):
            selected.append(row)
        if len(selected) >= 6:
            break

    if not selected:
        return ""

    lines = []
    for character in selected:
        profile = character.basic_profile or {}
        engines = character.engines or {}
        runtime = character.runtime_state or {}
        payload = {
            "姓名": character.name,
            "身份": profile.get("role") or profile.get("identity") or "",
            "五引擎": engines,
            "核心欲望": profile.get("desire") or runtime.get("desire") or "",
            "最大恐惧": profile.get("fear") or runtime.get("fear") or "",
            "绝对底线": profile.get("bottom_line") or runtime.get("bottom_line") or "",
            "当前状态": runtime.get("state") or runtime.get("summary") or "",
        }
        lines.append(json.dumps(payload, ensure_ascii=False))
    return _clip("【出场人物设定】\n" + "\n".join(lines), BLOCK_LIMITS["characters"])


def _events_block(
    db: Session,
    events: list[models.Event],
    sims: list[models.SimulationRun],
    detailed: bool,
) -> str:
    lines = ["【本章事件】"]
    for event in events:
        if not detailed:
            lines.append(f"- [{event.story_time or '某时'}] {event.name}")
            continue
        location = ""
        organization = ""
        if event.location_id:
            loc = db.query(models.Location).filter(models.Location.id == event.location_id).first()
            if loc:
                location = f"在{loc.name}"
        if event.organization_id:
            org = db.query(models.Organization).filter(models.Organization.id == event.organization_id).first()
            if org:
                organization = f"涉及{org.name}"
        lines.append(
            f"- [{event.story_time or '某时'}] {event.name} {location}{organization}: {_clip(event.description, 220)}"
        )

    if detailed:
        lines.append("\n【人物反应与行动】")
        if not sims:
            lines.append("- 尚无推演记录，请依据事件本身合理呈现人物反应。")
        for simulation in sims:
            lines.append(f"- 世界变化: {_clip(simulation.world_changes, 240)}")
            for action in simulation.character_actions or []:
                if not isinstance(action, dict):
                    continue
                lines.append(
                    f"  * {action.get('name')} ({action.get('engine')}): "
                    f"{_clip(str(action.get('action') or ''), 120)}；结果：{_clip(str(action.get('status') or ''), 80)}"
                )
    return _clip("\n".join(lines), BLOCK_LIMITS["events"])


def _previous_block(db: Session, story: models.Story | None, world_id: str) -> str:
    query = db.query(models.Story).filter(
        models.Story.world_id == world_id,
        models.Story.archived_at.is_(None),
    )
    if story:
        query = query.filter(
            models.Story.id != story.id,
            models.Story.created_at < story.created_at,
        )
        if story.owner_user_id:
            query = query.filter(models.Story.owner_user_id == story.owner_user_id)
    rows = query.order_by(models.Story.created_at.desc()).limit(3).all()
    if not rows:
        return ""
    lines = ["【前置章节概要】"]
    for row in reversed(rows):
        summary = (row.plain_text or "").strip()
        if not summary:
            continue
        lines.append(f"- {row.title}：{_clip(summary, 500)}")
    return _clip("\n".join(lines), BLOCK_LIMITS["previous"])


def build_generation_context(
    db: Session,
    *,
    world: models.World | None,
    events: list[models.Event],
    sims: list[models.SimulationRun],
    story: models.Story | None,
    options: dict,
) -> str:
    """按 context_options 拼装，顺序固定，最后统一裁剪到总预算。"""
    blocks: list[str] = []
    if world and options.get("world", True):
        blocks.append(_world_block(db, world))
    if world and options.get("characters", True):
        blocks.append(_characters_block(db, world.id, events, str(options.get("direction") or "")))
    if options.get("events", True):
        blocks.append(_events_block(db, events, sims, detailed=True))
    elif events:
        blocks.append(_events_block(db, events, sims, detailed=False))
    if world and options.get("previous", True):
        blocks.append(_previous_block(db, story, world.id))

    context = "\n\n".join(block for block in blocks if block).strip()
    return context[:TOTAL_LIMIT]
