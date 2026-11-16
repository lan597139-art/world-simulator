"""E 社区核心：个人动态、个人主页、好友私信、拉黑与互动。

保留现有社区小组/讨论/关注能力；本模块把「个人动态」与「社交关系」连通，
并让好友关系成为私信、主页访问和拉黑的前置条件。
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

import models
from auth import current_user
from database import get_db

router = APIRouter(tags=["social-core"])

CHANNELS = {"content", "social"}
VISIBILITIES = {"public", "friends", "private"}
POST_LIMIT = 2000
MESSAGE_LIMIT = 2000


def _now() -> datetime:
    return datetime.utcnow()


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _me(request: Request, db: Session) -> models.AppUser:
    return current_user(request, db)


def _user(db: Session, user_id: str) -> models.AppUser:
    row = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
    if not row or not row.is_active:
        raise HTTPException(status_code=404, detail="用户不存在")
    return row


def _friendship(db: Session, a: str, b: str) -> bool:
    x, y = sorted((a, b))
    return db.query(models.CommunityFriendship).filter(
        models.CommunityFriendship.user_a_id == x,
        models.CommunityFriendship.user_b_id == y,
    ).first() is not None


def blocked_between(db: Session, a: str, b: str) -> bool:
    return db.query(models.SocialBlock).filter(
        or_(
            (models.SocialBlock.blocker_id == a) & (models.SocialBlock.blocked_id == b),
            (models.SocialBlock.blocker_id == b) & (models.SocialBlock.blocked_id == a),
        )
    ).first() is not None


def _blocked_by_me(db: Session, viewer_id: str, target_id: str) -> bool:
    return db.query(models.SocialBlock).filter(
        models.SocialBlock.blocker_id == viewer_id,
        models.SocialBlock.blocked_id == target_id,
    ).first() is not None


def _privacy(db: Session, user_id: str) -> dict:
    row = db.query(models.UserSettings).filter(models.UserSettings.user_id == user_id).first()
    return dict(row.privacy or {}) if row else {}


def _user_card(row: models.AppUser) -> dict:
    return {
        "id": row.id,
        "username": row.username,
        "display_name": row.display_name or row.username,
        "bio": row.bio or "",
        "avatar": row.avatar_url or row.avatar or "",
        "is_owner": bool(row.is_owner),
    }


def _friend_status(db: Session, viewer_id: str, target_id: str) -> str:
    if viewer_id == target_id:
        return "self"
    if _friendship(db, viewer_id, target_id):
        return "friends"
    pending = db.query(models.CommunityFriendRequest).filter(
        models.CommunityFriendRequest.status == "pending",
        or_(
            (models.CommunityFriendRequest.requester_id == viewer_id)
            & (models.CommunityFriendRequest.addressee_id == target_id),
            (models.CommunityFriendRequest.requester_id == target_id)
            & (models.CommunityFriendRequest.addressee_id == viewer_id),
        ),
    ).first()
    if pending:
        return "outgoing" if pending.requester_id == viewer_id else "incoming"
    return "none"


def _following(db: Session, viewer_id: str, target_id: str) -> bool:
    return db.query(models.CommunityFollow).filter(
        models.CommunityFollow.follower_id == viewer_id,
        models.CommunityFollow.followee_id == target_id,
    ).first() is not None


def _post_json(db: Session, row: models.SocialPost, viewer_id: str) -> dict:
    author = db.query(models.AppUser).filter(models.AppUser.id == row.author_id).first()
    likes = db.query(func.count(models.SocialPostLike.id)).filter(models.SocialPostLike.post_id == row.id).scalar() or 0
    comments = db.query(func.count(models.SocialPostComment.id)).filter(models.SocialPostComment.post_id == row.id).scalar() or 0
    liked = db.query(models.SocialPostLike).filter(
        models.SocialPostLike.post_id == row.id,
        models.SocialPostLike.user_id == viewer_id,
    ).first() is not None
    return {
        "id": row.id,
        "author": _user_card(author) if author else None,
        "body": row.body or "",
        "media_urls": row.media_urls or [],
        "channels": row.channels or [],
        "visibility": row.visibility or "public",
        "work_id": row.work_id,
        "world_id": row.world_id,
        "character_id": row.character_id,
        "story_id": row.story_id,
        "like_count": likes,
        "comment_count": comments,
        "liked_by_me": liked,
        "is_mine": row.author_id == viewer_id,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _can_view_post(db: Session, row: models.SocialPost, viewer: models.AppUser) -> bool:
    if row.author_id == viewer.id:
        return True
    if blocked_between(db, viewer.id, row.author_id):
        return False
    if row.visibility == "private":
        return False
    if row.visibility == "friends":
        return _friendship(db, viewer.id, row.author_id)
    return True


def _normalize_channels(value) -> list[str]:
    if not isinstance(value, list):
        raise HTTPException(status_code=422, detail="动态投放位置必须是数组")
    channels = []
    for item in value:
        channel = str(item or "").strip()
        if channel not in CHANNELS:
            raise HTTPException(status_code=422, detail="动态只能投放到内容社区或社交社区")
        if channel not in channels:
            channels.append(channel)
    if not channels:
        raise HTTPException(status_code=422, detail="至少选择一个社区")
    return channels


def _normalize_media(value) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HTTPException(status_code=422, detail="媒体格式错误")
    urls = [str(item or "").strip()[:1000] for item in value if str(item or "").strip()]
    if len(urls) > 9:
        raise HTTPException(status_code=422, detail="一条动态最多 9 张图片")
    return urls


@router.get("/api/social/posts")
def list_posts(
    request: Request,
    channel: str = "all",
    scope: str = "discover",
    limit: int = 40,
    author_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    viewer = _me(request, db)
    if channel not in {"all", "content", "social"}:
        raise HTTPException(status_code=422, detail="频道非法")
    if scope not in {"discover", "following", "mine"}:
        raise HTTPException(status_code=422, detail="范围非法")
    query = db.query(models.SocialPost)
    if scope == "mine":
        query = query.filter(models.SocialPost.author_id == viewer.id)
    elif scope == "following":
        follows = db.query(models.CommunityFollow.followee_id).filter(models.CommunityFollow.follower_id == viewer.id).all()
        ids = [row[0] for row in follows] + [viewer.id]
        query = query.filter(models.SocialPost.author_id.in_(ids))
    if author_id:
        query = query.filter(models.SocialPost.author_id == author_id)
    rows = query.order_by(models.SocialPost.created_at.desc()).limit(max(1, min(limit, 100))).all()
    result = []
    for row in rows:
        if channel != "all" and channel not in (row.channels or []):
            continue
        if not _can_view_post(db, row, viewer):
            continue
        result.append(_post_json(db, row, viewer.id))
    return result


@router.post("/api/social/posts")
def create_post(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    body = str(payload.get("body") or "").strip()
    media = _normalize_media(payload.get("media_urls"))
    if not body and not media:
        raise HTTPException(status_code=422, detail="动态需要文字或图片")
    if len(body) > POST_LIMIT:
        raise HTTPException(status_code=422, detail="动态文字过长")
    channels = _normalize_channels(payload.get("channels") or ["content"])
    visibility = str(payload.get("visibility") or "public")
    if visibility not in VISIBILITIES:
        raise HTTPException(status_code=422, detail="可见范围非法")
    row = models.SocialPost(
        author_id=viewer.id,
        body=body,
        media_urls=media,
        channels=channels,
        visibility=visibility,
        work_id=str(payload.get("work_id") or "")[:160] or None,
        world_id=str(payload.get("world_id") or "")[:160] or None,
        character_id=str(payload.get("character_id") or "")[:160] or None,
        story_id=str(payload.get("story_id") or "")[:160] or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _post_json(db, row, viewer.id)


@router.patch("/api/social/posts/{post_id}")
def update_post(post_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="动态不存在")
    if row.author_id != viewer.id:
        raise HTTPException(status_code=403, detail="无权编辑这条动态")
    if "body" in payload:
        row.body = str(payload.get("body") or "").strip()[:POST_LIMIT]
    if "media_urls" in payload:
        row.media_urls = _normalize_media(payload.get("media_urls"))
    if "channels" in payload:
        row.channels = _normalize_channels(payload.get("channels"))
    if "visibility" in payload:
        visibility = str(payload.get("visibility") or "public")
        if visibility not in VISIBILITIES:
            raise HTTPException(status_code=422, detail="可见范围非法")
        row.visibility = visibility
    if not (row.body or "").strip() and not (row.media_urls or []):
        raise HTTPException(status_code=422, detail="动态需要文字或图片")
    row.updated_at = _now()
    db.commit()
    return _post_json(db, row, viewer.id)


@router.delete("/api/social/posts/{post_id}")
def delete_post(post_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="动态不存在")
    if row.author_id != viewer.id:
        raise HTTPException(status_code=403, detail="无权删除这条动态")
    db.query(models.SocialPostLike).filter(models.SocialPostLike.post_id == row.id).delete(synchronize_session=False)
    db.query(models.SocialPostComment).filter(models.SocialPostComment.post_id == row.id).delete(synchronize_session=False)
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.post("/api/social/posts/{post_id}/like")
def like_post(post_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row or not _can_view_post(db, row, viewer):
        raise HTTPException(status_code=404, detail="动态不存在")
    exists = db.query(models.SocialPostLike).filter(
        models.SocialPostLike.post_id == row.id,
        models.SocialPostLike.user_id == viewer.id,
    ).first()
    if not exists:
        db.add(models.SocialPostLike(post_id=row.id, user_id=viewer.id))
        db.commit()
    return _post_json(db, row, viewer.id)


@router.delete("/api/social/posts/{post_id}/like")
def unlike_post(post_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="动态不存在")
    db.query(models.SocialPostLike).filter(
        models.SocialPostLike.post_id == row.id,
        models.SocialPostLike.user_id == viewer.id,
    ).delete(synchronize_session=False)
    db.commit()
    return _post_json(db, row, viewer.id)


@router.get("/api/social/posts/{post_id}/comments")
def list_comments(post_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row or not _can_view_post(db, row, viewer):
        raise HTTPException(status_code=404, detail="动态不存在")
    rows = db.query(models.SocialPostComment).filter(
        models.SocialPostComment.post_id == row.id
    ).order_by(models.SocialPostComment.created_at.asc()).limit(200).all()
    result = []
    for comment in rows:
        author = db.query(models.AppUser).filter(models.AppUser.id == comment.author_id).first()
        result.append({
            "id": comment.id,
            "post_id": comment.post_id,
            "parent_id": comment.parent_id,
            "body": comment.body,
            "author": _user_card(author) if author else None,
            "created_at": _iso(comment.created_at),
        })
    return result


@router.post("/api/social/posts/{post_id}/comments")
def create_comment(post_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPost).filter(models.SocialPost.id == post_id).first()
    if not row or not _can_view_post(db, row, viewer):
        raise HTTPException(status_code=404, detail="动态不存在")
    if blocked_between(db, viewer.id, row.author_id):
        raise HTTPException(status_code=403, detail="你们之间已拉黑，无法评论")
    body = str(payload.get("body") or "").strip()[:1000]
    if not body:
        raise HTTPException(status_code=422, detail="评论不能为空")
    parent_id = str(payload.get("parent_id") or "").strip() or None
    if parent_id:
        parent = db.query(models.SocialPostComment).filter(
            models.SocialPostComment.id == parent_id,
            models.SocialPostComment.post_id == row.id,
        ).first()
        if not parent:
            raise HTTPException(status_code=422, detail="回复目标不存在")
    comment = models.SocialPostComment(post_id=row.id, author_id=viewer.id, parent_id=parent_id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id, "post_id": comment.post_id, "parent_id": comment.parent_id,
        "body": comment.body, "author": _user_card(viewer), "created_at": _iso(comment.created_at),
    }


@router.delete("/api/social/comments/{comment_id}")
def delete_comment(comment_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.SocialPostComment).filter(models.SocialPostComment.id == comment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="评论不存在")
    post = db.query(models.SocialPost).filter(models.SocialPost.id == row.post_id).first()
    if row.author_id != viewer.id and (not post or post.author_id != viewer.id):
        raise HTTPException(status_code=403, detail="无权删除这条评论")
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/social/users/{user_id}/profile")
def user_profile(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    privacy = _privacy(db, target.id)
    status = _friend_status(db, viewer.id, target.id)
    is_friend = status == "friends"
    can_view = viewer.id == target.id or is_friend or bool(privacy.get("public_profile", True))
    posts = []
    if can_view:
        rows = db.query(models.SocialPost).filter(
            models.SocialPost.author_id == target.id
        ).order_by(models.SocialPost.created_at.desc()).limit(20).all()
        posts = [_post_json(db, row, viewer.id) for row in rows if _can_view_post(db, row, viewer)]
    works = []
    if can_view:
        for work in db.query(models.CommunityPublication).filter(
            models.CommunityPublication.owner_user_id == target.id,
            models.CommunityPublication.status == "published",
        ).order_by(models.CommunityPublication.published_at.desc()).limit(12).all():
            works.append({
                "id": work.id, "title": work.title, "scene": work.work_type,
                "category": work.work_type, "cover_url": work.cover or "",
                "status": work.status,
            })
    pending = db.query(models.CommunityFriendRequest).filter(
        models.CommunityFriendRequest.status == "pending",
        or_(
            (models.CommunityFriendRequest.requester_id == viewer.id)
            & (models.CommunityFriendRequest.addressee_id == target.id),
            (models.CommunityFriendRequest.requester_id == target.id)
            & (models.CommunityFriendRequest.addressee_id == viewer.id),
        ),
    ).first()
    return {
        "user": _user_card(target),
        "friend_status": status,
        "friend_request_id": pending.id if pending else None,
        "friend_request_direction": ("outgoing" if pending.requester_id == viewer.id else "incoming") if pending else None,
        "following": _following(db, viewer.id, target.id),
        "blocked_by_me": _blocked_by_me(db, viewer.id, target.id),
        "is_blocked": blocked_between(db, viewer.id, target.id),
        "can_view": can_view,
        "allow_friend_requests": bool(privacy.get("allow_friend_requests", True)),
        "allow_follow": bool(privacy.get("allow_follow", True)),
        "posts": posts,
        "works": works,
        "stats": {
            "posts": db.query(func.count(models.SocialPost.id)).filter(models.SocialPost.author_id == target.id).scalar() or 0,
            "friends": db.query(func.count(models.CommunityFriendship.id)).filter(
                or_(
                    models.CommunityFriendship.user_a_id == target.id,
                    models.CommunityFriendship.user_b_id == target.id,
                )
            ).scalar() or 0,
            "works": db.query(func.count(models.CommunityPublication.id)).filter(
                models.CommunityPublication.owner_user_id == target.id,
                models.CommunityPublication.status == "published",
            ).scalar() or 0,
        },
    }


@router.get("/api/social/blocks")
def list_blocks(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.SocialBlock).filter(models.SocialBlock.blocker_id == viewer.id).order_by(models.SocialBlock.created_at.desc()).all()
    result = []
    for row in rows:
        target = db.query(models.AppUser).filter(models.AppUser.id == row.blocked_id).first()
        if target:
            result.append({"user": _user_card(target), "blocked_at": _iso(row.created_at)})
    return result


@router.post("/api/social/users/{user_id}/block")
def block_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    if target.id == viewer.id:
        raise HTTPException(status_code=422, detail="不能拉黑自己")
    exists = db.query(models.SocialBlock).filter(
        models.SocialBlock.blocker_id == viewer.id,
        models.SocialBlock.blocked_id == target.id,
    ).first()
    if not exists:
        db.add(models.SocialBlock(blocker_id=viewer.id, blocked_id=target.id))
        db.commit()
    return {"status": "blocked"}


@router.delete("/api/social/users/{user_id}/block")
def unblock_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    _user(db, user_id)
    db.query(models.SocialBlock).filter(
        models.SocialBlock.blocker_id == viewer.id,
        models.SocialBlock.blocked_id == user_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "unblocked"}


@router.get("/api/social/messages/conversations")
def message_conversations(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.DirectMessage).filter(
        or_(models.DirectMessage.sender_id == viewer.id, models.DirectMessage.recipient_id == viewer.id)
    ).order_by(models.DirectMessage.created_at.desc()).all()
    seen: dict[str, dict] = {}
    for row in rows:
        peer_id = row.recipient_id if row.sender_id == viewer.id else row.sender_id
        if peer_id in seen:
            continue
        peer = db.query(models.AppUser).filter(models.AppUser.id == peer_id).first()
        unread = db.query(func.count(models.DirectMessage.id)).filter(
            models.DirectMessage.sender_id == peer_id,
            models.DirectMessage.recipient_id == viewer.id,
            models.DirectMessage.read_at.is_(None),
        ).scalar() or 0
        seen[peer_id] = {
            "user": _user_card(peer) if peer else {"id": peer_id, "display_name": peer_id, "username": peer_id},
            "last_message": row.body or ("[图片]" if row.image_url else ""),
            "last_at": _iso(row.created_at),
            "unread": unread,
            "friend": _friendship(db, viewer.id, peer_id),
            "blocked": blocked_between(db, viewer.id, peer_id),
        }
    return list(seen.values())


@router.get("/api/social/messages/unread")
def unread_messages(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    count = db.query(func.count(models.DirectMessage.id)).filter(
        models.DirectMessage.recipient_id == viewer.id,
        models.DirectMessage.read_at.is_(None),
    ).scalar() or 0
    return {"count": count}


@router.get("/api/social/messages/{user_id}")
def message_history(user_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    if blocked_between(db, viewer.id, target.id):
        raise HTTPException(status_code=403, detail="你们之间已拉黑，无法私信")
    if not _friendship(db, viewer.id, target.id):
        raise HTTPException(status_code=403, detail="只有好友之间可以私信")
    rows = db.query(models.DirectMessage).filter(
        or_(
            (models.DirectMessage.sender_id == viewer.id) & (models.DirectMessage.recipient_id == target.id),
            (models.DirectMessage.sender_id == target.id) & (models.DirectMessage.recipient_id == viewer.id),
        )
    ).order_by(models.DirectMessage.created_at.asc()).limit(300).all()
    now = _now()
    changed = False
    for row in rows:
        if row.recipient_id == viewer.id and row.read_at is None:
            row.read_at = now
            changed = True
    if changed:
        db.commit()
    return [
        {
            "id": row.id,
            "sender_id": row.sender_id,
            "recipient_id": row.recipient_id,
            "body": row.body or "",
            "image_url": row.image_url or "",
            "read_at": _iso(row.read_at),
            "created_at": _iso(row.created_at),
            "is_mine": row.sender_id == viewer.id,
        }
        for row in rows
    ]


@router.post("/api/social/messages/{user_id}")
def send_message(user_id: str, payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target = _user(db, user_id)
    if target.id == viewer.id:
        raise HTTPException(status_code=422, detail="不能给自己发私信")
    if blocked_between(db, viewer.id, target.id):
        raise HTTPException(status_code=403, detail="你们之间已拉黑，无法私信")
    if not _friendship(db, viewer.id, target.id):
        raise HTTPException(status_code=403, detail="只有好友之间可以私信")
    body = str(payload.get("body") or "").strip()[:MESSAGE_LIMIT]
    image_url = str(payload.get("image_url") or "").strip()[:1000]
    if not body and not image_url:
        raise HTTPException(status_code=422, detail="消息需要文字或图片")
    row = models.DirectMessage(sender_id=viewer.id, recipient_id=target.id, body=body, image_url=image_url or None)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id, "sender_id": row.sender_id, "recipient_id": row.recipient_id,
        "body": row.body, "image_url": row.image_url or "", "read_at": _iso(row.read_at),
        "created_at": _iso(row.created_at), "is_mine": True,
    }
