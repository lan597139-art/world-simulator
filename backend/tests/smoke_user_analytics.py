"""用户画像分析：创作等级、粉丝等级、作品阅读量与点击量验收。

覆盖：
- 作品阅读量（view_count）与点击量（click_count）分别计数、口径分离。
- 创作等级按「作品数 + 阅读量」分档，粉丝等级按粉丝数分档。
- 用户画像统计（作品/草稿/阅读/点击/互动/关注）随个人主页下发。
- 社交用户行携带创作等级与粉丝等级。
"""

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
    username = f"analytics-{label}-{suffix}"
    user = models.AppUser(username=username, display_name=f"画像{label}", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    response = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if response.status_code != 200:
        raise RuntimeError(response.text)
    return user, {"Authorization": f"Bearer {response.json()['token']}"}


def publish(headers, *, title):
    payload = {"title": title, "content": "公开正文内容", "work_type": "diary_essay"}
    r = client.post("/api/community/publications", headers=headers, json=payload)
    if r.status_code != 200:
        raise RuntimeError(r.text)
    return r.json()


def main_test():
    author, ha = create_user("作者")
    viewer, hv = create_user("观众")

    # 12 个已发布作品：创作积分 12*10=120，应达到 2 级「萌芽」。
    published = [publish(ha, title=f"作品-{suffix}-{index}") for index in range(12)]
    pub_id = published[0]["public_id"]

    # 阅读量：打开详情累加。
    for _ in range(3):
        r = client.get(f"/api/community/public/{pub_id}", headers=ha)
        check("详情读取返回 200", r.status_code == 200, r.text)

    # 点击量：入口点击单独计数。
    r = client.post(f"/api/community/public/{pub_id}/click", headers=ha)
    check("点击接口返回 200", r.status_code == 200, r.text)
    check("点击量自增为 1", r.json().get("click_count") == 1, r.json())
    r = client.post(f"/api/community/public/{pub_id}/click", headers=ha)
    check("再次点击累加为 2", r.json().get("click_count") == 2, r.json())

    # 作品列表返回点击量与阅读量。
    r = client.get("/api/community/public", headers=ha)
    check("作品列表返回 200", r.status_code == 200, r.text)
    row = next((item for item in r.json() if item["public_id"] == pub_id), None)
    check("作品列表含阅读量与点击量", row is not None and row.get("view_count", 0) >= 3 and row.get("click_count") == 2, row)

    # 画像统计。
    r = client.get(f"/api/social/users/{author.id}/profile", headers=ha)
    check("个人主页返回 200", r.status_code == 200, r.text)
    stats = r.json().get("stats", {})
    check("画像作品数为 12", stats.get("works") == 12, stats)
    check("画像阅读量累计 >= 3", stats.get("total_reads", 0) >= 3, stats)
    check("画像点击量累计为 2", stats.get("total_clicks") == 2, stats)
    creator = stats.get("creator_level", {})
    check("创作等级为 2 级", creator.get("level") == 2, creator)
    check("创作等级标签为 萌芽", creator.get("label") == "萌芽", creator)
    check("创作等级含进度", "progress" in creator and "next_threshold" in creator, creator)
    follower = stats.get("follower_level", {})
    check("粉丝等级初始为 1 级", follower.get("level") == 1, follower)

    # 粉丝：关注后粉丝数增加，画像粉丝数同步。
    r = client.post(f"/api/community/social/users/{author.id}/follow", headers=hv)
    check("关注接口返回 200", r.status_code == 200, r.text)
    r = client.get(f"/api/social/users/{author.id}/profile", headers=hv)
    stats2 = r.json().get("stats", {})
    check("关注后粉丝数为 1", stats2.get("followers") == 1, stats2)
    check("关注后粉丝等级仍为 1 级（未达 20）", stats2.get("follower_level", {}).get("level") == 1, stats2.get("follower_level"))

    # 社交用户行携带等级。
    r = client.get(f"/api/community/social/users/{author.id}", headers=hv)
    check("社交用户接口返回 200", r.status_code == 200, r.text)
    user_row = r.json()
    check("社交用户含创作等级", user_row.get("creator_level", {}).get("level") == 2, user_row)
    check("社交用户含粉丝等级", "follower_level" in user_row, user_row)

    print(f"\n===== {passed} passed, {failed} failed =====")
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if main_test() else 0)
