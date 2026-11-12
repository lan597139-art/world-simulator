"""Phase N1-M3/M4/M5/M6 手动验收：个人内容、授权、记忆撤销、社区公开。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def run():
    global passed, failed
    suffix = uuid.uuid4().hex[:6]

    person = client.post("/api/journal/people", json={
        "name": f"朋友-{suffix}", "relation_label": "朋友", "summary": "一起长大",
    }).json()
    check("个人人物可创建", bool(person.get("id")), person)

    entry = client.post("/api/journal/entries", json={
        "entry_date": "2026-11-12", "entry_type": "life_experience",
        "info_class": "experience", "sensitivity": "sensitive",
        "title": f"授权日记-{suffix}", "content": "这是我明确授权的一段私人经历。",
        "person_ids": [person["id"]],
    })
    check("Journal 条目带类别/敏感度/人物", entry.status_code == 200 and entry.json()["person_ids"] == [person["id"]], entry.text)
    entry_id = entry.json()["id"]

    source = client.post("/api/information-sources", json={
        "title": "本人回忆", "content": "我记得这段经历", "source_type": "self_memory",
    }).json()
    citation = client.post("/api/journal/citations", json={
        "target_type": "journal_entry", "target_id": entry_id, "source_id": source["id"],
    })
    check("日记可引用信息来源", citation.status_code == 200, citation.text)

    bio = client.post("/api/journal/biographies", json={"title": f"我的传记-{suffix}"}).json()
    chapter = client.post(f"/api/journal/biographies/{bio['id']}/chapters/from-entries", json={
        "entry_ids": [entry_id], "title": "第一章",
    })
    check("日记可生成用户传记章节", chapter.status_code == 200 and entry_id in chapter.json()["source_entry_ids"], chapter.text)

    bad_citation = client.post("/api/journal/citations", json={
        "target_type": "journal_entry", "target_id": "missing", "source_id": source["id"],
    })
    check("引用不存在目标被拒", bad_citation.status_code == 409, bad_citation.text)

    profile = client.get("/api/yunbao").json()
    instance_id = profile["instance_id"]
    grant = client.post("/api/ai-grants", json={
        "instance_id": instance_id, "access_level": 2,
        "allowed_purposes": ["chat_context", "memory_capture"],
        "allow_memory": True, "scopes": [{"scope_type": "entry", "scope_id": entry_id}],
    })
    check("AI 授权可创建", grant.status_code == 200 and grant.json()["status"] == "active", grant.text)
    grant_id = grant.json()["id"]

    read = client.post(f"/api/ai-grants/{grant_id}/read", json={
        "instance_id": instance_id, "purpose": "chat_context",
    })
    check("授权范围内可读取", read.status_code == 200 and read.json()["entries"][0]["entry_id"] == entry_id, read.text)

    memory = client.post(f"/api/ai-grants/{grant_id}/memory", json={
        "instance_id": instance_id, "source_type": "journal_entry", "source_id": entry_id,
    })
    check("授权可派生带来源记忆", memory.status_code == 200, memory.text)
    memory_id = memory.json().get("memory_id")

    logs = client.get("/api/ai-grants/audit/logs").json()
    check("访问日志只含范围元数据", any(item["action"] == "read" and item["scope_type"] == "entry" for item in logs) and all("content" not in item for item in logs), logs[:2])

    revoked = client.post(f"/api/ai-grants/{grant_id}/revoke")
    check("撤销授权返回失效记忆", revoked.status_code == 200 and memory_id in revoked.json()["memory_ids"], revoked.text)
    db = SessionLocal()
    try:
        saved = db.query(models.PersonaMemory).filter(models.PersonaMemory.id == memory_id).first()
        check("撤销后记忆正文清空且状态失效", saved is not None and saved.status == "invalidated" and saved.content == "", saved)
    finally:
        db.close()

    pub = client.post("/api/community/publications", json={
        "source_type": "journal_entry", "source_ids": [entry_id],
        "title": f"公开经历-{suffix}", "summary": "匿名公开", "anonymous": True,
    })
    check("日记可发布为公开作品", pub.status_code == 200 and pub.json()["status"] == "published", pub.text)
    pub_id = pub.json()["id"]
    public_id = pub.json()["public_id"]

    feed = client.get("/api/community/public")
    check("公开列表不含作者身份", feed.status_code == 200 and any(item["public_id"] == public_id and "owner_user_id" not in item for item in feed.json()), feed.text)
    detail = client.get(f"/api/community/public/{public_id}")
    check("公开详情可匿名读取", detail.status_code == 200 and detail.json()["author_display"] == "匿名用户", detail.text)
    comment = client.post(f"/api/community/public/{public_id}/comments", json={"body": "写得真好"})
    check("公开作品可评论", comment.status_code == 200, comment.text)
    fav = client.post(f"/api/community/public/{public_id}/favorite")
    check("公开作品可收藏", fav.status_code == 200 and fav.json()["favorited"] is True, fav.text)

    withdraw = client.post(f"/api/community/publications/{pub_id}/withdraw")
    check("公开作品可撤回", withdraw.status_code == 200 and withdraw.json()["status"] == "withdrawn", withdraw.text)
    hidden = client.get(f"/api/community/public/{public_id}")
    check("撤回后公开链接不可见", hidden.status_code == 404, hidden.text)

    client.delete(f"/api/journal/biographies/{bio['id']}")
    client.delete(f"/api/journal/entries/{entry_id}")
    client.delete(f"/api/journal/people/{person['id']}")
    client.delete(f"/api/information-sources/{source['id']}")
    client.delete(f"/api/community/publications/{pub_id}")

    db = SessionLocal()
    try:
        db.query(models.AiMemorySource).filter(models.AiMemorySource.memory_id == memory_id).delete()
        db.query(models.PersonaMemory).filter(models.PersonaMemory.id == memory_id).delete()
        db.query(models.AiInfoAccessLog).filter(models.AiInfoAccessLog.grant_id == grant_id).delete()
        db.query(models.AiInfoGrantScope).filter(models.AiInfoGrantScope.grant_id == grant_id).delete()
        db.query(models.AiInfoGrant).filter(models.AiInfoGrant.id == grant_id).delete()
        db.query(models.CommunityComment).filter(models.CommunityComment.publication_id == pub_id).delete()
        db.query(models.CommunityFavorite).filter(models.CommunityFavorite.publication_id == pub_id).delete()
        db.query(models.CommunityPublicationVersion).filter(models.CommunityPublicationVersion.publication_id == pub_id).delete()
        db.query(models.CommunityPublication).filter(models.CommunityPublication.id == pub_id).delete()
        db.commit()
    finally:
        db.close()

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
