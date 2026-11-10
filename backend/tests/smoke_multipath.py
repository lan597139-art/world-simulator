"""多路径推演验收测试（进程内 TestClient + AI stub）。

覆盖：方向 CRUD / AI 建议确认 / 分支创建 / 沙盒推演 / 分支隔离 /
节点回溯 / 结局与对比 / 应用分支 / 分支事件隔离 / 六轴 / C_profile。
"""

import json
import uuid

from fastapi.testclient import TestClient

import main
import models
import multipath
from database import SessionLocal

client = TestClient(main.app)

passed = 0
failed = 0


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


def api(method, path, body=None, expect=200):
    response = client.request(method, path, json=body)
    if response.status_code != expect:
        print(f"   {method} {path} -> {response.status_code} {response.text[:300]} (expect {expect})")
    return response


# ---- AI stub -------------------------------------------------------
STUB_STATE = {"quadrant": "敌对"}


def stub_branch(payload):
    return {
        "relationship_changes": [
            {"source_name": "甲", "target_name": "乙", "new_quadrant": STUB_STATE["quadrant"], "reason": "测试原因"}
        ],
        "world_changes": "世界发生了变化：测试",
        "actions": [
            {
                "name": "甲",
                "engine": "O 秩序",
                "engine_label": "O",
                "cognition_reason": "认为被欺骗",
                "action": "当面对质",
                "status": "引发冲突",
            }
        ],
        "memory_deposits": [{"name": "甲", "content": "被乙欺骗"}],
        "state_hint": "D0",
    }


multipath.run_branch_simulation = stub_branch
multipath.run_direction_suggestions = lambda payload: {
    "directions": [
        {
            "name": "AI 建议方向",
            "description": "由 AI 生成的测试方向",
            "trigger_conditions": ["条件"],
            "cognition": {"meaning": "意义", "attribution": "归因", "certainty": 0.5},
            "behavior_output": "行动",
            "reality_resistance": "阻力",
            "direct_result": "结果",
            "future_impacts": ["影响"],
        }
    ]
}

world = api("POST", "/api/worlds", {"name": "多路径验收世界", "type": "fiction", "description": "", "background": ""}).json()
wid = world["id"]

char_a = api("POST", "/api/characters", {"world_id": wid, "name": "甲", "basic_profile": {}}).json()
char_b = api("POST", "/api/characters", {"world_id": wid, "name": "乙", "basic_profile": {}}).json()

api(
    "POST",
    "/api/relationships",
    {
        "world_id": wid,
        "source_id": char_a["id"],
        "target_id": char_b["id"],
        "source_quadrant": "亲密",
        "target_quadrant": "亲密",
        "relation_type": "朋友",
    },
)

event = api(
    "POST",
    "/api/events",
    {
        "world_id": wid,
        "name": "欺骗暴露",
        "description": "甲发现乙长期欺骗自己",
        "polarity": "威胁",
        "intensity": "高",
        "participants": [char_a["id"], char_b["id"]],
    },
).json()

# ---- 方向 ----------------------------------------------------------
d1 = api(
    "POST",
    f"/api/events/{event['id']}/directions",
    {
        "name": "正面对抗",
        "description": "甲当众揭穿乙",
        "trigger_conditions": ["证据确凿"],
        "cognition": {"meaning": "被背叛", "attribution": "乙", "certainty": 0.9},
        "behavior_output": "公开对质",
        "direct_result": "关系破裂",
    },
).json()
check("创建方向", d1.get("name") == "正面对抗" and d1.get("source") == "user", d1)

d2 = api("POST", f"/api/events/{event['id']}/directions", {"name": "隐忍观察"}).json()
directions = api("GET", f"/api/events/{event['id']}/directions").json()
check("方向列表", len(directions) == 2, directions)

dup = api("POST", f"/api/directions/{d1['id']}/duplicate").json()
check("复制方向", "副本" in dup.get("name", ""), dup)

api("POST", f"/api/directions/{dup['id']}/toggle")
directions = api("GET", f"/api/events/{event['id']}/directions").json()
toggled = next(row for row in directions if row["id"] == dup["id"])
check("禁用方向", toggled["enabled"] is False, toggled)

patched = api("PATCH", f"/api/directions/{d2['id']}", {"description": "先观察后行动"}).json()
check("更新方向", patched.get("description") == "先观察后行动", patched)

before_suggest = len(api("GET", f"/api/events/{event['id']}/directions").json())
suggested = api("POST", f"/api/events/{event['id']}/directions/suggest", {"count": 3}).json()
after_suggest = len(api("GET", f"/api/events/{event['id']}/directions").json())
check(
    "AI 建议不落库",
    suggested.get("directions") and before_suggest == after_suggest,
    suggested,
)

confirmed = api(
    "POST",
    f"/api/events/{event['id']}/directions",
    {"name": suggested["directions"][0]["name"], "source": "ai", "confirmed": True},
).json()
check("AI 建议确认后可入库", confirmed.get("source") == "ai_confirmed", confirmed)

api("DELETE", f"/api/directions/{dup['id']}")

# ---- 分支 ----------------------------------------------------------
branch_a = api(
    "POST",
    "/api/branches",
    {"root_event_id": event["id"], "source_direction_id": d1["id"], "name": "分支 A（对抗）"},
).json()
check("创建分支（分叉节点）", branch_a.get("node_count") == 1, branch_a)

branch_b = api(
    "POST",
    "/api/branches",
    {"root_event_id": event["id"], "source_direction_id": d2["id"], "name": "分支 B（隐忍）"},
).json()
check("创建第二分支", branch_b.get("id") != branch_a.get("id"), branch_b)

# ---- 沙盒推演 -------------------------------------------------------
STUB_STATE["quadrant"] = "敌对"
sim = api(
    "POST",
    f"/api/branches/{branch_a['id']}/simulate",
    {"event_id": event["id"], "direction_id": d1["id"]},
).json()
check("分支推演返回", sim.get("applied", {}).get("relationships") == 1 and sim.get("node"), sim)

detail_a = api("GET", f"/api/branches/{branch_a['id']}").json()
check("分支节点推进", detail_a.get("node_count") == 2, detail_a.get("node_count"))

# 主时间线关系未被污染
mainline_rel = SessionLocal()
try:
    row = (
        mainline_rel.query(models.Relationship)
        .filter(models.Relationship.world_id == wid)
        .filter(models.Relationship.source_id == char_a["id"])
        .first()
    )
    mainline_quadrant = row.source_quadrant if row else None
    mainline_events = len(
        mainline_rel.query(models.CharacterEventPerception).filter(models.CharacterEventPerception.world_id == wid).all()
    )
finally:
    mainline_rel.close()
check("主时间线关系未被污染", mainline_quadrant == "亲密", mainline_quadrant)

# ---- 分支隔离 -------------------------------------------------------
STUB_STATE["quadrant"] = "漠视"
api(
    "POST",
    f"/api/branches/{branch_b['id']}/simulate",
    {"event_id": event["id"], "direction_id": d2["id"]},
)

compare = api("POST", "/api/branches/compare", {"branch_ids": [branch_a["id"], branch_b["id"]]}).json()
relations_diff = compare["comparisons"][0]["diff"]["relationships"]
check("分支关系不同", any(item["a"] == "敌对" and item["b"] == "漠视" for item in relations_diff), relations_diff)

# 分支 A 回溯到分叉节点
nodes_a = api("GET", f"/api/branches/{branch_a['id']}/nodes").json()
fork_node = nodes_a[0]
rollback = api(
    "POST",
    f"/api/branches/{branch_a['id']}/rollback",
    {"node_id": fork_node["id"], "reason": "重新选择方向"},
).json()
check("节点回溯", rollback.get("rolled_back_to", {}).get("id") == fork_node["id"], rollback)

compare2 = api("POST", "/api/branches/compare", {"branch_ids": [branch_a["id"], branch_b["id"]]}).json()
check(
    "回溯后 A 回到初始关系",
    all(item["a"] == "亲密" for item in compare2["comparisons"][0]["diff"]["relationships"]),
    compare2["comparisons"][0]["diff"]["relationships"],
)

# ---- 分支内事件隔离 --------------------------------------------------
branch_event = api(
    "POST",
    "/api/events",
    {
        "branch_id": branch_b["id"],
        "name": "乙的补刀",
        "description": "分支内后续事件",
        "polarity": "威胁",
        "intensity": "中",
        "participants": [char_b["id"]],
    },
).json()
check("分支事件创建", branch_event.get("branch_id") == branch_b["id"], branch_event)

mainline_events = api("GET", f"/api/events?world_id={wid}").json()
branch_events = api("GET", f"/api/events?world_id={wid}&branch_id={branch_b['id']}").json()
check(
    "分支事件不泄漏到主时间线",
    all(row["id"] != branch_event["id"] for row in mainline_events)
    and any(row["id"] == branch_event["id"] for row in branch_events),
    (len(mainline_events), len(branch_events)),
)

# 主时间线推演拒绝分支事件
blocked = api("POST", "/api/simulate", {"event_id": branch_event["id"]}, expect=409)
check("主时间线拒绝分支事件", blocked.status_code == 409, blocked.status_code)

# ---- 结局 ----------------------------------------------------------
nodes_b = api("GET", f"/api/branches/{branch_b['id']}/nodes").json()
ending_b = api(
    "POST",
    f"/api/branches/{branch_b['id']}/endings",
    {"node_id": nodes_b[-1]["id"], "name": "结局：决裂", "key_reasons": "欺骗不可原谅"},
).json()
check("创建结局", ending_b.get("name") == "结局：决裂" and ending_b.get("character_final_states"), ending_b)

nodes_a2 = api("GET", f"/api/branches/{branch_a['id']}/nodes").json()
ending_a = api(
    "POST",
    f"/api/branches/{branch_a['id']}/endings",
    {"node_id": nodes_a2[-1]["id"], "name": "结局：和解"},
).json()

endings = api("GET", f"/api/worlds/{wid}/endings").json()
check("结局列表", len(endings) == 2, endings)

ending_compare = api("POST", "/api/endings/compare", {"ending_ids": [ending_a["id"], ending_b["id"]]}).json()
check("结局对比", bool(ending_compare.get("comparisons")), ending_compare)

continued = api("POST", f"/api/endings/{ending_b['id']}/continue", {}).json()
check("从结局继续推演", continued.get("parent_node_id") == nodes_b[-1]["id"], continued)

# ---- 应用分支 -------------------------------------------------------
applied = api("POST", f"/api/branches/{branch_b['id']}/apply", {}).json()
check("应用分支", applied.get("status") == "ok" and applied.get("backup_snapshot"), applied)

db2 = SessionLocal()
try:
    row = (
        db2.query(models.Relationship)
        .filter(models.Relationship.world_id == wid)
        .filter(models.Relationship.source_id == char_a["id"])
        .first()
    )
    applied_quadrant = row.source_quadrant if row else None
    backup = (
        db2.query(models.WorldSnapshot)
        .filter(models.WorldSnapshot.world_id == wid)
        .filter(models.WorldSnapshot.label.like("应用分支前备份%"))
        .count()
    )
finally:
    db2.close()
check("应用后主时间线被覆盖", applied_quadrant == "漠视", applied_quadrant)
check("应用前已写备份快照", backup >= 1, backup)

# ---- 六轴 / C_profile ----------------------------------------------
axis = api(
    "PUT",
    f"/api/worlds/{wid}/six-axis",
    {"six_axis": {"scarcity": 0.8, "threat": 1.4, "status": "0.5"}, "negentropy": 0.2},
).json()
check("六轴写入并裁剪", axis["six_axis"].get("threat") == 1.0 and axis["six_axis"].get("scarcity") == 0.8, axis)

axis_get = api("GET", f"/api/worlds/{wid}/six-axis").json()
check("六轴读取", axis_get["six_axis"].get("scarcity") == 0.8, axis_get)

profile = api(
    "PUT",
    f"/api/characters/{char_a['id']}/c-profile",
    {"c_profile": {"Threat_Defense": {"fight_threshold": 0.3, "flight_threshold": 2}}},
).json()
check("C_profile 写入并裁剪", profile["c_profile"]["Threat_Defense"].get("flight_threshold") == 1.0, profile)

profile_get = api("GET", f"/api/characters/{char_a['id']}/c-profile").json()
check("C_profile 读取", profile_get["c_profile"]["Threat_Defense"].get("fight_threshold") == 0.3, profile_get)

# ---- 清理 ----------------------------------------------------------
db3 = SessionLocal()
try:
    db3.query(models.SimulationEnding).filter(models.SimulationEnding.world_id == wid).delete()
    db3.query(models.SimulationBranchNode).filter(models.SimulationBranchNode.world_id == wid).delete()
    db3.query(models.SimulationBranch).filter(models.SimulationBranch.world_id == wid).delete()
    db3.query(models.SimulationDirection).filter(models.SimulationDirection.world_id == wid).delete()
    db3.query(models.SimulationRun).filter(models.SimulationRun.world_id == wid).delete()
    db3.query(models.Event).filter(models.Event.world_id == wid).delete()
    db3.query(models.Relationship).filter(models.Relationship.world_id == wid).delete()
    db3.query(models.Character).filter(models.Character.world_id == wid).delete()
    db3.query(models.WorldSnapshot).filter(models.WorldSnapshot.world_id == wid).delete()
    db3.query(models.WorldSettings).filter(models.WorldSettings.world_id == wid).delete()
    db3.query(models.World).filter(models.World.id == wid).delete()
    db3.commit()
finally:
    db3.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
