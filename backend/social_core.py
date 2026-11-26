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
from user_analytics import user_analytics

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
        "stats": _profile_stats(db, target.id, viewer.id),
    }


def _profile_stats(db: Session, user_id: str, viewer_id: str) -> dict:
    """对外暴露的用户统计：本人始终可见完整数据，他人需用户开启 show_stats。

    未开启时只保留公开口径（作品、动态、粉丝、关注、好友与等级），
    隐藏「用户画像分析」数值，并标记 stats_hidden 供前端隐藏该区块。
    """
    stats = user_analytics(db, user_id)
    if user_id == viewer_id or _privacy(db, user_id).get("show_stats", False):
        return stats
    return {
        "works": stats["works"],
        "posts": stats["posts"],
        "followers": stats["followers"],
        "following": stats["following"],
        "friends": stats["friends"],
        "creator_level": stats["creator_level"],
        "follower_level": stats["follower_level"],
        "activity_level": stats["activity_level"],
        "stats_hidden": True,
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


# =====================================================================
# 登录活跃 · 签到 · 收藏夹 · 推荐 · 浏览历史
# =====================================================================
FAVORITE_TYPE_LABELS = {"work": "作品", "character": "角色", "world": "世界", "post": "动态"}
FAVORITE_TARGET_MODELS = {
    "work": models.CommunityPublication,
    "character": models.Character,
    "world": models.World,
    "post": models.SocialPost,
}
HISTORY_TARGET_MODELS = {
    "work": models.CommunityPublication,
    "character": models.Character,
    "world": models.World,
}


def _lookup_target(db: Session, model, target_id: str):
    """按 id 解析目标；作品支持 public_id 回退，避免前端传公开 id 时查不到。"""
    target = db.query(model).filter(model.id == target_id).first()
    if target is None and model is models.CommunityPublication:
        target = db.query(model).filter(models.CommunityPublication.public_id == target_id).first()
    return target


def _favorite_item(db: Session, row: models.UserFavorite) -> dict | None:
    model = FAVORITE_TARGET_MODELS.get(row.target_type)
    if model is None:
        return None
    target = _lookup_target(db, model, row.target_id)
    if not target:
        return None
    title = getattr(target, "title", "") or getattr(target, "name", "") or row.target_id
    return {
        "id": row.id,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "folder_id": row.folder_id or "",
        "title": str(title),
        "created_at": _iso(row.created_at),
    }


def _history_item(db: Session, row: models.ViewHistory) -> dict | None:
    model = HISTORY_TARGET_MODELS.get(row.target_type)
    if model is None:
        return None
    target = _lookup_target(db, model, row.target_id)
    if not target:
        return None
    title = getattr(target, "title", "") or getattr(target, "name", "") or row.target_id
    return {
        "id": row.id,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "title": str(title),
        "created_at": _iso(row.created_at),
    }


@router.post("/api/social/me/checkin")
def checkin(payload: dict, request: Request, db: Session = Depends(get_db)):
    """每日签到。以当天日期去重，返回连续签到天数与累计次数。"""
    viewer = _me(request, db)
    today = str(payload.get("date") or datetime.utcnow().date().isoformat())[:10]
    existing = db.query(models.UserCheckin).filter(
        models.UserCheckin.user_id == viewer.id,
        models.UserCheckin.checkin_date == today,
    ).first()
    if existing:
        return {
            "date": today, "streak": existing.streak,
            "checkin_count": db.query(func.count(models.UserCheckin.id)).filter(
                models.UserCheckin.user_id == viewer.id
            ).scalar() or 0,
            "already": True,
        }
    # 连续签到：从昨天向前数连续天数，遇到断档即终止。
    streak = 1
    cursor = datetime.strptime(today, "%Y-%m-%d").date()
    while True:
        cursor = cursor.fromordinal(cursor.toordinal() - 1)
        day = cursor.isoformat()
        hit = db.query(models.UserCheckin.id).filter(
            models.UserCheckin.user_id == viewer.id,
            models.UserCheckin.checkin_date == day,
        ).first()
        if not hit:
            break
        streak += 1
        if streak > 400:
            break
    row = models.UserCheckin(user_id=viewer.id, checkin_date=today, streak=streak)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "date": today, "streak": streak,
        "checkin_count": db.query(func.count(models.UserCheckin.id)).filter(
            models.UserCheckin.user_id == viewer.id
        ).scalar() or 0,
        "already": False,
    }


@router.get("/api/social/me/checkin")
def checkin_status(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.UserCheckin).filter(
        models.UserCheckin.user_id == viewer.id
    ).order_by(models.UserCheckin.checkin_date.desc()).all()
    today = datetime.utcnow().date().isoformat()
    last = rows[0].checkin_date if rows else ""
    return {
        "today": today,
        "checked_in_today": bool(rows) and last == today,
        "streak": rows[0].streak if rows and rows[0].checkin_date == today else 0,
        "checkin_count": len(rows),
        "dates": [row.checkin_date for row in rows[:30]],
    }


@router.get("/api/social/favorite-folders")
def list_folders(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.FavoriteFolder).filter(
        models.FavoriteFolder.user_id == viewer.id
    ).order_by(models.FavoriteFolder.sort_order, models.FavoriteFolder.created_at).all()
    return [{
        "id": row.id, "name": row.name,
        "sort_order": row.sort_order, "created_at": _iso(row.created_at),
    } for row in rows]


@router.post("/api/social/favorite-folders")
def create_folder(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    name = str(payload.get("name") or "").strip()[:40]
    if not name:
        raise HTTPException(status_code=422, detail="收藏夹名称不能为空")
    row = models.FavoriteFolder(user_id=viewer.id, name=name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "sort_order": row.sort_order, "created_at": _iso(row.created_at)}


@router.delete("/api/social/favorite-folders/{folder_id}")
def delete_folder(folder_id: str, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    row = db.query(models.FavoriteFolder).filter(
        models.FavoriteFolder.id == folder_id,
        models.FavoriteFolder.user_id == viewer.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="收藏夹不存在")
    db.query(models.UserFavorite).filter(models.UserFavorite.folder_id == folder_id).update(
        {"folder_id": None}, synchronize_session=False
    )
    db.delete(row)
    db.commit()
    return {"status": "ok"}


@router.get("/api/social/favorites")
def list_favorites(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == viewer.id
    ).order_by(models.UserFavorite.created_at.desc()).all()
    items = [item for item in (_favorite_item(db, row) for row in rows) if item]
    return {
        "items": items,
        "total": len(items),
        "folders": [
            {"id": row.id, "name": row.name, "sort_order": row.sort_order}
            for row in db.query(models.FavoriteFolder).filter(
                models.FavoriteFolder.user_id == viewer.id
            ).order_by(models.FavoriteFolder.sort_order).all()
        ],
    }


@router.post("/api/social/favorites")
def add_favorite(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target_type = str(payload.get("target_type") or "").strip()
    target_id = str(payload.get("target_id") or "").strip()
    if target_type not in FAVORITE_TARGET_MODELS or not target_id:
        raise HTTPException(status_code=422, detail="收藏目标类型或 id 无效")
    existing = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == viewer.id,
        models.UserFavorite.target_type == target_type,
        models.UserFavorite.target_id == target_id,
    ).first()
    if existing:
        return {"status": "already", "id": existing.id}
    folder_id = str(payload.get("folder_id") or "").strip() or None
    if folder_id:
        folder = db.query(models.FavoriteFolder).filter(
            models.FavoriteFolder.id == folder_id,
            models.FavoriteFolder.user_id == viewer.id,
        ).first()
        folder_id = folder.id if folder else None
    row = models.UserFavorite(
        user_id=viewer.id, target_type=target_type, target_id=target_id, folder_id=folder_id
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "ok", "id": row.id}


@router.delete("/api/social/favorites")
def remove_favorite(payload: dict, request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    target_type = str(payload.get("target_type") or "").strip()
    target_id = str(payload.get("target_id") or "").strip()
    if target_type not in FAVORITE_TARGET_MODELS or not target_id:
        raise HTTPException(status_code=422, detail="收藏目标类型或 id 无效")
    deleted = db.query(models.UserFavorite).filter(
        models.UserFavorite.user_id == viewer.id,
        models.UserFavorite.target_type == target_type,
        models.UserFavorite.target_id == target_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "ok", "deleted": deleted}


@router.post("/api/social/history")
def record_history(payload: dict, request: Request, db: Session = Depends(get_db)):
    """记录一次浏览。同一用户对同一目标重复查看时刷新时间。"""
    viewer = _me(request, db)
    target_type = str(payload.get("target_type") or "").strip()
    target_id = str(payload.get("target_id") or "").strip()
    if target_type not in HISTORY_TARGET_MODELS or not target_id:
        raise HTTPException(status_code=422, detail="浏览目标类型或 id 无效")
    existing = db.query(models.ViewHistory).filter(
        models.ViewHistory.user_id == viewer.id,
        models.ViewHistory.target_type == target_type,
        models.ViewHistory.target_id == target_id,
    ).first()
    if existing:
        db.delete(existing)
    row = models.ViewHistory(user_id=viewer.id, target_type=target_type, target_id=target_id)
    db.add(row)
    # 仅保留最近 200 条，避免历史无限增长。
    overflow = db.query(models.ViewHistory).filter(
        models.ViewHistory.user_id == viewer.id
    ).order_by(models.ViewHistory.created_at.desc()).offset(200).all()
    for stale in overflow:
        db.delete(stale)
    db.commit()
    return {"status": "ok"}


@router.get("/api/social/history")
def list_history(request: Request, db: Session = Depends(get_db)):
    viewer = _me(request, db)
    rows = db.query(models.ViewHistory).filter(
        models.ViewHistory.user_id == viewer.id
    ).order_by(models.ViewHistory.created_at.desc()).limit(100).all()
    items = [item for item in (_history_item(db, row) for row in rows) if item]
    return {"items": items, "total": len(items)}


@router.get("/api/social/recommendations")
def recommendations(request: Request, db: Session = Depends(get_db)):
    """推荐：按公开作品的点赞热度取前若干，排除本人作品，使用真实数据。"""
    viewer = _me(request, db)
    likes = dict(db.query(
        models.CommunityLike.publication_id, func.count(models.CommunityLike.id)
    ).group_by(models.CommunityLike.publication_id).all())
    works = db.query(models.CommunityPublication).filter(
        models.CommunityPublication.status == "published",
        models.CommunityPublication.public_visible.is_(True),
        models.CommunityPublication.owner_user_id != viewer.id,
    ).order_by(models.CommunityPublication.published_at.desc()).limit(40).all()
    items = [{
        "id": work.id, "public_id": work.public_id, "title": work.title,
        "summary": work.summary or "", "cover_url": work.cover or "",
        "work_type": work.work_type, "like_count": int(likes.get(work.id, 0)),
        "view_count": work.view_count or 0,
    } for work in works]
    items.sort(key=lambda item: (item["like_count"], item["view_count"]), reverse=True)
    return {"items": items[:20], "total": len(items[:20])}


# =====================================================================
# 一键四连：点赞 / 收藏 / 推荐 / 打赏（打赏不消耗灵果额度）
# =====================================================================
CHEER_KINDS = ("like", "favorite", "recommend", "tip")


def _resolve_target(db: Session, target_type: str, target_id: str):
    if target_type == "work":
        row = db.query(models.CommunityPublication).filter(
            models.CommunityPublication.id == target_id
        ).first()
        if row is None:
            row = db.query(models.CommunityPublication).filter(
                models.CommunityPublication.public_id == target_id
            ).first()
        return row
    if target_type == "storyline":
        # 兼容故事线（StoryProject）与写作章节（Story）两种真实记录。
        row = db.query(models.StoryProject).filter(models.StoryProject.id == target_id).first()
        if row is None:
            row = db.query(models.Story).filter(models.Story.id == target_id).first()
        return row
    model = {
        "character": models.Character,
        "world": models.World,
        "post": models.SocialPost,
    }.get(target_type)
    if model is None:
        return None
    return db.query(model).filter(model.id == target_id).first()


@router.post("/api/social/cheers/quad")
def quad_cheer(payload: dict, request: Request, db: Session = Depends(get_db)):
    """一键四连：对目标执行点赞 / 收藏 / 推荐 / 打赏。

    打赏为不消耗灵果额度的免费鼓励，不写入灵果流水；付费打赏仍走
    /api/spirit/gift。操作按目标类型与已有记录幂等。
    """
    viewer = _me(request, db)
    target_type = str(payload.get("target_type") or "").strip()
    target_id = str(payload.get("target_id") or "").strip()
    if target_type not in ("work", "character", "world", "post", "storyline") or not target_id:
        raise HTTPException(status_code=422, detail="目标类型或 id 无效")
    target = _resolve_target(db, target_type, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="目标内容不存在")

    result = {}
    # 作品类目标：点赞与收藏写入社区既有表，与公开作品统计口径一致。
    publication = target if target_type == "work" else None
    if publication is not None:
        like_exists = db.query(models.CommunityLike).filter(
            models.CommunityLike.publication_id == publication.id,
            models.CommunityLike.owner_user_id == viewer.id,
        ).first()
        if not like_exists:
            db.add(models.CommunityLike(publication_id=publication.id, owner_user_id=viewer.id))
        result["like"] = True
        fav_exists = db.query(models.CommunityFavorite).filter(
            models.CommunityFavorite.publication_id == publication.id,
            models.CommunityFavorite.owner_user_id == viewer.id,
        ).first()
        if not fav_exists:
            db.add(models.CommunityFavorite(publication_id=publication.id, owner_user_id=viewer.id))
        # 同步写入个人收藏，使个人中心收藏面板能看到一键四连的收藏。
        personal_fav = db.query(models.UserFavorite).filter(
            models.UserFavorite.user_id == viewer.id,
            models.UserFavorite.target_type == "work",
            models.UserFavorite.target_id == target_id,
        ).first()
        if not personal_fav:
            db.add(models.UserFavorite(user_id=viewer.id, target_type="work", target_id=target_id))
        result["favorite"] = True

    # 推荐与免费打赏：统一记录到 UserCheer，重复操作幂等。
    for kind in ("recommend", "tip"):
        exists = db.query(models.UserCheer).filter(
            models.UserCheer.user_id == viewer.id,
            models.UserCheer.target_type == target_type,
            models.UserCheer.target_id == target_id,
            models.UserCheer.kind == kind,
        ).first()
        if not exists:
            db.add(models.UserCheer(
                user_id=viewer.id, target_type=target_type, target_id=target_id, kind=kind,
            ))
        result[kind] = True
    if publication is not None:
        # 点赞 / 收藏同样登记到 UserCheer，便于个人中心统一展示。
        for kind in ("like", "favorite"):
            exists = db.query(models.UserCheer).filter(
                models.UserCheer.user_id == viewer.id,
                models.UserCheer.target_type == target_type,
                models.UserCheer.target_id == target_id,
                models.UserCheer.kind == kind,
            ).first()
            if not exists:
                db.add(models.UserCheer(
                    user_id=viewer.id, target_type=target_type, target_id=target_id, kind=kind,
                ))
    db.commit()
    return {"status": "ok", "actions": result}


@router.get("/api/social/cheers/status")
def cheer_status(request: Request, db: Session = Depends(get_db), target_type: str = "", target_id: str = ""):
    viewer = _me(request, db)
    if target_type not in ("work", "character", "world", "post", "storyline") or not target_id:
        return {"actions": {}}
    rows = db.query(models.UserCheer).filter(
        models.UserCheer.user_id == viewer.id,
        models.UserCheer.target_type == target_type,
        models.UserCheer.target_id == target_id,
    ).all()
    actions = {row.kind: True for row in rows}
    if target_type == "work":
        public = _resolve_target(db, target_type, target_id)
        if public is not None:
            actions["like"] = db.query(models.CommunityLike).filter(
                models.CommunityLike.publication_id == public.id,
                models.CommunityLike.owner_user_id == viewer.id,
            ).first() is not None
            actions["favorite"] = db.query(models.CommunityFavorite).filter(
                models.CommunityFavorite.publication_id == public.id,
                models.CommunityFavorite.owner_user_id == viewer.id,
            ).first() is not None
    return {"actions": actions}
