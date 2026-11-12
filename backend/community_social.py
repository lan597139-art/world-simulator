"""内容社区社交：讨论、兴趣小组、关注、好友、动态与通知。

所有写操作要求登录；关注/好友请求尊重目标用户的隐私设置。
公开作品的读取仍由 community.py 负责；本模块只组合动态。
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db
from settings import DEFAULT_PRIVACY, _settings

router = APIRouter(tags=["community-social"])

TOPIC_CATEGORIES = {
    "discussion": "话题讨论",
    "experience": "经验交流",
    "help": "问题求助",
    "opinion": "观点交流",
}
GROUP_CATEGORIES = {
    "interest": "兴趣",
    "creation": "创作",
    "world": "世界",
    "learning": "学习",
    "life": "生活",
    "other": "其他",
}
GROUP_VISIBILITY = {"public", "private"}


def _iso(value):
    return value.isoformat() if value else None


def _clip(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _user(db: Session, user_id: str) -> models.AppUser:
    row = db.query(models.AppUser).filter(
        models.AppUser.id == user_id, models.AppUser.is_active.is_(True)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return row


def _me(request: Request, db: Session) -> models.AppUser:
    return current_user(request, db)


def _privacy(db: Session, user_id: str) -> dict:
    row = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
    values = dict(DEFAULT_PRIVACY)
    if row and isinstance(row.privacy, dict):
        values.update({key: row.privacy[key] for key in values if key in row.privacy})
    return values


def _user_card(db: Session, row: models.AppUser, viewer: models.AppUser | None = None) -> dict:
    is_following = False
    is_friend = False
    request_status = ""
    if viewer and viewer.id != row.id:
        is_following = db.query(models.CommunityFollow).filter(
            models.CommunityFollow.follower_id == viewer.id,
            models.CommunityFollow.followee_id == row.id,
        ).first() is not None
        is_friend = _friendship(db, viewer.id, row.id) is not None
        pending = db.query(models.CommunityFriendRequest).filter(
            models.CommunityFriendRequest.status == "pending",
            or_(
                (models.CommunityFriendRequest.requester_id == viewer.id)
                & (models.CommunityFriendRequest.addressee_id == row.id),
                (models.CommunityFriendRequest.requester_id == row.id)
                & (models.CommunityFriendRequest.addressee_id == viewer.id),
            ),
        ).first()
        if pending:
            request_status = "outgoing" if pending.requester_id == viewer.id else "incoming"
    return {
        "id": row.id,
        "username": row.username,
        "display_name": row.display_name or row.username,
        "avatar": row.avatar or "",
        "bio": row.bio or "",
        "is_owner": bool(row.is_owner),
        "is_following": is_following,
        "is_friend": is_friend,
        "friend_request": request_status,
        "follower_count": db.query(models.CommunityFollow).filter(
            models.CommunityFollow.followee_id == row.id
        ).count(),
        "following_count": db.query(models.CommunityFollow).filter(
            models.CommunityFollow.follower_id == row.id
        ).count(),
    }


def _friendship(db: Session, a: str, b: str) -> models.CommunityFriendship | None:
    x, y = sorted((a, b))
    return db.query(models.CommunityFriendship).filter(
        models.CommunityFriendship.user_a_id == x,
        models.CommunityFriendship.user_b_id == y,
    ).first()


def _friend_ids(db: Session, user_id: str) -> set[str]:
    rows = db.query(models.CommunityFriendship).filter(
        or_(
            models.CommunityFriendship.user_a_id == user_id,
            models.CommunityFriendship.user_b_id == user_id,
        )
    ).all()
    return {row.user_b_id if row.user_a_id == user_id else row.user_a_id for row in rows}


def _following_ids(db: Session, user_id: str) -> set[str]:
    rows = db.query(models.CommunityFollow).filter(
        models.CommunityFollow.follower_id == user_id
    ).all()
    return {row.followee_id for row in rows}


def _notify(
    db: Session, user_id: str, type_: str, actor_id: str,
    object_type: str, object_id: str, title: str, body: str = "",
) -> None:
    if not user_id or user_id == actor_id:
        return
    db.add(models.CommunityNotification(
        user_id=user_id, type=type_, actor_id=actor_id,
        object_type=object_type, object_id=object_id,
        title=_clip(title, 160), body=_clip(body, 500),
    ))


def _notification_row(db: Session, row: models.CommunityNotification) -> dict:
    actor = db.query(models.AppUser).filter(models.AppUser.id == row.actor_id).first() if row.actor_id else None
    return {
        "id": row.id,
        "type": row.type,
        "actor": _user_card(db, actor) if actor else None,
        "object_type": row.object_type or "",
        "object_id": row.object_id or "",
        "title": row.title or "",
        "body": row.body or "",
        "read": bool(row.read_at),
        "created_at": _iso(row.created_at),
    }


def _topic(db: Session, topic_id: str) -> models.CommunityTopic:
    row = db.query(models.CommunityTopic).filter(
        models.CommunityTopic.id == topic_id,
        models.CommunityTopic.status == "active",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="讨论不存在")
    return row


def _reply_row(db: Session, row: models.CommunityTopicReply) -> dict:
    author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
    return {
        "id": row.id,
        "body": row.body or "",
        "author": _user_card(db, author) if author else None,
        "created_at": _iso(row.created_at),
    }


def _topic_row(db: Session, row: models.CommunityTopic) -> dict:
    author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
    reply_count = db.query(models.CommunityTopicReply).filter(
        models.CommunityTopicReply.topic_id == row.id,
        models.CommunityTopicReply.status == "active",
    ).count()
    return {
        "id": row.id,
        "category": row.category,
        "category_label": TOPIC_CATEGORIES.get(row.category, row.category),
        "title": row.title,
        "body": row.body or "",
        "tags": row.tags if isinstance(row.tags, list) else [],
        "author": _user_card(db, author) if author else None,
        "reply_count": reply_count,
        "view_count": row.view_count or 0,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _group(db: Session, group_id: str) -> models.CommunityGroup:
    row = db.query(models.CommunityGroup).filter(
        models.CommunityGroup.id == group_id,
        models.CommunityGroup.status == "active",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="小组不存在")
    return row


def _member(db: Session, group_id: str, user_id: str, active_only: bool = True) -> models.CommunityGroupMember | None:
    query = db.query(models.CommunityGroupMember).filter(
        models.CommunityGroupMember.group_id == group_id,
        models.CommunityGroupMember.user_id == user_id,
    )
    if active_only:
        query = query.filter(models.CommunityGroupMember.status == "active")
    return query.first()


def _group_row(db: Session, row: models.CommunityGroup, viewer: models.AppUser) -> dict:
    owner = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
    member = _member(db, row.id, viewer.id, active_only=False)
    active_count = db.query(models.CommunityGroupMember).filter(
        models.CommunityGroupMember.group_id == row.id,
        models.CommunityGroupMember.status == "active",
    ).count()
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description or "",
        "category": row.category,
        "category_label": GROUP_CATEGORIES.get(row.category, row.category),
        "visibility": row.visibility,
        "owner": _user_card(db, owner) if owner else None,
        "member_count": active_count,
        "joined": bool(member and member.status == "active"),
        "membership_status": member.status if member else "",
        "is_owner": row.owner_user_id == viewer.id,
        "created_at": _iso(row.created_at),
    }


def _group_post(db: Session, post_id: str) -> models.CommunityGroupPost:
    row = db.query(models.CommunityGroupPost).filter(
        models.CommunityGroupPost.id == post_id,
        models.CommunityGroupPost.status == "active",
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="组内帖子不存在")
    return row


def _group_post_row(db: Session, row: models.CommunityGroupPost) -> dict:
    author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
    replies = db.query(models.CommunityGroupReply).filter(
        models.CommunityGroupReply.post_id == row.id,
        models.CommunityGroupReply.status == "active",
    ).count()
    return {
        "id": row.id,
        "group_id": row.group_id,
        "title": row.title,
        "body": row.body or "",
        "author": _user_card(db, author) if author else None,
        "reply_count": replies,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _require_group_access(db: Session, group: models.CommunityGroup, viewer: models.AppUser) -> None:
    if group.visibility == "public":
        return
    if group.owner_user_id == viewer.id or _member(db, group.id, viewer.id):
        return
    raise HTTPException(status_code=403, detail="私密小组仅成员可访问")


def _feed(db: Session, viewer: models.AppUser, scope: str, limit: int = 30) -> list[dict]:
    allowed_actors: set[str] | None = None
    if scope == "following":
        allowed_actors = _following_ids(db, viewer.id) | {viewer.id}
    elif scope == "friends":
        allowed_actors = _friend_ids(db, viewer.id) | {viewer.id}

    items: list[tuple[datetime, dict]] = []
    topics = db.query(models.CommunityTopic).filter(
        models.CommunityTopic.status == "active"
    ).order_by(models.CommunityTopic.created_at.desc()).limit(60).all()
    for row in topics:
        if allowed_actors is not None and row.owner_user_id not in allowed_actors:
            continue
        author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
        items.append((row.created_at or datetime.min, {
            "id": f"topic:{row.id}", "type": "topic", "title": row.title,
            "summary": _clip(row.body, 220), "category": row.category,
            "author": _user_card(db, author) if author else None,
            "created_at": _iso(row.created_at),
            "target": {"kind": "topic", "id": row.id},
        }))

    posts = db.query(models.CommunityGroupPost).filter(
        models.CommunityGroupPost.status == "active"
    ).order_by(models.CommunityGroupPost.created_at.desc()).limit(60).all()
    for row in posts:
        group = db.query(models.CommunityGroup).filter(models.CommunityGroup.id == row.group_id).first()
        if not group or group.status != "active":
            continue
        if group.visibility == "private" and not _member(db, group.id, viewer.id) and group.owner_user_id != viewer.id:
            continue
        if allowed_actors is not None and row.owner_user_id not in allowed_actors:
            continue
        author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
        items.append((row.created_at or datetime.min, {
            "id": f"group:{row.id}", "type": "group_post", "title": row.title,
            "summary": _clip(row.body, 220), "group": {"id": group.id, "name": group.name},
            "author": _user_card(db, author) if author else None,
            "created_at": _iso(row.created_at),
            "target": {"kind": "group_post", "id": row.id, "group_id": group.id},
        }))

    publications = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.status == "published"
    ).order_by(models.CommunityPublication.published_at.desc()).limit(60).all()
    for row in publications:
        if allowed_actors is not None and row.owner_user_id not in allowed_actors:
            continue
        author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
        items.append((row.published_at or datetime.min, {
            "id": f"work:{row.id}", "type": "publication", "title": row.title,
            "summary": _clip(row.summary, 220),
            "author": _user_card(db, author) if author else None,
            "created_at": _iso(row.published_at),
            "target": {"kind": "publication", "id": row.public_id},
        }))

    items.sort(key=lambda item: item[0], reverse=True)
    return [item for _, item in items[:max(1, min(limit, 100))]]


@router.get("/api/community/social/overview")
def social_overview(request: Request, scope: str = "following", db: Session = Depends(get_db)):
    viewer = _me(request, db)
    if scope not in {"following", "friends", "all"}:
        raise HTTPException(status_code=422, detail="scope 只能是 following/friends/all")
    unread = db.query(models.CommunityNotification).filter(
        models.CommunityNotification.user_id == viewer.id,
        models.CommunityNotification.read_at.is_(None),
    ).count()
    recent_notifications = db.query(models.CommunityNotification).filter(
        models.CommunityNotification.user_id == viewer.id
    ).order_by(models.CommunityNotification.created_at.desc()).limit(6).all()
    topics = db.query(models.CommunityTopic).filter(
        models.CommunityTopic.status == "active"
    ).order_by(models.CommunityTopic.created_at.desc()).limit(6).all()
    groups = db.query(models.CommunityGroup).filter(
        models.CommunityGroup.status == "active"
    ).order_by(models.CommunityGroup.created_at.desc()).limit(6).all()
    suggestions = db.query(models.AppUser).filter(
        models.AppUser.is_active.is_(True), models.AppUser.id != viewer.id
    ).order_by(models.AppUser.created_at.asc()).limit(6).all()
    return {
        "viewer": _user_card(db, viewer),
        "scope": scope,
        "feed": _feed(db, viewer, scope, 18),
        "topics": [_topic_row(db, row) for row in topics],
        "groups": [_group_row(db, row, viewer) for row in groups],
        "suggestions": [_user_card(db, row, viewer) for row in suggestions],
        "notifications": [_notification_row(db, row) for row in recent_notifications],
        "counts": {
            "following": len(_following_ids(db, viewer.id)),
            "followers": db.query(models.CommunityFollow).filter(
                models.CommunityFollow.followee_id == viewer.id
            ).count(),
            "friends": len(_friend_ids(db, viewer.id)),
            "unread_notifications": unread,
            "pending_friend_requests": db.query(models.CommunityFriendRequest).filter(
                models.CommunityFriendRequest.addressee_id == viewer.id,
                models.CommunityFriendRequest.status == "pending",
            ).count(),
        },
    }


@router.get("/api/community/social/users")
def search_users(request: Request, q: str = "", db: Session = Depends(get_db)):
    viewer = _me(request, db)
    query = db.query(models.AppUser).filter(models.AppUser.is_active.is_(True))
    text = q.strip()
    if text:
        like = f"%{text}%"
        query = query.filter(or_(
            models.AppUser.username.ilike(like),
            models.AppUser.display_name.ilike(like),
            models.AppUser.bio.ilike(like),
        ))
    rows = query.order_by(models.AppUser.created_at.asc()).limit(50).all()
    return [_user_card(db, row, viewer) for row in rows]


@router.get("/api/community/social/users/{user_id}")
def user_profile(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _user(db, user_id)
    topics = db.query(models.CommunityTopic).filter(
        models.CommunityTopic.owner_user_id == row.id,
        models.CommunityTopic.status == "active",
    ).order_by(models.CommunityTopic.created_at.desc()).limit(10).all()
    return {
        **_user_card(db, row, viewer),
        "is_self": row.id == viewer.id,
        "created_at": _iso(row.created_at),
        "recent_topics": [_topic_row(db, item) for item in topics],
    }


@router.get("/api/community/social/users/{user_id}/followers")
def followers(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    _user(db, user_id)
    rows = db.query(models.CommunityFollow).filter(
        models.CommunityFollow.followee_id == user_id
    ).order_by(models.CommunityFollow.created_at.desc()).limit(100).all()
    users = [db.query(models.AppUser).filter(models.AppUser.id == row.follower_id).first() for row in rows]
    return [_user_card(db, item, viewer) for item in users if item]


@router.get("/api/community/social/users/{user_id}/following")
def following(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    _user(db, user_id)
    rows = db.query(models.CommunityFollow).filter(
        models.CommunityFollow.follower_id == user_id
    ).order_by(models.CommunityFollow.created_at.desc()).limit(100).all()
    users = [db.query(models.AppUser).filter(models.AppUser.id == row.followee_id).first() for row in rows]
    return [_user_card(db, item, viewer) for item in users if item]


@router.post("/api/community/social/users/{user_id}/follow")
def follow(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    if target.id == viewer.id:
        raise HTTPException(status_code=422, detail="不能关注自己")
    if not _privacy(db, target.id).get("allow_follow", True):
        raise HTTPException(status_code=403, detail="对方未开放关注")
    existing = db.query(models.CommunityFollow).filter(
        models.CommunityFollow.follower_id == viewer.id,
        models.CommunityFollow.followee_id == target.id,
    ).first()
    if not existing:
        db.add(models.CommunityFollow(follower_id=viewer.id, followee_id=target.id))
        _notify(db, target.id, "follow", viewer.id, "user", viewer.id, f"{viewer.display_name or viewer.username} 关注了你")
        db.commit()
    return {"following": True, "follower_count": db.query(models.CommunityFollow).filter(
        models.CommunityFollow.followee_id == target.id
    ).count()}


@router.delete("/api/community/social/users/{user_id}/follow")
def unfollow(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    db.query(models.CommunityFollow).filter(
        models.CommunityFollow.follower_id == viewer.id,
        models.CommunityFollow.followee_id == target.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"following": False}


@router.get("/api/community/topics")
def list_topics(request: Request, category: str = "all", q: str = "", db: Session = Depends(get_db)):
    _me(request, db)
    query = db.query(models.CommunityTopic).filter(models.CommunityTopic.status == "active")
    if category != "all":
        if category not in TOPIC_CATEGORIES:
            raise HTTPException(status_code=422, detail="未知讨论分类")
        query = query.filter(models.CommunityTopic.category == category)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(
            models.CommunityTopic.title.ilike(like),
            models.CommunityTopic.body.ilike(like),
        ))
    rows = query.order_by(models.CommunityTopic.created_at.desc()).limit(100).all()
    return [_topic_row(db, row) for row in rows]


@router.post("/api/community/topics")
def create_topic(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    category = str(payload.get("category") or "discussion")
    if category not in TOPIC_CATEGORIES:
        raise HTTPException(status_code=422, detail="未知讨论分类")
    title = _clip(payload.get("title"), 120)
    body = _clip(payload.get("body"), 20000)
    if len(title) < 2:
        raise HTTPException(status_code=422, detail="标题至少 2 个字符")
    if len(body) < 2:
        raise HTTPException(status_code=422, detail="正文至少 2 个字符")
    tags = payload.get("tags") if isinstance(payload.get("tags"), list) else []
    row = models.CommunityTopic(
        owner_user_id=viewer.id, category=category, title=title, body=body,
        tags=[_clip(item, 24) for item in tags[:8] if _clip(item, 24)],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _topic_row(db, row)


@router.get("/api/community/topics/{topic_id}")
def topic_detail(topic_id: str, request: Request, db: Session = Depends(get_db)):
    _me(request, db)
    row = _topic(db, topic_id)
    row.view_count = (row.view_count or 0) + 1
    db.commit()
    replies = db.query(models.CommunityTopicReply).filter(
        models.CommunityTopicReply.topic_id == row.id,
        models.CommunityTopicReply.status == "active",
    ).order_by(models.CommunityTopicReply.created_at.asc()).limit(200).all()
    return {**_topic_row(db, row), "replies": [_reply_row(db, item) for item in replies]}


@router.delete("/api/community/topics/{topic_id}")
def delete_topic(topic_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _topic(db, topic_id)
    if row.owner_user_id != viewer.id and not viewer.is_owner:
        raise HTTPException(status_code=403, detail="只能删除自己的讨论")
    row.status = "deleted"
    db.commit()
    return {"status": "ok"}


@router.post("/api/community/topics/{topic_id}/replies")
def reply_topic(topic_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    topic = _topic(db, topic_id)
    body = _clip(payload.get("body"), 10000)
    if len(body) < 1:
        raise HTTPException(status_code=422, detail="回复不能为空")
    row = models.CommunityTopicReply(topic_id=topic.id, owner_user_id=viewer.id, body=body)
    db.add(row)
    _notify(db, topic.owner_user_id, "topic_reply", viewer.id, "topic", topic.id,
            f"{viewer.display_name or viewer.username} 回复了你的讨论", body)
    db.commit()
    db.refresh(row)
    return _reply_row(db, row)


@router.get("/api/community/groups")
def list_groups(request: Request, scope: str = "all", db: Session = Depends(get_db)):
    viewer = _me(request, db)
    if scope not in {"all", "joined", "owned"}:
        raise HTTPException(status_code=422, detail="scope 只能是 all/joined/owned")
    query = db.query(models.CommunityGroup).filter(models.CommunityGroup.status == "active")
    if scope == "joined":
        ids = [row.group_id for row in db.query(models.CommunityGroupMember).filter(
            models.CommunityGroupMember.user_id == viewer.id,
            models.CommunityGroupMember.status == "active",
        ).all()]
        query = query.filter(models.CommunityGroup.id.in_(ids)) if ids else query.filter(False)
    elif scope == "owned":
        query = query.filter(models.CommunityGroup.owner_user_id == viewer.id)
    rows = query.order_by(models.CommunityGroup.created_at.desc()).limit(100).all()
    visible = []
    for row in rows:
        if row.visibility == "private" and row.owner_user_id != viewer.id and not _member(db, row.id, viewer.id):
            continue
        visible.append(_group_row(db, row, viewer))
    return visible


@router.post("/api/community/groups")
def create_group(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    name = _clip(payload.get("name"), 80)
    description = _clip(payload.get("description"), 2000)
    category = str(payload.get("category") or "interest")
    visibility = str(payload.get("visibility") or "public")
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="小组名称至少 2 个字符")
    if category not in GROUP_CATEGORIES:
        raise HTTPException(status_code=422, detail="未知小组分类")
    if visibility not in GROUP_VISIBILITY:
        raise HTTPException(status_code=422, detail="小组可见性无效")
    row = models.CommunityGroup(
        owner_user_id=viewer.id, name=name, description=description,
        category=category, visibility=visibility,
    )
    db.add(row)
    db.flush()
    db.add(models.CommunityGroupMember(group_id=row.id, user_id=viewer.id, role="owner", status="active"))
    db.commit()
    db.refresh(row)
    return _group_row(db, row, viewer)


@router.get("/api/community/groups/{group_id}")
def group_detail(group_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _group(db, group_id)
    _require_group_access(db, row, viewer)
    members = db.query(models.CommunityGroupMember).filter(
        models.CommunityGroupMember.group_id == row.id,
        models.CommunityGroupMember.status == "active",
    ).limit(200).all()
    pending = []
    if row.owner_user_id == viewer.id:
        pending = db.query(models.CommunityGroupMember).filter(
            models.CommunityGroupMember.group_id == row.id,
            models.CommunityGroupMember.status == "pending",
        ).limit(200).all()
    posts = db.query(models.CommunityGroupPost).filter(
        models.CommunityGroupPost.group_id == row.id,
        models.CommunityGroupPost.status == "active",
    ).order_by(models.CommunityGroupPost.created_at.desc()).limit(50).all()
    return {
        **_group_row(db, row, viewer),
        "members": [
            {**_user_card(db, _user(db, item.user_id), viewer), "role": item.role}
            for item in members
        ],
        "pending_members": [
            {**_user_card(db, _user(db, item.user_id), viewer), "role": item.role}
            for item in pending
        ],
        "posts": [_group_post_row(db, item) for item in posts],
    }


@router.post("/api/community/groups/{group_id}/join")
def join_group(group_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    existing = _member(db, group.id, viewer.id, active_only=False)
    if existing:
        return {"status": existing.status, "joined": existing.status == "active"}
    status = "pending" if group.visibility == "private" else "active"
    db.add(models.CommunityGroupMember(
        group_id=group.id, user_id=viewer.id, role="member", status=status,
    ))
    _notify(db, group.owner_user_id, "group_join", viewer.id, "group", group.id,
            f"{viewer.display_name or viewer.username} 申请加入「{group.name}」")
    db.commit()
    return {"status": status, "joined": status == "active"}


@router.post("/api/community/groups/{group_id}/leave")
def leave_group(group_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    if group.owner_user_id == viewer.id:
        raise HTTPException(status_code=409, detail="组长不能退出小组")
    member = _member(db, group.id, viewer.id, active_only=False)
    if not member:
        return {"status": "not_member"}
    db.delete(member)
    db.commit()
    return {"status": "left"}


@router.post("/api/community/groups/{group_id}/members/{user_id}/approve")
def approve_group_member(group_id: str, user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    if group.owner_user_id != viewer.id:
        raise HTTPException(status_code=403, detail="只有组长可以审批成员")
    member = _member(db, group.id, user_id, active_only=False)
    if not member or member.status != "pending":
        raise HTTPException(status_code=404, detail="待审批成员不存在")
    member.status = "active"
    _notify(db, user_id, "group_approved", viewer.id, "group", group.id,
            f"你已加入「{group.name}」")
    db.commit()
    return {"status": "active"}


@router.get("/api/community/groups/{group_id}/posts")
def group_posts(group_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    _require_group_access(db, group, viewer)
    rows = db.query(models.CommunityGroupPost).filter(
        models.CommunityGroupPost.group_id == group.id,
        models.CommunityGroupPost.status == "active",
    ).order_by(models.CommunityGroupPost.created_at.desc()).limit(100).all()
    return [_group_post_row(db, row) for row in rows]


@router.post("/api/community/groups/{group_id}/posts")
def create_group_post(group_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    if not (group.owner_user_id == viewer.id or _member(db, group.id, viewer.id)):
        raise HTTPException(status_code=403, detail="加入小组后才能发帖")
    title = _clip(payload.get("title"), 120)
    body = _clip(payload.get("body"), 20000)
    if len(title) < 2 or len(body) < 2:
        raise HTTPException(status_code=422, detail="标题与正文至少 2 个字符")
    row = models.CommunityGroupPost(
        group_id=group.id, owner_user_id=viewer.id, title=title, body=body,
    )
    db.add(row)
    db.flush()
    members = db.query(models.CommunityGroupMember).filter(
        models.CommunityGroupMember.group_id == group.id,
        models.CommunityGroupMember.status == "active",
    ).limit(80).all()
    for item in members:
        _notify(db, item.user_id, "group_post", viewer.id, "group_post", row.id,
                f"「{group.name}」有新帖子：{title}")
    db.commit()
    db.refresh(row)
    return _group_post_row(db, row)


@router.post("/api/community/groups/{group_id}/posts/{post_id}/replies")
def reply_group_post(group_id: str, post_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    group = _group(db, group_id)
    if not (group.owner_user_id == viewer.id or _member(db, group.id, viewer.id)):
        raise HTTPException(status_code=403, detail="加入小组后才能回复")
    post = _group_post(db, post_id)
    if post.group_id != group.id:
        raise HTTPException(status_code=404, detail="组内帖子不存在")
    body = _clip(payload.get("body"), 10000)
    if not body:
        raise HTTPException(status_code=422, detail="回复不能为空")
    row = models.CommunityGroupReply(post_id=post.id, owner_user_id=viewer.id, body=body)
    db.add(row)
    _notify(db, post.owner_user_id, "group_reply", viewer.id, "group_post", post.id,
            f"{viewer.display_name or viewer.username} 回复了你的组内帖子", body)
    db.commit()
    db.refresh(row)
    author = db.query(models.AppUser).filter(models.AppUser.id == row.owner_user_id).first()
    return {
        "id": row.id, "body": row.body, "author": _user_card(db, author) if author else None,
        "created_at": _iso(row.created_at),
    }


@router.get("/api/community/social/friends")
def list_friends(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.CommunityFriendship).filter(
        or_(
            models.CommunityFriendship.user_a_id == viewer.id,
            models.CommunityFriendship.user_b_id == viewer.id,
        )
    ).order_by(models.CommunityFriendship.created_at.desc()).all()
    result = []
    for row in rows:
        other_id = row.user_b_id if row.user_a_id == viewer.id else row.user_a_id
        other = db.query(models.AppUser).filter(models.AppUser.id == other_id).first()
        if other:
            result.append({**_user_card(db, other, viewer), "friends_since": _iso(row.created_at)})
    return result


@router.get("/api/community/social/friend-requests")
def list_friend_requests(request: Request, direction: str = "incoming", db: Session = Depends(get_db)):
    viewer = _me(request, db)
    if direction not in {"incoming", "outgoing"}:
        raise HTTPException(status_code=422, detail="direction 只能是 incoming/outgoing")
    field = models.CommunityFriendRequest.addressee_id if direction == "incoming" else models.CommunityFriendRequest.requester_id
    rows = db.query(models.CommunityFriendRequest).filter(
        field == viewer.id,
        models.CommunityFriendRequest.status == "pending",
    ).order_by(models.CommunityFriendRequest.created_at.desc()).limit(100).all()
    result = []
    for row in rows:
        other_id = row.requester_id if direction == "incoming" else row.addressee_id
        other = db.query(models.AppUser).filter(models.AppUser.id == other_id).first()
        result.append({
            "id": row.id,
            "status": row.status,
            "message": row.message or "",
            "created_at": _iso(row.created_at),
            "user": _user_card(db, other, viewer) if other else None,
        })
    return result


@router.post("/api/community/social/friend-requests")
def create_friend_request(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, str(payload.get("user_id") or ""))
    if target.id == viewer.id:
        raise HTTPException(status_code=422, detail="不能添加自己为好友")
    if not _privacy(db, target.id).get("allow_friend_requests", True):
        raise HTTPException(status_code=403, detail="对方未开放好友申请")
    if _friendship(db, viewer.id, target.id):
        raise HTTPException(status_code=409, detail="你们已经是好友")
    pending = db.query(models.CommunityFriendRequest).filter(
        models.CommunityFriendRequest.status == "pending",
        or_(
            (models.CommunityFriendRequest.requester_id == viewer.id)
            & (models.CommunityFriendRequest.addressee_id == target.id),
            (models.CommunityFriendRequest.requester_id == target.id)
            & (models.CommunityFriendRequest.addressee_id == viewer.id),
        ),
    ).first()
    if pending:
        raise HTTPException(status_code=409, detail="已有待处理的好友申请")
    row = models.CommunityFriendRequest(
        requester_id=viewer.id, addressee_id=target.id, message=_clip(payload.get("message"), 200),
    )
    db.add(row)
    _notify(db, target.id, "friend_request", viewer.id, "friend_request", row.id,
            f"{viewer.display_name or viewer.username} 想添加你为好友")
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": row.status}


def _friend_request(db: Session, request_id: str, viewer_id: str, role: str) -> models.CommunityFriendRequest:
    field = models.CommunityFriendRequest.addressee_id if role == "addressee" else models.CommunityFriendRequest.requester_id
    row = db.query(models.CommunityFriendRequest).filter(
        models.CommunityFriendRequest.id == request_id,
        field == viewer_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="好友申请不存在")
    return row


@router.post("/api/community/social/friend-requests/{request_id}/accept")
def accept_friend_request(request_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _friend_request(db, request_id, viewer.id, "addressee")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="好友申请已处理")
    row.status = "accepted"
    row.responded_at = datetime.utcnow()
    a, b = sorted((row.requester_id, row.addressee_id))
    if not _friendship(db, a, b):
        db.add(models.CommunityFriendship(user_a_id=a, user_b_id=b))
    _notify(db, row.requester_id, "friend_accepted", viewer.id, "friend_request", row.id,
            f"{viewer.display_name or viewer.username} 接受了你的好友申请")
    db.commit()
    return {"status": "accepted"}


@router.post("/api/community/social/friend-requests/{request_id}/reject")
def reject_friend_request(request_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _friend_request(db, request_id, viewer.id, "addressee")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="好友申请已处理")
    row.status = "rejected"
    row.responded_at = datetime.utcnow()
    db.commit()
    return {"status": "rejected"}


@router.delete("/api/community/social/friend-requests/{request_id}")
def cancel_friend_request(request_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = _friend_request(db, request_id, viewer.id, "requester")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail="好友申请已处理")
    row.status = "cancelled"
    row.responded_at = datetime.utcnow()
    db.commit()
    return {"status": "cancelled"}


@router.delete("/api/community/social/friends/{user_id}")
def delete_friend(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    a, b = sorted((viewer.id, target.id))
    db.query(models.CommunityFriendship).filter(
        models.CommunityFriendship.user_a_id == a,
        models.CommunityFriendship.user_b_id == b,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "removed"}


@router.get("/api/community/social/feed")
def social_feed(request: Request, scope: str = "following", limit: int = 30, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    if scope not in {"following", "friends", "all"}:
        raise HTTPException(status_code=422, detail="scope 只能是 following/friends/all")
    return _feed(db, viewer, scope, limit)


@router.get("/api/community/social/notifications")
def list_notifications(request: Request, unread_only: bool = False, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    query = db.query(models.CommunityNotification).filter(
        models.CommunityNotification.user_id == viewer.id
    )
    if unread_only:
        query = query.filter(models.CommunityNotification.read_at.is_(None))
    rows = query.order_by(models.CommunityNotification.created_at.desc()).limit(100).all()
    return [_notification_row(db, row) for row in rows]


@router.post("/api/community/social/notifications/read")
def read_notifications(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    ids = payload.get("ids") if isinstance(payload.get("ids"), list) else []
    query = db.query(models.CommunityNotification).filter(
        models.CommunityNotification.user_id == viewer.id,
        models.CommunityNotification.read_at.is_(None),
    )
    if ids:
        query = query.filter(models.CommunityNotification.id.in_([str(item) for item in ids[:200]]))
    query.update({models.CommunityNotification.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return {"status": "ok"}


@router.get("/api/community/social/search")
def social_search(request: Request, q: str = "", db: Session = Depends(get_db)):
    viewer = _me(request, db)
    text = q.strip()
    if not text:
        return {"users": [], "topics": [], "groups": []}
    like = f"%{text}%"
    users = db.query(models.AppUser).filter(
        models.AppUser.is_active.is_(True),
        or_(
            models.AppUser.username.ilike(like),
            models.AppUser.display_name.ilike(like),
            models.AppUser.bio.ilike(like),
        ),
    ).limit(12).all()
    topics = db.query(models.CommunityTopic).filter(
        models.CommunityTopic.status == "active",
        or_(models.CommunityTopic.title.ilike(like), models.CommunityTopic.body.ilike(like)),
    ).limit(12).all()
    groups = db.query(models.CommunityGroup).filter(
        models.CommunityGroup.status == "active",
        models.CommunityGroup.visibility == "public",
        or_(models.CommunityGroup.name.ilike(like), models.CommunityGroup.description.ilike(like)),
    ).limit(12).all()
    return {
        "users": [_user_card(db, row, viewer) for row in users],
        "topics": [_topic_row(db, row) for row in topics],
        "groups": [_group_row(db, row, viewer) for row in groups],
    }
