import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"
results = []


def call(method, path, body=None, expect=200):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.status
            payload = resp.read().decode()
    except urllib.error.HTTPError as exc:
        code = exc.code
        payload = exc.read().decode()
    try:
        parsed = json.loads(payload) if payload else None
    except ValueError:
        parsed = payload
    ok = code == expect
    results.append((ok, method, path, code, parsed))
    print(("PASS" if ok else "FAIL"), method, path, code)
    if not ok:
        print("   expect", expect, "got", code, parsed)
    return parsed, code


world, _ = call("POST", "/worlds", {"name": "验收世界", "description": "", "type": "fiction", "background": ""})
wid = world["id"]

nodes, _ = call("GET", f"/worlds/{wid}/nodes")
assert len(nodes) == 8, nodes
types, _ = call("GET", f"/worlds/{wid}/location-types")
assert len(types) >= 10

cn, _ = call("POST", "/locations", {"world_id": wid, "name": "华国", "location_type_id": "lt-country"})
prov, _ = call("POST", "/locations", {"world_id": wid, "name": "北方省", "location_type_id": "lt-province", "parent_location_id": cn["id"]})
city, _ = call("POST", "/locations", {"world_id": wid, "name": "明山市", "location_type_id": "lt-city", "parent_location_id": prov["id"]})
dist, _ = call("POST", "/locations", {"world_id": wid, "name": "中央城区", "location_type_id": "lt-district", "parent_location_id": city["id"]})

# 类型白名单：城市不能挂在城区下
call("POST", "/locations", {"world_id": wid, "name": "错误城市", "location_type_id": "lt-city", "parent_location_id": dist["id"]}, expect=409)
# 环检测
call("POST", f"/locations/{city['id']}/move", {"parent_location_id": dist["id"]}, expect=409)
# 正常移动 + 历史（城市可直接挂在国家下）
call("POST", f"/locations/{city['id']}/move", {"parent_location_id": cn["id"]})
hist, _ = call("GET", f"/worlds/{wid}/histories?entity_type=location&entity_id={city['id']}")
assert any(h["field"] == "parent_location_id" for h in hist), hist

# 有子节点不能删
call("DELETE", f"/locations/{cn['id']}", expect=409)

org, _ = call("POST", "/organizations", {"world_id": wid, "name": "星河集团", "organization_type": "company", "headquarters_location_id": dist["id"]})
unit1, _ = call("POST", "/organization-units", {"world_id": wid, "organization_id": org["id"], "name": "市场部"})
unit2, _ = call("POST", "/organization-units", {"world_id": wid, "organization_id": org["id"], "name": "财务部"})
pos, _ = call("POST", "/organization-positions", {"world_id": wid, "unit_id": unit1["id"], "name": "市场主管"})

# 目录节点绑定实体（entity_ref）
n1, _ = call("POST", f"/worlds/{wid}/nodes", {"name": "首都", "branch": "geography", "node_type": "entity_ref", "ref_type": "location", "ref_id": cn["id"]})
assert n1["ref_type"] == "location" and n1["ref_id"] == cn["id"], n1
call("PATCH", f"/nodes/{n1['id']}", {"ref_type": "organization", "ref_id": org["id"]})
nodes_geo, _ = call("GET", f"/worlds/{wid}/nodes?branch=geography")
bound = [n for n in nodes_geo if n["id"] == n1["id"]][0]
assert bound["ref_type"] == "organization" and bound["ref_id"] == org["id"], bound
# 非法引用类型
call("PATCH", f"/nodes/{n1['id']}", {"ref_type": "spaceship", "ref_id": "x"}, expect=422)
# 解除绑定
call("PATCH", f"/nodes/{n1['id']}", {"node_type": "folder", "ref_type": None, "ref_id": None})
nodes_geo, _ = call("GET", f"/worlds/{wid}/nodes?branch=geography")
unbound = [n for n in nodes_geo if n["id"] == n1["id"]][0]
assert unbound["node_type"] == "folder" and unbound["ref_id"] is None, unbound
# 有子节点的目录节点不能直接删
root_id = nodes_geo[0]["id"]
call("POST", f"/worlds/{wid}/nodes", {"name": "子目录", "branch": "geography", "parent_id": root_id})
call("DELETE", f"/nodes/{root_id}", expect=409)

boss, _ = call("POST", "/characters", {"world_id": wid, "name": "老板"})
emp, _ = call("POST", "/characters", {"world_id": wid, "name": "员工甲"})

appt, _ = call("POST", "/appointments", {"world_id": wid, "character_id": emp["id"], "position_id": pos["id"]})
call("PATCH", f"/appointments/{appt['id']}/end", {"reason": "离职"})
tree, _ = call("GET", f"/organizations/{org['id']}/tree")
assert tree["organization"]["name"] == "星河集团" and len(tree["units"]) == 2

rel, _ = call("POST", "/relationships", {"world_id": wid, "source_type": "character", "source_id": boss["id"], "target_type": "organization", "target_id": org["id"], "relation_type": "控制"})
call("PATCH", f"/relationships/{rel['id']}", {"status": "strained"})
rh, _ = call("GET", f"/relationships/{rel['id']}/history")
assert len(rh) >= 2, rh
# 跨世界
call("POST", "/relationships", {"world_id": wid, "source_id": boss["id"], "target_id": "nonexistent", "relation_type": "信任"}, expect=404)

rule, _ = call("POST", f"/worlds/{wid}/rules", {"name": "预算审批制度", "rule_category": "economic", "description": "超过额度需审批", "scopes": [{"scope_type": "organization", "scope_id": org["id"]}]})
apply_rules, _ = call("GET", f"/worlds/{wid}/rules/applicable?scope_type=organization&scope_id={org['id']}")
assert len(apply_rules) == 1

rtype = [t for t in call("GET", f"/worlds/{wid}/resource-types")[0] if t["category"] == "financial"][0]
res, _ = call("POST", f"/worlds/{wid}/resources", {"name": "营销预算", "resource_type_id": rtype["id"], "quantity": 100, "unit": "万元"})
h1, _ = call("POST", "/resource-holdings", {"world_id": wid, "resource_id": res["id"], "holder_type": "organization", "holder_id": org["id"], "role": "holder"})
h2, _ = call("POST", "/resource-holdings", {"world_id": wid, "resource_id": res["id"], "holder_type": "organization_unit", "holder_id": unit2["id"], "role": "manager"})
h3, _ = call("POST", "/resource-holdings", {"world_id": wid, "resource_id": res["id"], "holder_type": "organization_unit", "holder_id": unit1["id"], "role": "user"})
tx, _ = call("POST", "/resource-transactions", {"world_id": wid, "resource_id": res["id"], "amount": -20, "reason": "市场投放"})
assert abs(tx["quantity"] - 80) < 1e-6, tx

# 时间：手动推进 + 实时模式
ts, _ = call("GET", f"/worlds/{wid}/time-settings")
call("POST", f"/worlds/{wid}/time/advance", {"days": 3})
call("PUT", f"/worlds/{wid}/time-settings", {"time_mode": "realtime", "real_seconds_per_world_day": 60})
ts2, _ = call("GET", f"/worlds/{wid}/time-settings")
assert ts2["time_mode"] == "realtime"

# 事件参与方
ev, _ = call("POST", "/events", {"world_id": wid, "name": "预算会议", "participants": [emp["id"]], "location_id": dist["id"]})
links, _ = call("GET", f"/events/{ev['id']}/entities")
assert len(links) == 2, links

# 世界切换隔离
world2, _ = call("POST", "/worlds", {"name": "隔离世界B", "description": "", "type": "fiction", "background": ""})
loc2, _ = call("GET", f"/worlds/{world2['id']}/locations")
assert loc2 == [], loc2
# 跨世界父节点
call("POST", "/locations", {"world_id": world2["id"], "name": "越界地点", "parent_location_id": cn["id"]}, expect=409)

# --- 关系类型配置与端点校验 ---
types, _ = call("GET", f"/worlds/{wid}/relationship-types")
assert types["total"] >= 40, types["total"]
# 人物 → 人物 不允许用「总部位于」（组织→地点）
call("POST", "/relationships", {"world_id": wid, "source_type": "character", "source_id": boss["id"], "target_type": "character", "target_id": emp["id"], "relation_type": "总部位于"}, expect=409)

# --- 事件参与者 / 影响对象 ---
ev2, _ = call("POST", "/events", {"world_id": wid, "name": "预算削减", "occurred_at": "2026-01-02T10:00:00"})
call("POST", f"/events/{ev['id']}/participants", {"entity_type": "character", "entity_id": emp["id"], "participant_role": "发起者"})
call("POST", f"/events/{ev['id']}/participants", {"entity_type": "organization", "entity_id": org["id"], "participant_role": "决策者"})
parts, _ = call("GET", f"/events/{ev['id']}/participants")
roles = {p["participant_role"] for p in parts if p["participant_role"]}
assert {"发起者", "决策者"} <= roles, roles
call("POST", f"/events/{ev2['id']}/impacts", {"entity_type": "organization", "entity_id": org["id"], "impact_type": "损失", "impact_level": "高"})
impacts, _ = call("GET", f"/events/{ev2['id']}/impacts")
assert len(impacts) == 1, impacts

# --- 事件因果 ---
rel_e, _ = call("POST", "/event-relations", {"world_id": wid, "source_event_id": ev["id"], "target_event_id": ev2["id"], "relation_type": "causes", "confidence": 0.8})
call("POST", "/event-relations", {"world_id": wid, "source_event_id": ev["id"], "target_event_id": ev2["id"], "relation_type": "causes"}, expect=409)
call("POST", "/event-relations", {"world_id": wid, "source_event_id": ev["id"], "target_event_id": ev["id"], "relation_type": "causes"}, expect=422)
rels, _ = call("GET", f"/worlds/{wid}/event-relations?event_id={ev['id']}")
assert len(rels) == 1, rels

# --- 人物事件认知 ---
call("POST", f"/events/{ev['id']}/perceptions", {"character_id": emp["id"], "perceived_content": "认为是针对自己", "certainty": 0.6, "attribution_target": boss["id"]})
perceptions, _ = call("GET", f"/events/{ev['id']}/perceptions")
assert len(perceptions) == 1, perceptions

# --- 统一时间线 ---
tl, _ = call("GET", f"/worlds/{wid}/timeline?scope=character&entity_id={emp['id']}")
kinds = {item["kind"] for item in tl["items"]}
assert "event" in kinds and "history" in kinds, kinds
tl_world, _ = call("GET", f"/worlds/{wid}/timeline")
assert tl_world["counts"]["event"] >= 2 and tl_world["counts"]["history"] >= 1, tl_world["counts"]

# --- 组织架构编辑：改名 / 移动部门 / 职位调整 / 任职时间 ---
org_edited, _ = call("PATCH", f"/organizations/{org['id']}", {"name": "星河控股", "status": "expanding"})
assert org_edited["name"] == "星河控股" and org_edited["status"] == "expanding", org_edited
unit_edited, _ = call("PATCH", f"/organization-units/{unit1['id']}", {"name": "市场中心", "unit_type": "department"})
assert unit_edited["name"] == "市场中心", unit_edited
# 移动部门：财务部挂到市场部下
moved, _ = call("PATCH", f"/organization-units/{unit2['id']}", {"parent_unit_id": unit1['id']})
assert moved["parent_unit_id"] == unit1['id'], moved
# 环检测：市场部不能移动到自己的下级财务部下
call("PATCH", f"/organization-units/{unit1['id']}", {"parent_unit_id": unit2['id']}, expect=409)
# 职位改名与职级
pos_edited, _ = call("PATCH", f"/organization-positions/{pos['id']}", {"name": "市场总监", "position_level": "P7"})
assert pos_edited["name"] == "市场总监", pos_edited
# 任职指定开始与结束时间
appt2, _ = call("POST", "/appointments", {"world_id": wid, "character_id": emp["id"], "position_id": pos['id'], "start_time": "2026-02-01 09:00:00"})
ended, _ = call("PATCH", f"/appointments/{appt2['id']}/end", {"end_time": "2026-03-01 18:00:00", "reason": "调整任职"})
assert ended["appointment_status"] == "ended", ended
# 有任职历史的职位不能直接删除
call("DELETE", f"/organization-positions/{pos['id']}", expect=409)

# --- 关系状态与有效期：结束关系保留历史 ---
rel_ended, _ = call("PATCH", f"/relationships/{rel['id']}", {"status": "ended", "valid_until": "2026-03-02 00:00:00"})
assert rel_ended["status"] == "ended" and rel_ended["valid_until"], rel_ended
rh2, _ = call("GET", f"/relationships/{rel['id']}/history")
assert any(h["new_status"] == "ended" for h in rh2), rh2
kept, _ = call("GET", f"/worlds/{wid}/relationships")
assert any(r["id"] == rel['id'] and r["status"] == "ended" for r in kept), kept
# 已结束关系不能直接恢复
call("PUT", f"/relationships/{rel['id']}", {"status": "active"}, expect=409)
# 有方向的关系不会自动生成反向记录
rel3, _ = call("POST", "/relationships", {"world_id": wid, "source_type": "character", "source_id": boss['id'], "target_type": "character", "target_id": emp['id'], "relation_type": "信任"})
all_rel, _ = call("GET", f"/worlds/{wid}/relationships")
assert not any(
    r["source_id"] == emp['id'] and r["target_id"] == boss['id'] and r["relation_type"] == "信任"
    for r in all_rel
), all_rel

# --- 时间线四个范围都可读取 ---
for scope, eid in (("character", emp['id']), ("organization", org['id']), ("location", dist['id']), ("resource", res['id'])):
    tl_scope, _ = call("GET", f"/worlds/{wid}/timeline?scope={scope}&entity_id={eid}")
    assert "items" in tl_scope and "counts" in tl_scope, (scope, tl_scope)

# --- 人物认知：同一人物同一事件为覆盖更新，可删除 ---
p2, _ = call("POST", f"/events/{ev['id']}/perceptions", {"character_id": emp["id"], "perceived_content": "改口：并不针对自己", "certainty": 0.9})
perceptions2, _ = call("GET", f"/events/{ev['id']}/perceptions")
assert len(perceptions2) == 1 and perceptions2[0]["certainty"] == 0.9, perceptions2
call("DELETE", f"/perceptions/{p2['id']}")
perceptions3, _ = call("GET", f"/events/{ev['id']}/perceptions")
assert perceptions3 == [], perceptions3

# --- 引用检查：删除被引用实体必须 409 ---
loc_leaf, _ = call("POST", "/locations", {"world_id": wid, "name": "测试房间", "location_type_id": "lt-room"})
node_ref, _ = call("POST", f"/worlds/{wid}/nodes", {"name": "房间节点", "branch": "geography", "node_type": "entity_ref", "ref_type": "location", "ref_id": loc_leaf["id"]})
call("DELETE", f"/locations/{loc_leaf['id']}", expect=409)
call("DELETE", f"/nodes/{node_ref['id']}")
call("DELETE", f"/locations/{loc_leaf['id']}")

# 人物被关系引用时不能删
call("DELETE", f"/characters/{boss['id']}", expect=409)
call("DELETE", f"/relationships/{rel['id']}")
call("DELETE", f"/relationships/{rel3['id']}")
call("DELETE", f"/characters/{boss['id']}")
# 组织被部门/任职引用时不能删
call("DELETE", f"/organizations/{org['id']}", expect=409)

# 清理
call("DELETE", f"/worlds/{wid}")
call("DELETE", f"/worlds/{world2['id']}")
call("GET", f"/worlds/{wid}", expect=404)

failed = [r for r in results if not r[0]]
print("\n=====", len(results) - len(failed), "passed,", len(failed), "failed")
for f in failed:
    print(f)
