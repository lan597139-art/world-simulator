"""写作工作台接口冒烟：章节 CRUD、解析提取、草稿入库。

运行前需启动后端（127.0.0.1:8000）。
"""

import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8000/api"
passed = 0
failed = 0


def call(method, path, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    merged = {"Content-Type": "application/json"}
    merged.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=merged)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, json.loads(raw) if raw else None


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {label}")
    else:
        failed += 1
        print(f"FAIL {label} {detail}")


def main():
    suffix = uuid.uuid4().hex[:6]
    world_id = story_id = character_id = None
    try:
        code, health = call("GET", "/health")
        check("GET /health", code == 200 and health.get("status") == "ok", str(health))

        code, world = call(
            "POST", "/worlds", {"name": f"写作冒烟-{suffix}", "type": "fiction", "description": "test"}
        )
        check("POST /worlds", code == 200 and world.get("id"), str(world))
        world_id = world["id"]

        code, story = call(
            "POST",
            "/writings",
            {
                "world_id": world_id,
                "title": "第一章 雨夜",
                "mode": "explorer",
                "content": "<p>雨落在青石板上。沈砚说道：“别回头。”</p><p>他来到废弃的驿站。</p>",
            },
        )
        check("POST /writings", code == 200 and story.get("word_count", 0) > 0, str(story))
        story_id = story["id"]

        code, rows = call("GET", f"/writings?world_id={world_id}")
        check("GET /writings 按世界过滤", code == 200 and any(r["id"] == story_id for r in rows))

        code, updated = call("PATCH", f"/writings/{story_id}", {"title": "第一章 雨夜（修）"})
        check("PATCH /writings 自动保存字段", code == 200 and updated["title"].endswith("（修）"))

        code, result = call("POST", f"/writings/{story_id}/analyze", {})
        check("POST analyze 返回草稿", code == 200 and result.get("count", 0) >= 2, str(result))
        drafts = result.get("drafts", [])
        names = {(d["entity_type"], d["name"]) for d in drafts}
        check("解析出人物", ("character", "沈砚") in names, str(names))
        check("解析出地点", any(entity_type == "location" for entity_type, _ in names), str(names))

        code, listed = call("GET", f"/writings/{story_id}/drafts?status=pending")
        check("GET 本章草稿", code == 200 and len(listed) == len(drafts))

        char_draft = next(d for d in drafts if d["entity_type"] == "character")
        code, approved = call("POST", f"/drafts/{char_draft['id']}/approve", {})
        check("POST 草稿入库人物", code == 200 and approved.get("entity_id"), str(approved))
        check("入库响应说明目标库", approved.get("target_label") == "人物库", str(approved))
        character_id = approved.get("entity_id")

        code, character = call("GET", f"/characters/{character_id}")
        check("入库人物可读取", code == 200 and character["name"] == "沈砚")

        code, nodes = call("GET", f"/worlds/{world_id}/nodes?branch=people_groups")
        check(
            "入库人物挂到人物与群体目录",
            code == 200 and any(n.get("ref_id") == character_id for n in nodes),
        )

        code, world_drafts = call("GET", f"/worlds/{world_id}/drafts?status=all")
        check(
            "草稿箱保留已入库状态",
            code == 200 and any(d["status"] == "accepted" for d in world_drafts),
        )

        code, _ = call("DELETE", f"/characters/{character_id}")
        check("DELETE 人物不被自身目录节点阻塞", code == 200)
        code, nodes = call("GET", f"/worlds/{world_id}/nodes?branch=people_groups")
        check("删除人物后目录节点清理", code == 200 and not any(n.get("ref_id") == character_id for n in nodes))

        code, undone = call("POST", f"/drafts/{char_draft['id']}/undo")
        check("POST 撤销入库", code == 200, str(undone))
        code, _ = call("GET", f"/characters/{character_id}")
        check("撤销后错误实体已删除", code == 404)
        code, world_drafts = call("GET", f"/worlds/{world_id}/drafts?status=all")
        restored = next((d for d in world_drafts if d["id"] == char_draft["id"]), None)
        check("撤销后草稿退回待入库", bool(restored) and restored["status"] == "pending", str(restored))

        other = next(d for d in drafts if d["entity_type"] != "character")
        code, _ = call("POST", f"/drafts/{other['id']}/ignore")
        check("POST 忽略草稿", code == 200)

        # --- 可选多路径创作（阶段 F1）---
        code, source_event = call(
            "POST",
            "/events",
            {"world_id": world_id, "name": "分支素材事件", "description": "用于写作分支校验", "polarity": "威胁", "intensity": "中"},
        )
        check("创建分支素材事件", code == 200 and source_event.get("id"), str(source_event))
        source_event_id = source_event["id"]

        code, branch = call("POST", "/branches", {"root_event_id": source_event_id, "name": "写作支线"})
        check("创建写作分支", code == 200 and branch.get("id"), str(branch))
        branch_id = branch["id"]

        code, _ = call("POST", "/writing/generate", {"world_id": world_id, "branch_id": "missing-branch"})
        check("未知分支写作 404", code == 404, str(_))

        code, empty = call("POST", "/writing/generate", {"world_id": world_id, "branch_id": branch_id})
        check("分支无事件时 422 而不是空写", code == 422, str(empty))

        bogus = {"X-AI-API-Key": "sk-invalid-for-smoke", "X-AI-Base-URL": "https://api.siliconflow.cn/v1"}
        code, _ = call("POST", "/writing/assist", {"action": "polish", "text": "测试文本"}, headers=bogus)
        check("08 AI 建流失败返回 502", code == 502, str(_))

        code, _ = call("POST", "/writing/generate", {"world_id": world_id}, headers=bogus)
        check("08 正文生成建流失败返回 502", code == 502, str(_))

        code, _ = call("DELETE", f"/branches/{branch_id}")
        code, archived = call("POST", "/writing/generate", {"world_id": world_id, "branch_id": branch_id})
        check("已归档分支写作 409", code == 409, str(archived))

        code, _ = call("DELETE", f"/writings/{story_id}")
        check("DELETE /writings", code == 200)
        story_id = None

        code, _ = call("GET", f"/writings/{story['id']}")
        check("删除章节后 404", code == 404)
    finally:
        if story_id:
            call("DELETE", f"/writings/{story_id}")
        if world_id:
            call("DELETE", f"/worlds/{world_id}")
            _, trash = call("GET", "/trash")
            for entry in trash if isinstance(trash, list) else []:
                if entry.get("world_id") == world_id or entry.get("entity_id") == world_id:
                    call("DELETE", f"/trash/{entry['id']}")

    print(f"\n===== {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
