"""M059 内容社区与体验中心合并：作者内容权限、灵果体验授权与作品点赞。

- 社区作品新增作者内容权限字段：普通公开范围、灵果体验开关与消耗。
  experience_fruit 默认 NULL，表示灵果体验尚未定价，不虚构数值。
- 版本新增灵果体验深度内容字段（默认 NULL）。
- 新增作品点赞表与灵果体验授权表，均以 (作品, 用户) 唯一约束防重复。
- 历史作品数据保持原样，仅补列默认值，不改动任何已有互动记录。
"""

from sqlalchemy import text

VERSION = "M059"


def apply(conn):
    # 作者内容权限字段（历史行取默认值：普通公开、灵果体验关闭、未定价）。
    conn.execute(
        text("ALTER TABLE community_publications ADD COLUMN public_visible BOOLEAN DEFAULT 1")
    )
    conn.execute(
        text("ALTER TABLE community_publications ADD COLUMN experience_enabled BOOLEAN DEFAULT 0")
    )
    conn.execute(
        text("ALTER TABLE community_publications ADD COLUMN experience_fruit INTEGER")
    )
    conn.execute(
        text("ALTER TABLE community_publication_versions ADD COLUMN experience_snapshot JSON")
    )

    # 作品点赞表。
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS community_likes (
            id VARCHAR PRIMARY KEY,
            publication_id VARCHAR NOT NULL,
            owner_user_id VARCHAR NOT NULL,
            created_at DATETIME,
            UNIQUE (publication_id, owner_user_id)
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_community_likes_publication ON community_likes (publication_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_community_likes_user ON community_likes (owner_user_id)"))

    # 灵果体验授权表。
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS community_experience_grants (
            id VARCHAR PRIMARY KEY,
            publication_id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            fruit_amount INTEGER NOT NULL DEFAULT 0,
            transaction_id VARCHAR,
            created_at DATETIME,
            UNIQUE (publication_id, user_id)
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_community_grants_publication ON community_experience_grants (publication_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_community_grants_user ON community_experience_grants (user_id)"))
