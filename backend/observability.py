"""前端错误采集与运行监控。"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter()
MAX_MESSAGE = 2000
MAX_STACK = 12000


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else None


@router.post("/api/client-errors")
def report_client_error(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    message = str(payload.get("message") or "").strip()[:MAX_MESSAGE]
    if not message:
        raise HTTPException(status_code=422, detail="缺少错误信息")
    db.add(models.ClientError(
        user_id=user.id,
        message=message,
        stack=str(payload.get("stack") or "")[:MAX_STACK],
        url=str(payload.get("url") or "")[:1000],
        page=str(payload.get("page") or "")[:200],
        user_agent=str(request.headers.get("user-agent") or "")[:1000],
    ))
    db.commit()
    # 只保留最近 2000 条，避免错误风暴把数据库撑满。
    overflow = (
        db.query(models.ClientError.id)
        .order_by(models.ClientError.created_at.desc())
        .offset(2000)
        .limit(500)
        .all()
    )
    if overflow:
        ids = [row[0] for row in overflow]
        db.query(models.ClientError).filter(models.ClientError.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
    return {"ok": True}


@router.get("/api/admin/client-errors")
def list_client_errors(
    request: Request,
    limit: int = Query(80, ge=1, le=300),
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可查看运行监控")
    rows = (
        db.query(models.ClientError)
        .order_by(models.ClientError.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "items": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "message": row.message,
                "stack": row.stack,
                "url": row.url,
                "page": row.page,
                "user_agent": row.user_agent,
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ],
        "total": db.query(models.ClientError).count(),
    }


@router.delete("/api/admin/client-errors")
def clear_client_errors(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可清理运行监控")
    count = db.query(models.ClientError).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": count}
