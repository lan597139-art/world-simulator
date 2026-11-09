"""归档 / 回收站 / 时光机 / 传记 / 官方演示世界回归。"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"


def call(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    request_headers = {"Content-Type": "application/json"} if data else {}
    request_headers.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=request_headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.status, json.loads(response.read().decode() or "null")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def main():
    passed = failed = 0
    world_id = char_a = char_b = None

    def check(name, condition, detail=""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"PASS {name}")
        else:
            failed += 1
            print(f"FAIL {name} {detail}")

    try:
        code, world = call("POST", "/worlds", {"name": "工作区回归世界", "description": "temp"})
        world_id = world.get("id") if isinstance(world, dict) else None
        check("创建测试世界", code == 200 and world_id, str(world))

        code, char = call("POST", "/characters", {"name": "回归人物甲", "world_id": world_id, "basic_profile": {}})
        char_a = char.get("id") if isinstance(char, dict) else None
        check("创建人物甲", code == 200 and char_a, str(char))

        code, snap = call("POST", f"/worlds/{world_id}/snapshots", {"label": "初始快照"})
        check("创建世界快照", code == 200 and snap.get("entity_count", 0) > 0, str(snap))

        code, char = call("POST", "/characters", {"name": "回归人物乙", "world_id": world_id, "basic_profile": {}})
        char_b = char.get("id") if isinstance(char, dict) else None
        check("创建人物乙", code == 200 and char_b, str(char))

        code, restored = call("POST", f"/worlds/{world_id}/snapshots/{snap['id']}/restore")
        check("一键回滚", code == 200 and restored.get("restored") is True, str(restored))
        code, chars = call("GET", f"/characters?world_id={world_id}")
        ids = {row["id"] for row in chars} if isinstance(chars, list) else set()
        check("回滚后人物乙消失", char_a in ids and char_b not in ids, str(ids))

        code, archived = call("POST", f"/archive/character/{char_a}")
        check("归档人物", code == 200 and archived.get("archived") is True, str(archived))
        code, chars = call("GET", f"/characters?world_id={world_id}")
        check("归档后不出现在人物列表", char_a not in {row["id"] for row in chars}, str(chars))
        code, archive = call("GET", "/archive")
        check("归档库可见", char_a in {row["id"] for row in archive.get("characters", [])}, str(archive))
        code, _ = call("POST", f"/archive/character/{char_a}/restore")
        check("解除归档", code == 200)

        code, trashed = call("DELETE", f"/characters/{char_a}")
        check("删除进入回收站", code == 200 and trashed.get("trashed") is True, str(trashed))
        code, trash = call("GET", "/trash")
        entry = next((row for row in trash if row["entity_id"] == char_a), None) if isinstance(trash, list) else None
        check("回收站可见", entry is not None, str(trash)[:300])
        code, restored = call("POST", f"/trash/{entry['id']}/restore")
        check("回收站复原", code == 200 and restored.get("restored") is True, str(restored))
        code, chars = call("GET", f"/characters?world_id={world_id}")
        check("复原后人物回来", char_a in {row["id"] for row in chars}, str(chars))

        code, story = call("POST", "/writings", {"world_id": world_id, "title": "回归章节", "content": "测试正文"})
        story_id = story.get("id") if isinstance(story, dict) else None
        code, trashed = call("DELETE", f"/writings/{story_id}")
        check("章节进入回收站", code == 200 and trashed.get("trashed") is True, str(trashed))
        code, trash = call("GET", "/trash")
        story_entry = next((row for row in trash if row["entity_id"] == story_id), None) if isinstance(trash, list) else None
        check("章节回收站可见", story_entry is not None)
        code, _ = call("POST", f"/trash/{story_entry['id']}/restore")
        check("章节复原", code == 200)

        code, worlds = call("GET", "/worlds")
        official = next((row for row in worlds if row.get("is_official")), None) if isinstance(worlds, list) else None
        check("官方演示世界存在", official is not None, str(worlds)[:200])
        if official:
            code, detail = call("DELETE", f"/worlds/{official['id']}")
            check("官方世界锁定不可删", code == 409, f"{code} {detail}")

        hero = call("GET", "/characters?world_id=a89474b6-8301-4f35-b819-aa14a8943af0")[1]
        han = next((row for row in hero if row.get("name") == "韩立"), None) if isinstance(hero, list) else None
        if han:
            code, bio = call("GET", f"/characters/{han['id']}/biography")
            check("传记聚合生平", code == 200 and len(bio.get("timeline", [])) > 0, str(bio)[:200])
    finally:
        if world_id:
            call("DELETE", f"/worlds/{world_id}")
            code, trash = call("GET", "/trash")
            for row in trash if isinstance(trash, list) else []:
                if row["entity_id"] == world_id:
                    call("DELETE", f"/trash/{row['id']}")
        print(f"\n===== {passed} passed, {failed} failed")
        return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
