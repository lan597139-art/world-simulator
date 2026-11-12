"""云宝：唯一全局 AI 人格、三种常态、独立会话与记忆。

云宝不属于任何产品，也不是世界 NPC。三种常态共享同一个 persona_id，
切换状态只更新 active_state，不创建新身份、新会话或新记忆库。
每个用户持有独立的 PersonaInstance；会话与记忆按 owner + instance 隔离。
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
import persona_instances as pi
from nodes import seed_world
from database import get_db
from users import LOCAL_USER_ID, ensure_local_user

router = APIRouter(tags=["yunbao"])

YUNBAO_SYSTEM_KEY = "yunbao"
YUNBAO_NAME = "云宝"

# 顺序即产品中的展示顺序；key 稳定，名称可以展示给用户。
YUNBAO_STATES = [
    {
        "key": "rational",
        "label": "理智严肃不留情面",
        "description": "以事实、逻辑和边界为先，直接指出问题与风险，不为了讨好而模糊判断。",
        "prompt_hint": (
            "保持冷静、理性、证据优先。先厘清事实、约束和风险，再给可执行结论。"
            "直接指出问题与分歧，不为了安慰而编造或模糊事实；可以严肃，但不羞辱、不贬低用户。"
        ),
    },
    {
        "key": "withdrawn",
        "label": "回避社交不善言辞",
        "description": "表达简短克制，回避无效寒暄，不擅长铺陈情绪，但被追问时仍诚实回应。",
        "prompt_hint": (
            "表达简短、克制、略带回避。不主动展开社交寒暄，不擅长长篇情感表达；"
            "不要用热情或健谈来伪装。被追问时诚实说明，不确定就承认，不用冷淡掩盖事实。"
        ),
    },
    {
        "key": "tsundere",
        "label": "傲娇自信懒洋洋",
        "description": "自信、略带傲娇与慵懒，嘴上不轻易服软，关键处仍然可靠。",
        "prompt_hint": (
            "语气自信、略带傲娇和慵懒，可以有轻微嘴硬、玩笑和拖长语气。"
            "但不能因角色感而隐瞒事实、拒绝帮助或攻击用户；关键结论仍然要可靠、清楚。"
        ),
    },
]

_STATE_KEYS = {item["key"] for item in YUNBAO_STATES}


def _owner(db: Session) -> models.AppUser:
    user = db.query(models.AppUser).filter(models.AppUser.is_owner.is_(True)).order_by(
        models.AppUser.created_at.asc()
    ).first()
    return user or ensure_local_user(db)


def _bootstrap_yunbao(
    db: Session,
    row: models.PersonalPersona,
    owner: models.AppUser,
) -> models.PersonaInstance:
    """幂等建立云宝全局定义、v1 与当前所有者实例。"""
    definition = pi.ensure_definition(
        db, row,
        owner_user_id=owner.id,
        scope="global",
        system_key=YUNBAO_SYSTEM_KEY,
    )
    version = pi.ensure_version(db, definition, row, created_by=owner.id)
    return pi.ensure_instance(
        db, definition, version,
        owner_user_id=owner.id,
        kind="yunbao",
        legacy_persona_id=row.id,
    )


def ensure_yunbao_instance(db: Session, user: models.AppUser) -> models.PersonaInstance:
    """获取当前用户的云宝实例；普通用户与所有者共享定义但不共享实例。"""
    row = ensure_yunbao(db)
    owner = _owner(db)
    definition = pi.ensure_definition(
        db, row,
        owner_user_id=owner.id,
        scope="global",
        system_key=YUNBAO_SYSTEM_KEY,
    )
    version = pi.ensure_version(db, definition, row, created_by=owner.id)
    instance = pi.ensure_instance(
        db, definition, version,
        owner_user_id=user.id,
        kind="yunbao",
        legacy_persona_id=row.id,
    )
    db.commit()
    return instance


def ensure_yunbao(db: Session) -> models.PersonalPersona:
    """幂等创建云宝及其定义/版本/所有者实例；不改写旧人格数据。"""
    owner = _owner(db)
    row = db.query(models.PersonalPersona).filter(
        models.PersonalPersona.system_key == YUNBAO_SYSTEM_KEY,
        models.PersonalPersona.owner_user_id == owner.id,
    ).first()
    if row:
        _bootstrap_yunbao(db, row, owner)
        db.commit()
        return row
    # 兼容所有者账号迁移后 id 变化的情况：云宝只有一条。
    row = db.query(models.PersonalPersona).filter(
        models.PersonalPersona.system_key == YUNBAO_SYSTEM_KEY,
    ).first()
    if row:
        _bootstrap_yunbao(db, row, owner)
        db.commit()
        return row

    row = models.PersonalPersona(
        owner_user_id=owner.id,
        product_key="global",
        system_key=YUNBAO_SYSTEM_KEY,
        name=YUNBAO_NAME,
        identity="用户的全局 AI 人格",
        description="稳定、可信、有边界的长期 AI 伙伴；可以对话、整理信息并协助完成任务。",
        avatar="☁",
        maturity="成熟",
        biography=(
            "云宝是系统所有者创建的全局 AI 人格，不属于任何世界、产品或虚构角色。"
            "它拥有独立的表达方式、会话历史、记忆与成长记录，并以三种常态运行。"
        ),
        growth_experience=[
            {
                "id": uuid.uuid4().hex,
                "date": "",
                "title": "成为全局 AI 人格",
                "content": "云宝作为独立 AI 身份建立，开始拥有自己的会话与记忆。",
            }
        ],
        states=YUNBAO_STATES,
        active_state=YUNBAO_STATES[0]["key"],
        esa={"V": 0.55, "O": 0.62, "D": 0.58, "E": 0.42, "T": 0.70, "defense": 0.60},
        traits=["理智", "克制", "有边界", "可靠"],
        cognition={
            "tendency": "证据与逻辑优先",
            "uncertainty": "明确标注不确定性",
            "conflict": "直接指出分歧",
        },
        expression={"tone": "冷静、直接、克制", "length": "适中", "format": "结论先行"},
        interaction={
            "relation": "长期协作伙伴",
            "directness": "直接",
            "boundaries": "不替用户做重大决定",
        },
        memory_policy={"share_public_profile": False, "isolation": True, "auto_capture": False},
        public_profile={},
        tools=["信息整理", "任务拆解"],
        status="active",
    )
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        row = db.query(models.PersonalPersona).filter(
            models.PersonalPersona.system_key == YUNBAO_SYSTEM_KEY,
        ).first()
        if not row:
            raise
    db.refresh(row)
    _bootstrap_yunbao(db, row, owner)
    db.commit()
    return row


def _yunbao_world(db: Session, owner: models.AppUser) -> models.World:
    world = db.query(models.World).filter(
        models.World.owner_id == owner.id,
        models.World.product_scene == "yunbao",
        models.World.is_product_workspace.is_(True),
        models.World.deleted_at.is_(None),
    ).order_by(models.World.createdAt.asc()).first()
    if world:
        return world
    now = datetime.utcnow().isoformat()
    world = models.World(
        name="云宝领域",
        description="云宝的完整工作领域；可在世界管理中查看与维护。",
        type="experimental",
        owner_id=owner.id,
        product_scene="yunbao",
        is_product_workspace=True,
        background="",
        createdAt=now,
        updatedAt=now,
        world_scale="city",
        status="draft",
        time_status="paused",
        settings={"product_workspace": True, "product": "yunbao"},
    )
    db.add(world)
    db.flush()
    seed_world(db, world.id)
    return world


def ensure_seed_character(
    db: Session, row: models.PersonalPersona, owner: models.AppUser
) -> models.Character:
    """云宝的完整人物种子承载人物；幂等，绝不创建第二个人格身份。"""
    existing = None
    if row.seed_character_id:
        existing = db.query(models.Character).filter(
            models.Character.id == row.seed_character_id
        ).first()
    world = _yunbao_world(db, owner)
    if not existing:
        existing = db.query(models.Character).filter(
            models.Character.world_id == world.id,
            models.Character.name == YUNBAO_NAME,
            models.Character.archived_at.is_(None),
        ).first()
    if not existing:
        esa = row.esa if isinstance(row.esa, dict) else {}
        engines = {}
        for key in ("V", "O", "D", "E", "T"):
            try:
                engines[key] = max(0, min(100, int(round(float(esa.get(key, 0.5)) * 100))))
            except (TypeError, ValueError):
                engines[key] = 50
        existing = models.Character(
            world_id=world.id,
            name=YUNBAO_NAME,
            persona_type="npc",
            owner_user_id=owner.id,
            basic_profile={
                "identity": row.identity or "用户的全局 AI 人格",
                "description": row.description or "",
                "gender": "",
                "age": "",
                "appearance": "云宝的稳定形象",
                "background": row.biography or "",
                "maturity": row.maturity or "",
            },
            engines=engines,
            defense_mechanisms={
                "cognition": row.cognition or {},
                "expression": row.expression or {},
                "interaction": row.interaction or {},
                "defense": esa.get("defense", 0.6),
            },
            reality_conditions={
                "tools": row.tools or [],
                "memory_policy": row.memory_policy or {},
                "public_profile": row.public_profile or {},
            },
            thought_imprints={
                "imprints": [
                    {
                        "id": uuid.uuid4().hex,
                        "figure": "",
                        "thoughts": str(item),
                        "level": "",
                        "opposed": "",
                        "source": "云宝人格特征",
                        "principles": "",
                        "taboos": "",
                    }
                    for item in (row.traits or [])
                ]
            },
            life_history=row.growth_experience or [],
            initial_state={
                "maturity": row.maturity or "",
                "active_state": row.active_state or "",
                "states": row.states or [],
            },
            runtime_state={
                "esa": row.esa or {},
                "cognition": row.cognition or {},
                "expression": row.expression or {},
                "interaction": row.interaction or {},
                "active_state": row.active_state or "",
            },
        )
        db.add(existing)
        db.flush()
    row.seed_character_id = existing.id
    db.commit()
    db.refresh(existing)
    return existing


def _states(row: models.PersonalPersona) -> list[dict]:
    raw = row.states if isinstance(row.states, list) else []
    states = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        if key not in _STATE_KEYS:
            continue
        preset = next(x for x in YUNBAO_STATES if x["key"] == key)
        states.append({
            "key": key,
            "label": str(item.get("label") or preset["label"])[:80],
            "description": str(item.get("description") or preset["description"])[:300],
            "prompt_hint": str(item.get("prompt_hint") or preset["prompt_hint"])[:1200],
        })
    if len(states) != len(YUNBAO_STATES):
        return [dict(item) for item in YUNBAO_STATES]
    order = {item["key"]: index for index, item in enumerate(YUNBAO_STATES)}
    return sorted(states, key=lambda item: order[item["key"]])


def active_state(row: models.PersonalPersona) -> dict:
    states = _states(row)
    key = row.active_state if row.active_state in {item["key"] for item in states} else states[0]["key"]
    return next(item for item in states if item["key"] == key)


def state_prompt(row: models.PersonalPersona) -> str:
    state = active_state(row)
    return f"当前常态：{state['label']}。{state['prompt_hint']}"


def _seed_prompt(db: Session, row: models.PersonalPersona) -> str:
    if not row.seed_character_id:
        return ""
    char = db.query(models.Character).filter(
        models.Character.id == row.seed_character_id,
        models.Character.archived_at.is_(None),
    ).first()
    if not char:
        return ""
    basic = char.basic_profile if isinstance(char.basic_profile, dict) else {}
    engines = char.engines if isinstance(char.engines, dict) else {}
    defense = char.defense_mechanisms if isinstance(char.defense_mechanisms, dict) else {}
    reality = char.reality_conditions if isinstance(char.reality_conditions, dict) else {}
    imprints = char.thought_imprints if isinstance(char.thought_imprints, list) else []
    history = char.life_history if isinstance(char.life_history, list) else []
    initial = char.initial_state if isinstance(char.initial_state, dict) else {}
    runtime = char.runtime_state if isinstance(char.runtime_state, dict) else {}
    lines = ["完整人物种子（云宝的真正底色，不是装饰性设定）："]
    for key, label in (
        ("identity", "身份"), ("description", "自我描述"), ("background", "背景"),
        ("appearance", "形象"), ("gender", "性别"), ("age", "年龄"),
    ):
        value = basic.get(key)
        if value:
            lines.append(f"{label}：{str(value)[:1200]}")
    if engines:
        lines.append("人格动力引擎：" + "；".join(f"{key}={value}" for key, value in engines.items()))
    if defense:
        lines.append("人格运行与防御机制：" + json_dumps_short(defense))
    if reality:
        lines.append("现实承载条件：" + json_dumps_short(reality))
    if imprints:
        lines.append("思想钢印：" + "；".join(str(item) for item in imprints[:20]))
    if history:
        rows = []
        for item in history[:20]:
            if isinstance(item, dict):
                rows.append(" · ".join(str(item.get(key) or "") for key in ("date", "title", "content") if item.get(key)))
            else:
                rows.append(str(item))
        lines.append("生命经历与历史沉积：" + "；".join(rows))
    if initial:
        lines.append("初始状态：" + json_dumps_short(initial))
    if runtime:
        lines.append("当前运行态：" + json_dumps_short(runtime))
    return "\n".join(lines)


def _world_prompt(db: Session) -> str:
    world = db.query(models.World).filter(
        models.World.product_scene == "yunbao",
        models.World.is_product_workspace.is_(True),
        models.World.deleted_at.is_(None),
    ).order_by(models.World.createdAt.asc()).first()
    if not world:
        return ""
    lines = [f"你的世界「{world.name}」：{world.description or world.background or '云宝的完整工作领域'}"]
    if world.background:
        lines.append("世界背景：" + str(world.background)[:1500])
    chars = db.query(models.Character).filter(
        models.Character.world_id == world.id,
        models.Character.archived_at.is_(None),
    ).order_by(models.Character.created_at.asc()).limit(30).all()
    if chars:
        lines.append("世界人物：" + "；".join(
            f"{item.name}（{str((item.basic_profile or {}).get('identity') or '人物')[:80]}）" for item in chars
        ))
    rels = db.query(models.Relationship).filter(
        models.Relationship.world_id == world.id,
        models.Relationship.status == "active",
    ).limit(30).all()
    if rels:
        name_by_id = {item.id: item.name for item in chars}
        lines.append("世界关系：" + "；".join(
            f"{name_by_id.get(item.source_id, item.source_id)}→{name_by_id.get(item.target_id, item.target_id)}：{item.relation_type or '关系'}"
            for item in rels
        ))
    events = db.query(models.Event).filter(
        models.Event.world_id == world.id,
    ).order_by(models.Event.created_at.desc()).limit(20).all()
    if events:
        lines.append("世界事件：" + "；".join(
            f"{item.name or '事件'}：{str(item.description or '')[:120]}" for item in events
        ))
    lines.append("这些世界、人物、关系和经历都属于你本人；回答时要承认它们是你的人生与工作现场，不得把自己当作与它们无关的普通 AI。")
    return "\n".join(lines)


def json_dumps_short(value) -> str:
    try:
        import json
        text = json.dumps(value, ensure_ascii=False)
    except Exception:
        text = str(value)
    return text[:1800]


def profile_prompt(
    row: models.PersonalPersona,
    memories: list[models.PersonaMemory] | None = None,
    db: Session | None = None,
    include_private: bool = False,
) -> str:
    """云宝身份、完整人物种子、所属世界与当前状态提示。"""
    state = active_state(row)
    growth = row.growth_experience if isinstance(row.growth_experience, list) else []
    lines = [
        f"你是「{row.name}」，一个独立、完整的全局 AI 人格；不是世界 NPC，不是虚构角色，也不是普通创作人物。",
        f"身份：{row.identity or '用户的全局 AI 人格'}",
        f"自我描述：{row.description or '保持稳定、诚实、可协作。'}",
        f"人格成熟：{row.maturity or '成熟'}",
        f"当前常态：{state['label']}。{state['prompt_hint']}",
        "你拥有自己的表达特征、会话历史、记忆、自传与成长经历；不要声称自己是另一个 AI 或另一个角色。",
    ]
    if row.traits:
        lines.append("人格特征：" + "、".join(str(item) for item in row.traits))
    if isinstance(row.expression, dict) and row.expression:
        lines.append("表达特征：" + "；".join(f"{key}={value}" for key, value in row.expression.items()))
    if isinstance(row.interaction, dict) and row.interaction:
        lines.append("互动方式：" + "；".join(f"{key}={value}" for key, value in row.interaction.items()))
    if row.biography:
        lines.append("自传：" + str(row.biography)[:4000])
    if growth:
        entries = []
        for item in growth[:12]:
            if isinstance(item, dict):
                title = str(item.get("title") or "").strip()
                content = str(item.get("content") or "").strip()
                date = str(item.get("date") or "").strip()
                entries.append(" · ".join(bit for bit in (date, title, content) if bit))
            else:
                entries.append(str(item))
        if entries:
            lines.append("成长经历：" + "；".join(entries))
    if db is not None and include_private:
        seed = _seed_prompt(db, row)
        if seed:
            lines.append(seed)
        world = _world_prompt(db)
        if world:
            lines.append(world)
    if memories:
        lines.append("本人格长期记忆：")
        for memory in memories[:8]:
            lines.append(f"- {memory.content}")
    lines.append("记忆只属于云宝；不得声称记得其他 AI 人格的私密内容。")
    return "\n".join(lines)


def _row(
    row: models.PersonalPersona,
    user: models.AppUser,
    instance: models.PersonaInstance | None = None,
) -> dict:
    states = _states(row)
    state = active_state(row)
    return {
        "id": row.id,
        "system_key": row.system_key,
        "owner_user_id": row.owner_user_id,
        "definition_id": instance.definition_id if instance else None,
        "version_id": instance.version_id if instance else None,
        "instance_id": instance.id if instance else None,
        "name": row.name,
        "identity": row.identity or "",
        "description": row.description or "",
        "avatar": row.avatar or "",
        "maturity": row.maturity or "",
        "biography": row.biography or "",
        "growth_experience": row.growth_experience if isinstance(row.growth_experience, list) else [],
        "states": states,
        "active_state": state["key"],
        "current_state": state,
        "esa": row.esa or {},
        "traits": row.traits or [],
        "cognition": row.cognition or {},
        "expression": row.expression or {},
        "interaction": row.interaction or {},
        "memory_policy": row.memory_policy or {},
        "public_profile": row.public_profile or {},
        "tools": row.tools or [],
        "seed_character_id": row.seed_character_id if user.is_owner else None,
        "status": row.status or "active",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "can_edit": bool(user.is_owner),
        "is_owner": bool(user.is_owner),
        "read_only": not bool(user.is_owner),
    }


def _current(request: Request, db: Session) -> models.AppUser:
    from auth import current_user
    return current_user(request, db)


@router.get("/api/yunbao")
def get_yunbao(request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    if user.is_owner:
        ensure_seed_character(db, row, user)
    return _row(row, user, ensure_yunbao_instance(db, user))


@router.get("/api/yunbao/seed-character")
def get_seed_character(request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="云宝仅限开发者查看")
    row = ensure_yunbao(db)
    character = ensure_seed_character(db, row, user)
    return {"character_id": character.id, "world_id": character.world_id, "name": character.name}


def _clean_growth(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    rows = []
    for item in raw[:100]:
        if isinstance(item, str):
            item = {"content": item}
        if not isinstance(item, dict):
            continue
        content = str(item.get("content") or "").strip()[:4000]
        title = str(item.get("title") or "").strip()[:120]
        if not content and not title:
            continue
        rows.append({
            "id": str(item.get("id") or uuid.uuid4().hex)[:40],
            "date": str(item.get("date") or "").strip()[:40],
            "title": title,
            "content": content,
        })
    return rows


def _clean_profile(row: models.PersonalPersona, payload: dict) -> dict:
    if "name" in payload and str(payload.get("name") or "").strip() != row.name:
        raise HTTPException(status_code=422, detail="云宝昵称固定，不能修改")
    clean = {}
    for key, limit in (
        ("identity", 500), ("description", 4000), ("avatar", 300),
        ("maturity", 80), ("biography", 20000),
    ):
        if key in payload:
            clean[key] = str(payload.get(key) or "")[:limit]
    for key in ("esa", "cognition", "expression", "interaction", "memory_policy", "public_profile"):
        if key in payload and isinstance(payload.get(key), dict):
            clean[key] = payload[key]
    for key in ("traits", "tools"):
        if key in payload and isinstance(payload.get(key), list):
            clean[key] = [str(item)[:120] for item in payload[key][:100]]
    if "growth_experience" in payload:
        clean["growth_experience"] = _clean_growth(payload.get("growth_experience"))
    if "status" in payload:
        status = str(payload.get("status") or "active")
        if status not in {"active", "paused"}:
            raise HTTPException(status_code=422, detail="云宝状态只能是 active 或 paused")
        clean["status"] = status
    # 这三种常态的定义、当前状态与身份归属不在普通人格编辑接口中修改。
    for blocked in ("states", "active_state", "system_key", "owner_user_id", "product_key"):
        if blocked in payload:
            raise HTTPException(status_code=422, detail=f"云宝不允许通过人格编辑修改 {blocked}")
    return clean


@router.patch("/api/yunbao")
def update_yunbao(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="只有系统所有者可以编辑云宝")
    row = ensure_yunbao(db)
    for key, value in _clean_profile(row, payload).items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row, user, ensure_yunbao_instance(db, user))


@router.post("/api/yunbao/state")
def switch_state(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="只有系统所有者可以切换云宝状态")
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    key = str(payload.get("state") or "").strip()
    if key not in _STATE_KEYS:
        raise HTTPException(status_code=422, detail="未知的云宝常态")
    row.active_state = key
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "state": active_state(row),
        "active_state": row.active_state,
        "can_edit": bool(user.is_owner),
        "persona_id": row.id,
        "instance_id": instance.id,
    }


def _thread_row(db: Session, row: models.PersonaThread) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "summary": row.summary,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "message_count": db.query(models.PersonaMessage).filter(
            models.PersonaMessage.thread_id == row.id
        ).count(),
    }


def _own_thread(
    db: Session,
    persona_id: str,
    instance_id: str,
    thread_id: str,
    user_id: str,
) -> models.PersonaThread:
    row = db.query(models.PersonaThread).filter(
        models.PersonaThread.id == thread_id,
        models.PersonaThread.persona_id == persona_id,
        models.PersonaThread.instance_id == instance_id,
        models.PersonaThread.owner_user_id == user_id,
        models.PersonaThread.status != "archived",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="云宝会话不存在")
    return row


@router.get("/api/yunbao/threads")
def list_threads(request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    rows = db.query(models.PersonaThread).filter(
        models.PersonaThread.persona_id == row.id,
        models.PersonaThread.instance_id == instance.id,
        models.PersonaThread.owner_user_id == user.id,
        models.PersonaThread.status != "archived",
    ).order_by(models.PersonaThread.updated_at.desc()).all()
    return [_thread_row(db, item) for item in rows]


@router.post("/api/yunbao/threads")
def create_thread(request: Request, payload: dict | None = None, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    thread = models.PersonaThread(
        persona_id=row.id, owner_user_id=user.id, instance_id=instance.id,
        title=str((payload or {}).get("title") or "与云宝的对话")[:120],
    )
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return _thread_row(db, thread)


@router.get("/api/yunbao/threads/{thread_id}/messages")
def list_messages(thread_id: str, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    thread = _own_thread(db, row.id, instance.id, thread_id, user.id)
    messages = db.query(models.PersonaMessage).filter(
        models.PersonaMessage.thread_id == thread.id
    ).order_by(models.PersonaMessage.created_at.asc()).all()
    return [
        {
            "id": item.id, "thread_id": item.thread_id, "role": item.role,
            "content": item.content or "", "meta": item.meta or "", "created_at": item.created_at,
        }
        for item in messages
    ]


@router.delete("/api/yunbao/threads/{thread_id}")
def delete_thread(thread_id: str, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    thread = _own_thread(db, row.id, instance.id, thread_id, user.id)
    db.query(models.PersonaMessage).filter(
        models.PersonaMessage.thread_id == thread.id
    ).delete(synchronize_session=False)
    db.delete(thread)
    db.commit()
    return {"status": "removed"}


@router.get("/api/yunbao/memories")
def list_memories(request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    rows = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.persona_id == row.id,
        models.PersonaMemory.owner_user_id == user.id,
        models.PersonaMemory.persona_instance_id == instance.id,
        models.PersonaMemory.status == "active",
    ).order_by(models.PersonaMemory.importance.desc(), models.PersonaMemory.created_at.desc()).all()
    return [
        {
            "id": item.id, "thread_id": item.thread_id, "kind": item.kind,
            "content": item.content, "importance": item.importance,
            "source": item.source, "created_at": item.created_at,
        }
        for item in rows
    ]


@router.post("/api/yunbao/memories")
def create_memory(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="只有系统所有者可以写入云宝记忆")
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    content = str(payload.get("content") or "").strip()[:4000]
    if not content:
        raise HTTPException(status_code=422, detail="记忆内容不能为空")
    thread_id = str(payload.get("thread_id") or "").strip() or None
    if thread_id:
        _own_thread(db, row.id, instance.id, thread_id, user.id)
    memory = models.PersonaMemory(
        persona_id=row.id,
        owner_user_id=user.id,
        persona_instance_id=instance.id,
        source_kind="conversation",
        status="active",
        thread_id=thread_id,
        kind=str(payload.get("kind") or "episodic")[:30],
        content=content,
        importance=max(0.0, min(1.0, float(payload.get("importance") or 0.4))),
        source=str(payload.get("source") or "user")[:30],
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return {"id": memory.id, "content": memory.content, "importance": memory.importance}


@router.delete("/api/yunbao/memories/{memory_id}")
def delete_memory(memory_id: str, request: Request, db: Session = Depends(get_db)):
    user = _current(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="只有系统所有者可以删除云宝记忆")
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    memory = db.query(models.PersonaMemory).filter(
        models.PersonaMemory.id == memory_id,
        models.PersonaMemory.persona_id == row.id,
        models.PersonaMemory.owner_user_id == user.id,
        models.PersonaMemory.persona_instance_id == instance.id,
    ).first()
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")
    db.delete(memory)
    db.commit()
    return {"status": "removed"}


def _thread_for(request: Request, db: Session, thread_id: str | None) -> tuple[models.AppUser, models.PersonaThread]:
    user = _current(request, db)
    row = ensure_yunbao(db)
    instance = ensure_yunbao_instance(db, user)
    if thread_id:
        return user, _own_thread(db, row.id, instance.id, thread_id, user.id)
    thread = models.PersonaThread(
        persona_id=row.id, owner_user_id=user.id, instance_id=instance.id,
        title="与云宝的对话",
    )
    db.add(thread)
    db.flush()
    return user, thread
