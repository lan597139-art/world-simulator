"""人物运行态冒烟：种子不变、当前态变化、成长日志与状态历史。

运行前需启动后端（127.0.0.1:8000）。
"""

import json
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8000/api"
passed = 0
failed = 0


def call(method, path, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method, headers={"Content-Type": "application/json"}
    )
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


def engines(values):
    return {
        "ovtde": {key: {"val": value} for key, value in values.items()},
        "dominance": {"mode": ["秩序"], "engines": ["O"], "description": "测试"},
    }


def main():
    suffix = uuid.uuid4().hex[:6]
    world_id = character_id = None
    try:
        code, health = call("GET", "/health")
        check("GET /health", code == 200, str(health))

        code, world = call("POST", "/worlds", {"name": f"运行态冒烟-{suffix}"})
        world_id = world.get("id") if world else None
        check("POST /worlds", code == 200 and world_id, str(world))

        code, character = call(
            "POST",
            "/characters",
            {
                "world_id": world_id,
                "name": "成长测试人物",
                "basic_profile": {"name": "成长测试人物"},
                "engines": engines({"V": 70, "O": 60, "D": 50, "E": 40, "T": 30}),
                "defense_mechanisms": {"L2.5": {"actualPerformance": "旧防御"}},
                "reality_conditions": {"PN": {"fields": {"economy": "稳定"}}},
                "thought_imprints": {"imprints": []},
            },
        )
        character_id = character.get("id") if character else None
        check("POST /characters", code == 200 and character_id, str(character))

        code, view = call("GET", f"/characters/{character_id}/runtime")
        check("GET runtime", code == 200 and view["runtime"]["version"] == 0, str(view)[:200])
        check(
            "GET runtime 默认继承种子",
            view["runtime"]["engines"]["ovtde"]["V"]["val"] == 70,
            str(view["runtime"].get("engines")),
        )

        code, saved = call(
            "PUT",
            f"/characters/{character_id}/runtime",
            {
                "engines": engines({"V": 65, "O": 72, "D": 58, "E": 44, "T": 35}),
                "defense_mechanisms": {"L2.5": {"actualPerformance": "经历后更倾向于先审计再防御"}},
                "reality_conditions": {"PN": {"fields": {"economy": "波动"}}},
                "thought_imprints": {"imprints": [{"figure": "旧事"}]},
                "main_color": "O",
                "reason": "经历一次资源危机后，人物更重视秩序与可控性",
                "source_event_ids": [],
            },
        )
        check("PUT runtime", code == 200 and saved["runtime"]["version"] == 1, str(saved)[:300])
        check("成长日志写入", saved["runtime"]["growth_log"][0]["reason"].startswith("经历一次"), str(saved["runtime"]["growth_log"])[:200])
        check("引擎差值写入", saved["entry"]["engine_deltas"].get("O") == 12, str(saved["entry"]["engine_deltas"]))

        code, after = call("GET", f"/characters/{character_id}/runtime")
        check("种子 V 保持 70", after["seed"]["engines"]["ovtde"]["V"]["val"] == 70, str(after["seed"]))
        check("运行态 V 变为 65", after["runtime"]["engines"]["ovtde"]["V"]["val"] == 65, str(after["runtime"]["engines"]))
        check("主色调保存", after["runtime"]["main_color"] == "O", after["runtime"]["main_color"])

        code, histories = call("GET", f"/worlds/{world_id}/histories?entity_type=character&entity_id={character_id}")
        fields = {row["field"] for row in histories} if code == 200 and isinstance(histories, list) else set()
        check("状态历史记录五引擎", "runtime.engines.ovtde.O.val" in fields, str(fields))
        check("状态历史记录主色调", "runtime.main_color" in fields, str(fields))

        code, empty = call(
            "PUT",
            f"/characters/{character_id}/runtime",
            {
                "engines": after["runtime"]["engines"],
                "defense_mechanisms": after["runtime"]["defense_mechanisms"],
                "reality_conditions": after["runtime"]["reality_conditions"],
                "thought_imprints": after["runtime"]["thought_imprints"],
                "main_color": after["runtime"]["main_color"],
                "reason": "没有变化",
                "source_event_ids": [],
            },
        )
        check("无变化不新增日志", code == 200 and empty["runtime"]["version"] == 1, str(empty)[:200])
    finally:
        if character_id:
            call("DELETE", f"/characters/{character_id}")
        if world_id:
            call("DELETE", f"/worlds/{world_id}")
            _, trash = call("GET", "/trash")
            for entry in trash if isinstance(trash, list) else []:
                if entry.get("world_id") == world_id or entry.get("entity_id") == world_id:
                    call("DELETE", f"/trash/{entry['id']}")
        print(f"\n===== {passed} passed, {failed} failed")
        return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
