"""M036 Phase N1-M1：个人内容与 AI 归属字段（只加列、回填，不改行为）。

边界：
- 只新增 nullable / 带默认值的列与索引，不删列、不删行、不改语义。
- 现有数据 owner 统一回填为本地账号 `local`；无法推导的才保留 NULL。
- 旧 persona/character 记忆标记为 `legacy_unscoped`，等待 M2/M4 实例化后再启用。
- 6 条旧 companion 人格、3 条人物传记、3 个 Story、世界关系均不迁移、不删除。
"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M036"


def apply(conn):
    # ---- 日记：从 DiaryEntry 扩展为 JournalEntry 的类别/敏感度/状态 ----
    add_column(conn, "diary_entries", "entry_type", "TEXT NOT NULL DEFAULT 'diary'")
    add_column(conn, "diary_entries", "info_class", "TEXT NOT NULL DEFAULT 'basic'")
    add_column(conn, "diary_entries", "sensitivity", "TEXT NOT NULL DEFAULT 'normal'")
    add_column(conn, "diary_entries", "status", "TEXT NOT NULL DEFAULT 'active'")
    add_column(conn, "diary_entries", "date_end", "TEXT")
    conn.execute(text(
        "UPDATE diary_entries SET entry_type = 'diary' WHERE entry_type IS NULL OR entry_type = ''"
    ))
    conn.execute(text(
        "UPDATE diary_entries SET info_class = 'basic' WHERE info_class IS NULL OR info_class = ''"
    ))
    conn.execute(text(
        "UPDATE diary_entries SET sensitivity = 'normal' WHERE sensitivity IS NULL OR sensitivity = ''"
    ))
    conn.execute(text(
        "UPDATE diary_entries SET status = 'active' WHERE status IS NULL OR status = ''"
    ))
    create_index(conn, "ix_diary_entries_owner_type", "diary_entries", "owner_user_id, entry_type")

    # ---- 写作章节与人物传记：补 owner，便于后续按用户鉴权 ----
    add_column(conn, "stories", "owner_user_id", "TEXT")
    conn.execute(text("UPDATE stories SET owner_user_id = 'local' WHERE owner_user_id IS NULL"))
    create_index(conn, "ix_stories_owner_user_id", "stories", "owner_user_id")

    add_column(conn, "character_biographies", "owner_user_id", "TEXT")
    conn.execute(text(
        "UPDATE character_biographies SET owner_user_id = 'local' WHERE owner_user_id IS NULL"
    ))
    create_index(conn, "ix_character_biographies_owner_user_id", "character_biographies", "owner_user_id")

    # ---- 人格会话：为实例化预留键；旧会话默认 chat ----
    add_column(conn, "persona_threads", "instance_id", "TEXT")
    add_column(conn, "persona_threads", "version_id", "TEXT")
    add_column(conn, "persona_threads", "kind", "TEXT NOT NULL DEFAULT 'chat'")
    conn.execute(text(
        "UPDATE persona_threads SET kind = 'chat' WHERE kind IS NULL OR kind = ''"
    ))
    create_index(
        conn, "ix_persona_threads_owner_instance",
        "persona_threads", "owner_user_id, instance_id",
    )

    # ---- 角色聊天会话：补 owner 与实例键；旧数据归本地用户 ----
    add_column(conn, "chat_threads", "owner_user_id", "TEXT")
    add_column(conn, "chat_threads", "persona_instance_id", "TEXT")
    conn.execute(text("UPDATE chat_threads SET owner_user_id = 'local' WHERE owner_user_id IS NULL"))
    create_index(
        conn, "ix_chat_threads_owner_instance",
        "chat_threads", "owner_user_id, persona_instance_id",
    )

    # ---- 人格记忆：owner / 实例 / 授权来源 / 生命周期 ----
    add_column(conn, "persona_memories", "owner_user_id", "TEXT")
    add_column(conn, "persona_memories", "persona_instance_id", "TEXT")
    add_column(conn, "persona_memories", "source_grant_id", "TEXT")
    add_column(conn, "persona_memories", "source_kind", "TEXT NOT NULL DEFAULT 'conversation'")
    add_column(conn, "persona_memories", "status", "TEXT NOT NULL DEFAULT 'active'")
    add_column(conn, "persona_memories", "invalidated_at", "DATETIME")
    add_column(conn, "persona_memories", "deleted_at", "DATETIME")
    add_column(conn, "persona_memories", "content_hash", "TEXT")
    # 旧记忆没有实例，不能安全召回；先标记 legacy，不删除正文。
    conn.execute(text(
        "UPDATE persona_memories SET owner_user_id = COALESCE("
        "(SELECT owner_user_id FROM personal_personas "
        " WHERE personal_personas.id = persona_memories.persona_id), 'local') "
        "WHERE owner_user_id IS NULL"
    ))
    conn.execute(text(
        "UPDATE persona_memories SET source_kind = 'conversation' "
        "WHERE source_kind IS NULL OR source_kind = ''"
    ))
    conn.execute(text(
        "UPDATE persona_memories SET status = 'legacy_unscoped' "
        "WHERE status = 'active' AND persona_instance_id IS NULL"
    ))
    create_index(
        conn, "ix_persona_memories_owner_instance",
        "persona_memories", "owner_user_id, persona_instance_id",
    )
    create_index(conn, "ix_persona_memories_status", "persona_memories", "status")

    # ---- 角色记忆：补 owner 与实例键；旧数据 legacy ----
    add_column(conn, "character_memories", "owner_user_id", "TEXT")
    add_column(conn, "character_memories", "persona_instance_id", "TEXT")
    add_column(conn, "character_memories", "status", "TEXT NOT NULL DEFAULT 'active'")
    conn.execute(text(
        "UPDATE character_memories SET owner_user_id = 'local' WHERE owner_user_id IS NULL"
    ))
    conn.execute(text(
        "UPDATE character_memories SET status = 'legacy_unscoped' "
        "WHERE status = 'active' AND persona_instance_id IS NULL"
    ))
    create_index(
        conn, "ix_character_memories_owner_instance",
        "character_memories", "owner_user_id, persona_instance_id",
    )

    # ---- AiRole 仅增加可选投影键，不改变现有世界 NPC 聊天 ----
    add_column(conn, "ai_roles", "persona_instance_id", "TEXT")
    create_index(conn, "ix_ai_roles_persona_instance", "ai_roles", "persona_instance_id")
