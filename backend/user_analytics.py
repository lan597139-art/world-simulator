"""用户创作等级、粉丝等级、活跃等级与作品数据统计。

等级按以下口径计算，阈值集中在此模块，便于后续调整：
- 创作等级：作品数 * 10 + 阅读量。
- 粉丝等级：粉丝数。
- 活跃等级：参与痕迹合计（动态、评论、点赞、收藏、关注、阅读等）。
用户画像分析基于以下口径：
- 作品数：已发布作品数量（草稿单独统计）。
- 阅读量：已发布作品的阅读量（view_count）合计。
- 点击量：已发布作品的点击量（click_count）合计。
- 互动量：点赞 / 收藏 / 评论数量，均按用户已发布作品汇总。

等级阈值当前为通用分档，属可调整的展示口径，不涉及创作者收益规则。
"""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from models import (
    AppUser,
    AuthSession,
    CommunityComment,
    CommunityFavorite,
    CommunityFollow,
    CommunityFriendship,
    CommunityLike,
    CommunityPublication,
    SocialPost,
    SpiritTransaction,
    UserCheckin,
)

# 创作等级：创作积分 = 作品数 * 10 + 阅读量。
CREATOR_LEVELS = [
    (1, '初心', 0),
    (2, '萌芽', 100),
    (3, '生长', 500),
    (4, '绽放', 2000),
    (5, '繁盛', 8000),
]

# 粉丝等级：按粉丝数分档。
FOLLOWER_LEVELS = [
    (1, '路人', 0),
    (2, '新秀', 20),
    (3, '达人', 100),
    (4, '名角', 500),
    (5, '顶流', 2000),
]

# 打赏等级：按累计打赏 / 被打赏灵果分档。属于展示口径的等级，不涉及定价或收益规则。
TIP_LEVELS = [
    (1, '新客', 0),
    (2, '暖心', 200),
    (3, '慷慨', 600),
    (4, '热忱', 1500),
    (5, '慈善', 4000),
]

# 活跃等级：按参与痕迹合计分档。
# 参与痕迹来自真实记录：动态、评论、点赞、收藏、关注、粉丝、好友、阅读量，
# 以及登录天数与签到次数（两者均有后端记录）。
ACTIVITY_LEVELS = [
    (1, '初心', 0),
    (2, '活跃', 50),
    (3, '达人', 200),
    (4, '资深', 600),
    (5, '传奇', 1500),
]

# 活跃参与痕迹权重：均为已发生的参与行为，不涉及任何定价或收益规则。
ACTIVITY_WEIGHTS = {
    'posts': 10,        # 动态
    'comments': 5,      # 评论
    'likes': 3,         # 点赞
    'favorites': 3,     # 收藏
    'following': 2,     # 主动关注
    'followers': 2,     # 被关注
    'friends': 2,       # 好友
    'reads': 1,         # 阅读量
    'logins': 2,        # 登录天数
    'checkins': 4,      # 签到次数
}


def _tier(score: int, levels) -> dict:
    level, label, threshold = levels[0]
    next_threshold = None
    for candidate, candidate_label, candidate_threshold in levels:
        if score >= candidate_threshold:
            level, label, threshold = candidate, candidate_label, candidate_threshold
        elif candidate_threshold > score and next_threshold is None:
            next_threshold = candidate_threshold
    if next_threshold is None:
        progress = 1.0
    else:
        span = next_threshold - threshold
        progress = 0.0 if span <= 0 else min(1.0, max(0.0, (score - threshold) / span))
    return {
        'level': level,
        'label': label,
        'score': score,
        'next_threshold': next_threshold,
        'progress': round(progress, 4),
    }


def creator_level_info(works: int, reads: int) -> dict:
    return _tier(works * 10 + reads, CREATOR_LEVELS)


def follower_level_info(followers: int) -> dict:
    return _tier(followers, FOLLOWER_LEVELS)


def activity_level_info(**activity: int) -> dict:
    score = sum(int(value or 0) * weight for key, weight in ACTIVITY_WEIGHTS.items() for value in [activity.get(key, 0)])
    return _tier(score, ACTIVITY_LEVELS)


def tip_level_info(amount: int) -> dict:
    return _tier(int(amount or 0), TIP_LEVELS)


def user_analytics(db: Session, user_id: str) -> dict:
    """汇总用户创作与互动数据，并给出创作等级、粉丝等级。"""
    published_ids = select(CommunityPublication.id).where(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    )
    works = db.query(func.count(CommunityPublication.id)).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    ).scalar() or 0
    drafts = db.query(func.count(CommunityPublication.id)).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'draft',
    ).scalar() or 0
    total_reads = db.query(
        func.coalesce(func.sum(CommunityPublication.view_count), 0)
    ).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    ).scalar() or 0
    total_clicks = db.query(
        func.coalesce(func.sum(CommunityPublication.click_count), 0)
    ).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    ).scalar() or 0
    total_likes = db.query(func.count(CommunityLike.id)).filter(
        CommunityLike.publication_id.in_(published_ids)
    ).scalar() or 0
    total_favorites = db.query(func.count(CommunityFavorite.id)).filter(
        CommunityFavorite.publication_id.in_(published_ids)
    ).scalar() or 0
    total_comments = db.query(func.count(CommunityComment.id)).filter(
        CommunityComment.publication_id.in_(published_ids)
    ).scalar() or 0
    friends = db.query(func.count(CommunityFriendship.id)).filter(
        or_(
            CommunityFriendship.user_a_id == user_id,
            CommunityFriendship.user_b_id == user_id,
        )
    ).scalar() or 0
    followers = db.query(func.count(CommunityFollow.id)).filter(
        CommunityFollow.followee_id == user_id
    ).scalar() or 0
    following = db.query(func.count(CommunityFollow.id)).filter(
        CommunityFollow.follower_id == user_id
    ).scalar() or 0
    posts = db.query(func.count(SocialPost.id)).filter(
        SocialPost.author_id == user_id
    ).scalar() or 0
    # 登录天数：以登录会话的日期去重，避免会话累积造成虚高。
    login_days = db.query(
        func.count(func.distinct(func.date(AuthSession.created_at)))
    ).filter(AuthSession.user_id == user_id).scalar() or 0
    checkin_count = db.query(func.count(UserCheckin.id)).filter(
        UserCheckin.user_id == user_id
    ).scalar() or 0
    # 打赏 / 被打赏：仅统计 tip / gift 类型流水，主动为负、被动为正。
    tip_rows = db.query(
        SpiritTransaction.fruit_amount
    ).filter(
        SpiritTransaction.user_id == user_id,
        SpiritTransaction.kind.in_(['tip', 'gift']),
    ).all()
    tip_given = sum(abs(int(row[0])) for row in tip_rows if int(row[0]) < 0)
    tip_received = sum(int(row[0]) for row in tip_rows if int(row[0]) > 0)

    creator = creator_level_info(works, int(total_reads))
    follower = follower_level_info(int(followers))
    activity = activity_level_info(
        posts=int(posts),
        comments=int(total_comments),
        likes=int(total_likes),
        favorites=int(total_favorites),
        following=int(following),
        followers=int(followers),
        friends=int(friends),
        reads=int(total_reads),
        logins=int(login_days),
        checkins=int(checkin_count),
    )
    return {
        'works': int(works),
        'drafts': int(drafts),
        'total_reads': int(total_reads),
        'total_clicks': int(total_clicks),
        'total_likes': int(total_likes),
        'total_favorites': int(total_favorites),
        'total_comments': int(total_comments),
        'friends': int(friends),
        'followers': int(followers),
        'following': int(following),
        'posts': int(posts),
        'login_days': int(login_days),
        'checkin_count': int(checkin_count),
        'tip_given': int(tip_given),
        'tip_received': int(tip_received),
        'creator_level': creator,
        'follower_level': follower,
        'activity_level': activity,
        'tip_level_given': tip_level_info(tip_given),
        'tip_level_received': tip_level_info(tip_received),
    }


def user_levels(db: Session, user_id: str) -> dict:
    """仅计算等级所需的最小统计，供用户列表等高频场景使用。"""
    works = db.query(func.count(CommunityPublication.id)).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    ).scalar() or 0
    reads = db.query(
        func.coalesce(func.sum(CommunityPublication.view_count), 0)
    ).filter(
        CommunityPublication.owner_user_id == user_id,
        CommunityPublication.status == 'published',
    ).scalar() or 0
    followers = db.query(func.count(CommunityFollow.id)).filter(
        CommunityFollow.followee_id == user_id
    ).scalar() or 0
    return {
        'creator_level': creator_level_info(int(works), int(reads)),
        'follower_level': follower_level_info(int(followers)),
    }


def _iso(value):
    if not value:
        return None
    return value.isoformat(sep=" ", timespec="seconds")


def user_activity_overview(db: Session, q: str = "", limit: int = 100) -> list:
    """开发者视角：汇总所有用户的参与活跃情况。

    仅使用真实记录：登录会话、动态、评论、作品、点赞、收藏与关注。
    登录 / 签到暂无独立记录，登录时间以最近一次登录会话为准。
    """
    text = (q or "").strip()
    query = db.query(AppUser)
    if text:
        query = query.filter(or_(
            AppUser.username.ilike(f"%{text}%"),
            AppUser.display_name.ilike(f"%{text}%"),
        ))
    users = query.order_by(AppUser.created_at.desc()).limit(max(1, min(limit, 200))).all()

    post_counts = dict(db.query(SocialPost.author_id, func.count(SocialPost.id)).group_by(SocialPost.author_id).all())
    post_last = dict(db.query(SocialPost.author_id, func.max(SocialPost.created_at)).group_by(SocialPost.author_id).all())
    comment_counts = dict(db.query(CommunityComment.owner_user_id, func.count(CommunityComment.id)).group_by(CommunityComment.owner_user_id).all())
    comment_last = dict(db.query(CommunityComment.owner_user_id, func.max(CommunityComment.created_at)).group_by(CommunityComment.owner_user_id).all())
    work_counts = dict(db.query(CommunityPublication.owner_user_id, func.count(CommunityPublication.id)).group_by(CommunityPublication.owner_user_id).all())
    work_last = dict(db.query(CommunityPublication.owner_user_id, func.max(CommunityPublication.updated_at)).group_by(CommunityPublication.owner_user_id).all())
    read_counts = dict(
        db.query(CommunityPublication.owner_user_id, func.coalesce(func.sum(CommunityPublication.view_count), 0))
        .filter(CommunityPublication.status == "published")
        .group_by(CommunityPublication.owner_user_id).all()
    )
    like_given = dict(db.query(CommunityLike.owner_user_id, func.count(CommunityLike.id)).group_by(CommunityLike.owner_user_id).all())
    fav_given = dict(db.query(CommunityFavorite.owner_user_id, func.count(CommunityFavorite.id)).group_by(CommunityFavorite.owner_user_id).all())
    follow_given = dict(db.query(CommunityFollow.follower_id, func.count(CommunityFollow.id)).group_by(CommunityFollow.follower_id).all())
    follower_counts = dict(db.query(CommunityFollow.followee_id, func.count(CommunityFollow.id)).group_by(CommunityFollow.followee_id).all())
    login_last = dict(db.query(AuthSession.user_id, func.max(AuthSession.created_at)).group_by(AuthSession.user_id).all())
    login_days = dict(
        db.query(AuthSession.user_id, func.count(func.distinct(func.date(AuthSession.created_at))))
        .group_by(AuthSession.user_id).all()
    )
    checkin_counts = dict(db.query(UserCheckin.user_id, func.count(UserCheckin.id)).group_by(UserCheckin.user_id).all())

    items = []
    for user in users:
        posts = int(post_counts.get(user.id, 0))
        comments = int(comment_counts.get(user.id, 0))
        works = int(work_counts.get(user.id, 0))
        reads = int(read_counts.get(user.id, 0))
        likes = int(like_given.get(user.id, 0))
        favorites = int(fav_given.get(user.id, 0))
        following = int(follow_given.get(user.id, 0))
        followers = int(follower_counts.get(user.id, 0))
        logins = int(login_days.get(user.id, 0))
        checkins = int(checkin_counts.get(user.id, 0))
        activity = activity_level_info(
            posts=posts,
            comments=comments,
            likes=likes,
            favorites=favorites,
            following=following,
            followers=followers,
            friends=0,
            reads=reads,
            logins=logins,
            checkins=checkins,
        )
        traces = [post_last.get(user.id), comment_last.get(user.id), work_last.get(user.id)]
        last_active = max([value for value in traces if value], default=None)
        items.append({
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "is_owner": bool(user.is_owner),
            "posts": posts,
            "comments": comments,
            "works": works,
            "reads": reads,
            "likes_given": likes,
            "favorites_given": favorites,
            "following": following,
            "followers": followers,
            "login_days": logins,
            "checkin_count": checkins,
            "activity_level": activity,
            "last_login_at": _iso(login_last.get(user.id)),
            "last_active_at": _iso(last_active),
            "created_at": _iso(user.created_at),
        })
    return items
