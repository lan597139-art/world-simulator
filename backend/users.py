"""本地账号（第一阶段）：无密码登录，仅用于归属与场景隔离的基础设施。"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["users"])
LOCAL_USER_ID = "local"


def ensure_local_user(db: Session) -> models.AppUser:
    user = db.query(models.AppUser).filter(models.AppUser.id == LOCAL_USER_ID).first()
    if user is None:
        user = models.AppUser(id=LOCAL_USER_ID, username="local", display_name="本地用户")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _row(user: models.AppUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.get("/api/users/me")
def me(request: Request, db: Session = Depends(get_db)):
    from auth import current_user
    return _row(current_user(request, db))


@router.patch("/api/users/me")
def update_me(payload: dict, db: Session = Depends(get_db)):
    user = ensure_local_user(db)
    name = str(payload.get("display_name") or "").strip()[:80]
    if name:
        user.display_name = name
        db.commit()
        db.refresh(user)
    return _row(user)


@router.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    rows = db.query(models.AppUser).order_by(models.AppUser.created_at.asc()).all()
    return [_row(row) for row in rows]
