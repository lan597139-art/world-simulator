"""全局 AI 助手验收：上下文压缩、动作白名单、无 Key 兜底。"""

import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

import assistant
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


CAPTURE = []
REPLY = {"reply": "先把事件名称改成「欺骗暴露·改」。", "actions": []}


class _Completions:
    def create(self, **kwargs):
        CAPTURE.append(kwargs)
        content = json.dumps(REPLY, ensure_ascii=False)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


class _Client:
    chat = SimpleNamespace(completions=_Completions())


assistant.get_client = lambda: _Client()
assistant.get_model = lambda: "stub-model"
assistant.ai_config_status = lambda: {"configured": True, "message": ""}

# ---- 上下文数据 -----------------------------------------------------
db = SessionLocal()
try:
    world = models.World(name="助手验收世界", type="fiction", background="一个用于测试的世界")
    db.add(world)
    db.commit()
    db.refresh(world)
    wid = world.id
    character = models.Character(world_id=wid, name="甲", basic_profile={"name": "甲", "identity": "修士"}, engines={"V": 50})
    db.add(character)
    db.commit()
    db.refresh(character)
    event = models.Event(world_id=wid, name="欺骗暴露", description="甲发现乙欺骗", polarity="威胁", intensity="高", participants=[character.id])
    db.add(event)
    db.commit()
    db.refresh(event)
    eid = event.id
    cid = character.id
    end_id = None
finally:
    db.close()

CONTEXT = {
    "page": "events",
    "page_label": "事件管理",
    "world_id": wid,
    "world_name": "助手验收世界",
    "entity_type": "event",
    "entity_id": eid,
    "entity_name": "欺骗暴露",
    "form": {
        "title": "事件表单",
        "fields": [
            {"label": "事件名称", "name": "name", "type": "text", "value": "欺骗暴露"},
            {"label": "事件描述", "name": "description", "type": "textarea", "value": "甲发现乙欺骗"},
        ],
    },
    "selection": "甲发现乙长期欺骗自己",
}


def chat(body, expect=200):
    response = client.post("/api/assistant/chat", json=body)
    if response.status_code != expect:
        print(f"   -> {response.status_code} {response.text[:200]} (expect {expect})")
    return response


# ---- 基础校验 -------------------------------------------------------
r = chat({"messages": []}, expect=422)
check("缺少对话内容返回 422", r.status_code == 422, r.status_code)

r = chat({"messages": [{"role": "user", "content": "这个事件怎么改？"}], "context": CONTEXT})
data = r.json()
check("正常对话返回 reply", r.status_code == 200 and "欺骗暴露" in data.get("reply", ""), data)
check("context_label 含世界与页面", data.get("context_label") == "世界：助手验收世界 · 页面：事件管理 · 对象：欺骗暴露", data.get("context_label"))

prompt = CAPTURE[-1]["messages"][0]["content"]
check("prompt 注入世界与对象", "助手验收世界" in prompt and "欺骗暴露" in prompt, prompt[:120])
check("prompt 注入表单字段", "事件名称" in prompt, prompt[:200])
check("prompt 注入选中文本", "长期欺骗" in prompt, prompt[:200])
check("prompt 含动作白名单", "fill_form" in prompt and "update_entity" in prompt and "navigate" in prompt, prompt[-400:])
check("历史只保留对话角色", all(item["role"] in {"user", "assistant"} for item in CAPTURE[-1]["messages"][1:]), CAPTURE[-1]["messages"])

# ---- 动作清洗 -------------------------------------------------------
REPLY = {
    "reply": "已生成建议。",
    "actions": [
        {"type": "fill_form", "fields": {"事件名称": "欺骗暴露·改", "不存在的字段": "x"}, "summary": "改标题"},
        {"type": "update_entity", "entity_type": "event", "entity_id": eid, "fields": {"name": "欺骗暴露·改", "participants": ["x"]}, "summary": "改事件"},
        {"type": "update_entity", "entity_type": "event", "entity_id": "wrong-id", "fields": {"name": "错误"}, "summary": "越权"},
        {"type": "navigate", "page": "multipath", "summary": "去看分支"},
        {"type": "navigate", "page": "not-a-page", "summary": "无效页面"},
        {"type": "delete_entity", "entity_id": eid, "summary": "危险动作"},
    ],
}
r = chat({"messages": [{"role": "user", "content": "帮我改一下"}], "context": CONTEXT})
actions = r.json().get("actions")
check("动作数量受上限约束", isinstance(actions, list) and len(actions) <= 4, actions)
kinds = [item["type"] for item in actions]
check("危险动作被丢弃", "delete_entity" not in kinds, kinds)
fill = next((item for item in actions if item["type"] == "fill_form"), None)
check("fill_form 只保留可见字段", fill and fill["fields"] == {"事件名称": "欺骗暴露·改"}, fill)
update = next((item for item in actions if item["type"] == "update_entity"), None)
check("update_entity 过滤越权 ID 与非法字段", update and update["entity_id"] == eid and update["fields"] == {"name": "欺骗暴露·改"}, update)
nav = [item["page"] for item in actions if item["type"] == "navigate"]
check("navigate 只保留合法页面", nav == ["multipath"], nav)

# ---- 无上下文 / 空回复兜底 -------------------------------------------
REPLY = {}
r = chat({"messages": [{"role": "user", "content": "你好"}], "context": {}})
check("无上下文也能回答", r.status_code == 200 and bool(r.json().get("reply")), r.json())
check("空回复有兜底文案", "没有拿到足够信息" in r.json().get("reply", ""), r.json().get("reply"))

# ---- 无 Key ---------------------------------------------------------
assistant.ai_config_status = lambda: {"configured": False, "message": "未配置 API Key，请在「AI 接入」中填写" }
r = chat({"messages": [{"role": "user", "content": "你好"}]}, expect=503)
check("无 Key 返回 503 与提示", r.status_code == 503 and "AI 接入" in r.text, r.text[:120])
assistant.ai_config_status = lambda: {"configured": True, "message": ""}

# ---- AI 报错转译 -----------------------------------------------------
def _boom(**kwargs):
    raise RuntimeError("insufficient balance")


class _BadCompletions:
    def create(self, **kwargs):
        raise RuntimeError("insufficient balance")


assistant.get_client = lambda: SimpleNamespace(chat=SimpleNamespace(completions=_BadCompletions()))
r = chat({"messages": [{"role": "user", "content": "你好"}], "context": CONTEXT}, expect=502)
check("AI 额度不足有中文提示", r.status_code == 502 and "额度" in r.text, r.text[:120])
assistant.get_client = lambda: _Client()

# ---- 清理 -----------------------------------------------------------
db = SessionLocal()
try:
    db.query(models.Event).filter(models.Event.world_id == wid).delete()
    db.query(models.Character).filter(models.Character.world_id == wid).delete()
    db.query(models.World).filter(models.World.id == wid).delete()
    db.commit()
finally:
    db.close()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
