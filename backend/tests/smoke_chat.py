"""AI 角色聊天室验收（进程内，AI 客户端打桩）。"""

import json
import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

import chat
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


PLAN_STATE = {"ids": [], "bad": False}


class FakeCompletions:
    def __init__(self):
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        system = kwargs["messages"][0]["content"]
        if "世界演化分析器" in system:
            content = json.dumps({
                "summary": "对话让彼此更戒备",
                "relationships": [{
                    "source_id": PLAN_STATE["ids"][0], "target_id": PLAN_STATE["ids"][1],
                    "quadrant": "戒备", "strength": "中", "power": "对等",
                    "relation_type": "互相提防", "reason": "双方都在试探",
                }],
                "six_axis": {"threat": 0.05, "attachment": 0.02},
                "negentropy": 0.02,
            })
        elif "调度器" in system:
            if PLAN_STATE["bad"]:
                content = "我觉得应该让乙先说。"
            else:
                content = json.dumps({"speakers": [{"character_id": cid, "reason": "test"} for cid in PLAN_STATE["ids"]]})
        else:
            content = "我在药园做事。你问这个做什么？"
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


FAKE = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
chat.get_client = lambda: FAKE

suffix = uuid.uuid4().hex[:6]
world = api("POST", "/api/worlds", {"name": f"聊天-{suffix}", "type": "fiction", "description": "test"}).json()
wid = world["id"]
a = api("POST", "/api/characters", {"world_id": wid, "name": "甲", "basic_profile": {"name": "甲", "role": "药园杂役"}}).json()
b = api("POST", "/api/characters", {"world_id": wid, "name": "乙", "basic_profile": {"name": "乙"}}).json()
c = api("POST", "/api/characters", {"world_id": wid, "name": "丙", "basic_profile": {"name": "丙"}}).json()

db = SessionLocal()
row = db.query(models.Character).filter(models.Character.id == a["id"]).first()
row.engines = {"ovtde": {"V": {"val": 80, "behavior": "先确保能活下去"}, "O": 30}, "dominance": {"mode": ["单引擎主导"], "engines": ["V"], "description": "危险时由生存主导"}}
row.thought_imprints = [{"name": "谨慎", "content": "不轻信陌生人"}]
row.life_history = [{"event": "入七玄门", "result": "成为记名弟子"}]
db.commit()
db.close()

# ---- 角色配置 -------------------------------------------------------
preview = api("GET", f"/api/characters/{a['id']}/ai-role").json()
check("未配置时返回预览", preview["exists"] is False and preview["preview"]["identity"]["name"] == "甲", preview.keys())
engines = preview["preview"]["engines"]
check("嵌套引擎归一化", engines["V"]["value"] == 80.0 and engines["V"]["behavior"] == "先确保能活下去", engines)
check("引擎行为进入配置", engines["O"]["value"] == 30.0, engines)
check("主导模式转换", preview["preview"]["dominance"]["engines"] == ["V"], preview["preview"]["dominance"])
check("思想印记转换", preview["preview"]["imprints"] == ["谨慎：不轻信陌生人"], preview["preview"]["imprints"])
check("人生经历转换", preview["preview"]["life"] == ["入七玄门：成为记名弟子"], preview["preview"]["life"])

built = api("POST", f"/api/characters/{a['id']}/ai-role/build").json()
check("构建并保存角色", bool(built["id"]) and built["enabled"] is True and built["source"] == "auto", built)
role_id = built["id"]

persona = built["persona"]
persona["voice"]["tone"] = "冷淡、简短"
updated = api("PUT", f"/api/characters/{a['id']}/ai-role", {
    "display_name": "甲师兄", "persona": persona,
}).json()
check("自定义语气与称呼", updated["persona"]["voice"]["tone"] == "冷淡、简短" and updated["display_name"] == "甲师兄", updated)
check("手改标记", updated["source"] == "manual" and updated["version"] == 2, updated)

# ---- 私聊 -----------------------------------------------------------
thread = api("POST", "/api/chat/threads", {"world_id": wid, "kind": "private", "character_id": a["id"]}).json()
check("创建私聊", thread["kind"] == "private" and len(thread["participants"]) == 1, thread)
check("会话标题默认", thread["title"] == "与甲的对话", thread["title"])
tid = thread["id"]

sent = api("POST", f"/api/chat/threads/{tid}/messages", {"content": "你今天为何来药园？"}).json()
check("用户消息与角色回复", sent["reply"]["sender_type"] == "character" and "药园" in sent["reply"]["content"], sent)
check("回复引用用户消息", sent["reply"]["reply_to_id"] == sent["user_message"]["id"], sent)
call = FAKE.chat.completions.calls[-1]
check("系统提示含角色设定", "甲师兄" in call["messages"][0]["content"] and "药园杂役" in call["messages"][0]["content"], call["messages"][0]["content"][:200])
check("提示含记忆约束", "不替用户行动" in call["messages"][0]["content"], call["messages"][0]["content"][-200:])

messages = api("GET", f"/api/chat/threads/{tid}/messages").json()
check("消息按时间正序", [m["sender_type"] for m in messages] == ["user", "character"], messages)
check("消息分页限制", len(api("GET", f"/api/chat/threads/{tid}/messages?limit=1").json()) == 1)

memories = api("GET", f"/api/chat/threads/{tid}/memories").json()
check("对话产生记忆", len(memories) == 1 and "药园" in memories[0]["content"], memories)
check("删除记忆", api("DELETE", f"/api/chat/memories/{memories[0]['id']}").status_code == 200)
check("记忆已删除", len(api("GET", f"/api/chat/threads/{tid}/memories").json()) == 0)

# ---- 关闭开关 -------------------------------------------------------
api("PUT", f"/api/characters/{a['id']}/ai-role", {"enabled": False})
check("关闭角色后拒绝发言", api("POST", f"/api/chat/threads/{tid}/messages", {"content": "在吗"}, expect=409).status_code == 409)
api("PUT", f"/api/characters/{a['id']}/ai-role", {"enabled": True})
check("重新开启后可发言", api("POST", f"/api/chat/threads/{tid}/messages", {"content": "还在吗"}).status_code == 200)

detail = api("GET", f"/api/chat/threads/{tid}").json()
check("会话详情含消息", len(detail["messages"]) == 4, len(detail["messages"]))
check("世界会话列表", any(t["id"] == tid for t in api("GET", f"/api/worlds/{wid}/chat/threads").json()))

# ---- 群聊边界 -------------------------------------------------------
group = api("POST", "/api/chat/threads", {"world_id": wid, "kind": "group", "character_ids": [b["id"], c["id"]]}).json()
check("创建群聊", group["kind"] == "group" and len(group["participants"]) == 2, group)
check("群聊发言走 turns", api("POST", f"/api/chat/threads/{group['id']}/messages", {"content": "你们好"}, expect=409).status_code == 409)
check("私聊不可加人", api("POST", f"/api/chat/threads/{tid}/participants", {"character_id": c["id"]}, expect=409).status_code == 409)
added = api("POST", f"/api/chat/threads/{group['id']}/participants", {"character_id": a["id"]}).json()
check("群聊加入第三人", added["character_id"] == a["id"], added)
check("移除成员", api("DELETE", f"/api/chat/threads/{group['id']}/participants/{b['id']}").status_code == 200)
check("移除后可再加入", api("POST", f"/api/chat/threads/{group['id']}/participants", {"character_id": b["id"]}).status_code == 200)

# ---- 群聊调度 -------------------------------------------------------
PLAN_STATE["ids"] = [a["id"], c["id"]]
turn = api("POST", f"/api/chat/threads/{group['id']}/turns", {"content": "你们怎么看墨居仁？"}).json()
check("群聊一轮多角色发言", len(turn["replies"]) == 2 and {r["character_id"] for r in turn["replies"]} == {a["id"], c["id"]}, turn)
check("群聊计划返回", [p["character_id"] for p in turn["plan"]] == [a["id"], c["id"]], turn["plan"])
group_msgs = api("GET", f"/api/chat/threads/{group['id']}/messages").json()
check("群聊消息落库", len(group_msgs) == 3 and group_msgs[0]["sender_type"] == "user", group_msgs)
group_mem = api("GET", f"/api/chat/threads/{group['id']}/memories").json()
check("群聊每位发言者形成记忆", len(group_mem) == 2, group_mem)

db = SessionLocal()
plan_row = db.query(models.ChatPlan).filter(models.ChatPlan.thread_id == group["id"]).order_by(models.ChatPlan.created_at.desc()).first()
db.close()
check("调度计划持久化", plan_row is not None and len(plan_row.plan.get("speakers", [])) == 2, plan_row.plan if plan_row else None)

PLAN_STATE["bad"] = True
fallback = api("POST", f"/api/chat/threads/{group['id']}/turns", {"content": "那你们打算怎么办？"}).json()
check("非法计划规则兜底", 1 <= len(fallback["replies"]) <= 2, fallback)
db = SessionLocal()
plan_row = db.query(models.ChatPlan).filter(models.ChatPlan.thread_id == group["id"]).order_by(models.ChatPlan.created_at.desc()).first()
db.close()
check("兜底标记", plan_row is not None and plan_row.plan.get("fallback") is True, plan_row.plan if plan_row else None)

check("私聊不可用 turns", api("POST", f"/api/chat/threads/{tid}/turns", {"content": "x"}, expect=409).status_code == 409)

# ---- 聊天影响世界 ---------------------------------------------------
impact = api("POST", f"/api/chat/threads/{group['id']}/impact/preview").json()
check("影响预览返回关系", len(impact["relationships"]) == 1 and impact["relationships"][0]["quadrant"] == "戒备", impact)
check("影响预览增量受限", impact["six_axis"].get("threat") == 0.05 and impact["negentropy"] == 0.02, impact)

world_before = api("GET", f"/api/worlds/{wid}").json()
base_threat = ((world_before.get("settings") or {}).get("six_axis") or {}).get("threat", 0)
applied = api("POST", f"/api/chat/impact/{impact['id']}/apply", {}).json()
check("应用影响创建关系", len(applied["relationship_ids"]) == 1, applied)
check("六轴按增量更新", abs(applied["six_axis"].get("threat", 0) - (base_threat + 0.05)) < 0.0001, applied["six_axis"])
check("影响已标记应用", applied["impact"]["status"] == "applied", applied["impact"])
check("重复应用被拒", api("POST", f"/api/chat/impact/{impact['id']}/apply", {}, expect=409).status_code == 409)

impact2 = api("POST", f"/api/chat/threads/{group['id']}/impact/preview").json()
check("忽略影响", api("POST", f"/api/chat/impact/{impact2['id']}/dismiss").json()["status"] == "dismissed")
check("忽略后不可应用", api("POST", f"/api/chat/impact/{impact2['id']}/apply", {}, expect=409).status_code == 409)

# 私聊只有一个角色：关系应为空，但六轴仍可建议
private_impact = api("POST", f"/api/chat/threads/{tid}/impact/preview").json()
check("私聊不产生关系", private_impact["relationships"] == [], private_impact)

# ---- 对话转事件 / 经历 ---------------------------------------------
converted = api("POST", f"/api/chat/threads/{tid}/to-event", {"title": "药园对话"}).json()
check("对话整理为事件", converted["event"]["name"] == "药园对话" and converted["event"]["participants"] == [a["id"]], converted)
check("事件描述含对话记录", "用户：" in converted["event"]["description"] and "甲师兄：" in converted["event"]["description"], converted["event"]["description"][:200])
check("非法极性被拒", api("POST", f"/api/chat/threads/{tid}/to-event", {"polarity": "乱写"}, expect=422).status_code == 422)

exp = api("POST", f"/api/chat/threads/{tid}/to-experience", {"character_id": a["id"], "title": "药园夜谈"}).json()
check("对话写入人物经历", exp["life_history_count"] == 2, exp)
db = SessionLocal()
row = db.query(models.Character).filter(models.Character.id == a["id"]).first()
db.close()
check("经历内容带来源", (row.life_history or [])[-1].get("source") == "chat" and (row.life_history or [])[-1].get("thread_id") == tid, row.life_history[-1] if row.life_history else None)
check("非会话角色不可写经历", api("POST", f"/api/chat/threads/{tid}/to-experience", {"character_id": b["id"]}, expect=409).status_code == 409)

empty = api("POST", "/api/chat/threads", {"world_id": wid, "kind": "private", "character_id": b["id"]}).json()
check("空会话不可整理", api("POST", f"/api/chat/threads/{empty['id']}/to-event", {}, expect=409).status_code == 409)

api("PATCH", f"/api/chat/threads/{tid}", {"status": "archived"})
check("归档会话拒绝发言", api("POST", f"/api/chat/threads/{tid}/messages", {"content": "?"}, expect=409).status_code == 409)

# ---- 清理 -----------------------------------------------------------
db = SessionLocal()
try:
    tids = [row[0] for row in db.query(models.ChatThread.id).filter(models.ChatThread.world_id == wid).all()]
    if tids:
        db.query(models.ChatPlan).filter(models.ChatPlan.thread_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.ChatMessage).filter(models.ChatMessage.thread_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.ChatParticipant).filter(models.ChatParticipant.thread_id.in_(tids)).delete(synchronize_session=False)
        db.query(models.ChatThread).filter(models.ChatThread.world_id == wid).delete(synchronize_session=False)
    db.query(models.CharacterMemory).filter(models.CharacterMemory.world_id == wid).delete(synchronize_session=False)
    db.query(models.AiRole).filter(models.AiRole.world_id == wid).delete(synchronize_session=False)
    db.query(models.Event).filter(models.Event.world_id == wid).delete()
    db.query(models.Character).filter(models.Character.world_id == wid).delete()
    db.query(models.WorldSettings).filter(models.WorldSettings.world_id == wid).delete()
    db.query(models.World).filter(models.World.id == wid).delete()
    db.commit()
finally:
    db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
