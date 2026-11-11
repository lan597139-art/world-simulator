"""信息来源管理：日记/传记产品专用。

来源类型：本人回忆、他人叙述、资料证据、AI 推断。
AI 推断默认不是事实；只有用户显式确认后才能 confirmed。
"""

from __future__ import annotations

from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import product_config as pc
from database import get_db

router = APIRouter(tags=["information-sources"])
OWNER = "local"

SOURCE_TYPES = {
    "self_memory": "本人回忆",
    "other_account": "他人叙述",
    "document": "资料文献",
    "evidence": "实物/记录证据",
    "ai_inference": "AI 推断",
}
STATUS = {"confirmed", "unconfirmed", "inference"}


def _fail(code, message):
    raise HTTPException(status_code=code, detail=message)


def _check_product(product: str) -> str:
    try:
        return pc.require_module(product, "information-sources")
    except (ValueError, PermissionError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def _row(row: models.InformationSource) -> dict:
    return {
        "id": row.id,
        "product_key": row.product_key,
        "world_id": row.world_id,
        "character_id": row.character_id,
        "event_id": row.event_id,
        "title": row.title or "",
        "source_type": row.source_type,
        "source_type_label": SOURCE_TYPES.get(row.source_type, row.source_type),
        "content": row.content or "",
        "source_date": row.source_date or "",
        "status": row.status,
        "confirmed": row.status == "confirmed",
        "confidence": row.confidence if row.confidence is not None else 0.5,
        "citation": row.citation or "",
        "visibility": row.visibility or "private",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _validate_links(db: Session, world_id: str | None, character_id: str | None, event_id: str | None):
    world = None
    if world_id:
        world = db.query(models.World).filter(
            models.World.id == world_id, models.World.deleted_at.is_(None)
        ).first()
        if not world:
            _fail(409, "关联世界不存在")
    if character_id:
        char = db.query(models.Character).filter(models.Character.id == character_id).first()
        if not char or (world_id and char.world_id != world_id):
            _fail(409, "关联人物不存在或不属于该世界")
        if not world_id:
            world_id = char.world_id
    if event_id:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event or (world_id and event.world_id != world_id):
            _fail(409, "关联事件不存在或不属于该世界")
        if not world_id:
            world_id = event.world_id
    return world_id


@router.get("/api/information-sources/presets")
def presets():
    return {
        "source_types": [{"key": key, "label": label} for key, label in SOURCE_TYPES.items()],
        "statuses": [
            {"key": "confirmed", "label": "已确认"},
            {"key": "unconfirmed", "label": "待核实"},
            {"key": "inference", "label": "AI 推断 · 未确认"},
        ],
    }


@router.get("/api/information-sources")
def list_sources(
    product: str = "diary",
    character_id: str = "",
    event_id: str = "",
    source_type: str = "",
    status: str = "",
    db: Session = Depends(get_db),
):
    product = _check_product(product)
    query = db.query(models.InformationSource).filter(
        models.InformationSource.owner_user_id == OWNER,
        models.InformationSource.product_key == product,
    )
    if character_id:
        query = query.filter(models.InformationSource.character_id == character_id)
    if event_id:
        query = query.filter(models.InformationSource.event_id == event_id)
    if source_type:
        query = query.filter(models.InformationSource.source_type == source_type)
    if status:
        query = query.filter(models.InformationSource.status == status)
    rows = query.order_by(models.InformationSource.source_date.desc(), models.InformationSource.created_at.desc()).all()
    return [_row(row) for row in rows]


@router.post("/api/information-sources")
def create_source(payload: dict, db: Session = Depends(get_db)):
    product = _check_product(str(payload.get("product_key") or "diary").strip().lower())
    source_type = str(payload.get("source_type") or "self_memory")
    if source_type not in SOURCE_TYPES:
        _fail(422, "来源类型不合法")
    title = str(payload.get("title") or "").strip()[:200]
    content = str(payload.get("content") or "").strip()
    if not title and not content:
        _fail(422, "来源标题或内容不能为空")
    world_id = str(payload.get("world_id") or "").strip() or None
    character_id = str(payload.get("character_id") or "").strip() or None
    event_id = str(payload.get("event_id") or "").strip() or None
    world_id = _validate_links(db, world_id, character_id, event_id)

    source_date = str(payload.get("source_date") or date.today().isoformat())[:10]
    try:
        date.fromisoformat(source_date)
    except ValueError:
        _fail(422, "source_date 必须是 YYYY-MM-DD")
    if source_type == "ai_inference":
        status = "inference"
    else:
        status = str(payload.get("status") or "unconfirmed")
        if status not in STATUS:
            _fail(422, "来源状态不合法")
        if status == "inference":
            _fail(422, "只有 AI 推断来源可标记为 inference")
    confidence = payload.get("confidence", 0.5)
    try:
        confidence = max(0.0, min(1.0, float(confidence)))
    except (TypeError, ValueError):
        confidence = 0.5
    row = models.InformationSource(
        owner_user_id=OWNER,
        product_key=product,
        world_id=world_id,
        character_id=character_id,
        event_id=event_id,
        title=title,
        source_type=source_type,
        content=content[:20000],
        source_date=source_date,
        status=status,
        confidence=confidence,
        citation=str(payload.get("citation") or "")[:10000],
        visibility=str(payload.get("visibility") or "private")[:20],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row(row)


@router.patch("/api/information-sources/{source_id}")
def update_source(source_id: str, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.InformationSource).filter(
        models.InformationSource.id == source_id,
        models.InformationSource.owner_user_id == OWNER,
    ).first()
    if not row:
        _fail(404, "信息来源不存在")
    _check_product(str(payload.get("product") or row.product_key))
    if "title" in payload:
        row.title = str(payload.get("title") or "")[:200]
    if "content" in payload:
        row.content = str(payload.get("content") or "")[:20000]
    if "citation" in payload:
        row.citation = str(payload.get("citation") or "")[:10000]
    if "source_date" in payload:
        value = str(payload.get("source_date") or "")[:10]
        try:
            date.fromisoformat(value)
        except ValueError:
            _fail(422, "source_date 必须是 YYYY-MM-DD")
        row.source_date = value
    if "source_type" in payload:
        source_type = str(payload.get("source_type") or "")
        if source_type not in SOURCE_TYPES:
            _fail(422, "来源类型不合法")
        row.source_type = source_type
        if source_type == "ai_inference":
            row.status = "inference"
    if "status" in payload:
        status = str(payload.get("status") or "")
        if status not in STATUS:
            _fail(422, "来源状态不合法")
        if row.source_type == "ai_inference" and status == "confirmed" and payload.get("confirm_inference") is not True:
            _fail(409, "AI 推断必须经用户显式确认后才能转为事实")
        row.status = status
    if "confidence" in payload:
        try:
            row.confidence = max(0.0, min(1.0, float(payload.get("confidence"))))
        except (TypeError, ValueError):
            _fail(422, "confidence 必须是 0-1 数字")
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row)


@router.post("/api/information-sources/{source_id}/confirm")
def confirm_source(source_id: str, db: Session = Depends(get_db)):
    """用户显式确认 AI 推断（唯一允许把推断转为事实的入口）。"""
    row = db.query(models.InformationSource).filter(
        models.InformationSource.id == source_id,
        models.InformationSource.owner_user_id == OWNER,
    ).first()
    if not row:
        _fail(404, "信息来源不存在")
    _check_product(row.product_key)
    row.status = "confirmed"
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row)


@router.delete("/api/information-sources/{source_id}")
def delete_source(source_id: str, db: Session = Depends(get_db)):
    row = db.query(models.InformationSource).filter(
        models.InformationSource.id == source_id,
        models.InformationSource.owner_user_id == OWNER,
    ).first()
    if not row:
        _fail(404, "信息来源不存在")
    _check_product(row.product_key)
    db.delete(row)
    db.commit()
    return {"status": "removed"}
