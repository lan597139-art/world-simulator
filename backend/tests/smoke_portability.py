"""世界包导入：ID 重映射、父子地点、资源持有与故事线。"""

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


def main_test():
    db = SessionLocal()
    user = models.AppUser(username=f"pack-{suffix}", display_name="导入验收", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    login = client.post("/api/auth/login", json={"username": user.username, "password": "password-123"})
    headers = {"Authorization": f"Bearer {login.json()['token']}"}

    ids = {key: str(uuid.uuid4()) for key in (
        "world", "parent_location", "child_location", "character", "organization",
        "event", "story", "story_project", "thread", "resource_type", "resource",
    )}
    payload = {
        "format": "world-simulator/world",
        "version": 1,
        "target_product": "game",
        "world": {"id": ids["world"], "name": f"迁移世界 {suffix}", "description": "导入测试", "type": "fiction", "product_scene": "game"},
        "locations": [
            {"id": ids["parent_location"], "name": "天南", "x": 50, "y": 50, "sort_order": 1},
            {"id": ids["child_location"], "name": "七玄门", "parent_location_id": ids["parent_location"], "x": 50, "y": 50, "sort_order": 2},
        ],
        "characters": [{"id": ids["character"], "name": "韩立", "basic_profile": {"gender": "男"}}],
        "organizations": [{"id": ids["organization"], "name": "七玄门", "headquarters_location_id": ids["child_location"]}],
        "events": [{"id": ids["event"], "name": "入门", "participants": [ids["character"]], "location_id": ids["child_location"], "organization_id": ids["organization"]}],
        "relationships": [{"id": str(uuid.uuid4()), "source_id": ids["character"], "target_id": ids["organization"], "source_type": "character", "target_type": "organization", "relation_type": "成员"}],
        "resource_types": [{"id": ids["resource_type"], "name": "灵药", "category": "material", "unit": "株"}],
        "resources": [{"id": ids["resource"], "name": "百年黄精", "resource_type_id": ids["resource_type"], "quantity": 9, "location_id": ids["child_location"]}],
        "resource_holdings": [{"id": str(uuid.uuid4()), "resource_id": ids["resource"], "holder_type": "character", "holder_id": ids["character"], "role": "holder"}],
        "stories": [{"id": ids["story"], "title": "第一章", "content": "山门", "sort_order": 1}],
        "story_projects": [{"id": ids["story_project"], "title": "主线故事", "premise": "山门"}],
        "story_threads": [{"id": ids["thread"], "story_id": ids["story_project"], "title": "主线", "kind": "main", "order_index": 1}],
        "story_thread_events": [{"id": str(uuid.uuid4()), "thread_id": ids["thread"], "event_id": ids["event"], "order_index": 1}],
    }

    imported = client.post("/api/worlds/import", headers=headers, json=payload)
    body = imported.json() if imported.status_code == 200 else {}
    world_id = body.get("world_id")
    check("世界包导入成功", imported.status_code == 200 and bool(world_id), imported.text[:400])
    check("导入计数完整", body.get("counts") == {"characters": 1, "events": 1, "relationships": 1, "locations": 2, "organizations": 1, "stories": 1, "story_projects": 1, "resources": 1}, body.get("counts"))

    locations = client.get(f"/api/worlds/{world_id}/locations", headers=headers).json()
    by_name = {row["name"]: row for row in locations if isinstance(row, dict)}
    check("地点全部迁移", len(locations) == 2)
    check("地点父子 ID 重映射", by_name["七玄门"]["parent_location_id"] == by_name["天南"]["id"], by_name)

    characters = client.get(f"/api/worlds/{world_id}/characters", headers=headers).json()
    organizations = client.get(f"/api/worlds/{world_id}/organizations", headers=headers).json()
    relationships = client.get(f"/api/worlds/{world_id}/relationships", headers=headers).json()
    check("人物迁移并改归属", len(characters) == 1 and characters[0]["name"] == "韩立")
    check("组织总部指向新地点", organizations[0]["headquarters_location_id"] == by_name["七玄门"]["id"])
    check("关系端点指向新人物/组织", relationships[0]["source_id"] == characters[0]["id"] and relationships[0]["target_id"] == organizations[0]["id"])

    events = client.get(f"/api/events?world_id={world_id}", headers=headers).json()
    check("事件参与者重映射", events[0]["participants"] == [characters[0]["id"]], events[0].get("participants"))
    check("事件地点重映射", events[0]["location_id"] == by_name["七玄门"]["id"])

    resources = client.get(f"/api/worlds/{world_id}/resources", headers=headers).json()
    holdings = client.get(f"/api/worlds/{world_id}/resource-holdings", headers=headers).json()
    check("资源与类型迁移", len(resources) == 1 and resources[0]["name"] == "百年黄精")
    check("资源持有指向新人物", len(holdings) == 1 and holdings[0]["holder_id"] == characters[0]["id"], holdings)

    projects = client.get(f"/api/worlds/{world_id}/stories", headers=headers).json()
    project_id = projects[0]["id"] if projects else ""
    thread_response = client.get(f"/api/stories/{project_id}/threads", headers=headers) if project_id else None
    threads = thread_response.json() if thread_response else []
    check("故事线迁移", isinstance(threads, list) and len(threads) == 1 and len(threads[0].get("events") or []) == 1, {"status": thread_response.status_code if thread_response else None, "body": str(threads)[:400]})

    export = client.get(f"/api/worlds/{world_id}/export", headers=headers)
    check("导入后可再次导出", export.status_code == 200 and export.json().get("counts", {}).get("characters") == 1)

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
