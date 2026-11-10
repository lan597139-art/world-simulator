"""08 写作工作台：章节 CRUD、AI 生成/润色、素材提取与草稿入库。"""

from __future__ import annotations

import html as html_lib
import json
import re
from datetime import datetime
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

import models
from ai_engine import ai_config_status, ai_error_message, get_client, get_model
from common import fail, get_world, world_now
from database import get_db
from reference_guard import delete_entity

router = APIRouter()

VALID_MODES = {"architect", "explorer"}
VALID_STATUS = {"draft", "published"}
DRAFT_TYPES = {"character", "location", "event", "organization", "relationship"}
DRAFT_TARGETS = {
    "character": {"label": "人物库", "branch": "03 人物管理 / 人物档案", "detail": "人物档案，并挂到世界结构·人物与群体"},
    "location": {"label": "地点库", "branch": "世界结构 / 地理与地点", "detail": "地理地点（草稿状态）"},
    "event": {"label": "事件库", "branch": "05 事件管理", "detail": "世界事件（草稿状态）"},
    "organization": {"label": "组织库", "branch": "世界结构 / 组织与制度", "detail": "组织（草稿状态）"},
    "relationship": {"label": "关系库", "branch": "04 关系与组织", "detail": "人物之间的关系"},
}
TYPE_ALIASES = {
    "person": "character",
    "people": "character",
    "人物": "character",
    "角色": "character",
    "place": "location",
    "地点": "location",
    "场景": "location",
    "事件": "event",
    "组织": "organization",
    "势力": "organization",
    "关系": "relationship",
}

STORY_FIELDS = {
    "title",
    "content",
    "mode",
    "status",
    "source_event_ids",
    "source_simulation_ids",
}


# ---------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------


def _now() -> datetime:
    return datetime.utcnow()


def _strip_html(value: str) -> str:
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", value or "", flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</(p|div|h[1-6]|li|blockquote)>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html_lib.unescape(text).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _word_count(value: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9]+", value or ""))


def _plain(content: str, provided: str | None = None) -> str:
    return (provided or "").strip() or _strip_html(content)


def _as_list(value) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _story_or_404(db: Session, story_id: str) -> models.Story:
    story = db.query(models.Story).filter(models.Story.id == story_id).first()
    if not story:
        fail(404, "NOT_FOUND", "章节不存在")
    return story


def _draft_dict(db: Session, draft: models.EntityDraft) -> dict:
    story_title = None
    if draft.story_id:
        title = db.query(models.Story.title).filter(models.Story.id == draft.story_id).first()
        story_title = title[0] if title else None
    return {
        "id": draft.id,
        "world_id": draft.world_id,
        "story_id": draft.story_id,
        "story_title": story_title,
        "entity_type": draft.entity_type,
        "name": draft.name,
        "summary": draft.summary or "",
        "payload": draft.payload or {},
        "evidence": draft.evidence or "",
        "confidence": draft.confidence,
        "status": draft.status,
        "target_label": DRAFT_TARGETS.get(draft.entity_type, {}).get("label", ""),
        "target_branch": DRAFT_TARGETS.get(draft.entity_type, {}).get("branch", ""),
        "target_detail": DRAFT_TARGETS.get(draft.entity_type, {}).get("detail", ""),
        "approved_entity_id": (draft.payload or {}).get("entity_id") if isinstance(draft.payload, dict) else None,
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
    }


def _clean_title(value: str, fallback: str = "未命名章节") -> str:
    title = re.sub(r"\s+", " ", (value or "")).strip()
    return title[:80] or fallback


def _title_from_text(text: str, prefix: str) -> str:
    first = re.split(r"[。！？!?\n]", text.strip(), maxsplit=1)[0]
    if "“" in first:
        first = first.split("“", 1)[0]
    first = re.sub(r"^[#*\-\s]+", "", first).strip().strip("“”\"'：:，,、；; ")
    if not first:
        return prefix
    return _clean_title(first[:24], prefix)


# ---------------------------------------------------------------------
# 章节 CRUD
# ---------------------------------------------------------------------


@router.get("/api/writings")
def list_stories(world_id: str = "", db: Session = Depends(get_db)):
    query = db.query(models.Story).filter(models.Story.archived_at.is_(None))
    if world_id:
        query = query.filter(models.Story.world_id == world_id)
    return query.order_by(models.Story.updated_at.desc(), models.Story.created_at.desc()).all()


@router.get("/api/writings/{story_id}")
def get_story(story_id: str, db: Session = Depends(get_db)):
    return _story_or_404(db, story_id)


@router.post("/api/writings")
def create_story(payload: dict, db: Session = Depends(get_db)):
    world_id = payload.get("world_id") or ""
    if world_id:
        get_world(db, world_id)
    content = payload.get("content") or ""
    plain = _plain(content, payload.get("plain_text"))
    story = models.Story(
        world_id=world_id or None,
        title=_clean_title(payload.get("title") or "未命名章节"),
        content=content,
        plain_text=plain,
        word_count=_word_count(plain),
        mode=payload.get("mode") if payload.get("mode") in VALID_MODES else "explorer",
        status=payload.get("status") if payload.get("status") in VALID_STATUS else "draft",
        source_event_ids=_as_list(payload.get("source_event_ids")),
        source_simulation_ids=_as_list(payload.get("source_simulation_ids")),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


@router.post("/api/writings/save")
def save_story_compat(payload: dict, db: Session = Depends(get_db)):
    """兼容旧前端：保存一段正文并返回完整章节。"""
    content = payload.get("content") or ""
    if not content:
        fail(422, "VALIDATION_ERROR", "内容不能为空")
    return create_story(payload, db)


@router.put("/api/writings/{story_id}")
@router.patch("/api/writings/{story_id}")
def update_story(story_id: str, payload: dict, db: Session = Depends(get_db)):
    story = _story_or_404(db, story_id)
    for key in STORY_FIELDS:
        if key not in payload:
            continue
        value = payload[key]
        if key == "mode" and value not in VALID_MODES:
            continue
        if key == "status" and value not in VALID_STATUS:
            continue
        if key in {"source_event_ids", "source_simulation_ids"}:
            value = _as_list(value)
            setattr(story, key, value)
            flag_modified(story, key)
            continue
        if key == "title":
            value = _clean_title(value, story.title or "未命名章节")
        if key == "content":
            story.content = value or ""
            plain = _plain(story.content, payload.get("plain_text"))
            story.plain_text = plain
            story.word_count = _word_count(plain)
        else:
            setattr(story, key, value)
    if "plain_text" in payload and "content" not in payload:
        story.plain_text = payload.get("plain_text") or ""
        story.word_count = _word_count(story.plain_text)
    story.updated_at = _now()
    db.commit()
    db.refresh(story)
    return story


@router.delete("/api/writings/{story_id}")
def delete_story(story_id: str, db: Session = Depends(get_db)):
    from trash_service import trash_entity

    story = _story_or_404(db, story_id)
    entry = trash_entity(db, models.Story, "story", story, skip_guard=True)
    db.commit()
    return {"status": "ok", "trashed": True, "trash_id": entry.id}


# ---------------------------------------------------------------------
# AI 正文生成
# ---------------------------------------------------------------------


def _require_ai():
    status = ai_config_status()
    if not status["configured"]:
        fail(503, "AI_NOT_CONFIGURED", status.get("message") or "未配置 API Key，无法调用 AI")
    client = get_client()
    return client


def _ai_error_message(exc: Exception) -> str:
    return ai_error_message(exc)


@router.get("/api/ai/status")
def ai_status(probe: bool = False):
    status = ai_config_status()
    if probe and status["configured"]:
        try:
            get_client().models.list()
            status["probe_ok"] = True
            status["probe_error"] = ""
        except Exception as exc:
            status["probe_ok"] = False
            status["probe_error"] = ai_error_message(exc)
    return status


@router.post("/api/writing/generate")
def generate_story(payload: dict, db: Session = Depends(get_db)):
    client = _require_ai()
    model = get_model()
    world_id = payload.get("world_id", "")
    event_ids = _as_list(payload.get("event_ids"))
    user_direction = (payload.get("user_direction") or "").strip()[:2000]
    perspective = (payload.get("perspective") or "").strip()[:200]
    if world_id:
        get_world(db, world_id)

    query = db.query(models.Event).filter(models.Event.branch_id.is_(None))
    if world_id:
        query = query.filter(models.Event.world_id == world_id)
    if event_ids:
        query = query.filter(models.Event.id.in_(event_ids))
    else:
        query = query.order_by(models.Event.created_at.desc()).limit(5)
    events = query.all()
    if not events:
        fail(422, "NO_MATERIAL", "当前世界或选中的事件中没有内容，无法生成")

    sims = db.query(models.SimulationRun).filter(models.SimulationRun.branch_id.is_(None))
    if event_ids:
        sims = sims.filter(models.SimulationRun.event_id.in_(event_ids))
    elif world_id:
        sims = sims.filter(
            models.SimulationRun.event_id.in_(
                db.query(models.Event.id).filter(models.Event.world_id == world_id)
            )
        )
    sims = sims.order_by(models.SimulationRun.created_at.asc()).all()

    context = "【世界发生的事件】\n"
    for e in events:
        loc_name = ""
        org_name = ""
        if e.location_id:
            loc = db.query(models.Location).filter(models.Location.id == e.location_id).first()
            if loc:
                loc_name = f"在{loc.name}"
        if e.organization_id:
            org = db.query(models.Organization).filter(models.Organization.id == e.organization_id).first()
            if org:
                org_name = f"涉及{org.name}"
        context += f"- [{e.story_time or '某时'}] {e.name} {loc_name}{org_name}: {e.description}\n"

    context += "\n【人物的反应与行动】\n"
    if not sims:
        context += "- 尚无推演记录，请依据事件本身合理呈现人物反应。\n"
    for simulation in sims:
        context += f"- 世界变化: {simulation.world_changes}\n"
        for act in simulation.character_actions or []:
            context += f"  * {act.get('name')} ({act.get('engine')}): {act.get('action')}；结果：{act.get('status')}\n"

    prompt = f"""你是一个文笔极佳的小说家。请根据以下世界事件和人物推演记录，写一段约 900 字的小说正文。
要求：
1. 不要罗列数据，要把事件和行动融合成连贯的场景、对话、人物心理描写。
2. 自然体现发生地点与涉及组织。
3. 保持冷峻、克制、有画面感的文学质感。
4. 不要出现“根据推演记录”“事件描述”等元叙述，直接呈现故事。
5. 叙事视角：{perspective or "由你选择最适合这段素材的视角，但全篇必须统一"}。视角只决定读者跟随谁、知道多少，不得改变事件事实。
{f"【作者预设推演方向：{user_direction}。必须严格沿此走向描写，但不得违背人物既有性格与关系。】" if user_direction else ""}
{context}
"""

    def stream():
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                stream=True,
            )
            for chunk in response:
                text = chunk.choices[0].delta.content
                if text:
                    yield text
        except Exception as exc:  # pragma: no cover - network dependent
            yield f"\n[生成中断: {_ai_error_message(exc)}]"

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")


# ---------------------------------------------------------------------
# 素材提取
# ---------------------------------------------------------------------


def _existing_names(db: Session, world_id: str) -> dict[str, set[str]]:
    return {
        "character": {row[0] for row in db.query(models.Character.name).filter(models.Character.world_id == world_id)},
        "location": {row[0] for row in db.query(models.Location.name).filter(models.Location.world_id == world_id)},
        "event": {row[0] for row in db.query(models.Event.name).filter(models.Event.world_id == world_id)},
        "organization": {row[0] for row in db.query(models.Organization.name).filter(models.Organization.world_id == world_id)},
    }


def _pending_names(db: Session, world_id: str) -> set[tuple[str, str]]:
    rows = (
        db.query(models.EntityDraft.entity_type, models.EntityDraft.name)
        .filter(models.EntityDraft.world_id == world_id, models.EntityDraft.status == "pending")
        .all()
    )
    return {(r[0], r[1]) for r in rows}


def _normalize_type(value: str) -> str | None:
    value = (value or "").strip().lower()
    value = TYPE_ALIASES.get(value, value)
    return value if value in DRAFT_TYPES else None


def _ai_extract(world: models.World, text: str, target_types: list[str]) -> list[dict]:
    _require_ai()
    prompt = f"""你是严谨的小说素材抽取器。只从正文中抽取明确出现的信息，不得编造。
【世界】{world.name}｜{world.description or ''}
【正文】
{text[:12000]}

【抽取类型】{', '.join(target_types) if target_types else 'character, location, event, relationship, organization'}
输出严格 JSON，格式：
{{"items":[{{"type":"character|location|event|relationship|organization","name":"名称","summary":"一句话概述","confidence":0.0,"evidence":"原文短句","fields":{{}}}}]}}
fields 约定：
- character: role, intro, appearance, species, gender, age, background
- location: description, terrain, climate, parent_name
- event: description, story_time, participants(名字数组), location_name, organization_name
- relationship: source_name, target_name, relation_type
- organization: description, organization_type
同一实体只输出一次；不要输出正文中未出现的名字。

【名称硬性规则】
- 人物：必须是正文中的专名（姓名、道号、称号），2–8 字；禁止把“身后那”“指着那”“认得就”“修士没再”这类代词、动作片段、半句话当成人物名。
- 地点：必须是地名或场所专名；禁止把“人群靠后的位置”这类方位描述当成地点。
- 组织：必须是组织专名；事件：用完整短语概括，不要截断句子。
- 无法确定专名时宁可不输出，不要猜测。"""
    response = get_client().chat.completions.create(
        model=get_model(),
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.2,
        timeout=60.0,
    )
    data = json.loads(response.choices[0].message.content or "{}")
    items = data.get("items") if isinstance(data, dict) else None
    return items if isinstance(items, list) else []


_DIALOGUE_RE = re.compile(r"([\u4e00-\u9fff]{2,4}?)(?:说道|笑道|问道|答道|低声说|开口|说|道|问|答)")
_LOCATION_RE = re.compile(r"(?:来到|进入|抵达|前往|身处|站在|走进|走进)([\u4e00-\u9fff]{2,10})")
_ORG_RE = re.compile(r"([\u4e00-\u9fff]{2,10}(?:门|宗|派|阁|殿|帮|会|盟|谷|府|族|家))")
_STOP_NAMES = {
    "他", "她", "它", "我", "你", "我们", "他们", "她们", "众人", "有人", "那人",
    "此人", "对方", "老者", "少年", "男子", "女子", "作者", "自己", "大家",
}


def _heuristic_extract(text: str, target_types: list[str]) -> list[dict]:
    clean = _strip_html(text)
    types = target_types or ["event", "character", "location"]
    items: list[dict] = []

    if "event" in types:
        items.append(
            {
                "type": "event",
                "name": _title_from_text(clean, "新事件"),
                "summary": clean[:160],
                "confidence": 0.45,
                "evidence": clean[:120],
                "fields": {"description": clean[:800]},
            }
        )

    if "character" in types:
        seen = set()
        for raw_name in _DIALOGUE_RE.findall(clean):
            name = re.sub(r"(说|道|问|答)$", "", raw_name)
            if name in _STOP_NAMES or name in seen:
                continue
            seen.add(name)
            items.append(
                {
                    "type": "character",
                    "name": name,
                    "summary": f"在正文中开口说话的角色：{name}",
                    "confidence": 0.4,
                    "evidence": "",
                    "fields": {"role": "", "intro": f"由章节抽取，待补充五引擎。"},
                }
            )
            if len(seen) >= 6:
                break
        if not seen and clean:
            items.append(
                {
                    "type": "character",
                    "name": _title_from_text(clean, "新人物"),
                    "summary": "从选中文字中抽取的人物草稿",
                    "confidence": 0.3,
                    "evidence": clean[:120],
                    "fields": {"intro": clean[:300]},
                }
            )

    if "location" in types:
        seen_loc = set()
        for name in _LOCATION_RE.findall(clean):
            if name in seen_loc or name in _STOP_NAMES:
                continue
            seen_loc.add(name)
            items.append(
                {
                    "type": "location",
                    "name": name,
                    "summary": f"正文中出现的场所：{name}",
                    "confidence": 0.4,
                    "evidence": "",
                    "fields": {"description": clean[:300]},
                }
            )
            if len(seen_loc) >= 4:
                break
        if not seen_loc:
            items.append(
                {
                    "type": "location",
                    "name": _title_from_text(clean, "新地点"),
                    "summary": "从选中文字中抽取的地点草稿",
                    "confidence": 0.3,
                    "evidence": clean[:120],
                    "fields": {"description": clean[:300]},
                }
            )

    if "organization" in types:
        for name in dict.fromkeys(_ORG_RE.findall(clean)):
            items.append(
                {
                    "type": "organization",
                    "name": name,
                    "summary": f"正文中出现的组织：{name}",
                    "confidence": 0.4,
                    "evidence": "",
                    "fields": {"organization_type": "other", "description": clean[:300]},
                }
            )
            if len(items) > 20:
                break

    return items


_NAME_PARTICLES = set("的了着过吗呢吧啊呀嘛")
_NAME_BAD_START = set("这那他她它我你谁没就又便却忽指认站走看听说问答笑转抬低摇点伸收拿放推拉开坐起去回出进望盯皱沉叹")
_NAME_BAD_TOKENS = ("身后", "指着", "认得", "忽然", "没再", "味道", "那", "这", "修士没")


def _valid_entity_name(entity_type: str, name: str) -> bool:
    if len(name) < 2:
        return False
    if entity_type in {"character", "organization"} and any(ch in _NAME_PARTICLES for ch in name):
        return False
    if entity_type == "location":
        if any(ch in "了着过吗呢吧" for ch in name):
            return False
        if name.endswith(("的位置", "的地方", "的方向", "的角落", "的旁边", "的身后", "的面前", "的中间", "的上面", "的下面", "的里面", "的处")):
            return False
    if entity_type == "character":
        if len(name) > 8:
            return False
        if name[0] in _NAME_BAD_START:
            return False
        if any(token in name for token in _NAME_BAD_TOKENS):
            return False
        if name in _STOP_NAMES:
            return False
    if entity_type == "location":
        if len(name) > 20:
            return False
        if name[0] in _NAME_BAD_START:
            return False
    if entity_type == "organization" and len(name) > 24:
        return False
    if entity_type == "event" and len(name) > 60:
        return False
    return True


def _sanitize_items(items: Iterable[dict], target_types: list[str]) -> list[dict]:
    result: list[dict] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        entity_type = _normalize_type(str(raw.get("type") or ""))
        if not entity_type:
            continue
        if target_types and entity_type not in target_types:
            continue
        name = re.sub(r"\s+", " ", str(raw.get("name") or "")).strip()[:80]
        if not name or not _valid_entity_name(entity_type, name):
            continue
        fields = raw.get("fields") if isinstance(raw.get("fields"), dict) else {}
        try:
            confidence = min(0.99, max(0.0, float(raw.get("confidence", 0.6))))
        except Exception:
            confidence = 0.6
        result.append(
            {
                "type": entity_type,
                "name": name,
                "summary": str(raw.get("summary") or "")[:500],
                "fields": fields,
                "evidence": str(raw.get("evidence") or "")[:500],
                "confidence": confidence,
            }
        )
        if len(result) >= 20:
            break
    return result


@router.post("/api/writings/{story_id}/analyze")
def analyze_story(story_id: str, payload: dict | None = None, db: Session = Depends(get_db)):
    story = _story_or_404(db, story_id)
    payload = payload or {}
    if not story.world_id:
        fail(422, "NO_WORLD", "章节未绑定世界，无法入库")
    world = get_world(db, story.world_id)

    text = str(payload.get("text") or "").strip()
    if not text:
        text = story.plain_text or _strip_html(story.content)
    if len(text.strip()) < 10:
        fail(422, "TOO_SHORT", "正文太短，至少写几句再解析")
    target_types = [
        normalized
        for normalized in (_normalize_type(str(t)) for t in _as_list(payload.get("target_types")))
        if normalized
    ]

    engine = "heuristic"
    items: list[dict] = []
    try:
        items = _ai_extract(world, text, target_types)
        if items:
            engine = "ai"
    except HTTPException:
        items = []
    except Exception as exc:
        print(f"素材解析 AI 失败，改用规则抽取: {exc}")

    items = _sanitize_items(items, target_types)
    if not items:
        items = _sanitize_items(_heuristic_extract(text, target_types), target_types)

    existing = _existing_names(db, story.world_id)
    pending = _pending_names(db, story.world_id)
    created: list[models.EntityDraft] = []
    for item in items:
        entity_type = item["type"]
        name = item["name"]
        if (entity_type, name) in pending:
            continue
        if entity_type in existing and name in existing[entity_type]:
            continue
        draft = models.EntityDraft(
            world_id=story.world_id,
            story_id=story.id,
            entity_type=entity_type,
            name=name,
            summary=item["summary"],
            payload={"fields": item["fields"], "source": engine},
            evidence=item["evidence"],
            confidence=item["confidence"],
            status="pending",
        )
        db.add(draft)
        created.append(draft)
    db.commit()
    for draft in created:
        db.refresh(draft)
    return {
        "engine": engine,
        "count": len(created),
        "drafts": [_draft_dict(db, draft) for draft in created],
    }


@router.post("/api/writing/extract")
def extract_selection(payload: dict, db: Session = Depends(get_db)):
    story_id = payload.get("story_id")
    if not story_id:
        fail(422, "VALIDATION_ERROR", "缺少 story_id")
    return analyze_story(story_id, payload, db)


# ---------------------------------------------------------------------
# 草稿箱
# ---------------------------------------------------------------------


@router.get("/api/worlds/{world_id}/drafts")
def list_world_drafts(
    world_id: str,
    status: str = "pending",
    story_id: str = "",
    db: Session = Depends(get_db),
):
    get_world(db, world_id)
    query = db.query(models.EntityDraft).filter(models.EntityDraft.world_id == world_id)
    if status and status != "all":
        query = query.filter(models.EntityDraft.status == status)
    if story_id:
        query = query.filter(models.EntityDraft.story_id == story_id)
    rows = query.order_by(models.EntityDraft.created_at.desc()).all()
    return [_draft_dict(db, row) for row in rows]


@router.get("/api/writings/{story_id}/drafts")
def list_story_drafts(story_id: str, status: str = "all", db: Session = Depends(get_db)):
    story = _story_or_404(db, story_id)
    query = db.query(models.EntityDraft).filter(models.EntityDraft.story_id == story.id)
    if status and status != "all":
        query = query.filter(models.EntityDraft.status == status)
    rows = query.order_by(models.EntityDraft.created_at.desc()).all()
    return [_draft_dict(db, row) for row in rows]


@router.patch("/api/drafts/{draft_id}")
def update_draft(draft_id: str, payload: dict, db: Session = Depends(get_db)):
    draft = db.query(models.EntityDraft).filter(models.EntityDraft.id == draft_id).first()
    if not draft:
        fail(404, "NOT_FOUND", "草稿不存在")
    if "name" in payload:
        name = str(payload.get("name") or "").strip()[:80]
        if name:
            draft.name = name
    if "summary" in payload:
        draft.summary = str(payload.get("summary") or "")[:1000]
    if "payload" in payload and isinstance(payload["payload"], dict):
        draft.payload = payload["payload"]
        flag_modified(draft, "payload")
    if payload.get("status") in {"pending", "accepted", "ignored"}:
        draft.status = payload["status"]
    draft.updated_at = _now()
    db.commit()
    db.refresh(draft)
    return _draft_dict(db, draft)


@router.post("/api/drafts/{draft_id}/ignore")
def ignore_draft(draft_id: str, db: Session = Depends(get_db)):
    draft = db.query(models.EntityDraft).filter(models.EntityDraft.id == draft_id).first()
    if not draft:
        fail(404, "NOT_FOUND", "草稿不存在")
    draft.status = "ignored"
    draft.updated_at = _now()
    db.commit()
    return {"status": "ok", "draft": _draft_dict(db, draft)}


@router.delete("/api/drafts/{draft_id}")
def delete_draft(draft_id: str, db: Session = Depends(get_db)):
    draft = db.query(models.EntityDraft).filter(models.EntityDraft.id == draft_id).first()
    if not draft:
        fail(404, "NOT_FOUND", "草稿不存在")
    db.delete(draft)
    db.commit()
    return {"status": "ok"}


@router.post("/api/drafts/{draft_id}/undo")
def undo_draft(draft_id: str, db: Session = Depends(get_db)):
    """撤销一次错误入库：删除刚创建的实体，并把草稿退回待入库。"""
    draft = db.query(models.EntityDraft).filter(models.EntityDraft.id == draft_id).first()
    if not draft:
        fail(404, "NOT_FOUND", "草稿不存在")
    if draft.status != "accepted":
        fail(409, "NOT_ACCEPTED", "只有已入库的草稿可以撤销入库")

    payload = draft.payload if isinstance(draft.payload, dict) else {}
    entity_id = payload.get("entity_id")
    entity_type = draft.entity_type
    models_by_type = {
        "character": models.Character,
        "location": models.Location,
        "event": models.Event,
        "organization": models.Organization,
        "relationship": models.Relationship,
    }
    model = models_by_type.get(entity_type)
    removed = False
    if model and entity_id:
        # 先移除结构树中的引用节点，否则引用检查会把“挂载节点”当成外部依赖。
        nodes = (
            db.query(models.WorldNode)
            .filter(
                models.WorldNode.world_id == draft.world_id,
                models.WorldNode.ref_type == entity_type,
                models.WorldNode.ref_id == entity_id,
            )
            .all()
        )
        for node in nodes:
            db.delete(node)
        db.flush()
        entity = db.query(model).filter(model.id == entity_id).first()
        if entity:
            delete_entity(db, model, entity_type, entity_id, use_trash=False)
            removed = True

    draft.payload = {k: v for k, v in payload.items() if k not in {"entity_id", "approved_at"}}
    flag_modified(draft, "payload")
    draft.status = "pending"
    draft.updated_at = _now()
    db.commit()
    db.refresh(draft)
    target = DRAFT_TARGETS.get(entity_type, {"label": entity_type})
    return {
        "status": "ok",
        "draft": _draft_dict(db, draft),
        "removed_entity": removed,
        "target_label": target.get("label", entity_type),
        "message": f"已撤销入库并删除【{target.get('label', entity_type)}】中的错误实体，草稿已退回待入库",
    }


def _next_node_order(db: Session, world_id: str, branch: str) -> int:
    rows = db.query(models.WorldNode.sort_order).filter(
        models.WorldNode.world_id == world_id, models.WorldNode.branch == branch
    )
    values = [row[0] or 0 for row in rows]
    return (max(values) + 1) if values else 0


def _attach_character_node(db: Session, world_id: str, character: models.Character, summary: str):
    branch = "people_groups"
    root = (
        db.query(models.WorldNode)
        .filter(
            models.WorldNode.world_id == world_id,
            models.WorldNode.branch == branch,
            models.WorldNode.parent_id.is_(None),
        )
        .order_by(models.WorldNode.sort_order.asc())
        .first()
    )
    if not root:
        root = models.WorldNode(
            world_id=world_id,
            branch=branch,
            node_type="folder",
            name="人物与群体",
            sort_order=0,
            description="由写作工作台自动创建的人物目录。",
        )
        db.add(root)
        db.flush()
    exists = (
        db.query(models.WorldNode)
        .filter(
            models.WorldNode.world_id == world_id,
            models.WorldNode.ref_type == "character",
            models.WorldNode.ref_id == character.id,
        )
        .first()
    )
    if exists:
        return exists
    node = models.WorldNode(
        world_id=world_id,
        parent_id=root.id,
        branch=branch,
        node_type="entity_ref",
        name=character.name,
        sort_order=_next_node_order(db, world_id, branch),
        description=summary,
        ref_type="character",
        ref_id=character.id,
    )
    db.add(node)
    db.flush()
    return node


def _resolve_participants(db: Session, world_id: str, names: Iterable[str], text: str) -> list[str]:
    chars = db.query(models.Character).filter(models.Character.world_id == world_id).all()
    by_name = {c.name: c.id for c in chars}
    result: list[str] = []
    for name in names:
        if name in by_name and by_name[name] not in result:
            result.append(by_name[name])
    for char in chars:
        if char.name and char.name in text and char.id not in result:
            result.append(char.id)
    return result


@router.post("/api/drafts/{draft_id}/approve")
def approve_draft(draft_id: str, payload: dict | None = None, db: Session = Depends(get_db)):
    draft = db.query(models.EntityDraft).filter(models.EntityDraft.id == draft_id).first()
    if not draft:
        fail(404, "NOT_FOUND", "草稿不存在")
    if draft.status == "accepted":
        fail(409, "ALREADY_ACCEPTED", "该草稿已经入库")
    if draft.status == "ignored":
        fail(409, "IGNORED", "该草稿已被忽略，请先恢复为待处理")
    payload = payload or {}
    fields = {}
    if isinstance(draft.payload, dict):
        fields = draft.payload.get("fields") or {}
    if isinstance(payload.get("fields"), dict):
        fields = {**fields, **payload["fields"]}
    world = get_world(db, draft.world_id)
    summary = draft.summary or ""

    entity = None
    node = None
    entity_type = draft.entity_type

    if entity_type == "character":
        profile = {
            "name": draft.name,
            "code": "",
            "avatar": "",
            "species": str(fields.get("species") or ""),
            "age": str(fields.get("age") or ""),
            "gender": str(fields.get("gender") or ""),
            "world": world.name,
            "nation": "",
            "org": "",
            "socialClass": "",
            "profession": str(fields.get("role") or ""),
            "role": str(fields.get("role") or ""),
            "appearance": str(fields.get("appearance") or ""),
            "education": "",
            "degree": "",
            "intro": str(fields.get("intro") or summary),
            "background": str(fields.get("background") or summary),
            "draft": True,
            "source_story_id": draft.story_id,
        }
        entity = models.Character(
            world_id=draft.world_id,
            name=draft.name,
            basic_profile=profile,
            engines={},
            defense_mechanisms=None,
            reality_conditions=None,
            thought_imprints=None,
            life_history={"events": [], "deposits": {}},
            initial_state=None,
        )
        db.add(entity)
        db.flush()
        node = _attach_character_node(db, draft.world_id, entity, summary)

    elif entity_type == "location":
        entity = models.Location(
            world_id=draft.world_id,
            name=draft.name,
            description=str(fields.get("description") or summary),
            terrain=str(fields.get("terrain") or ""),
            climate=str(fields.get("climate") or ""),
            geo_type="地点",
            status="draft",
            x=50.0,
            y=50.0,
            sort_order=0,
        )
        db.add(entity)

    elif entity_type == "event":
        now = world_now(db, draft.world_id)
        story_time = str(fields.get("story_time") or now.strftime("%Y-%m-%d"))
        participants = _resolve_participants(
            db, draft.world_id, _as_list(fields.get("participants")), draft.summary or ""
        )
        entity = models.Event(
            world_id=draft.world_id,
            name=draft.name,
            description=str(fields.get("description") or summary),
            story_time=story_time,
            participants=participants,
            domain=_as_list(fields.get("domain")) or ["关系扰动"],
            event_status="draft",
            occurred_at=now,
            scale="中观",
            storyline="主线",
        )
        db.add(entity)

    elif entity_type == "organization":
        entity = models.Organization(
            world_id=draft.world_id,
            name=draft.name,
            description=str(fields.get("description") or summary),
            organization_type=str(fields.get("organization_type") or "other"),
            status="draft",
        )
        db.add(entity)

    elif entity_type == "relationship":
        source_name = str(fields.get("source_name") or "").strip()
        target_name = str(fields.get("target_name") or "").strip()
        source = (
            db.query(models.Character)
            .filter(models.Character.world_id == draft.world_id, models.Character.name == source_name)
            .first()
        )
        target = (
            db.query(models.Character)
            .filter(models.Character.world_id == draft.world_id, models.Character.name == target_name)
            .first()
        )
        if not source or not target:
            fail(422, "UNRESOLVED", "关系两端人物不存在，请先入库人物或补充姓名")
        entity = models.Relationship(
            world_id=draft.world_id,
            source_id=source.id,
            target_id=target.id,
            source_type="character",
            target_type="character",
            relation_type=str(fields.get("relation_type") or draft.name),
            description=summary,
            source_quadrant=str(fields.get("quadrant") or "漠视"),
            status="active",
        )
        db.add(entity)
    else:
        fail(422, "UNSUPPORTED_TYPE", f"暂不支持入库类型：{entity_type}")

    db.flush()
    draft.status = "accepted"
    draft.updated_at = _now()
    draft.payload = {
        **(draft.payload or {}),
        "entity_id": entity.id,
        "approved_at": _now().isoformat(),
    }
    flag_modified(draft, "payload")
    db.commit()
    db.refresh(entity)
    if node:
        db.refresh(node)

    target = DRAFT_TARGETS.get(entity_type, {"label": entity_type, "branch": "", "detail": ""})
    return {
        "status": "ok",
        "draft": _draft_dict(db, draft),
        "entity_type": entity_type,
        "entity_id": entity.id,
        "node_id": node.id if node else None,
        "target_label": target["label"],
        "target_branch": target["branch"],
        "target_detail": target["detail"],
        "message": f"{draft.name} 已入库到【{target['label']}】（{target['branch']}）",
    }


# ---------------------------------------------------------------------
# 划词 AI 辅助
# ---------------------------------------------------------------------

ASSIST_PROMPTS = {
    "polish": "润色以下小说片段：保持原意、人物口吻与叙事视角，提升节奏、画面感和用词准确度。只输出润色后的正文。",
    "expand": "扩写以下小说片段：补充环境、动作、感官细节和人物心理，篇幅约为原文的 2 倍。只输出扩写后的正文。",
    "dialogue": "根据以下情境写一段角色对白：符合人物身份与关系，有潜台词，避免说明腔。只输出对白与必要的动作提示。",
    "continue": "顺着以下小说片段继续写 300 字左右：保持文风、视角和人物状态，只输出续写正文。",
}


@router.post("/api/writing/assist")
def assist_writing(payload: dict):
    client = _require_ai()
    model = get_model()
    action = str(payload.get("action") or "polish")
    prompt_text = ASSIST_PROMPTS.get(action)
    if not prompt_text:
        fail(422, "UNSUPPORTED_ACTION", f"不支持的写作动作：{action}")
    text = str(payload.get("text") or "").strip()
    if not text:
        fail(422, "VALIDATION_ERROR", "请先选中文字")
    context = str(payload.get("context") or "").strip()
    user_prompt = f"{prompt_text}\n"
    if context:
        user_prompt += f"\n【上下文】\n{context[:4000]}\n"
    user_prompt += f"\n【选中文字】\n{text[:8000]}"

    def stream():
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=0.7,
                stream=True,
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as exc:  # pragma: no cover - network dependent
            yield f"\n[AI 辅助中断: {_ai_error_message(exc)}]"

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8")
