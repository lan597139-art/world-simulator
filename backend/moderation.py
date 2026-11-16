"""内容举报与管理员审核队列。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db
from sanctions import target_author_id

router = APIRouter()

TARGET_TYPES = {"post", "comment", "topic", "work", "user", "message"}
STATUSES = {"pending", "resolved", "dismissed"}
REASONS = {"spam", "harassment", "illegal", "adult", "misinformation", "other"}


def _row(row: models.ContentReport, db: Session):
    reporter = db.query(models.AppUser).filter(models.AppUser.id == row.reporter_id).first()
    author_id = target_author_id(db, row.target_type, row.target_id)
    author = db.query(models.AppUser).filter(models.AppUser.id == author_id).first() if author_id else None
    return {
        "id": row.id,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "reason": row.reason,
        "detail": row.detail or "",
        "status": row.status,
        "reporter": {"id": reporter.id, "name": reporter.display_name or reporter.username} if reporter else None,
        "target_author": {"id": author.id, "name": author.display_name or author.username} if author else None,
        "resolution_note": row.resolution_note or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
    }


@router.post("/api/reports")
def create_report(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    target_type = str(payload.get("target_type") or "").strip()
    target_id = str(payload.get("target_id") or "").strip()
    reason = str(payload.get("reason") or "other").strip()
    detail = str(payload.get("detail") or "").strip()[:2000]
    if target_type not in TARGET_TYPES or not target_id:
        raise HTTPException(status_code=400, detail="举报对象无效")
    model_map = {
        "post": models.SocialPost,
        "comment": models.SocialPostComment,
        "topic": models.CommunityTopic,
        "work": models.CreativeWork,
        "user": models.AppUser,
        "message": models.DirectMessage,
    }
    if not db.query(model_map[target_type]).filter(model_map[target_type].id == target_id).first():
        raise HTTPException(status_code=404, detail="举报对象不存在")
    if reason not in REASONS:
        reason = "other"
    duplicate = (
        db.query(models.ContentReport)
        .filter(
            models.ContentReport.reporter_id == user.id,
            models.ContentReport.target_type == target_type,
            models.ContentReport.target_id == target_id,
            models.ContentReport.status == "pending",
        )
        .first()
    )
    if duplicate:
        return {"ok": True, "duplicate": True, "report": _row(duplicate, db)}
    row = models.ContentReport(
        reporter_id=user.id,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        detail=detail,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "duplicate": False, "report": _row(row, db)}


@router.get("/api/admin/reports")
def admin_reports(
    request: Request,
    status: str = Query("pending"),
    limit: int = Query(100, ge=1, le=300),
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅管理员可查看审核队列")
    query = db.query(models.ContentReport)
    if status in STATUSES:
        query = query.filter(models.ContentReport.status == status)
    rows = query.order_by(models.ContentReport.created_at.desc()).limit(limit).all()
    return {"items": [_row(row, db) for row in rows], "status": status}


@router.patch("/api/admin/reports/{report_id}")
def resolve_report(report_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅管理员可处理举报")
    row = db.query(models.ContentReport).filter(models.ContentReport.id == report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="举报不存在")
    status = str(payload.get("status") or "").strip()
    if status not in {"resolved", "dismissed"}:
        raise HTTPException(status_code=400, detail="处理状态无效")
    row.status = status
    row.resolver_id = user.id
    row.resolution_note = str(payload.get("note") or "")[:2000]
    row.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _row(row, db)
