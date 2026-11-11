"""第一阶段的真实模型调用证据（需有效 AI Key；不进 CI）。

覆盖 07：/api/simulate、/api/events/{id}/directions/suggest
覆盖 08：/api/writing/generate、/api/writing/assist
每种能力至少两个模型，记录状态码、耗时、输出长度与样本。
"""

import json
import os
import time

import httpx
from dotenv import load_dotenv

BASE = "http://127.0.0.1:8000"
MODELS = ["deepseek-ai/DeepSeek-V3.2", "deepseek-ai/DeepSeek-V4-Flash"]
load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY", "")


def call(model, method, path, payload=None, stream=False):
    headers = {"X-AI-Model": model, "X-AI-API-Key": API_KEY}
    started = time.time()
    with httpx.Client(timeout=240) as client:
        with client.stream(method, f"{BASE}{path}", json=payload, headers=headers) as response:
            raw = "".join(response.iter_text()) if stream else response.read().decode("utf-8")
            status = response.status_code
    text = raw
    if not stream:
        try:
            body = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            body = raw
        if isinstance(body, dict):
            text = body.get("text") if isinstance(body.get("text"), str) else json.dumps(body, ensure_ascii=False)
    return {
        "model": model, "path": path, "status": status,
        "seconds": round(time.time() - started, 2), "chars": len(text or ""),
        "sample": (text or "")[:180], "error": None if status == 200 else (text or "")[:300],
    }


def main():
    results = []
    world = httpx.post(f"{BASE}/api/worlds", json={"name": "AI矩阵临时世界", "type": "fiction"}).json()
    wid = world["id"]
    a = httpx.post(f"{BASE}/api/characters", json={"world_id": wid, "name": "甲"}).json()
    b = httpx.post(f"{BASE}/api/characters", json={"world_id": wid, "name": "乙"}).json()
    event = httpx.post(f"{BASE}/api/events", json={
        "world_id": wid, "name": "临时事件", "description": "两人在雨夜见面。",
        "participants": [a["id"], b["id"]], "polarity": "neutral", "intensity": 50,
    }).json()
    try:
        for model in MODELS:
            results.append(call(model, "GET", "/api/ai/status"))
            results.append(call(model, "POST", "/api/simulate", {
                "event_id": event["id"], "direction": "只写一句后果", "perspective": "第三人称",
            }))
            results.append(call(model, "POST", f"/api/events/{event['id']}/directions/suggest", {}))
            results.append(call(model, "POST", "/api/writing/generate", {
                "world_id": wid, "event_ids": [event["id"]],
                "user_direction": "用两句话写这个场景", "perspective": "第三人称",
            }))
            results.append(call(model, "POST", "/api/writing/assist", {
                "action": "polish", "text": "他走进房间，看见了她。",
            }, stream=True))
    finally:
        httpx.delete(f"{BASE}/api/worlds/{wid}")
    passed = [r for r in results if r["status"] == 200 and r["chars"] > 0]
    print(json.dumps({"passed": len(passed), "total": len(results), "results": results}, ensure_ascii=False, indent=2))
    return 0 if len(passed) == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
