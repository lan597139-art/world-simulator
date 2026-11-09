from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy.orm.attributes import flag_modified # ✅ 核心：强制更新 JSON 字段
import models
from database import get_db
from reference_guard import assert_not_referenced

router = APIRouter()

# ✅ 改造：支持按 world_id 过滤
@router.get("/api/characters")
def list_characters(world_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Character)
    if world_id is not None:
        # 包含绑定该世界的，以及无世界的自由捏人（world_id 为空字符串或 None）
        query = query.filter((models.Character.world_id == world_id) | (models.Character.world_id == "") | (models.Character.world_id == None))
    return query.order_by(models.Character.created_at.desc()).all()

@router.get("/api/worlds/{world_id}/characters")
def get_characters(world_id: str, db: Session = Depends(get_db)):
    return db.query(models.Character).filter(models.Character.world_id == world_id).all()

@router.post("/api/characters")
def create_character(char_data: dict, db: Session = Depends(get_db)):
    new_char = models.Character(**char_data)
    db.add(new_char)
    db.commit()
    db.refresh(new_char)
    return new_char

@router.get("/api/characters/{character_id}")
def get_character(character_id: str, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character

@router.put("/api/characters/{character_id}")
def update_character(character_id: str, char_data: dict, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    for key, value in char_data.items():
        if hasattr(character, key):
            setattr(character, key, value)
            
            # ✅ 核心修复：只要修改了这些复杂的 JSON 字段，强制通知 SQLAlchemy 必须更新数据库
            if key in ["life_history", "thought_imprints", "reality_conditions", "defense_mechanisms", "initial_state", "basic_profile", "engines"]:
                flag_modified(character, key)

    db.commit()
    db.refresh(character)
    return character

@router.delete("/api/characters/{character_id}")
def delete_character(character_id: str, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    if character.world_id:
        # 人物入库时自动挂到“人物与群体”目录；这个挂载节点是人物自身的一部分，
        # 不能反过来阻止人物删除。先移除节点，再检查关系/事件等真实外部引用。
        nodes = (
            db.query(models.WorldNode)
            .filter(
                models.WorldNode.world_id == character.world_id,
                models.WorldNode.ref_type == "character",
                models.WorldNode.ref_id == character.id,
            )
            .all()
        )
        for node in nodes:
            db.delete(node)
        db.flush()
        assert_not_referenced(db, character.world_id, "character", character.id, "人物")
    db.delete(character)
    db.commit()
    return {"status": "ok", "message": "Character deleted"}

# =====================================================================
# 人物运行态 / 成长校准
# =====================================================================
import copy
from uuid import uuid4
from common import record_history, world_now
from migrations.util import utcnow


_ENGINE_KEYS = ("V", "O", "D", "E", "T")


def _runtime_seed(character: models.Character) -> dict:
    engines = copy.deepcopy(character.engines or {})
    if "ovtde" not in engines:
        engines = {"ovtde": engines, "dominance": {"mode": [], "engines": [], "description": ""}}
    return {
        "engines": engines,
        "defense_mechanisms": copy.deepcopy(character.defense_mechanisms or {}),
        "reality_conditions": copy.deepcopy(character.reality_conditions or {}),
        "thought_imprints": copy.deepcopy(character.thought_imprints or {}),
    }


def _dominant_engine(engines: dict) -> str:
    ovtde = engines.get("ovtde", {}) if isinstance(engines, dict) else {}
    best_key = "O"
    best_value = -1.0
    for key in _ENGINE_KEYS:
        item = ovtde.get(key)
        value = item.get("val", 0) if isinstance(item, dict) else item
        try:
            value = float(value)
        except (TypeError, ValueError):
            value = 0
        if value > best_value:
            best_key, best_value = key, value
    return best_key


def _runtime_view(character: models.Character) -> dict:
    seed = _runtime_seed(character)
    runtime = copy.deepcopy(character.runtime_state or {})
    if not runtime:
        runtime = copy.deepcopy(seed)
        runtime.update({"main_color": _dominant_engine(seed["engines"]), "version": 0, "updated_at": None})
    runtime.setdefault("growth_log", [])
    runtime.setdefault("main_color", _dominant_engine(runtime.get("engines", seed["engines"])))
    runtime.setdefault("version", len(runtime.get("growth_log", [])))
    return {"character_id": character.id, "seed": seed, "runtime": runtime}


def _engine_values(engines: dict) -> dict:
    ovtde = engines.get("ovtde", {}) if isinstance(engines, dict) else {}
    result = {}
    for key in _ENGINE_KEYS:
        item = ovtde.get(key)
        value = item.get("val", 0) if isinstance(item, dict) else item
        try:
            result[key] = round(float(value), 1)
        except (TypeError, ValueError):
            result[key] = 0.0
    return result


@router.get("/api/characters/{character_id}/runtime")
def get_character_runtime(character_id: str, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return _runtime_view(character)


@router.put("/api/characters/{character_id}/runtime")
def update_character_runtime(character_id: str, payload: dict, db: Session = Depends(get_db)):
    character = db.query(models.Character).filter(models.Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    current_view = _runtime_view(character)
    before = copy.deepcopy(current_view["runtime"])
    runtime = copy.deepcopy(before)

    for key in ("engines", "defense_mechanisms", "reality_conditions", "thought_imprints"):
        if key in payload and isinstance(payload[key], dict):
            runtime[key] = payload[key]

    # 生命经历是种子与运行态共享的记录层：在运行态里补记经历时也要落库。
    if "life_history" in payload and isinstance(payload["life_history"], (dict, list)):
        character.life_history = payload["life_history"]
        flag_modified(character, "life_history")

    main_color = str(payload.get("main_color") or "").strip().upper()
    if main_color and main_color not in _ENGINE_KEYS:
        raise HTTPException(status_code=400, detail="主色调必须是 V/O/D/E/T 之一")
    runtime["main_color"] = main_color or _dominant_engine(runtime.get("engines", {}))

    reason = str(payload.get("reason") or "").strip()[:500] or "作者校准当前运行态"
    source_event_ids = payload.get("source_event_ids") or []
    if not isinstance(source_event_ids, list):
        source_event_ids = []
    source_event_ids = [str(item) for item in source_event_ids[:50]]

    changed_modules = []
    labels = {
        "engines": "五引擎",
        "defense_mechanisms": "防御机制",
        "reality_conditions": "现实条件",
        "thought_imprints": "思想钢印",
    }
    for key, label in labels.items():
        if before.get(key) != runtime.get(key):
            changed_modules.append(label)
    if before.get("main_color") != runtime.get("main_color"):
        changed_modules.append("主色调")

    old_values = _engine_values(before.get("engines", {}))
    new_values = _engine_values(runtime.get("engines", {}))
    deltas = {key: round(new_values[key] - old_values[key], 1) for key in _ENGINE_KEYS if new_values[key] != old_values[key]}

    if not changed_modules and not deltas:
        db.commit()
        db.refresh(character)
        return _runtime_view(character)

    entry = {
        "id": uuid4().hex,
        "at": utcnow().isoformat(),
        "reason": reason,
        "source_event_ids": source_event_ids,
        "main_color": runtime["main_color"],
        "changed_modules": changed_modules,
        "engine_deltas": deltas,
        "engine_values": new_values,
    }
    runtime["version"] = int(runtime.get("version") or 0) + 1
    runtime["updated_at"] = entry["at"]
    runtime["growth_log"] = (list(runtime.get("growth_log") or []) + [entry])[-100:]
    character.runtime_state = runtime
    flag_modified(character, "runtime_state")

    if character.world_id:
        occurred_at = world_now(db, character.world_id)
        for key, delta in deltas.items():
            record_history(
                db=db,
                world_id=character.world_id,
                entity_type="character",
                entity_id=character.id,
                field=f"runtime.engines.ovtde.{key}.val",
                old_value=old_values[key],
                new_value=new_values[key],
                reason=f"成长校准：{reason}",
                source="author",
                occurred_at=occurred_at,
            )
        record_history(
            db=db,
            world_id=character.world_id,
            entity_type="character",
            entity_id=character.id,
            field="runtime.main_color",
            old_value=before.get("main_color"),
            new_value=runtime["main_color"],
            reason=f"成长校准：{reason}",
            source="author",
            occurred_at=occurred_at,
        )

    db.commit()
    db.refresh(character)
    result = _runtime_view(character)
    result["entry"] = entry
    return result
