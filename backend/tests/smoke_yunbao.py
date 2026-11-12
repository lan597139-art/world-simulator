"""云宝单一人格、三态、权限与会话持久化验收。"""

import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

import auth
import assistant
import main
import models
import yunbao as cloud
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


def ensure_user(user_id: str, owner: bool = False) -> models.AppUser:
    db = SessionLocal()
    try:
        user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
        if not user:
            user = models.AppUser(
                id=user_id, username=user_id, display_name="云宝权限测试",
                is_active=True, is_owner=owner,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.is_owner = owner
            db.commit()
        return user
    finally:
        db.close()


def cleanup_ordinary():
    db = SessionLocal()
    try:
        threads = db.query(models.PersonaThread).filter(
            models.PersonaThread.owner_user_id == "test-yunbao-ordinary"
        ).all()
        for thread in threads:
            db.query(models.PersonaMessage).filter(
                models.PersonaMessage.thread_id == thread.id
            ).delete()
            db.delete(thread)
        db.query(models.PersonaMemory).filter(
            models.PersonaMemory.owner_user_id == "test-yunbao-ordinary"
        ).delete(synchronize_session=False)
        db.query(models.PersonaInstance).filter(
            models.PersonaInstance.owner_user_id == "test-yunbao-ordinary"
        ).delete(synchronize_session=False)
        db.query(models.AppUser).filter(
            models.AppUser.id == "test-yunbao-ordinary"
        ).delete()
        db.commit()
    finally:
        db.close()


def count_personas() -> tuple[int, int]:
    db = SessionLocal()
    try:
        total = db.query(models.PersonalPersona).count()
        legacy = db.query(models.PersonalPersona).filter(
            models.PersonalPersona.system_key.is_(None)
        ).count()
        return total, legacy
    finally:
        db.close()


# ---- 初始数据与幂等单例 ---------------------------------------------
cleanup_ordinary()
ordinary = ensure_user("test-yunbao-ordinary", owner=False)
ensure_user("local", owner=True)

before_total, before_legacy = count_personas()
db = SessionLocal()
try:
    first = cloud.ensure_yunbao(db)
    second = cloud.ensure_yunbao(db)
    first_id = first.id
    singleton = db.query(models.PersonalPersona).filter(
        models.PersonalPersona.system_key == "yunbao"
    ).count()
finally:
    db.close()

check("云宝初始化幂等，只产生一个单例", singleton == 1 and first_id == second.id, (singleton, first_id, second.id))
check("云宝不属于四个产品", first.product_key == "global", first.product_key)
r = client.post("/api/yunbao/state", json={"state": "rational"})
check("测试前归一为第一个常态", r.status_code == 200 and r.json().get("active_state") == "rational", r.text[:200])

# ---- 所有者读取与三态顺序 -------------------------------------------
r = client.get("/api/yunbao")
profile = r.json() if r.status_code == 200 else {}
states = profile.get("states") or []
labels = [item.get("label") for item in states]
keys = [item.get("key") for item in states]
check("所有者读取云宝 200", r.status_code == 200, r.text[:200])
check("云宝昵称固定", profile.get("name") == "云宝", profile.get("name"))
check("三种常态顺序与名称完全一致", labels == [
    "理智严肃不留情面", "回避社交不善言辞", "傲娇自信懒洋洋",
], labels)
check("三种常态 key 稳定", keys == ["rational", "withdrawn", "tsundere"], keys)
check("所有者可编辑", profile.get("can_edit") is True and profile.get("read_only") is False, profile)
check("云宝只有一个人格 id", profile.get("id") == first_id, profile.get("id"))

original = {
    "identity": profile.get("identity"),
    "description": profile.get("description"),
    "maturity": profile.get("maturity"),
    "biography": profile.get("biography"),
    "active_state": profile.get("active_state"),
}

# ---- 所有者编辑边界 -------------------------------------------------
r = client.patch("/api/yunbao", json={"maturity": "测试成熟度", "biography": "测试自传"})
check("所有者可保存人格字段", r.status_code == 200 and r.json().get("maturity") == "测试成熟度", r.text[:200])
r = client.patch("/api/yunbao", json={"name": "另一个名字"})
check("云宝昵称不能改名", r.status_code == 422, r.text[:200])
r = client.patch("/api/yunbao", json={"states": []})
check("状态定义不能从人格编辑接口修改", r.status_code == 422, r.text[:200])
r = client.patch("/api/yunbao", json={
    "identity": original["identity"], "description": original["description"],
    "maturity": original["maturity"], "biography": original["biography"],
})
check("恢复测试前人格字段", r.status_code == 200, r.text[:200])

# ---- 普通用户只读、可切态 -------------------------------------------
original_current = cloud._current
cloud._current = lambda request, db: ordinary
try:
    r = client.get("/api/yunbao")
    body = r.json() if r.status_code == 200 else {}
    check("普通用户可读取云宝", r.status_code == 200, r.text[:200])
    check("普通用户前端只读", body.get("can_edit") is False and body.get("read_only") is True, body)
    r = client.patch("/api/yunbao", json={"biography": "普通用户越权"})
    check("普通用户不能编辑人格", r.status_code == 403, r.text[:200])

    for key, label in (("rational", "理智严肃不留情面"), ("withdrawn", "回避社交不善言辞"), ("tsundere", "傲娇自信懒洋洋")):
        r = client.post("/api/yunbao/state", json={"state": key})
        check(f"普通用户不能切换状态 {label}", r.status_code == 403, r.text[:200])
    r = client.post("/api/yunbao/memories", json={"content": "普通用户越权写入"})
    check("普通用户不能写云宝记忆", r.status_code == 403, r.text[:200])
    r = client.delete("/api/yunbao/memories/not-exists")
    check("普通用户不能删除云宝记忆", r.status_code == 403, r.text[:200])

    r = client.post("/api/yunbao/threads", json={})
    check("普通用户可以创建自己的云宝会话", r.status_code == 200 and r.json().get("id"), r.text[:200])
    ordinary_thread = (r.json() or {}).get("id")
    if ordinary_thread:
        client.delete(f"/api/yunbao/threads/{ordinary_thread}")
finally:
    cloud._current = original_current

# ---- 完整人物种子与世界上下文进入云宝提示词 -------------------------
db = SessionLocal()
try:
    row = cloud.ensure_yunbao(db)
    owner = db.query(models.AppUser).filter(models.AppUser.id == "local").first()
    seed_char = cloud.ensure_seed_character(db, row, owner)
    prompt = cloud.profile_prompt(row, db=db, include_private=True)
    check("云宝有完整人物种子承载人物", seed_char is not None and seed_char.world_id, seed_char)
    check("云宝提示词包含完整人物种子", "完整人物种子" in prompt and "人格动力引擎" in prompt, prompt[:300])
    check("云宝提示词包含自己的世界", "云宝领域" in prompt and "世界人物" in prompt, prompt[-500:])
    public_prompt = cloud.profile_prompt(row, db=db, include_private=False)
    check("非所有者提示词不含云宝私密世界", "云宝领域" not in public_prompt and "完整人物种子" not in public_prompt, public_prompt[-300:])
finally:
    db.close()

# 恢复默认首个常态，避免影响后续体验。
r = client.post("/api/yunbao/state", json={"state": "rational"})
check("恢复默认首个常态", r.status_code == 200 and r.json().get("active_state") == "rational", r.text[:200])

# ---- AI 助手接入同一云宝会话 -----------------------------------------
CAPTURE = []
REPLY = {"reply": "我在，按当前常态回答。", "actions": []}


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

db = SessionLocal()
try:
    thread_before = db.query(models.PersonaThread).filter(
        models.PersonaThread.persona_id == first_id
    ).count()
finally:
    db.close()

chat_body = {
    "messages": [{"role": "user", "content": "用你的第一常态回答"}],
    "context": {"page": "home", "page_label": "选择产品"},
    "yunbao": {"thread_id": ""},
}
r = client.post("/api/assistant/chat", json=chat_body)
data = r.json() if r.status_code == 200 else {}
thread_id = data.get("thread_id")
check("助手可创建云宝会话", r.status_code == 200 and bool(thread_id), r.text[:300])
check("助手返回当前云宝身份与状态", data.get("yunbao", {}).get("id") == first_id and data.get("yunbao", {}).get("state", {}).get("key") == "rational", data.get("yunbao"))
check("助手上下文标签带云宝与常态", "云宝" in (data.get("context_label") or "") and "理智严肃不留情面" in (data.get("context_label") or ""), data.get("context_label"))

r = client.post("/api/yunbao/state", json={"state": "withdrawn"})
check("切换常态不创建新人格", r.status_code == 200 and r.json().get("persona_id") == first_id, r.text[:200])
chat_body["messages"] = [{"role": "user", "content": "现在用第二常态回答"}]
chat_body["yunbao"] = {"thread_id": thread_id}
r = client.post("/api/assistant/chat", json=chat_body)
data2 = r.json() if r.status_code == 200 else {}
check("同一会话切态后 thread_id 不变", r.status_code == 200 and data2.get("thread_id") == thread_id, (r.status_code, data2.get("thread_id"), thread_id))
check("同一会话切态后人格 id 不变", data2.get("yunbao", {}).get("id") == first_id, data2.get("yunbao"))
check("第二次提示已使用第二常态", "回避社交不善言辞" in (CAPTURE[-1]["messages"][0]["content"] if CAPTURE else ""), CAPTURE[-1]["messages"][0]["content"][:200] if CAPTURE else "no prompt")

r = client.get(f"/api/yunbao/threads/{thread_id}/messages")
rows = r.json() if r.status_code == 200 else []
states_in_messages = [item.get("meta", {}).get("state") for item in rows]
check("会话持久化四条消息", r.status_code == 200 and len(rows) == 4, len(rows) if isinstance(rows, list) else r.text[:200])
check("每条消息记录当时常态", states_in_messages == ["rational", "rational", "withdrawn", "withdrawn"], states_in_messages)

db = SessionLocal()
try:
    thread_after = db.query(models.PersonaThread).filter(
        models.PersonaThread.persona_id == first_id
    ).count()
finally:
    db.close()
check("云宝会话没有被切态复制", thread_after == thread_before + 1, (thread_before, thread_after))

r = client.post("/api/yunbao/state", json={"state": "rational"})
check("验收后恢复首个常态", r.status_code == 200 and r.json().get("active_state") == "rational", r.text[:200])

# ---- 所有者记忆维护与清理 -------------------------------------------
r = client.post("/api/yunbao/memories", json={"content": "云宝验收记忆", "importance": 0.8})
memory_id = (r.json() or {}).get("id") if r.status_code == 200 else None
check("所有者可写入云宝记忆", r.status_code == 200 and bool(memory_id), r.text[:200])
r = client.get("/api/yunbao/memories")
check("云宝记忆可读取", r.status_code == 200 and any(item.get("id") == memory_id for item in r.json()), r.text[:200])
r = client.delete(f"/api/yunbao/memories/{memory_id}")
check("所有者可删除测试记忆", r.status_code == 200, r.text[:200])
if thread_id:
    r = client.delete(f"/api/yunbao/threads/{thread_id}")
    check("清理测试会话", r.status_code == 200, r.text[:200])

# ---- 旧人格数据保持不变 ---------------------------------------------
after_total, after_legacy = count_personas()
check("未新增第二个人格记录", after_total == before_total, (before_total, after_total))
check("既有旧人格记录不迁移、不删除", after_legacy == before_legacy, (before_legacy, after_legacy))

# ---- 清理测试用户 ---------------------------------------------------
cleanup_ordinary()

print(f"===== {passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
