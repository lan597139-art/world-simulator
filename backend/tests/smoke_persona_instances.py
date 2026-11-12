"""Phase N1-M2：云宝定义/版本/实例、会话与记忆按实例隔离。"""

from fastapi.testclient import TestClient

import main  # noqa: F401  触发建表 + 迁移 + 云宝引导
import models
import yunbao as cloud
from database import SessionLocal

client = TestClient(main.app)

passed = 0
failed = 0
ORDINARY_ID = "test-m2-ordinary"


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def ensure_user(user_id: str, owner: bool = False) -> models.AppUser:
    db = SessionLocal()
    try:
        user = db.query(models.AppUser).filter(models.AppUser.id == user_id).first()
        if not user:
            user = models.AppUser(
                id=user_id, username=user_id, display_name="M2 测试用户",
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
            models.PersonaThread.owner_user_id == ORDINARY_ID
        ).all()
        for thread in threads:
            db.query(models.PersonaMessage).filter(
                models.PersonaMessage.thread_id == thread.id
            ).delete()
            db.delete(thread)
        db.query(models.PersonaMemory).filter(
            models.PersonaMemory.owner_user_id == ORDINARY_ID
        ).delete(synchronize_session=False)
        db.query(models.PersonaInstance).filter(
            models.PersonaInstance.owner_user_id == ORDINARY_ID
        ).delete(synchronize_session=False)
        db.query(models.AppUser).filter(models.AppUser.id == ORDINARY_ID).delete()
        db.commit()
    finally:
        db.close()


def run():
    global passed, failed
    original_current = cloud._current
    cleanup_ordinary()
    ensure_user("local", owner=True)
    ordinary = ensure_user(ORDINARY_ID, owner=False)

    db = SessionLocal()
    try:
        local = db.query(models.AppUser).filter(models.AppUser.id == "local").first()
        persona = cloud.ensure_yunbao(db)
        owner_instance = cloud.ensure_yunbao_instance(db, local)
        ordinary_instance = cloud.ensure_yunbao_instance(db, ordinary)
        owner_instance_again = cloud.ensure_yunbao_instance(db, local)
        definition = db.query(models.PersonaDefinition).filter(
            models.PersonaDefinition.id == owner_instance.definition_id
        ).first()
        version = db.query(models.PersonaVersion).filter(
            models.PersonaVersion.id == owner_instance.version_id
        ).first()
        owner_threads = db.query(models.PersonaThread).filter(
            models.PersonaThread.persona_id == persona.id,
            models.PersonaThread.owner_user_id == "local",
        ).all()
        old_companions = db.query(models.PersonalPersona).filter(
            models.PersonalPersona.product_key == "companion",
            models.PersonalPersona.system_key.is_(None),
        ).all()
        old_threads = db.query(models.PersonaThread).filter(
            models.PersonaThread.instance_id.is_(None)
        ).all()
        legacy_memories = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.status == "legacy_unscoped"
        ).count()

        persona_id = persona.id
        owner_instance_id = owner_instance.id
        owner_definition_id = owner_instance.definition_id
        owner_version_id = owner_instance.version_id
        ordinary_instance_id = ordinary_instance.id
        ordinary_definition_id = ordinary_instance.definition_id
        ordinary_version_id = ordinary_instance.version_id
        owner_instance_again_id = owner_instance_again.id
        owner_thread_instance_ids = [item.instance_id for item in owner_threads]
        old_companion_count = len(old_companions)
        old_thread_instance_ids = [item.instance_id for item in old_threads]
        definition_system_key = definition.system_key if definition else None
        definition_scope = definition.scope if definition else None
        version_no = version.version_no if version else None
        version_name = (version.payload or {}).get("name") if version else None
    finally:
        db.close()

    check(
        "云宝定义存在且为全局",
        definition_system_key == "yunbao" and definition_scope == "global",
        (definition_system_key, definition_scope),
    )
    check("云宝初始版本 v1 有完整快照", version_no == 1 and version_name == "云宝", (version_no, version_name))
    check("所有者实例属于 local", owner_instance_id is not None, owner_instance_id)
    check("普通用户获得独立实例", ordinary_instance_id != owner_instance_id, (ordinary_instance_id, owner_instance_id))
    check(
        "两个实例共享定义与版本",
        ordinary_definition_id == owner_definition_id and ordinary_version_id == owner_version_id,
        (ordinary_definition_id, ordinary_version_id),
    )
    check("实例引导幂等", owner_instance_again_id == owner_instance_id, (owner_instance_id, owner_instance_again_id))
    check("云宝旧会话已绑定实例或不存在", all(item == owner_instance_id for item in owner_thread_instance_ids), owner_thread_instance_ids)
    check("旧 companion 人格仍保留", old_companion_count >= 6, old_companion_count)
    check("旧 companion 会话未被绑定", all(item is None for item in old_thread_instance_ids), old_thread_instance_ids)
    check("旧 companion 记忆仍为 legacy", legacy_memories >= 1, legacy_memories)

    db = SessionLocal()
    legacy_cloud_id = None
    legacy_cloud_ok = False
    try:
        legacy_cloud = models.PersonaMemory(
            persona_id=persona_id,
            owner_user_id="local",
            status="legacy_unscoped",
            content="云宝 legacy 测试记忆",
            importance=0.1,
            source="test",
        )
        db.add(legacy_cloud)
        db.commit()
        legacy_cloud_id = legacy_cloud.id
        local_row = db.query(models.AppUser).filter(models.AppUser.id == "local").first()
        cloud.ensure_yunbao_instance(db, local_row)
        db.refresh(legacy_cloud)
        legacy_cloud_ok = (
            legacy_cloud.status == "legacy_unscoped"
            and legacy_cloud.persona_instance_id is None
        )
    finally:
        if legacy_cloud_id:
            db.query(models.PersonaMemory).filter(
                models.PersonaMemory.id == legacy_cloud_id
            ).delete(synchronize_session=False)
            db.commit()
        db.close()
    check("云宝 legacy 记忆不被实例绑定或激活", legacy_cloud_ok, legacy_cloud_id)

    r = client.get("/api/yunbao")
    profile = r.json() if r.status_code == 200 else {}
    check("云宝资料返回实例标识", r.status_code == 200 and profile.get("instance_id") == owner_instance_id, profile.get("instance_id"))

    # ---- 会话隔离 ----
    cloud._current = lambda request, db: ordinary
    r = client.post("/api/yunbao/threads", json={"title": "普通用户会话"})
    ordinary_thread = (r.json() or {}).get("id") if r.status_code == 200 else None
    check("普通用户可创建自己的云宝会话", r.status_code == 200 and bool(ordinary_thread), r.text[:200])
    r = client.get("/api/yunbao/threads")
    ordinary_ids = {item["id"] for item in (r.json() if r.status_code == 200 else [])}
    check("普通用户列表包含自己的会话", ordinary_thread in ordinary_ids, ordinary_ids)

    cloud._current = original_current
    r = client.get("/api/yunbao/threads")
    owner_ids = {item["id"] for item in (r.json() if r.status_code == 200 else [])}
    check("所有者列表不包含普通用户会话", ordinary_thread not in owner_ids, (ordinary_thread, owner_ids))

    r = client.post("/api/yunbao/memories", json={"content": "所有者实例记忆", "importance": 0.7})
    owner_memory = (r.json() or {}).get("id") if r.status_code == 200 else None
    check("所有者可写入云宝记忆", r.status_code == 200 and bool(owner_memory), r.text[:200])

    db = SessionLocal()
    try:
        memory_row = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.id == owner_memory
        ).first()
        memory_instance = memory_row.persona_instance_id if memory_row else None
        memory_owner = memory_row.owner_user_id if memory_row else None
        ordinary_memory = models.PersonaMemory(
            persona_id=persona_id,
            owner_user_id=ORDINARY_ID,
            persona_instance_id=ordinary_instance_id,
            source_kind="conversation",
            status="active",
            content="普通用户实例记忆",
            importance=0.6,
            source="test",
        )
        db.add(ordinary_memory)
        db.commit()
        ordinary_memory_id = ordinary_memory.id
    finally:
        db.close()

    check("记忆写入绑定 owner 与实例", memory_owner == "local" and memory_instance == owner_instance_id, (memory_owner, memory_instance))

    cloud._current = lambda request, db: ordinary
    r = client.get("/api/yunbao/memories")
    ordinary_memories = {item["id"] for item in (r.json() if r.status_code == 200 else [])}
    check("普通用户只读到自己的记忆", ordinary_memory_id in ordinary_memories and owner_memory not in ordinary_memories, (ordinary_memory_id, owner_memory, ordinary_memories))
    r = client.post("/api/yunbao/memories", json={"content": "越权写入"})
    check("普通用户不能写入云宝记忆", r.status_code == 403, r.text[:200])

    cloud._current = original_current
    r = client.get("/api/yunbao/memories")
    owner_memories = {item["id"] for item in (r.json() if r.status_code == 200 else [])}
    check("所有者列表不包含普通用户记忆", owner_memory in owner_memories and ordinary_memory_id not in owner_memories, (owner_memory, ordinary_memory_id, owner_memories))

    # ---- 清理测试数据 ----
    if ordinary_thread:
        cloud._current = lambda request, db: ordinary
        client.delete(f"/api/yunbao/threads/{ordinary_thread}")
        cloud._current = original_current
    if owner_memory:
        client.delete(f"/api/yunbao/memories/{owner_memory}")
    db = SessionLocal()
    try:
        db.query(models.PersonaMemory).filter(
            models.PersonaMemory.id == ordinary_memory_id
        ).delete()
        db.commit()
    finally:
        db.close()

    cleanup_ordinary()
    cloud._current = original_current

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
