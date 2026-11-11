"""05 事件分支沙盒方案：预设选项/约束/支持/潜在条件/关联因素。

方案独立于事件，只保存探索配置；创建实际分支时写 branch_id，复用 multipath。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter()


def _event(db: Session, event_id: str) -> models.Event:
    row = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="事件不存在")
    return row


def _scenario(db: Session, scenario_id: str) -> models.EventSandboxScenario:
    row = db.query(models.EventSandboxScenario).filter(models.EventSandboxScenario.id == scenario_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="沙盒方案不存在")
    return row


def _list(value, limit: int = 40) -> list:
    return value[:limit] if isinstance(value, list) else []


def _row(row: models.EventSandboxScenario) -> dict:
    branch = None
    return {
        "id": row.id, "world_id": row.world_id, "event_id": row.event_id,
        "title": row.title, "note": row.note or "",
        "preset_options": row.preset_options or [], "constraints": row.constraints or [],
        "supports": row.supports or [], "potentials": row.potentials or [],
        "factors": row.factors or [], "branch_id": row.branch_id,
        "status": row.status or "draft", "created_at": row.created_at, "updated_at": row.updated_at,
    }


def _clean_list(payload: dict, key: str) -> list:
    value = payload.get(key)
    if not isinstance(value, list):
        return []
    rows = []
    for item in value[:40]:
        if isinstance(item, str):
            text = item.strip()
            if text:
                rows.append({"text": text[:1000], "status": "active"})
        elif isinstance(item, dict):
            text = str(item.get("text") or item.get("name") or item.get("label") or "").strip()
            if not text:
                continue
            row = {**item, "text": text[:1000]}
            if key == "potentials":
                row["status"] = row.get("status") if row.get("status") in {"potential", "confirmed", "dismissed"} else "potential"
            rows.append(row)
    return rows


@router.get("/api/events/{event_id}/sandbox-scenarios")
def list_scenarios(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = db.query(models.EventSandboxScenario).filter(
        models.EventSandboxScenario.event_id == event_id
    ).order_by(models.EventSandboxScenario.updated_at.desc()).all()
    return [_row(row) for row in rows]


@router.get("/api/events/{event_id}/sandbox-presets")
def sandbox_presets(event_id: str, db: Session = Depends(get_db)):
    event = _event(db, event_id)
    chars = []
    for char_id in (event.participants or [])[:20]:
        char = db.query(models.Character).filter(models.Character.id == char_id).first()
        if char:
            chars.append({"type": "character", "id": char.id, "name": char.name})
    orgs = []
    if event.organization_id:
        org = db.query(models.Organization).filter(models.Organization.id == event.organization_id).first()
        if org:
            orgs.append({"type": "organization", "id": org.id, "name": org.name})
    return {
        "preset_options": [
            {"label": "按原事件惯性发展", "description": "不额外改变条件，观察原有因果链。"},
            {"label": "关系变化介入", "description": "让人物关系或信任状态成为分支变量。"},
            {"label": "外部压力介入", "description": "引入组织、资源、环境或敌对势力的压力。"},
            {"label": "隐藏条件触发", "description": "把尚未确认的潜在条件作为分支触发点。"},
        ],
        "constraint_candidates": [
            {"text": "不得突破人物的现实能力与资源上限", "kind": "limit"},
            {"text": "分支必须保留与原事件的因果关联", "kind": "must"},
            {"text": "不得与已确认的世界规则冲突", "kind": "must"},
        ],
        "support_candidates": [
            {"text": "人物之间存在可调用的信任或人情", "kind": "support"},
            {"text": "事件时间窗口尚未关闭", "kind": "support"},
            {"text": "存在可利用的信息差或资源", "kind": "support"},
        ],
        "potential_candidates": [
            {"text": "某个人物尚未暴露的真实动机", "kind": "potential"},
            {"text": "未被确认的第三方势力介入", "kind": "potential"},
            {"text": "某个物品或资源的隐藏用途", "kind": "potential"},
        ],
        "factors": chars + orgs,
    }


@router.post("/api/events/{event_id}/sandbox-scenarios")
def create_scenario(event_id: str, payload: dict, db: Session = Depends(get_db)):
    event = _event(db, event_id)
    if not event.world_id:
        raise HTTPException(status_code=409, detail="事件未归属世界")
    title = str(payload.get("title") or "").strip()[:160]
    if not title:
        raise HTTPException(status_code=422, detail="方案名称不能为空")
    row = models.EventSandboxScenario(
        world_id=event.world_id, event_id=event.id, title=title,
        note=str(payload.get("note") or "")[:4000],
        preset_options=_clean_list(payload, "preset_options"),
        constraints=_clean_list(payload, "constraints"),
        supports=_clean_list(payload, "supports"),
        potentials=_clean_list(payload, "potentials"),
        factors=_clean_list(payload, "factors"),
        status="draft",
    )
    db.add(row); db.commit(); db.refresh(row)
    return _row(row)


@router.patch("/api/sandbox-scenarios/{scenario_id}")
def update_scenario(scenario_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _scenario(db, scenario_id)
    if "title" in payload:
        title = str(payload.get("title") or "").strip()[:160]
        if not title:
            raise HTTPException(status_code=422, detail="方案名称不能为空")
        row.title = title
    if "note" in payload:
        row.note = str(payload.get("note") or "")[:4000]
    for key in ("preset_options", "constraints", "supports", "potentials", "factors"):
        if key in payload:
            setattr(row, key, _clean_list(payload, key))
    if "status" in payload:
        row.status = str(payload.get("status") or "draft")[:20]
    if "branch_id" in payload:
        branch_id = str(payload.get("branch_id") or "").strip() or None
        if branch_id:
            branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == branch_id).first()
            if not branch or branch.world_id != row.world_id or branch.root_event_id != row.event_id:
                raise HTTPException(status_code=409, detail="分支不属于该事件/世界")
        row.branch_id = branch_id
    row.updated_at = datetime.utcnow()
    db.commit(); db.refresh(row)
    return _row(row)


@router.delete("/api/sandbox-scenarios/{scenario_id}")
def delete_scenario(scenario_id: str, db: Session = Depends(get_db)):
    row = _scenario(db, scenario_id)
    db.delete(row); db.commit()
    return {"status": "removed"}


@router.post("/api/sandbox-scenarios/compare")
def compare_scenarios(payload: dict, db: Session = Depends(get_db)):
    ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []
    rows = db.query(models.EventSandboxScenario).filter(
        models.EventSandboxScenario.id.in_(ids[:8])
    ).all()
    result = []
    for row in rows:
        result.append({
            "id": row.id, "title": row.title, "note": row.note or "",
            "preset_count": len(row.preset_options or []),
            "constraints": _list(row.constraints), "supports": _list(row.supports),
            "potentials": _list(row.potentials), "factors": _list(row.factors),
            "branch_id": row.branch_id, "status": row.status,
        })
    return {"scenarios": result}
