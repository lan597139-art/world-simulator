"""跨模块能力：全局通知中心与全局搜索。

这些接口只读取用户有权访问的数据：
- 私人世界/人物/事件只搜索自己的；
- 社区内容只搜索公开可见的；
- 通知只返回当前用户自己的。
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter()


def _iso(value):
    return value.isoformat() if value else None


@router.get("/api/notifications")
def global_notifications(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    rows = (
        db.query(models.CommunityNotification)
        .filter(models.CommunityNotification.user_id == user.id)
        .order_by(models.CommunityNotification.created_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for row in rows:
        page = "community-social"
        if row.type in {"system", "account", "spirit"}:
            page = "settings"
        if row.type == "world_collaboration":
            page = "world-management"
        items.append({
            "id": row.id,
            "type": row.type or "system",
            "title": row.title or "系统提醒",
            "body": row.body or "",
            "page": page,
            "read": bool(row.read_at),
            "created_at": _iso(row.created_at),
        })

    pending_friends = (
        db.query(models.CommunityFriendRequest)
        .filter(
            models.CommunityFriendRequest.addressee_id == user.id,
            models.CommunityFriendRequest.status == "pending",
        )
        .count()
    )
    unread_messages = (
        db.query(models.DirectMessage)
        .filter(
            models.DirectMessage.recipient_id == user.id,
            models.DirectMessage.read_at.is_(None),
        )
        .count()
    )
    pending_request = (
        db.query(models.CommunityFriendRequest)
        .filter(
            models.CommunityFriendRequest.addressee_id == user.id,
            models.CommunityFriendRequest.status == "pending",
        )
        .order_by(models.CommunityFriendRequest.created_at.desc())
        .first()
    )
    if pending_request:
        requester = db.query(models.AppUser).filter(models.AppUser.id == pending_request.requester_id).first()
        items.insert(0, {
            "id": f"friend:{pending_request.id}",
            "type": "friend_request",
            "title": f"{requester.display_name or requester.username if requester else '有人'} 请求加你为好友",
            "body": pending_request.message or "",
            "page": "community-social",
            "read": False,
            "created_at": _iso(pending_request.created_at),
        })
    if unread_messages > 0:
        items.insert(0, {
            "id": "messages:unread",
            "type": "message",
            "title": f"你有 {unread_messages} 条未读私信",
            "body": "打开社区社交查看会话",
            "page": "community-social",
            "read": False,
            "created_at": None,
        })
    community_unread = (
        db.query(models.CommunityNotification)
        .filter(
            models.CommunityNotification.user_id == user.id,
            models.CommunityNotification.read_at.is_(None),
        )
        .count()
    )
    total_unread = community_unread + pending_friends + unread_messages
    return {
        "items": items,
        "counts": {
            "unread": total_unread,
            "community": community_unread,
            "friend_requests": pending_friends,
            "messages": unread_messages,
        },
    }


@router.post("/api/notifications/read-all")
def read_all_notifications(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    now = datetime.utcnow()
    community = (
        db.query(models.CommunityNotification)
        .filter(
            models.CommunityNotification.user_id == user.id,
            models.CommunityNotification.read_at.is_(None),
        )
        .update({models.CommunityNotification.read_at: now}, synchronize_session=False)
    )
    messages = (
        db.query(models.DirectMessage)
        .filter(
            models.DirectMessage.recipient_id == user.id,
            models.DirectMessage.read_at.is_(None),
        )
        .update({models.DirectMessage.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "community": community, "messages": messages}


def _world_ids(db: Session, user_id: str):
    return [
        row[0]
        for row in db.query(models.World.id)
        .filter(models.World.owner_id == user_id, models.World.deleted_at.is_(None))
        .all()
    ]


@router.get("/api/search")
def global_search(
    request: Request,
    q: str = Query("", max_length=80),
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    user = current_user(request, db)
    term = (q or "").strip()
    if len(term) < 1:
        return {"query": term, "groups": []}
    like = f"%{term}%"
    groups = []

    worlds = (
        db.query(models.World)
        .filter(
            models.World.deleted_at.is_(None),
            or_(models.World.owner_id == user.id, models.World.is_official.is_(True)),
            or_(models.World.name.ilike(like), models.World.description.ilike(like)),
        )
        .order_by(models.World.updatedAt.desc())
        .limit(limit)
        .all()
    )
    if worlds:
        groups.append({"key": "worlds", "label": "世界", "items": [
            {"id": w.id, "title": w.name, "subtitle": (w.description or "")[:60], "page": "world-management", "kind": "world"}
            for w in worlds
        ]})

    owned_world_ids = _world_ids(db, user.id)
    if owned_world_ids:
        characters = (
            db.query(models.Character)
            .filter(
                models.Character.world_id.in_(owned_world_ids),
                models.Character.archived_at.is_(None),
                models.Character.name.ilike(like),
            )
            .limit(limit)
            .all()
        )
        if characters:
            groups.append({"key": "characters", "label": "人物", "items": [
                {"id": c.id, "title": c.name or "未命名人物", "subtitle": "人物档案", "page": "character-management", "kind": "character"}
                for c in characters
            ]})
        events = (
            db.query(models.Event)
            .filter(
                models.Event.world_id.in_(owned_world_ids),
                or_(models.Event.name.ilike(like), models.Event.description.ilike(like)),
            )
            .order_by(models.Event.updated_at.desc())
            .limit(limit)
            .all()
        )
        if events:
            groups.append({"key": "events", "label": "事件", "items": [
                {"id": e.id, "title": e.name or "未命名事件", "subtitle": f"{e.storyline or '事件'} · {e.scale or ''}", "page": "events", "kind": "event"}
                for e in events
            ]})

    works = (
        db.query(models.CreativeWork)
        .filter(
            models.CreativeWork.owner_user_id == user.id,
            or_(models.CreativeWork.title.ilike(like), models.CreativeWork.summary.ilike(like)),
        )
        .order_by(models.CreativeWork.updated_at.desc())
        .limit(limit)
        .all()
    )
    if works:
        groups.append({"key": "works", "label": "作品", "items": [
            {"id": w.id, "title": w.title, "subtitle": w.scene or "", "page": "works", "kind": "work"}
            for w in works
        ]})

    posts = (
        db.query(models.SocialPost)
        .filter(
            models.SocialPost.visibility == "public",
            models.SocialPost.body.ilike(like),
        )
        .order_by(models.SocialPost.created_at.desc())
        .limit(limit)
        .all()
    )
    if posts:
        groups.append({"key": "posts", "label": "动态", "items": [
            {"id": p.id, "title": (p.body or "动态")[:40], "subtitle": "社区动态", "page": "community", "kind": "post"}
            for p in posts
        ]})

    users = (
        db.query(models.AppUser)
        .filter(
            models.AppUser.is_active.is_(True),
            or_(
                models.AppUser.username.ilike(like),
                models.AppUser.display_name.ilike(like),
            ),
        )
        .limit(limit)
        .all()
    )
    if users:
        groups.append({"key": "users", "label": "用户", "items": [
            {"id": u.id, "title": u.display_name or u.username, "subtitle": f"@{u.username}", "page": "community-social", "kind": "user"}
            for u in users
        ]})

    topics = (
        db.query(models.CommunityTopic)
        .filter(
            models.CommunityTopic.status == "active",
            or_(models.CommunityTopic.title.ilike(like), models.CommunityTopic.body.ilike(like)),
        )
        .order_by(models.CommunityTopic.updated_at.desc())
        .limit(limit)
        .all()
    )
    if topics:
        groups.append({"key": "topics", "label": "讨论", "items": [
            {"id": t.id, "title": t.title, "subtitle": t.category or "", "page": "community-social", "kind": "topic"}
            for t in topics
        ]})

    return {"query": term, "groups": groups}
