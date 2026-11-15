"""M052 创作中心统一作品元数据。"""

from sqlalchemy import text

VERSION = "M052"


def apply(conn):
    # models.Base.metadata.create_all 会先创建新表；这里保证旧库/手工升级也得到同一张表。
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS creative_works (
            id VARCHAR PRIMARY KEY,
            owner_user_id VARCHAR NOT NULL,
            scene VARCHAR NOT NULL,
            title VARCHAR NOT NULL,
            summary TEXT DEFAULT '',
            category VARCHAR DEFAULT '',
            status VARCHAR NOT NULL DEFAULT 'draft',
            cover_url VARCHAR DEFAULT '',
            world_ids JSON DEFAULT '[]',
            character_ids JSON DEFAULT '[]',
            settings JSON DEFAULT '{}',
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_creative_works_owner_scene ON creative_works (owner_user_id, scene, updated_at)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_creative_works_owner_status ON creative_works (owner_user_id, status, updated_at)"))
