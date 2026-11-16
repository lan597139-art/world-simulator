"""世界协作：邀请、成员角色与待处理邀请。

角色规则：
- owner：创建者，可邀请、改角色、移除成员；
- editor：可编辑世界内所有内容；
- viewer：只读；
- 被邀请者在接受前没有访问权限。
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from access import current_user_id, get_world_for_request, world_role
from database import get_db

router = APIRouter(prefix="/api")
ROLES = {"editor", "viewer"}


def _iso(value) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else (str(value) if value else None)


def _user_brief(db: Session, user_id: str) -> dict:
    user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not user:
        return {"id": user_id, "username": "", "name": "已注销用户", "avatar": ""}
    return {
        "id": user.id,
        "username": user.username or "",
        "name": user.display_name or user.username or "未命名",
        "avatar": user.avatar or "",
    }


def _row(db: Session, row: models.WorldCollaborator, world: models.World | None = None) -> dict:
    world = world or db.query(models.World).filter(models.World.id == row.world_id).first()
    return {
        "id": row.id,
        "world_id": row.world_id,
        "world_name": world.name if world else "",
        "user": _user_brief(db, row.user_id),
        "role": row.role,
        "status": row.status,
        "invited_by": _user_brief(db, row.invited_by),
        "created_at": _iso(row.created_at),
        "responded_at": _iso(row.responded_at),
    }


def _owner_only(world: models.World, user_id: str, db: Session) -> None:
    if world_role(world, user_id, db) != "owner":
        raise HTTPException(status_code=403, detail="只有世界创建者可以管理协作成员")


def _notify(db: Session, *, user_id: str, actor_id: str, world: models.World, title: str, body: str) -> None:
    db.add(models.CommunityNotification(
        user_id=user_id,
        type="world_collaboration",
        actor_id=actor_id,
        object_type="world",
        object_id=world.id,
        title=title,
        body=body,
    ))


@router.get("/worlds/{world_id}/collaborators")
def list_collaborators(world_id: str, request: Request, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    user_id = current_user_id(request)
    role = world_role(world, user_id, db)
    can_manage = role == "owner"
    query = db.query(models.WorldCollaborator).filter(models.WorldCollaborator.world_id == world.id)
    if not can_manage:
        query = query.filter(
            models.WorldCollaborator.status == "accepted",
            models.WorldCollaborator.user_id == user_id,
        )
    rows = query.order_by(models.WorldCollaborator.created_at.asc()).all()
    owner = _user_brief(db, world.owner_id or "local")
    return {
        "owner": owner,
        "role": role,
        "can_manage": can_manage,
        "items": [_row(db, row, world) for row in rows],
    }


@router.post("/worlds/{world_id}/collaborators")
def invite_collaborator(world_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    world = get_world_for_request(db, world_id, request)
    user_id = current_user_id(request)
    _owner_only(world, user_id, db)
    username = str(payload.get("username") or "").strip().lstrip("@")
    role = str(payload.get("role") or "viewer").strip()
    if role not in ROLES:
        raise HTTPException(status_code=422, detail="角色只能是 editor 或 viewer")
    if not username:
        raise HTTPException(status_code=422, detail="请输入用户名")
    target = db.query(models.AppUser).filter(func.lower(models.AppUser.username) == username.lower()).first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    if target.id == (world.owner_id or "local"):
        raise HTTPException(status_code=409, detail="创建者已经是所有者")
    existing = db.query(models.WorldCollaborator).filter(
        models.WorldCollaborator.world_id == world.id,
        models.WorldCollaborator.user_id == target.id,
    ).first()
    if existing and existing.status == "accepted":
        if existing.role == role:
            raise HTTPException(status_code=409, detail="该用户已经是协作成员")
        existing.role = role
        db.commit()
        db.refresh(existing)
        return {"item": _row(db, existing, world), "updated": True}
    if existing:
        existing.role = role
        existing.status = "pending"
        existing.invited_by = user_id
        existing.responded_at = None
        row = existing
    else:
        row = models.WorldCollaborator(
            world_id=world.id,
            user_id=target.id,
            role=role,
            status="pending",
            invited_by=user_id,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    actor = _user_brief(db, user_id)
    _notify(
        db,
        user_id=target.id,
        actor_id=user_id,
        world=world,
        title=f"{actor['name']} 邀请你协作世界「{world.name}」",
        body=f"角色：{'可编辑' if role == 'editor' else '只读'}",
    )
    db.commit()
    return {"item": _row(db, row, world)}


@router.post("/world-collaborators/{collaborator_id}/respond")
def respond_to_invite(collaborator_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.WorldCollaborator).filter(models.WorldCollaborator.id == collaborator_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="邀请不存在")
    user_id = current_user_id(request)
    if row.user_id != user_id:
        raise HTTPException(status_code=403, detail="这不是发给你的邀请")
    action = str(payload.get("action") or "").strip()
    if action not in {"accept", "decline"}:
        raise HTTPException(status_code=422, detail="action 只能是 accept 或 decline")
    world = db.query(models.World).filter(models.World.id == row.world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="世界不存在")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="该邀请已经处理过")
    row.status = "accepted" if action == "accept" else "declined"
    row.responded_at = datetime.utcnow()
    db.query(models.CommunityNotification).filter(
        models.CommunityNotification.user_id == user_id,
        models.CommunityNotification.type == "world_collaboration",
        models.CommunityNotification.object_id == world.id,
        models.CommunityNotification.read_at.is_(None),
    ).update({models.CommunityNotification.read_at: datetime.utcnow()}, synchronize_session=False)
    actor = _user_brief(db, user_id)
    _notify(
        db,
        user_id=world.owner_id or "local",
        actor_id=user_id,
        world=world,
        title=f"{actor['name']} {'接受了' if action == 'accept' else '拒绝了'}世界协作邀请",
        body=f"世界：{world.name}",
    )
    db.commit()
    db.refresh(row)
    return {"item": _row(db, row, world)}


@router.patch("/world-collaborators/{collaborator_id}")
def update_collaborator(collaborator_id: str, request: Request, payload: dict, db: Session = Depends(get_db)):
    row = db.query(models.WorldCollaborator).filter(models.WorldCollaborator.id == collaborator_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="协作成员不存在")
    world = db.query(models.World).filter(models.World.id == row.world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="世界不存在")
    _owner_only(world, current_user_id(request), db)
    role = str(payload.get("role") or "").strip()
    if role not in ROLES:
        raise HTTPException(status_code=422, detail="角色只能是 editor 或 viewer")
    row.role = role
    db.commit()
    db.refresh(row)
    return {"item": _row(db, row, world)}


@router.delete("/world-collaborators/{collaborator_id}")
def remove_collaborator(collaborator_id: str, request: Request, db: Session = Depends(get_db)):
    row = db.query(models.WorldCollaborator).filter(models.WorldCollaborator.id == collaborator_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="协作成员不存在")
    world = db.query(models.World).filter(models.World.id == row.world_id).first()
    if not world or world.deleted_at is not None:
        raise HTTPException(status_code=404, detail="世界不存在")
    user_id = current_user_id(request)
    is_owner = world_role(world, user_id, db) == "owner"
    if not is_owner and row.user_id != user_id:
        raise HTTPException(status_code=403, detail="没有移除该成员的权限")
    member_id = row.user_id
    db.delete(row)
    db.commit()
    if is_owner:
        _notify(
            db,
            user_id=member_id,
            actor_id=user_id,
            world=world,
            title=f"你已被移出世界「{world.name}」的协作",
            body="",
        )
    else:
        _notify(
            db,
            user_id=world.owner_id or "local",
            actor_id=user_id,
            world=world,
            title=f"{_user_brief(db, user_id)['name']} 退出了世界协作",
            body=f"世界：{world.name}",
        )
    db.commit()
    return {"ok": True}


@router.get("/collaboration/invites")
def list_invites(request: Request, db: Session = Depends(get_db)):
    user_id = current_user_id(request)
    rows = (
        db.query(models.WorldCollaborator)
        .filter(
            models.WorldCollaborator.user_id == user_id,
            models.WorldCollaborator.status == "pending",
        )
        .order_by(models.WorldCollaborator.created_at.desc())
        .all()
    )
    return {"items": [_row(db, row) for row in rows]}
