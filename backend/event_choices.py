"""05 多剧情：事件选择点、选项结果、后续事件、沙盒生成。"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["event-choices"])


def _fail(code: int, message: str):
    raise HTTPException(status_code=code, detail=message)


def _event(db: Session, event_id: str) -> models.Event:
    row = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not row:
        _fail(404, "事件不存在")
    return row


def _choice(db: Session, choice_id: str) -> models.EventChoice:
    row = db.query(models.EventChoice).filter(models.EventChoice.id == choice_id).first()
    if not row:
        _fail(404, "选择点不存在")
    return row


def _option(db: Session, option_id: str) -> models.EventChoiceOption:
    row = db.query(models.EventChoiceOption).filter(models.EventChoiceOption.id == option_id).first()
    if not row:
        _fail(404, "选项不存在")
    return row


def _option_row(db: Session, row: models.EventChoiceOption) -> dict:
    outcome = (
        db.query(models.Event).filter(models.Event.id == row.outcome_event_id).first()
        if row.outcome_event_id else None
    )
    return {
        "id": row.id,
        "choice_id": row.choice_id,
        "label": row.label,
        "consequence": row.consequence or "",
        "outcome_event_id": row.outcome_event_id,
        "outcome_event_name": outcome.name if outcome else "",
        "target_branch_id": row.target_branch_id,
        "source": row.source,
        "confirmed": bool(row.confirmed),
        "order_index": row.order_index or 0,
    }


def _choice_row(db: Session, row: models.EventChoice) -> dict:
    options = (
        db.query(models.EventChoiceOption)
        .filter(models.EventChoiceOption.choice_id == row.id)
        .order_by(models.EventChoiceOption.order_index.asc(), models.EventChoiceOption.created_at.asc())
        .all()
    )
    return {
        "id": row.id,
        "event_id": row.event_id,
        "title": row.title,
        "description": row.description or "",
        "precondition": row.precondition or {},
        "status": row.status,
        "options": [_option_row(db, item) for item in options],
    }


@router.get("/api/events/{event_id}/choices")
def list_choices(event_id: str, db: Session = Depends(get_db)):
    _event(db, event_id)
    rows = (
        db.query(models.EventChoice)
        .filter(models.EventChoice.event_id == event_id)
        .order_by(models.EventChoice.created_at.asc())
        .all()
    )
    return [_choice_row(db, row) for row in rows]


@router.post("/api/events/{event_id}/choices")
def create_choice(event_id: str, payload: dict, db: Session = Depends(get_db)):
    event = _event(db, event_id)
    title = str(payload.get("title") or "").strip()[:200]
    if not title:
        _fail(422, "缺少选择点标题")
    row = models.EventChoice(
        world_id=event.world_id,
        event_id=event.id,
        title=title,
        description=str(payload.get("description") or "")[:2000],
        precondition=payload.get("precondition") if isinstance(payload.get("precondition"), dict) else {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _choice_row(db, row)


@router.patch("/api/event-choices/{choice_id}")
def update_choice(choice_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _choice(db, choice_id)
    for field in ("title", "description", "status"):
        if field in payload:
            setattr(row, field, str(payload.get(field) or "")[:2000])
    if "precondition" in payload and isinstance(payload.get("precondition"), dict):
        row.precondition = payload["precondition"]
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _choice_row(db, row)


@router.delete("/api/event-choices/{choice_id}")
def delete_choice(choice_id: str, db: Session = Depends(get_db)):
    row = _choice(db, choice_id)
    db.query(models.EventChoiceOption).filter(models.EventChoiceOption.choice_id == row.id).delete(
        synchronize_session=False
    )
    db.delete(row)
    db.commit()
    return {"status": "removed"}


@router.post("/api/event-choices/{choice_id}/options")
def create_option(choice_id: str, payload: dict, db: Session = Depends(get_db)):
    choice = _choice(db, choice_id)
    event = _event(db, choice.event_id)
    label = str(payload.get("label") or "").strip()[:200]
    if not label:
        _fail(422, "缺少选项文案")
    outcome_id = str(payload.get("outcome_event_id") or "").strip() or None
    if outcome_id:
        outcome = _event(db, outcome_id)
        if outcome.world_id != choice.world_id:
            _fail(409, "后续事件不在该世界")
        if event.branch_id and outcome.branch_id not in (None, event.branch_id):
            _fail(409, "后续事件属于其他分支")
    count = db.query(models.EventChoiceOption).filter(models.EventChoiceOption.choice_id == choice.id).count()
    row = models.EventChoiceOption(
        world_id=choice.world_id,
        choice_id=choice.id,
        label=label,
        consequence=str(payload.get("consequence") or "")[:2000],
        outcome_event_id=outcome_id,
        source="ai" if payload.get("source") == "ai" else "user",
        confirmed=False if payload.get("source") == "ai" else bool(payload.get("confirmed", True)),
        order_index=int(payload.get("order_index") or count),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _option_row(db, row)


@router.patch("/api/event-choice-options/{option_id}")
def update_option(option_id: str, payload: dict, db: Session = Depends(get_db)):
    row = _option(db, option_id)
    if "label" in payload:
        label = str(payload.get("label") or "").strip()[:200]
        if not label:
            _fail(422, "选项文案不能为空")
        row.label = label
    if "consequence" in payload:
        row.consequence = str(payload.get("consequence") or "")[:2000]
    if "outcome_event_id" in payload:
        outcome_id = str(payload.get("outcome_event_id") or "").strip() or None
        if outcome_id:
            outcome = _event(db, outcome_id)
            if outcome.world_id != row.world_id:
                _fail(409, "后续事件不在该世界")
        row.outcome_event_id = outcome_id
    if "confirmed" in payload:
        row.confirmed = bool(payload.get("confirmed"))
    db.commit()
    db.refresh(row)
    return _option_row(db, row)


@router.delete("/api/event-choice-options/{option_id}")
def delete_option(option_id: str, db: Session = Depends(get_db)):
    row = _option(db, option_id)
    db.delete(row)
    db.commit()
    return {"status": "removed"}


@router.post("/api/event-choice-options/{option_id}/sandbox")
def make_sandbox(option_id: str, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    option = _option(db, option_id)
    if option.target_branch_id:
        branch = db.query(models.SimulationBranch).filter(models.SimulationBranch.id == option.target_branch_id).first()
        if branch:
            return {"branch_id": branch.id, "name": branch.name, "existing": True}
    if not option.confirmed:
        _fail(409, "AI 选项需确认后才能生成沙盒")
    choice = _choice(db, option.choice_id)
    event = _event(db, choice.event_id)
    from multipath import create_branch
    branch = create_branch({
        "root_event_id": event.id,
        "name": str((payload or {}).get("name") or f"{event.name} · {option.label}")[:120],
        "note": f"来自事件选择「{choice.title}」的选项：{option.label}",
    }, db)
    option.target_branch_id = branch["id"]
    db.commit()
    return {"branch_id": branch["id"], "name": branch["name"], "existing": False}
