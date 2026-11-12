"""访客自带 AI Key：请求头隔离与状态回显。"""
import json
import sys
import urllib.error
import urllib.request

from live_auth import auth_headers

BASE = "http://127.0.0.1:8000/api"


def call(path, headers=None, body=None, method="GET"):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, headers=auth_headers(headers), data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=150) as response:
            return response.status, json.loads(response.read().decode() or "null")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def main():
    passed = failed = 0

    def check(name, condition, detail=""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"PASS {name}")
        else:
            failed += 1
            print(f"FAIL {name} {detail}")

    code, status = call("/ai/status")
    check("GET /ai/status", code == 200 and isinstance(status, dict), str(status))
    check("默认不使用访客 Key", status.get("using_personal_key") is False, str(status))

    code, personal = call(
        "/ai/status",
        {
            "X-AI-API-Key": "sk-visitor-test-1234567890",
            "X-AI-Base-URL": "https://api.siliconflow.cn/v1",
            "X-AI-Model": "deepseek-ai/DeepSeek-V4.1-Flash",
        },
    )
    check("访客 Key 被识别", code == 200 and personal.get("using_personal_key") is True, str(personal))
    check("访客模型生效", personal.get("model") == "deepseek-ai/DeepSeek-V4.1-Flash", str(personal))
    check("不返回完整 Key", personal.get("key_hint") == "sk-v…7890", str(personal))

    code, shared_model = call("/ai/status", {"X-AI-Model": "deepseek-ai/DeepSeek-V4.1-Flash"})
    check(
        "共享 Key 下模型头生效",
        code == 200 and shared_model.get("model") == "deepseek-ai/DeepSeek-V4.1-Flash"
        and shared_model.get("using_personal_key") is False,
        str(shared_model),
    )

    bogus = {"X-AI-API-Key": "sk-invalid-for-smoke", "X-AI-Base-URL": "https://api.siliconflow.cn/v1"}
    code, worlds = call("/worlds")
    world_id = None
    event_id = None
    if isinstance(worlds, list):
        # 云宝工作空间可能排在列表前面且没有事件；选择第一个有事件的世界。
        for world in worlds:
            if world.get("archived_at"):
                continue
            _, events = call(f"/events?world_id={world['id']}")
            candidate = next((e["id"] for e in events if not e.get("branch_id")), None) if isinstance(events, list) else None
            if candidate:
                world_id, event_id = world["id"], candidate
                break
    if event_id:
        code, body = call("/simulate", bogus, {"event_id": event_id}, "POST")
        check("07 AI 失败统一返回 502", code == 502, str(body))
    else:
        check("07 AI 失败统一返回 502", False, "无事件可测")

    code, body = call("/writing/assist", bogus, {"action": "polish", "text": "测试文本"}, "POST")
    check("08 AI 失败统一返回 502", code == 502, str(body))

    print(f"\n===== {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
