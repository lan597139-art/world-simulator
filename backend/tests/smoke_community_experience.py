"""内容社区 × 体验中心合并：作者权限、灵果体验与社区互动验收。

覆盖：
- 作者发布时配置普通公开 / 灵果体验权限与内容。
- 默认不虚构定价（未配置时 experience_fruit 为空、灵果体验关闭）。
- 普通体验不扣灵果，未公开内容不下发快照。
- 灵果体验：确认前置校验、余额不足拦截、确认后服务端扣费与授权、
  重复点击同幂等键不重复扣费、已授权后换键幂等不重复扣费、交易流水。
- 社区互动：点赞/取消点赞幂等、收藏、评论、打赏（与体验扣费分别记账）。
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
    username = f"exp-{label}-{suffix}"
    user = models.AppUser(username=username, display_name=f"体验{label}", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    response = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    if response.status_code != 200:
        raise RuntimeError(response.text)
    return user, {"Authorization": f"Bearer {response.json()['token']}"}


def publish(headers, *, title, content="公开正文内容", **extra):
    payload = {"title": title, "content": content, "work_type": "diary_essay"}
    payload.update(extra)
    r = client.post("/api/community/publications", headers=headers, json=payload)
    if r.status_code != 200:
        raise RuntimeError(r.text)
    return r.json()


def main_test():
    author, ha = create_user("author")
    viewer, hv = create_user("viewer")

    # 触发新账户灵果账户初始化（500 灵果）。
    r = client.get("/api/spirit/summary", headers=hv)
    check("灵果账户初始化", r.status_code == 200 and r.json()["account"]["fruit_balance"] == 500, r.text[:200])

    # 1) 默认发布：普通公开，灵果体验关闭，不虚构定价。
    pub_free = publish(ha, title=f"免费作品-{suffix}", public_visible=True)
    check("默认灵果体验关闭", pub_free["experience_enabled"] is False, pub_free)
    check("默认不虚构体验定价", pub_free["experience_fruit"] is None, pub_free)
    check("默认普通内容公开", pub_free["public_visible"] is True, pub_free)

    # 2) 配置灵果体验的深度作品。
    pub_exp = publish(
        ha, title=f"灵果作品-{suffix}", public_visible=True,
        experience_enabled=True, experience_fruit=50,
        experience_snapshot={"kind": "deep", "content": "深度体验内容"},
    )
    check("配置灵果体验开启", pub_exp["experience_enabled"] is True, pub_exp)
    check("灵果体验消耗已配置", pub_exp["experience_fruit"] == 50, pub_exp)

    # 3) 普通公开关闭的作品。
    pub_hidden = publish(ha, title=f"私密作品-{suffix}", public_visible=False)

    pid_exp = pub_exp["public_id"]
    pid_free = pub_free["public_id"]
    pid_hidden = pub_hidden["public_id"]

    # 公开详情：普通体验不下发未公开内容。
    r = client.get(f"/api/community/public/{pid_hidden}")
    check("未公开作品快照不下发", r.status_code == 200 and r.json()["content"]["snapshot"] == {}, r.text[:200])

    r = client.get(f"/api/community/public/{pid_exp}")
    body = r.json()
    check("灵果作品公开详情可读", r.status_code == 200, r.text[:200])
    check("普通内容公开可见", body["content"]["snapshot"].get("kind") == "direct", body["content"])
    check("体验信息：已开放", body["experience"]["enabled"] is True, body["experience"])
    check("体验信息：消耗数量已展示", body["experience"]["fruit"] == 50, body["experience"])
    check("体验信息：深度内容存在", body["experience"]["has_content"] is True, body["experience"])
    check("体验信息：未授权", body["experience"]["granted"] is False, body["experience"])
    check("初始点赞数为 0", body["like_count"] == 0, body)

    # 4) 灵果体验前置校验：未确认不扣费。
    r = client.post(f"/api/community/public/{pid_exp}/experience", headers=hv, json={"confirm": False})
    check("未确认不执行扣费", r.status_code == 422, r.text[:200])

    # 5) 未开放灵果体验的作品不可扣费。
    r = client.post(f"/api/community/public/{pid_free}/experience", headers=hv, json={"confirm": True})
    check("未开放体验不可扣费", r.status_code == 409, r.text[:200])

    # 6) 余额不足拦截（定价远高于余额）。
    pub_rich = publish(
        ha, title=f"高价作品-{suffix}", experience_enabled=True,
        experience_fruit=999999, experience_snapshot={"kind": "deep"},
    )
    r = client.post(f"/api/community/public/{pub_rich['public_id']}/experience", headers=hv, json={"confirm": True})
    check("余额不足拦截扣费", r.status_code == 409, r.text[:200])
    r = client.get("/api/spirit/summary", headers=hv)
    check("余额不足未扣灵果", r.json()["account"]["fruit_balance"] == 500, r.text[:200])

    # 7) 确认后服务端扣费与授权。
    r = client.post(f"/api/community/public/{pid_exp}/experience", headers=hv, json={"confirm": True, "idempotency_key": "key-a"})
    check("确认后扣费成功", r.status_code == 200 and r.json()["granted"] is True, r.text[:300])
    check("扣费数量正确", r.json().get("fruit_amount") == 50, r.text[:200])
    check("扣费后余额正确", r.json().get("balance_after") == 450, r.text[:200])
    exp_tx_id = r.json().get("transaction_id")

    r = client.get("/api/spirit/summary", headers=hv)
    check("账户余额已扣减", r.json()["account"]["fruit_balance"] == 450, r.text[:200])
    check("体验扣费流水存在", any(t["kind"] == "experience" and t["id"] == exp_tx_id for t in r.json()["transactions"]), r.text[:300])

    # 8) 重复点击同幂等键：不重复扣费。
    r = client.post(f"/api/community/public/{pid_exp}/experience", headers=hv, json={"confirm": True, "idempotency_key": "key-a"})
    check("同幂等键重复点击被拒", r.status_code == 409, r.text[:200])
    r = client.get("/api/spirit/summary", headers=hv)
    check("重复点击未重复扣费", r.json()["account"]["fruit_balance"] == 450, r.text[:200])

    # 9) 已授权后换键：幂等返回，不重复扣费。
    r = client.post(f"/api/community/public/{pid_exp}/experience", headers=hv, json={"confirm": True, "idempotency_key": "key-b"})
    check("已授权后再次确认幂等", r.status_code == 200 and r.json()["granted"] is True, r.text[:200])
    check("已授权重复确认不扣费", r.json().get("fruit_amount") == 0, r.text[:200])
    r = client.get("/api/spirit/summary", headers=hv)
    check("已授权重复确认余额不变", r.json()["account"]["fruit_balance"] == 450, r.text[:200])

    # 10) 体验授权后详情与体验信息同步。
    r = client.get(f"/api/community/public/{pid_exp}", headers=hv)
    check("授权后体验标记为已授权", r.json()["experience"]["granted"] is True, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}/experience", headers=hv)
    check("体验信息接口授权一致", r.json()["granted"] is True and r.json()["experience_enabled"] is True, r.text[:200])

    # 11) 点赞 / 取消点赞，幂等。
    r = client.post(f"/api/community/public/{pid_exp}/like", headers=hv)
    check("点赞成功", r.status_code == 200 and r.json()["liked"] is True, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}", headers=hv)
    check("点赞统计更新", r.json()["like_count"] == 1 and r.json()["liked_by_me"] is True, r.text[:200])
    r = client.post(f"/api/community/public/{pid_exp}/like", headers=hv)
    check("重复点赞幂等", r.status_code == 200, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}")
    check("重复点赞不重复计数", r.json()["like_count"] == 1, r.text[:200])
    r = client.delete(f"/api/community/public/{pid_exp}/like", headers=hv)
    check("取消点赞成功", r.status_code == 200 and r.json()["liked"] is False, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}")
    check("取消后点赞数归零", r.json()["like_count"] == 0, r.text[:200])

    # 12) 收藏与评论。
    r = client.post(f"/api/community/public/{pid_exp}/favorite", headers=hv)
    check("收藏成功", r.status_code == 200 and r.json()["favorited"] is True, r.text[:200])
    r = client.post(f"/api/community/public/{pid_exp}/comments", headers=hv, json={"body": "写得好"})
    check("评论成功", r.status_code == 200, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}")
    check("收藏统计更新", r.json()["favorite_count"] == 1, r.text[:200])
    r = client.get(f"/api/community/public/{pid_exp}/comments")
    check("评论列表可读", r.status_code == 200 and any(c["body"] == "写得好" for c in r.json()), r.text[:200])

    # 13) 打赏：与体验扣费分别记账。
    r = client.post("/api/spirit/gift", headers=hv, json={
        "to_user_id": author.id, "amount": 30, "kind": "tip",
        "ref_type": "publication", "ref_id": pid_exp, "note": "打赏作品",
    })
    check("打赏成功", r.status_code == 200, r.text[:200])
    r = client.get("/api/spirit/summary", headers=hv)
    balance = r.json()["account"]["fruit_balance"]
    check("打赏后余额为 420", balance == 420, balance)
    check("打赏流水与体验扣费分别记账", any(t["kind"] == "tip" for t in r.json()["transactions"]), r.text[:300])

    # 14) 作者权限调整。
    r = client.patch(f"/api/community/publications/{pub_free['id']}", headers=ha, json={
        "public_visible": False, "experience_enabled": True, "experience_fruit": 10,
    })
    check("作者可调整公开与体验权限", r.status_code == 200 and r.json()["public_visible"] is False and r.json()["experience_fruit"] == 10, r.text[:200])
    r = client.get(f"/api/community/public/{pid_free}")
    check("关闭公开后快照不下发", r.json()["content"]["snapshot"] == {} and r.json()["public_visible"] is False, r.text[:200])

    # 15) 删除体验中心/游戏体验入口：确认无独立入口路由（服务端无此类业务路由）。
    r = client.get("/api/experience-center")
    check("独立体验中心路由不存在", r.status_code in (401, 404, 405), r.status_code)

    print(f"\n结果：{passed} 通过 / {failed} 失败")
    return failed == 0


if __name__ == "__main__":
    ok = main_test()
    raise SystemExit(0 if ok else 1)
