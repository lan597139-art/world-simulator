"""设置中心与内容社区社交验收。"""

import os
import uuid

os.environ.pop("WS_AUTH_DISABLED", None)

from fastapi.testclient import TestClient

import main
import models
from auth import hash_password
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
suffix = uuid.uuid4().hex[:6]
users = {}


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


def create_user(label: str) -> tuple[models.AppUser, dict]:
    db = SessionLocal()
    username = f"social-{label}-{suffix}"
    user = models.AppUser(username=username, display_name=f"社交{label}", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    response = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if response.status_code != 200:
        raise RuntimeError(response.text)
    users[user.id] = user
    return user, {"Authorization": f"Bearer {response.json()['token']}"}


def main_test():
    a, ha = create_user("a")
    b, hb = create_user("b")

    # 设置中心
    r = client.get("/api/settings", headers=ha)
    body = r.json() if r.status_code == 200 else {}
    check("设置中心可读取", r.status_code == 200 and body.get("profile", {}).get("username") == a.username, r.text[:300])
    check("设置默认值完整", all(key in body for key in ("preferences", "privacy", "notifications", "account", "stats")), body)

    r = client.patch("/api/settings", headers=ha, json={
        "preferences": {"language": "en", "theme": "dark", "density": "compact"},
        "privacy": {"allow_follow": False, "allow_friend_requests": False},
        "notifications": {"weekly_digest": True},
    })
    data = r.json() if r.status_code == 200 else {}
    check("偏好/隐私/通知可保存", r.status_code == 200 and data["preferences"]["language"] == "en" and data["privacy"]["allow_follow"] is False, r.text[:300])
    r = client.patch("/api/settings", headers=ha, json={"preferences": {"theme": "neon"}})
    check("非法偏好被拒绝", r.status_code == 422, r.text[:200])
    r = client.patch("/api/auth/profile", headers=ha, json={"display_name": "社交 A", "bio": "测试简介", "avatar": "A"})
    check("个人资料可保存", r.status_code == 200 and r.json().get("display_name") == "社交 A" and r.json().get("bio") == "测试简介", r.text[:300])

    # 隐私限制关注：由被关注者关闭 allow_follow
    client.patch("/api/settings", headers=hb, json={"privacy": {"allow_follow": False}})
    r = client.post(f"/api/community/social/users/{b.id}/follow", headers=ha)
    check("隐私禁止关注生效", r.status_code == 403, r.text[:200])
    client.patch("/api/settings", headers=hb, json={"privacy": {"allow_follow": True}})

    # 讨论
    r = client.post("/api/community/topics", headers=ha, json={
        "category": "experience", "title": "如何开始一个世界", "body": "先写规则，再写人物。", "tags": ["新手"],
    })
    topic = r.json() if r.status_code == 200 else {}
    check("可发布讨论", r.status_code == 200 and topic.get("id") and topic.get("category") == "experience", r.text[:300])
    r = client.post(f"/api/community/topics/{topic.get('id')}/replies", headers=hb, json={"body": "先从一个事件开始。"})
    check("可回复讨论", r.status_code == 200 and r.json().get("body"), r.text[:300])
    r = client.get(f"/api/community/topics/{topic.get('id')}", headers=ha)
    check("讨论详情含回复", r.status_code == 200 and len(r.json().get("replies", [])) == 1, r.text[:300])
    r = client.get("/api/community/topics?category=experience", headers=hb)
    check("讨论分类可筛选", r.status_code == 200 and any(item["id"] == topic.get("id") for item in r.json()), r.text[:300])

    # 小组
    r = client.post("/api/community/groups", headers=ha, json={
        "name": "世界观研究", "description": "一起搭建可信世界", "category": "world", "visibility": "public",
    })
    group = r.json() if r.status_code == 200 else {}
    check("可创建兴趣小组", r.status_code == 200 and group.get("id") and group.get("member_count") == 1, r.text[:300])
    r = client.post(f"/api/community/groups/{group.get('id')}/join", headers=hb)
    check("可加入公开小组", r.status_code == 200 and r.json().get("joined") is True, r.text[:300])
    r = client.post(f"/api/community/groups/{group.get('id')}/posts", headers=hb, json={
        "title": "小组第一帖", "body": "我们来讨论世界规则。",
    })
    post = r.json() if r.status_code == 200 else {}
    check("组员可发帖", r.status_code == 200 and post.get("id"), r.text[:300])
    r = client.post(f"/api/community/groups/{group.get('id')}/posts/{post.get('id')}/replies", headers=ha, json={"body": "同意。"})
    check("组员可回复", r.status_code == 200 and r.json().get("body") == "同意。", r.text[:300])
    r = client.get(f"/api/community/groups/{group.get('id')}", headers=hb)
    check("小组详情含成员与帖子", r.status_code == 200 and r.json().get("joined") is True and r.json().get("posts"), r.text[:300])

    # 关注
    r = client.post(f"/api/community/social/users/{b.id}/follow", headers=ha)
    check("可关注用户", r.status_code == 200 and r.json().get("following") is True, r.text[:300])
    r = client.get(f"/api/community/social/users/{b.id}/followers", headers=hb)
    check("粉丝列表可见", r.status_code == 200 and any(item["id"] == a.id for item in r.json()), r.text[:300])
    r = client.get("/api/community/social/feed?scope=following", headers=ha)
    check("关注动态包含关注对象", r.status_code == 200 and any(item["author"] and item["author"]["id"] == b.id for item in r.json()), r.text[:300])

    # 好友
    r = client.post("/api/community/social/friend-requests", headers=ha, json={"user_id": b.id, "message": "一起创作"})
    request_id = (r.json() or {}).get("id")
    check("可发送好友申请", r.status_code == 200 and request_id, r.text[:300])
    r = client.get("/api/community/social/friend-requests?direction=incoming", headers=hb)
    check("可读取收到的好友申请", r.status_code == 200 and any(item["id"] == request_id for item in r.json()), r.text[:300])
    r = client.post(f"/api/community/social/friend-requests/{request_id}/accept", headers=hb)
    check("可接受好友申请", r.status_code == 200 and r.json().get("status") == "accepted", r.text[:300])
    r = client.get("/api/community/social/friends", headers=ha)
    check("好友列表包含对方", r.status_code == 200 and any(item["id"] == b.id for item in r.json()), r.text[:300])
    r = client.get("/api/community/social/feed?scope=friends", headers=ha)
    check("好友动态可读取", r.status_code == 200, r.text[:300])

    # 通知 / 设置安全 / 数据
    r = client.get("/api/community/social/notifications", headers=hb)
    check("社交通知生成", r.status_code == 200 and any(item["type"] == "friend_request" for item in r.json()), r.text[:300])
    r = client.get("/api/settings/sessions", headers=ha)
    check("会话列表可读取", r.status_code == 200 and any(item["current"] for item in r.json()), r.text[:300])
    r = client.get("/api/settings/export", headers=ha)
    check("数据可导出", r.status_code == 200 and "content" in r.json() and len(r.json()["content"]) > 10, r.text[:300])
    r = client.get("/api/settings/about")
    check("关于信息可读取", r.status_code == 200 and r.json().get("version"), r.text[:300])

    print(f"\n===== {passed} passed, {failed} failed")
    return failed


def cleanup():
    db = SessionLocal()
    try:
        ids = list(users)
        for uid in ids:
            db.query(models.CommunityNotification).filter(models.CommunityNotification.user_id == uid).delete(synchronize_session=False)
            db.query(models.CommunityNotification).filter(models.CommunityNotification.actor_id == uid).delete(synchronize_session=False)
            db.query(models.CommunityFollow).filter((models.CommunityFollow.follower_id == uid) | (models.CommunityFollow.followee_id == uid)).delete(synchronize_session=False)
            db.query(models.CommunityFriendRequest).filter((models.CommunityFriendRequest.requester_id == uid) | (models.CommunityFriendRequest.addressee_id == uid)).delete(synchronize_session=False)
            db.query(models.CommunityFriendship).filter((models.CommunityFriendship.user_a_id == uid) | (models.CommunityFriendship.user_b_id == uid)).delete(synchronize_session=False)
            db.query(models.CommunityTopicReply).filter(models.CommunityTopicReply.owner_user_id == uid).delete(synchronize_session=False)
            db.query(models.CommunityTopic).filter(models.CommunityTopic.owner_user_id == uid).delete(synchronize_session=False)
            topic_ids = [row.id for row in db.query(models.CommunityTopic).filter(models.CommunityTopic.owner_user_id == uid).all()]
            if topic_ids:
                db.query(models.CommunityTopicReply).filter(models.CommunityTopicReply.topic_id.in_(topic_ids)).delete(synchronize_session=False)
            group_ids = [row.id for row in db.query(models.CommunityGroup).filter(models.CommunityGroup.owner_user_id == uid).all()]
            for gid in group_ids:
                post_ids = [row.id for row in db.query(models.CommunityGroupPost).filter(models.CommunityGroupPost.group_id == gid).all()]
                if post_ids:
                    db.query(models.CommunityGroupReply).filter(models.CommunityGroupReply.post_id.in_(post_ids)).delete(synchronize_session=False)
                db.query(models.CommunityGroupPost).filter(models.CommunityGroupPost.group_id == gid).delete(synchronize_session=False)
                db.query(models.CommunityGroupMember).filter(models.CommunityGroupMember.group_id == gid).delete(synchronize_session=False)
                db.query(models.CommunityGroup).filter(models.CommunityGroup.id == gid).delete(synchronize_session=False)
            db.query(models.CommunityGroupMember).filter(models.CommunityGroupMember.user_id == uid).delete(synchronize_session=False)
            db.query(models.CommunityGroupReply).filter(models.CommunityGroupReply.owner_user_id == uid).delete(synchronize_session=False)
            db.query(models.CommunityGroupPost).filter(models.CommunityGroupPost.owner_user_id == uid).delete(synchronize_session=False)
            db.query(models.UserSettings).filter(models.UserSettings.user_id == uid).delete(synchronize_session=False)
            db.query(models.AuthSession).filter(models.AuthSession.user_id == uid).delete(synchronize_session=False)
            db.query(models.AppUser).filter(models.AppUser.id == uid).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main_test())
    finally:
        cleanup()
