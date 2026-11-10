from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import models
from database import get_db
from ai_engine import run_simulation
from sqlalchemy.orm.attributes import flag_modified # ✅ 核心：强制更新 JSON 字段

router = APIRouter()

# ================= 07 模拟推演 =================
@router.post("/api/simulate")
def simulate_event(payload: dict, db: Session = Depends(get_db)):
    event_id = payload.get("event_id")
    direction = str(payload.get("direction") or "").strip()[:2000]
    perspective = str(payload.get("perspective") or "").strip()[:200]
    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event_id")

    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.branch_id:
        raise HTTPException(status_code=409, detail="该事件属于某个推演分支，请在分支中推演")

    if event.world_id:
        world = db.query(models.World).filter(models.World.id == event.world_id).first()
        if not world or world.deleted_at is not None:
            raise HTTPException(status_code=404, detail="World not found")
        if world.archived_at is not None:
            raise HTTPException(status_code=409, detail="该世界已归档，恢复后才能继续推演")

    participants_ids = event.participants or []
    characters = (
        db.query(models.Character)
        .filter(
            models.Character.id.in_(participants_ids),
            models.Character.archived_at.is_(None),
        )
        .all()
    )

    loc_name = ""
    org_name = ""
    if event.location_id:
        loc = db.query(models.Location).filter(models.Location.id == event.location_id).first()
        if loc: loc_name = loc.name
    if event.organization_id:
        org = db.query(models.Organization).filter(models.Organization.id == event.organization_id).first()
        if org: org_name = org.name

    event_data = {
        "name": event.name,
        "description": event.description,
        "polarity": event.polarity,
        "intensity": event.intensity,
        "story_time": event.story_time or "未指定时间",
        "location": loc_name or "未指定地点",
        "organization": org_name or "未指定组织",
        "author_direction": direction,
        "perspective": perspective,
    }
    chars_data = [
        {
            "name": c.name,
            "engines": (c.runtime_state or {}).get("engines") or c.engines,
            "runtime": {
                "main_color": (c.runtime_state or {}).get("main_color"),
                "version": (c.runtime_state or {}).get("version"),
            },
        }
        for c in characters
    ]

    print("⏳ 正在向 AI 引擎发送推演请求...")
    result = run_simulation(event_data, chars_data)
    
    print("✅ AI 推演返回完成，准备处理数据")
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # ✅ 1. 处理 AI 返回的关系变化，直接反哺数据库
    rel_changes = result.get("relationship_changes", [])
    if rel_changes:
        for rc in rel_changes:
            s_char = db.query(models.Character).filter(
                models.Character.name == rc.get("source_name"),
                models.Character.world_id == event.world_id,
                models.Character.archived_at.is_(None),
            ).first()
            t_char = db.query(models.Character).filter(
                models.Character.name == rc.get("target_name"),
                models.Character.world_id == event.world_id,
                models.Character.archived_at.is_(None),
            ).first()
            
            if s_char and t_char:
                existing_rel = db.query(models.Relationship).filter(
                    models.Relationship.source_id == s_char.id,
                    models.Relationship.target_id == t_char.id
                ).first()
                
                if existing_rel:
                    new_history = list(existing_rel.history) if existing_rel.history else []
                    new_history.append({
                        "time": event.story_time or datetime.utcnow().strftime("%Y-%m-%d"),
                        "old_status": existing_rel.source_quadrant,
                        "new_status": rc.get("new_quadrant"),
                        "reason": rc.get("reason")
                    })
                    existing_rel.history = new_history
                    existing_rel.source_quadrant = rc.get("new_quadrant")
                    existing_rel.description = rc.get("reason")
                    flag_modified(existing_rel, "history")
                else:
                    new_rel = models.Relationship(
                        world_id=event.world_id,
                        source_id=s_char.id,
                        target_id=t_char.id,
                        relation_type="事件引发的新关系",
                        source_quadrant=rc.get("new_quadrant"),
                        description=rc.get("reason")
                    )
                    db.add(new_rel)

    # ✅ 2. 将推演行动写入人物的生命经历（历史沉积）
    actions = result.get("actions", [])
    print(f"📊 本次推演涉及的行动数量: {len(actions)}")
    
    for act in actions:
        char_name = act.get("name")
        action_desc = act.get("action")
        print(f"👉 尝试写入履历: {char_name} 的行动")
        
        # ✅ 核心修复 1：模糊匹配，防止 AI 返回“舒舒。”导致找不到人
        char = db.query(models.Character).filter(
            models.Character.name.like(f"%{char_name}%"),
            models.Character.world_id == event.world_id,
            models.Character.archived_at.is_(None),
        ).first()
        
        if char:
            print(f"✅ 找到人物 {char.name}，正在写入履历...")
            history_data = char.life_history or {"events": [], "deposits": {}}
            if isinstance(history_data, list):
                history_data = {"events": history_data, "deposits": {}}
                
            events_list = history_data.get("events", [])
            events_list.append({
                "id": str(uuid.uuid4()),
                "name": f"推演事件：{event.name}",
                "startTime": event.story_time or "未知时间",
                "facts": f"当时我采取了行动：{action_desc}",
                "cognition": "由世界推演引擎生成。",
                "lifeImpact": f"事件结果：{act.get('status', '无具体结果')}",
                "domain": event.domain or [],
                "polarity": event.polarity,
                "intensity": event.intensity
            })
            history_data["events"] = events_list
            char.life_history = history_data
            
            # ✅ 核心修复 2：强制 SQLAlchemy 更新 JSON 字段
            flag_modified(char, "life_history")
            print(f"✅ 履历写入完成，当前该人物共有 {len(events_list)} 条经历。")
        else:
            print(f"❌ 未找到名字为 {char_name} 的人物！")

    # ✅ 3. 保存推演记录
    new_run = models.SimulationRun(
        world_id=event.world_id,
        event_id=event.id,
        direction=direction,
        perspective=perspective,
        world_changes=result.get("world_changes", ""),
        character_actions=result.get("actions", [])
    )
    db.add(new_run)
    
    # 统一提交所有数据库变更
    db.commit()
    print("✅ 所有数据已统一存入数据库")
    db.refresh(new_run)

    return result

@router.get("/api/simulations")
def list_all_simulations(db: Session = Depends(get_db)):
    return db.query(models.SimulationRun).all()

@router.get("/api/simulations/{event_id}")
def get_simulations(event_id: str, db: Session = Depends(get_db)):
    runs = db.query(models.SimulationRun).filter(models.SimulationRun.event_id == event_id).order_by(models.SimulationRun.created_at.desc()).all()
    return runs
