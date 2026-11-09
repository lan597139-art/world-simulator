"""访客自带 AI Key：请求头隔离与状态回显。"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"


def call(path, headers=None):
    req = urllib.request.Request(BASE + path, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
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

    print(f"\n===== {passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
