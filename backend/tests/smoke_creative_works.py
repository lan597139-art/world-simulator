"""阶段 C：创作中心统一作品元数据、封面引用与四场景分类。"""

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
    world = client.post("/api/worlds", json={"name": f"作品世界-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    character = client.post("/api/characters", json={"world_id": wid, "name": "作品主角"}).json()
    cid = character["id"]

    empty = client.get("/api/creative-works")
    check("作品列表可读", empty.status_code == 200, empty.text)

    created = client.post("/api/creative-works", json={
        "scene": "literature",
        "title": "星海旧梦",
        "summary": "一部关于远航与归来的长篇小说。",
        "category": "长篇小说",
        "status": "in_progress",
        "cover_url": "/uploads/creator_assets/cover.webp",
        "world_ids": [wid],
        "character_ids": [cid],
    })
    check("创建文学作品", created.status_code == 200 and created.json()["title"] == "星海旧梦", created.text)
    work = created.json()
    work_id = work["id"]
    check("封面持久化引用", work["cover_url"] == "/uploads/creator_assets/cover.webp")
    check("世界与人物引用", work["world_ids"] == [wid] and work["character_ids"] == [cid])

    listing = client.get("/api/creative-works?scene=literature")
    check("按场景筛选", listing.status_code == 200 and any(row["id"] == work_id for row in listing.json()), listing.text)
    filtered_world = client.get(f"/api/creative-works?world_id={wid}")
    check("按世界筛选", any(row["id"] == work_id for row in filtered_world.json()), filtered_world.text)

    scene_payloads = {
        "game": "世界观",
        "companion": "AI 角色",
        "diary": "日记",
    }
    scene_ids = []
    for scene, category in scene_payloads.items():
        response = client.post("/api/creative-works", json={
            "scene": scene, "title": f"{scene} 作品", "category": category,
        })
        check(f"创建 {scene} 场景作品", response.status_code == 200 and response.json()["scene"] == scene, response.text)
        if response.status_code == 200:
            scene_ids.append(response.json()["id"])

    summary = client.get("/api/creative-works/summary")
    check("作品统计覆盖四个场景", summary.status_code == 200 and all(summary.json()["by_scene"][scene] >= 1 for scene in ("game", "literature", "companion", "diary")), summary.text)

    updated = client.patch(f"/api/creative-works/{work_id}", json={
        "title": "星海旧梦 · 第二版",
        "status": "completed",
        "category": "系列作品",
    })
    check("编辑作品状态与分类", updated.status_code == 200 and updated.json()["status"] == "completed", updated.text)
    scene_change = client.patch(f"/api/creative-works/{work_id}", json={"scene": "game"})
    check("作品场景不可切换", scene_change.status_code == 422, scene_change.text)

    bad_scene = client.post("/api/creative-works", json={"scene": "music", "title": "非法"})
    check("非法场景被拒", bad_scene.status_code == 422, bad_scene.text)
    bad_category = client.post("/api/creative-works", json={"scene": "game", "title": "分类错误", "category": "长篇小说"})
    check("跨场景分类被拒", bad_category.status_code == 422, bad_category.text)
    empty_title = client.post("/api/creative-works", json={"scene": "game", "title": "   "})
    check("空标题被拒", empty_title.status_code == 422, empty_title.text)
    bad_world = client.post("/api/creative-works", json={"scene": "game", "title": "坏世界", "world_ids": ["missing-world"]})
    check("不存在世界被拒", bad_world.status_code == 404, bad_world.text)
    bad_character = client.post("/api/creative-works", json={"scene": "diary", "title": "坏人物", "character_ids": ["missing-character"]})
    check("不存在人物被拒", bad_character.status_code == 422, bad_character.text)

    # 其他用户的作品不可见、不可编辑。
    db = SessionLocal()
    other = models.CreativeWork(
        owner_user_id="other-user", scene="game", title="别人的作品",
        status="draft", category="世界观", world_ids=[], character_ids=[], settings={},
    )
    db.add(other)
    db.commit()
    other_id = other.id
    db.close()
    rows = client.get("/api/creative-works").json()
    check("作品按用户隔离", all(row["id"] != other_id for row in rows), rows)
    check("他人作品不可读", client.get(f"/api/creative-works/{other_id}").status_code == 404)
    check("他人作品不可改", client.patch(f"/api/creative-works/{other_id}", json={"title": "篡改"}).status_code == 404)
    check("他人作品不可删", client.delete(f"/api/creative-works/{other_id}").status_code == 404)

    for scene_id in scene_ids:
        client.delete(f"/api/creative-works/{scene_id}")
    deleted = client.delete(f"/api/creative-works/{work_id}")
    check("删除作品", deleted.status_code == 200, deleted.text)
    check("删除后不可读", client.get(f"/api/creative-works/{work_id}").status_code == 404)

    db = SessionLocal()
    db.query(models.CreativeWork).filter(models.CreativeWork.id == other_id).delete()
    db.commit()
    db.close()
    client.delete(f"/api/characters/{cid}")
    client.delete(f"/api/worlds/{wid}")

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
