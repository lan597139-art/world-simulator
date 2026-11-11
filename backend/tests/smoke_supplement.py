"""补充整改验收：真实故事树 / 压强具象对象 / 个人 AI 人格 / 事件沙盒方案。"""

import uuid

from fastapi.testclient import TestClient

import main
import models
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {str(detail)[:400]}")


def jget(path):
    return client.get(path)


def run():
    global passed, failed
    suffix = uuid.uuid4().hex[:6]
    world = client.post("/api/worlds", json={"name": f"补充整改-{suffix}", "type": "fiction"}).json()
    wid = world["id"]
    char = client.post("/api/characters", json={"world_id": wid, "name": f"主角-{suffix}"}).json()
    e1 = client.post("/api/events", json={"world_id": wid, "name": "开端事件", "polarity": "威胁"}).json()
    e2 = client.post("/api/events", json={"world_id": wid, "name": "抉择事件", "polarity": "奖赏"}).json()
    story = client.post("/api/stories", json={"world_id": wid, "title": f"树测试-{suffix}"}).json()
    sid = story["id"]

    # ---------- A. 真实故事树 ----------
    main_thread = client.post(f"/api/stories/{sid}/threads", json={
        "title": "主线树干", "kind": "main", "character_id": char["id"],
    })
    check("创建树干", main_thread.status_code == 200, main_thread.text)
    trunk_id = main_thread.json()["id"]
    pending = client.post(f"/api/stories/{sid}/tree/nodes", json={
        "thread_id": trunk_id, "title": "待填充位置", "node_status": "pending",
    })
    check("创建待填充位置", pending.status_code == 200 and pending.json()["event_id"] is None, pending.text)
    pending_id = pending.json()["id"]
    filled = client.patch(f"/api/story-tree-nodes/{pending_id}", json={"event_id": e1["id"]})
    check("待填充位置填入既有事件", filled.status_code == 200 and filled.json()["node_status"] == "filled",
          filled.text)
    db = SessionLocal()
    event_count = db.query(models.Event).filter(models.Event.world_id == wid).count()
    db.close()
    check("填树不复制 05 事件", event_count == 2, event_count)

    child = client.post(f"/api/stories/{sid}/threads", json={
        "title": "人物支线", "kind": "side", "character_id": char["id"], "parent_thread_id": trunk_id,
    })
    check("创建带上级的人物树枝", child.status_code == 200 and child.json()["parent_thread_id"] == trunk_id,
          child.text)
    branch_id = child.json()["id"]
    child_node = client.post(f"/api/stories/{sid}/tree/nodes", json={
        "thread_id": branch_id, "event_id": e2["id"], "parent_node_id": None,
    })
    check("树枝挂事件叶", child_node.status_code == 200 and child_node.json()["event_id"] == e2["id"],
          child_node.text)
    tree = jget(f"/api/stories/{sid}/tree").json()
    check("树返回枝/叶/待填充统计", tree["counts"]["branches"] == 2 and tree["counts"]["pending"] == 0
          and tree["counts"]["filled"] == 2, tree["counts"])
    check("树保留父子层级", any(b["parent_thread_id"] == trunk_id for b in tree["branches"]), tree["branches"])
    moved = client.patch(f"/api/story-tree-nodes/{child_node.json()['id']}", json={"thread_id": trunk_id})
    check("节点可移动到另一树枝", moved.status_code == 200 and moved.json()["thread_id"] == trunk_id,
          moved.text)
    # 移回，后续树结构保持可读
    client.patch(f"/api/story-tree-nodes/{child_node.json()['id']}", json={"thread_id": branch_id})

    # ---------- B. 六轴压强具象对象 ----------
    presets = jget("/api/axis-objects/presets").json()
    check("七维预设齐全", len(presets.get("axes", [])) == 7, presets)
    base1 = client.post(f"/api/worlds/{wid}/axis-objects", json={
        "axis": "scarcity", "name": "缺钱", "category": "资源", "value": 0.2,
        "description": "货币不足", "linked_factors": [{"type": "character", "name": char["name"]}],
    })
    base2 = client.post(f"/api/worlds/{wid}/axis-objects", json={
        "axis": "scarcity", "name": "缺情报", "category": "信息", "value": 0.8,
    })
    check("同轴可建多个独立对象", base1.status_code == 200 and base2.status_code == 200, base2.text)
    axis = jget(f"/api/worlds/{wid}/axis-objects?event_id={e1['id']}").json()
    check("世界对象进入事件生效集合", len([o for o in axis["effective"] if o["axis"] == "scarcity"]) == 2,
          axis["effective"])
    check("多个对象不被压成一个抽象值", abs(axis["aggregate"]["scarcity"] - 0.5) < 0.001,
          axis["aggregate"])
    override = client.post(f"/api/worlds/{wid}/axis-objects", json={
        "axis": "scarcity", "name": "缺钱", "category": "资源", "value": 0.95, "event_id": e1["id"],
    })
    check("事件层可覆盖同名对象", override.status_code == 200, override.text)
    event_axis = jget(f"/api/worlds/{wid}/axis-objects?event_id={e1['id']}").json()
    effective_money = next(o for o in event_axis["effective"] if o["name"] == "缺钱")
    check("事件覆盖值生效", effective_money["value"] == 0.95 and effective_money["scope_type"] == "event",
          effective_money)
    neg = client.post(f"/api/worlds/{wid}/axis-objects", json={
        "axis": "negentropy", "name": "水源恢复", "value": 0.6,
    })
    check("负熵为独立环境修复维度", neg.status_code == 200 and neg.json()["axis"] == "negentropy", neg.text)

    branch = client.post("/api/branches", json={
        "root_event_id": e1["id"], "name": f"树沙盒-{suffix}", "note": "测试分支",
    })
    check("复用多路径引擎创建分支", branch.status_code == 200, branch.text)
    bid = branch.json()["id"] if branch.status_code == 200 else ""
    if bid:
        branch_override = client.post(f"/api/worlds/{wid}/axis-objects", json={
            "axis": "scarcity", "name": "缺钱", "category": "资源", "value": 0.08, "branch_id": bid,
        })
        check("分支层可覆盖同名对象", branch_override.status_code == 200, branch_override.text)
        branch_axis = jget(f"/api/worlds/{wid}/axis-objects?event_id={e1['id']}&branch_id={bid}").json()
        money = next(o for o in branch_axis["effective"] if o["name"] == "缺钱")
        check("同一事件在分支下读取不同压强", money["value"] == 0.08 and money["scope_type"] == "branch",
              money)
        base_axis = jget(f"/api/worlds/{wid}/axis-objects").json()
        base_money = next(o for o in base_axis["effective"] if o["name"] == "缺钱")
        check("分支覆盖不改世界基础值", base_money["value"] == 0.2, base_money)

    # ---------- C. 个人 AI 人格 ----------
    p1 = client.post("/api/personas", json={
        "name": "理性严谨的我", "identity": "分析型个人 AI",
        "esa": {"V": 0.3, "O": 0.7, "D": 0.8, "E": 0.5, "T": 0.7},
        "traits": ["理性", "严谨"], "cognition": {"tendency": "分析型"},
        "expression": {"tone": "克制"}, "interaction": {"relation": "协作"},
        "memory_policy": {"share_public_profile": False, "isolation": True},
    })
    p2 = client.post("/api/personas", json={"name": "自由松弛的我", "identity": "创意型个人 AI"})
    check("可创建独立个人 AI 人格", p1.status_code == 200 and p2.status_code == 200, p2.text)
    pid1, pid2 = p1.json()["id"], p2.json()["id"]
    check("人格持久化 ESA 而非只有提示词", p1.json()["esa"]["D"] == 0.8, p1.json())
    t1 = client.post(f"/api/personas/{pid1}/threads", json={"title": "理性会话"}).json()
    t2 = client.post(f"/api/personas/{pid2}/threads", json={"title": "松弛会话"}).json()
    check("人格会话独立", t1["id"] != t2["id"], (t1, t2))
    m1 = client.post(f"/api/personas/{pid1}/memories", json={"content": "理性记忆", "importance": 0.9})
    m2 = client.post(f"/api/personas/{pid2}/memories", json={"content": "松弛记忆", "importance": 0.4})
    check("人格记忆可写入", m1.status_code == 200 and m2.status_code == 200, m2.text)
    mem1 = jget(f"/api/personas/{pid1}/memories").json()
    mem2 = jget(f"/api/personas/{pid2}/memories").json()
    check("人格记忆隔离不混用", len(mem1) == 1 and mem1[0]["content"] == "理性记忆"
          and len(mem2) == 1 and mem2[0]["content"] == "松弛记忆", (mem1, mem2))
    private_profile = client.patch(f"/api/personas/{pid1}", json={
        "memory_policy": {"share_public_profile": False, "isolation": True},
        "public_profile": {"nickname": "测试昵称", "bio": "未授权简介"},
    })
    check("未授权公共资料可保存但不共享", private_profile.status_code == 200
          and private_profile.json()["memory_policy"]["share_public_profile"] is False, private_profile.text)
    # 用本地 stub 验证人格对话确实走独立会话/记忆与人格提示词，不访问外部 AI。
    import personas as personas_module
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            class Message:
                content = "这是理性人格的独立回复"
            class Choice:
                message = Message()
            class Response:
                choices = [Choice()]
            return Response()

    class FakeClient:
        chat = type("Chat", (), {"completions": FakeCompletions()})()

    old_client = personas_module.get_client
    old_status = personas_module.ai_config_status
    personas_module.get_client = lambda: FakeClient()
    personas_module.ai_config_status = lambda: {"configured": True, "message": ""}
    try:
        chat = client.post(f"/api/personas/{pid1}/chat", json={
            "message": "帮我整理一下今天的任务", "thread_id": t1["id"],
        })
        check("人格对话使用全局 AI 模型接口", chat.status_code == 200
              and chat.json()["reply"] == "这是理性人格的独立回复", chat.text)
        check("人格对话写入独立线程", chat.json().get("thread_id") == t1["id"], chat.json())
        messages = jget(f"/api/personas/{pid1}/threads/{t1['id']}/messages").json()
        check("人格对话历史持久化", len(messages) == 2 and messages[-1]["role"] == "persona", messages)
        system_prompt = captured.get("messages", [{}])[0].get("content", "")
        check("提示词使用 ESA 与本人格记忆", "D" in system_prompt and "0.8" in system_prompt
              and "理性记忆" in system_prompt and "松弛记忆" not in system_prompt, system_prompt[:300])
        check("未授权时公共资料不进入提示词", "未授权简介" not in system_prompt, system_prompt[:300])

        updated = client.patch(f"/api/personas/{pid1}", json={
            "memory_policy": {"share_public_profile": True, "isolation": True},
            "public_profile": {"nickname": "测试昵称", "bio": "授权简介"},
        })
        check("公共资料需显式授权", updated.status_code == 200
              and updated.json()["memory_policy"]["share_public_profile"] is True, updated.text)
        chat2 = client.post(f"/api/personas/{pid1}/chat", json={
            "message": "继续", "thread_id": t1["id"],
        })
        check("授权后人格对话成功", chat2.status_code == 200, chat2.text)
        system_prompt2 = captured.get("messages", [{}])[0].get("content", "")
        check("授权后公共资料进入提示词", "授权简介" in system_prompt2, system_prompt2[:300])
    finally:
        personas_module.get_client = old_client
        personas_module.ai_config_status = old_status

    client.delete(f"/api/personas/{pid2}")
    check("删除人格连同独立会话/记忆", jget(f"/api/personas/{pid2}/memories").status_code == 404)

    # ---------- D. 05 事件分支沙盒方案 ----------
    presets2 = jget(f"/api/events/{e1['id']}/sandbox-presets").json()
    check("沙盒提供 A-E 预设候选", all(k in presets2 for k in (
        "preset_options", "constraint_candidates", "support_candidates",
        "potential_candidates", "factors")) and all(presets2[k] for k in (
        "preset_options", "constraint_candidates", "support_candidates",
        "potential_candidates")), presets2)
    sc1 = client.post(f"/api/events/{e1['id']}/sandbox-scenarios", json={
        "title": "方案甲", "note": "高压线",
        "preset_options": [{"text": "独自应对"}],
        "constraints": [{"text": "不得突破能力上限", "kind": "limit"}],
        "supports": [{"text": "已掌握部分情报"}],
        "potentials": [{"text": "隐藏动机待确认"}],
        "factors": [{"type": "character", "name": char["name"]}],
    })
    sc2 = client.post(f"/api/events/{e1['id']}/sandbox-scenarios", json={
        "title": "方案乙", "note": "缓冲线", "preset_options": [{"text": "先求助"}],
    })
    check("同一事件可保存多个独立方案", sc1.status_code == 200 and sc2.status_code == 200, sc2.text)
    sid1, sid2 = sc1.json()["id"], sc2.json()["id"]
    check("潜在条件默认不确认", sc1.json()["potentials"][0].get("status") == "potential", sc1.json())
    listed = jget(f"/api/events/{e1['id']}/sandbox-scenarios").json()
    check("方案列表按事件隔离", len(listed) == 2 and all(row["event_id"] == e1["id"] for row in listed), listed)
    if bid:
        linked = client.patch(f"/api/sandbox-scenarios/{sid1}", json={"branch_id": bid, "status": "active"})
        check("方案关联既有分支且保留原事件", linked.status_code == 200 and linked.json()["branch_id"] == bid
              and linked.json()["event_id"] == e1["id"], linked.text)
        bad = client.patch(f"/api/sandbox-scenarios/{sid2}", json={"branch_id": "not-a-branch"})
        check("不存在的分支被拒绝", bad.status_code == 409, bad.text)

        import multipath as multipath_module
        captured_sim = {}
        old_sim = multipath_module.run_branch_simulation
        def fake_sim(payload):
            captured_sim.update(payload)
            return {"relationship_changes": [], "actions": [], "world_changes": "沙盒配置生效",
                    "memory_deposits": [], "state_hint": ""}
        multipath_module.run_branch_simulation = fake_sim
        try:
            sim = client.post(f"/api/branches/{bid}/simulate", json={"event_id": e1["id"]})
            check("分支沙盒推演调用复用多路径引擎", sim.status_code == 200, sim.text)
            passed_scenario = captured_sim.get("sandbox_scenario") or {}
            check("A-E 方案配置进入真实推演上下文",
                  passed_scenario.get("title") == "方案甲"
                  and passed_scenario.get("constraints")
                  and passed_scenario.get("potentials"), passed_scenario)
            check("潜在条件以未确认状态进入推演",
                  passed_scenario["potentials"][0].get("status") == "potential", passed_scenario)
        finally:
            multipath_module.run_branch_simulation = old_sim
    compare = client.post("/api/sandbox-scenarios/compare", json={"ids": [sid1, sid2]})
    check("多方案可比较", compare.status_code == 200 and len(compare.json()["scenarios"]) == 2, compare.text)
    check("比较保留关联因素", any(row["factors"] for row in compare.json()["scenarios"]), compare.text)
    # 删除方案不改事件
    client.delete(f"/api/sandbox-scenarios/{sid2}")
    db = SessionLocal()
    original = db.query(models.Event).filter(models.Event.id == e1["id"]).first()
    db.close()
    check("删方案不删/不改原事件", original is not None and original.name == "开端事件")

    # 删除事件时，故事树位置与沙盒方案不能留下悬空引用。
    e3 = client.post("/api/events", json={"world_id": wid, "name": "临时删除事件"}).json()
    node3 = client.post(f"/api/stories/{sid}/tree/nodes", json={
        "thread_id": trunk_id, "event_id": e3["id"], "node_status": "filled",
    }).json()
    client.post(f"/api/events/{e3['id']}/sandbox-scenarios", json={"title": "临时方案"})
    deleted = client.delete(f"/api/events/{e3['id']}")
    check("删除事件成功", deleted.status_code == 200, deleted.text)
    preserved = next(n for n in jget(f"/api/stories/{sid}/tree").json()["nodes"] if n["id"] == node3["id"])
    check("删事件后树位置保留为待填充", preserved["event_id"] is None and preserved["node_status"] == "pending",
          preserved)
    db = SessionLocal()
    orphan_scenarios = db.query(models.EventSandboxScenario).filter(
        models.EventSandboxScenario.event_id == e3["id"]).count()
    db.close()
    check("删事件后方案无悬空事件引用", orphan_scenarios == 0, orphan_scenarios)

    # cleanup
    client.delete(f"/api/personas/{pid1}")
    from world_lifecycle import _cascade_delete_world
    db = SessionLocal()
    row = db.query(models.World).filter(models.World.id == wid).first()
    if row:
        _cascade_delete_world(db, wid)
        db.delete(row)
        db.commit()
    db.close()
    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
