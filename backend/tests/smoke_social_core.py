"""E 社区核心：个人动态、主页、私信、拉黑与好友边界。"""

import uuid
from datetime import datetime

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
user_ids = []
post_ids = []


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def run():
    global user_ids
    suffix = uuid.uuid4().hex[:6]
    db = SessionLocal()
    friend = models.AppUser(username=f"social_friend_{suffix}", display_name="好友甲", bio="测试好友")
    stranger = models.AppUser(username=f"social_stranger_{suffix}", display_name="陌生人乙")
    db.add_all([friend, stranger])
    db.commit()
    db.refresh(friend); db.refresh(stranger)
    friend_id, stranger_id = friend.id, stranger.id
    user_ids = [friend_id, stranger_id]
    a, b = sorted(("local", friend_id))
    db.add(models.CommunityFriendship(user_a_id=a, user_b_id=b))
    db.commit()
    db.close()

    post = client.post("/api/social/posts", json={
        "body": "第一条个人动态", "channels": ["content", "social"], "visibility": "public",
    })
    check("发布双频道动态", post.status_code == 200 and set(post.json()["channels"]) == {"content", "social"}, post.text)
    post_id = post.json()["id"] if post.status_code == 200 else ""
    if post_id: post_ids.append(post_id)

    feed = client.get("/api/social/posts?channel=social&scope=discover")
    check("社交频道可见", feed.status_code == 200 and any(row["id"] == post_id for row in feed.json()), feed.text)
    content_feed = client.get("/api/social/posts?channel=content")
    check("内容频道可见", content_feed.status_code == 200 and any(row["id"] == post_id for row in content_feed.json()), content_feed.text)

    liked = client.post(f"/api/social/posts/{post_id}/like")
    check("点赞动态", liked.status_code == 200 and liked.json()["like_count"] == 1 and liked.json()["liked_by_me"], liked.text)
    unliked = client.delete(f"/api/social/posts/{post_id}/like")
    check("取消点赞", unliked.status_code == 200 and unliked.json()["like_count"] == 0, unliked.text)

    comment = client.post(f"/api/social/posts/{post_id}/comments", json={"body": "第一条评论"})
    check("评论动态", comment.status_code == 200 and comment.json()["body"] == "第一条评论", comment.text)
    comments = client.get(f"/api/social/posts/{post_id}/comments")
    check("读取评论", comments.status_code == 200 and len(comments.json()) == 1, comments.text)

    updated = client.patch(f"/api/social/posts/{post_id}", json={"body": "改后的动态", "visibility": "friends"})
    check("编辑动态与可见范围", updated.status_code == 200 and updated.json()["visibility"] == "friends", updated.text)

    profile = client.get(f"/api/social/users/{friend_id}/profile")
    check("访问好友主页", profile.status_code == 200 and profile.json()["friend_status"] == "friends", profile.text)
    own = client.get("/api/social/users/local/profile")
    check("访问自己主页", own.status_code == 200 and own.json()["friend_status"] == "self", own.text)

    sent = client.post(f"/api/social/messages/{friend_id}", json={"body": "你好，这是好友私信"})
    check("好友私信发送", sent.status_code == 200 and sent.json()["is_mine"], sent.text)
    history = client.get(f"/api/social/messages/{friend_id}")
    check("私信历史", history.status_code == 200 and len(history.json()) == 1, history.text)
    convos = client.get("/api/social/messages/conversations")
    check("会话列表", convos.status_code == 200 and any(row["user"]["id"] == friend_id for row in convos.json()), convos.text)
    unread = client.get("/api/social/messages/unread")
    check("未读数接口", unread.status_code == 200 and "count" in unread.json(), unread.text)

    stranger_msg = client.post(f"/api/social/messages/{stranger_id}", json={"body": "非好友私信"})
    check("非好友拒绝私信", stranger_msg.status_code == 403, stranger_msg.text)
    empty = client.post(f"/api/social/messages/{friend_id}", json={"body": " "})
    check("空消息拒绝", empty.status_code == 422, empty.text)

    blocked = client.post(f"/api/social/users/{friend_id}/block")
    check("拉黑用户", blocked.status_code == 200, blocked.text)
    blocked_msg = client.post(f"/api/social/messages/{friend_id}", json={"body": "拉黑后"})
    check("拉黑后拒绝私信", blocked_msg.status_code == 403, blocked_msg.text)
    blocked_friend = client.post("/api/community/social/friend-requests", json={"user_id": friend_id})
    check("拉黑后拒绝好友申请", blocked_friend.status_code == 403, blocked_friend.text)
    blocked_profile = client.get(f"/api/social/users/{friend_id}/profile")
    check("主页显示拉黑状态", blocked_profile.status_code == 200 and blocked_profile.json()["blocked_by_me"], blocked_profile.text)
    unblocked = client.delete(f"/api/social/users/{friend_id}/block")
    check("解除拉黑", unblocked.status_code == 200, unblocked.text)

    deleted = client.delete(f"/api/social/posts/{post_id}")
    check("删除动态", deleted.status_code == 200, deleted.text)
    post_ids.clear()


try:
    run()
finally:
    db = SessionLocal()
    if post_ids:
        db.query(models.SocialPostLike).filter(models.SocialPostLike.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(models.SocialPostComment).filter(models.SocialPostComment.post_id.in_(post_ids)).delete(synchronize_session=False)
        db.query(models.SocialPost).filter(models.SocialPost.id.in_(post_ids)).delete(synchronize_session=False)
    if user_ids:
        db.query(models.DirectMessage).filter(
            (models.DirectMessage.sender_id.in_(user_ids)) | (models.DirectMessage.recipient_id.in_(user_ids))
        ).delete(synchronize_session=False)
        db.query(models.SocialBlock).filter(
            (models.SocialBlock.blocker_id.in_(user_ids)) | (models.SocialBlock.blocked_id.in_(user_ids))
        ).delete(synchronize_session=False)
        db.query(models.CommunityFriendship).filter(
            (models.CommunityFriendship.user_a_id.in_(user_ids)) | (models.CommunityFriendship.user_b_id.in_(user_ids))
        ).delete(synchronize_session=False)
        db.query(models.AppUser).filter(models.AppUser.id.in_(user_ids)).delete(synchronize_session=False)
    db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed =====")
