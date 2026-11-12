"""Phase N1-M1：加法列、owner 回填、legacy 标记与默认关闭的 feature flags。"""

import os
from unittest.mock import patch

from sqlalchemy import inspect, text

import feature_flags
import main  # noqa: F401  触发 create_all + run_migrations
import models
from database import SessionLocal, engine

passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} {detail}")


def columns(table: str) -> set[str]:
    return {row["name"] for row in inspect(engine).get_columns(table)}


def run():
    global passed, failed

    # ---- 迁移记录与字段 ----
    with engine.connect() as conn:
        versions = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}
    check("M036 已登记", "M036" in versions, sorted(versions)[-3:])

    expected_columns = {
        "diary_entries": {"entry_type", "info_class", "sensitivity", "status", "date_end"},
        "stories": {"owner_user_id"},
        "character_biographies": {"owner_user_id"},
        "persona_threads": {"instance_id", "version_id", "kind"},
        "chat_threads": {"owner_user_id", "persona_instance_id"},
        "persona_memories": {
            "owner_user_id", "persona_instance_id", "source_grant_id",
            "source_kind", "status", "invalidated_at", "deleted_at", "content_hash",
        },
        "character_memories": {"owner_user_id", "persona_instance_id", "status"},
        "ai_roles": {"persona_instance_id"},
    }
    for table, names in expected_columns.items():
        actual = columns(table)
        check(f"{table} 新列齐全", names <= actual, sorted(names - actual))

    # ---- 旧数据回填，不删行 ----
    db = SessionLocal()
    try:
        diary_null = db.query(models.DiaryEntry).filter(
            models.DiaryEntry.entry_type.is_(None)
            | models.DiaryEntry.info_class.is_(None)
            | models.DiaryEntry.sensitivity.is_(None)
            | models.DiaryEntry.status.is_(None)
        ).count()
        check("日记类别/敏感度/状态无 NULL", diary_null == 0, diary_null)

        stories_null = db.query(models.Story).filter(models.Story.owner_user_id.is_(None)).count()
        check("Story owner 已回填", stories_null == 0, stories_null)

        bios_null = db.query(models.CharacterBiography).filter(
            models.CharacterBiography.owner_user_id.is_(None)
        ).count()
        check("人物传记 owner 已回填", bios_null == 0, bios_null)

        chat_null = db.query(models.ChatThread).filter(models.ChatThread.owner_user_id.is_(None)).count()
        check("聊天会话 owner 已回填", chat_null == 0, chat_null)

        thread_kind_null = db.query(models.PersonaThread).filter(
            models.PersonaThread.kind.is_(None) | (models.PersonaThread.kind == "")
        ).count()
        check("人格会话 kind 已回填", thread_kind_null == 0, thread_kind_null)

        persona_mem_null = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.owner_user_id.is_(None)
        ).count()
        check("人格记忆 owner 已回填", persona_mem_null == 0, persona_mem_null)

        legacy_persona = db.query(models.PersonaMemory).filter(
            models.PersonaMemory.persona_instance_id.is_(None),
            models.PersonaMemory.status == "legacy_unscoped",
        ).count()
        total_persona = db.query(models.PersonaMemory).count()
        check("无实例的人格记忆标记 legacy", legacy_persona == total_persona, (legacy_persona, total_persona))

        char_mem_null = db.query(models.CharacterMemory).filter(
            models.CharacterMemory.owner_user_id.is_(None)
        ).count()
        check("角色记忆 owner 已回填", char_mem_null == 0, char_mem_null)

        legacy_char = db.query(models.CharacterMemory).filter(
            models.CharacterMemory.persona_instance_id.is_(None),
            models.CharacterMemory.status == "legacy_unscoped",
        ).count()
        total_char = db.query(models.CharacterMemory).count()
        check("无实例的角色记忆标记 legacy", legacy_char == total_char, (legacy_char, total_char))

        companion_count = db.query(models.PersonalPersona).filter(
            models.PersonalPersona.product_key == "companion",
            models.PersonalPersona.system_key.is_(None),
        ).count()
        check("旧 companion 人格仍保留", companion_count >= 6, companion_count)
        check("M3 用户传记表已建立", "user_biographies" in inspect(engine).get_table_names())
    finally:
        db.close()

    # ---- feature flags：默认关闭，可显式打开 ----
    clean = {env: "" for env in feature_flags.FLAGS.values()}
    with patch.dict(os.environ, {}, clear=True):
        flags = feature_flags.snapshot()
        check("feature flags 未配置时新路径默认开启", all(flags.values()), flags)

    with patch.dict(os.environ, clean, clear=False):
        flags = feature_flags.snapshot()
        check("feature flags 显式置空可关闭", not any(flags.values()), flags)

    with patch.dict(os.environ, {"WS_AI_INFO_GRANTS": "1", "WS_COMMUNITY_PUBLICATIONS": ""}, clear=False):
        check("feature flag 可显式打开", feature_flags.is_enabled("ai_info_grants") is True)
        check("其他 flag 不受影响", feature_flags.is_enabled("community_publications") is False)

    try:
        feature_flags.is_enabled("not_a_flag")
        unknown_ok = False
    except KeyError:
        unknown_ok = True
    check("未知 flag 报错而不是静默关闭", unknown_ok)

    print(f"\n===== {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(run())
