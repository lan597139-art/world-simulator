"""故事线管理验收测试（进程内 TestClient，无 AI 调用）。

覆盖：故事 CRUD / 原始空间 / 分叉空间与分支绑定 / 结构单元 / 事件作用域 /
选择节点与选项 / 结局与导入 / 空间对比 / 回溯 / 归档 / 世界级联清理。
"""

import uuid

from fastapi.testclient import TestClient

import main
import models
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


suffix = uuid.uuid4().hex[:6]
world = api("POST", "/api/worlds", {"name": f"故事线-{suffix}", "type": "fiction", "description": "test"}).json()
wid = world["id"]
char = api("POST", "/api/characters", {"world_id": wid, "name": "甲", "basic_profile": {"name": "甲"}}).json()
e1 = api("POST", "/api/events", {"world_id": wid, "name": "开端", "description": "故事开始", "polarity": "稳定", "intensity": "中", "participants": [char["id"]]}).json()
e2 = api("POST", "/api/events", {"world_id": wid, "name": "抉择前夜", "description": "关键选择前", "polarity": "威胁", "intensity": "高", "participants": [char["id"]]}).json()
e3 = api("POST", "/api/events", {"world_id": wid, "name": "另一条路", "description": "分支事件", "polarity": "扩张", "intensity": "中", "participants": [char["id"]]}).json()

# ---- 故事 -----------------------------------------------------------
story = api("POST", "/api/stories", {"world_id": wid, "title": "测试故事", "premise": "一个用于验收的故事"}).json()
check("创建故事", story["id"] and story["status"] == "planning", story)
sid = story["id"]

listed = api("GET", f"/api/worlds/{wid}/stories").json()
check("故事列表", any(item["id"] == sid for item in listed), listed)

patched = api("PATCH", f"/api/stories/{sid}", {"status": "active", "premise": "已更新"}).json()
check("更新故事", patched["status"] == "active" and patched["premise"] == "已更新", patched)

# ---- 空间 -----------------------------------------------------------
original = api("POST", f"/api/stories/{sid}/spaces", {"name": "正史", "is_original": True, "summary": "原始发展"}).json()
check("创建原始空间", original["is_original"] is True and original["branch_id"] is None, original)
check("原始空间不建分支", len(api("GET", f"/api/worlds/{wid}/branches").json()) == 0)
check("重复原始空间被拒", api("POST", f"/api/stories/{sid}/spaces", {"name": "正史2", "is_original": True}, expect=409).status_code == 409)
check("分叉缺父空间被拒", api("POST", f"/api/stories/{sid}/spaces", {"name": "无父"}, expect=422).status_code == 422)

# ---- 单元与事件 -----------------------------------------------------
main_unit = api("POST", f"/api/spaces/{original['id']}/units", {"kind": "mainline", "title": "主线"}).json()
check("创建主线单元", main_unit["kind"] == "mainline", main_unit)
check("同一空间主线唯一", api("POST", f"/api/spaces/{original['id']}/units", {"kind": "mainline", "title": "第二条"}, expect=409).status_code == 409)
side_unit = api("POST", f"/api/spaces/{original['id']}/units", {"kind": "side", "title": "支线"}).json()
check("创建支线单元", side_unit["kind"] == "side", side_unit)

link1 = api("POST", f"/api/units/{main_unit['id']}/events", {"event_id": e1["id"], "role": "normal"}).json()
check("挂接主时间线事件", link1["event_id"] == e1["id"], link1)
check("重复挂接被拒", api("POST", f"/api/units/{main_unit['id']}/events", {"event_id": e1["id"]}, expect=409).status_code == 409)

# ---- 选择节点 -------------------------------------------------------
choice = api("POST", f"/api/spaces/{original['id']}/choices", {
    "anchor_event_id": e2["id"], "title": "是否走另一条路", "description": "关键选择"
}).json()
check("创建选择节点", choice["anchor_event_id"] == e2["id"], choice)
opt_a = api("POST", f"/api/choices/{choice['id']}/options", {"label": "留下", "consequence": "维持正史"}).json()
opt_b = api("POST", f"/api/choices/{choice['id']}/options", {"label": "离开", "consequence": "进入未知", "source": "ai"}).json()
check("新增选项", len(choice_options := api("GET", f"/api/spaces/{original['id']}/choices").json()[0]["options"]) == 2, choice_options)
check("AI 选项默认未确认", opt_b["confirmed"] is False, opt_b)
check("未确认 AI 选项不可采用", api("POST", f"/api/choices/{choice['id']}/resolve", {"option_id": opt_b["id"]}, expect=409).status_code == 409)

resolved = api("POST", f"/api/choices/{choice['id']}/resolve", {"option_id": opt_a["id"]}).json()
check("确定选择生成空间", resolved["space"]["is_original"] is False and resolved["space"]["branch_id"], resolved)
check("选择节点已确定", resolved["choice"]["status"] == "resolved", resolved["choice"])
space_a = resolved["space"]
check("空间绑定分支节点", bool(space_a["base_node_id"]) and space_a["node_count"] >= 1, space_a)

# 再建一个分叉，用于对比
choice2 = api("POST", f"/api/spaces/{original['id']}/choices", {"anchor_event_id": e2["id"], "title": "第二选择"}).json()
opt_c = api("POST", f"/api/choices/{choice2['id']}/options", {"label": "走第三条路", "consequence": "另一走向"}).json()
space_c = api("POST", f"/api/choices/{choice2['id']}/resolve", {"option_id": opt_c["id"]}).json()["space"]
check("第二分叉空间", space_c["branch_id"] != space_a["branch_id"], space_c)

# ---- 分支作用域事件 -------------------------------------------------
branch_event = api("POST", "/api/events", {
    "world_id": wid, "branch_id": space_a["branch_id"], "name": "分支内事件",
    "description": "只属于该空间", "polarity": "威胁", "intensity": "中",
}).json()
check("创建分支内事件", branch_event["branch_id"] == space_a["branch_id"], branch_event)

branch_unit = api("POST", f"/api/spaces/{space_a['id']}/units", {"kind": "mainline", "title": "分叉主线"}).json()
check("分叉空间建主线", branch_unit["space_id"] == space_a["id"], branch_unit)
check("分支空间拒绝未标记的主线事件",
      api("POST", f"/api/units/{branch_unit['id']}/events", {"event_id": e1["id"]}, expect=409).status_code == 409)
shared = api("POST", f"/api/units/{branch_unit['id']}/events", {"event_id": e1["id"], "is_shared": True}).json()
check("正史共享事件标记后可挂", shared["is_shared"] is True, shared)
check("分支空间挂本分支事件", api("POST", f"/api/units/{branch_unit['id']}/events", {"event_id": branch_event["id"]}).status_code == 200)
check("原始空间拒绝分支事件", api("POST", f"/api/units/{main_unit['id']}/events", {"event_id": branch_event["id"]}, expect=409).status_code == 409)

# ---- 结局 -----------------------------------------------------------
ending = api("POST", f"/api/spaces/{space_a['id']}/endings", {
    "name": "离开的结局", "content": "他走向未知。", "kind": "open", "is_final": False,
}).json()
check("创建开放结局", ending["kind"] == "open" and ending["is_final"] is False, ending)
check("非法结局类型被拒", api("POST", f"/api/spaces/{space_a['id']}/endings", {"name": "坏结局", "kind": "bad"}, expect=422).status_code == 422)

sim_ending = api("POST", f"/api/branches/{space_a['branch_id']}/endings", {
    "node_id": space_a["base_node_id"], "name": "推演结局", "description": "来自多路径"
}).json()
imported = api("POST", f"/api/spaces/{space_a['id']}/import-ending", {"ending_id": sim_ending["id"]}).json()
check("导入推演结局", imported["source_ending_id"] == sim_ending["id"], imported)
imported2 = api("POST", f"/api/spaces/{space_a['id']}/import-ending", {"ending_id": sim_ending["id"]}).json()
check("导入结局幂等", imported2["id"] == imported["id"], imported2)

# ---- 对比与回溯 -----------------------------------------------------
comp = api("POST", "/api/stories/compare-spaces", {"space_ids": [original["id"], space_a["id"]]}).json()
check("空间对比返回事件", isinstance(comp["differences"]["event_counts"], dict), comp)
check("空间对比识别差异", set(comp["differences"]["event_counts"]) == {"正史", resolved["space"]["name"]}, comp["differences"])

rollback = api("POST", f"/api/spaces/{space_a['id']}/rollback", {"node_id": space_a["base_node_id"], "reason": "验收"}).json()
check("空间回溯复用分支", rollback["rollback"].get("rolled_back_to", {}).get("id") == space_a["base_node_id"], rollback)
check("原始空间不可回溯", api("POST", f"/api/spaces/{original['id']}/rollback", {"node_id": "x"}, expect=409).status_code == 409)

# ---- 归档与级联 -----------------------------------------------------
archived = api("PATCH", f"/api/spaces/{space_c['id']}", {"status": "archived"}).json()
check("空间归档", archived["status"] == "archived", archived)
branch_rows = api("GET", f"/api/worlds/{wid}/branches").json()
branch_c = next((b for b in branch_rows if b["id"] == space_c["branch_id"]), None)
check("归档空间同步归档分支", branch_c is not None and branch_c["status"] == "archived", branch_c)

overview = api("GET", f"/api/stories/{sid}").json()
check("总览聚合空间与结局", overview["space_count"] == 3 and len(overview["endings"]) >= 2, overview["space_count"])

child = api("POST", f"/api/spaces/{original['id']}/units", {"kind": "phase", "title": "阶段", "parent_unit_id": main_unit["id"]}).json()
check("子单元创建", child["parent_unit_id"] == main_unit["id"], child)
check("有子单元的单元不可删", api("DELETE", f"/api/units/{main_unit['id']}", expect=409).status_code == 409)
check("删除子单元", api("DELETE", f"/api/units/{child['id']}").status_code == 200)

api("PATCH", f"/api/stories/{sid}", {"status": "archived"})
check("归档故事禁止新建空间", api("POST", f"/api/stories/{sid}/spaces", {"name": "x", "is_original": True}, expect=409).status_code == 409)

# ---- 清理 -----------------------------------------------------------
db = SessionLocal()
try:
    db.query(models.StoryEnding).filter(models.StoryEnding.world_id == wid).delete()
    db.query(models.StoryRejoin).filter(models.StoryRejoin.world_id == wid).delete()
    db.query(models.StoryChoiceOption).filter(models.StoryChoiceOption.world_id == wid).delete()
    db.query(models.StoryChoice).filter(models.StoryChoice.world_id == wid).delete()
    db.query(models.StoryUnitEvent).filter(models.StoryUnitEvent.world_id == wid).delete()
    db.query(models.StoryUnit).filter(models.StoryUnit.world_id == wid).delete()
    db.query(models.StorySpace).filter(models.StorySpace.world_id == wid).delete()
    db.query(models.StoryProject).filter(models.StoryProject.world_id == wid).delete()
    db.query(models.SimulationEnding).filter(models.SimulationEnding.world_id == wid).delete()
    db.query(models.SimulationBranchNode).filter(models.SimulationBranchNode.world_id == wid).delete()
    db.query(models.SimulationBranch).filter(models.SimulationBranch.world_id == wid).delete()
    db.query(models.Event).filter(models.Event.world_id == wid).delete()
    db.query(models.Character).filter(models.Character.world_id == wid).delete()
    db.query(models.WorldSettings).filter(models.WorldSettings.world_id == wid).delete()
    db.query(models.World).filter(models.World.id == wid).delete()
    db.commit()
finally:
    db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
