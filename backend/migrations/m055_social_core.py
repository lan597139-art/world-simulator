"""M055 社区核心：个人动态、互动、拉黑与好友私信。"""

from sqlalchemy import text

VERSION = "M055"


def apply(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS social_posts (
            id VARCHAR PRIMARY KEY,
            author_id VARCHAR NOT NULL,
            body TEXT DEFAULT '',
            media_urls JSON,
            channels JSON,
            visibility VARCHAR NOT NULL DEFAULT 'public',
            work_id VARCHAR,
            world_id VARCHAR,
            character_id VARCHAR,
            story_id VARCHAR,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS social_post_likes (
            id VARCHAR PRIMARY KEY,
            post_id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            created_at DATETIME,
            UNIQUE (post_id, user_id)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS social_post_comments (
            id VARCHAR PRIMARY KEY,
            post_id VARCHAR NOT NULL,
            author_id VARCHAR NOT NULL,
            parent_id VARCHAR,
            body TEXT NOT NULL,
            created_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS social_blocks (
            id VARCHAR PRIMARY KEY,
            blocker_id VARCHAR NOT NULL,
            blocked_id VARCHAR NOT NULL,
            created_at DATETIME,
            UNIQUE (blocker_id, blocked_id)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS direct_messages (
            id VARCHAR PRIMARY KEY,
            sender_id VARCHAR NOT NULL,
            recipient_id VARCHAR NOT NULL,
            body TEXT DEFAULT '',
            image_url VARCHAR,
            read_at DATETIME,
            created_at DATETIME
        )
    """))
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_social_posts_author_time ON social_posts (author_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_social_posts_time ON social_posts (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_social_comments_post_time ON social_post_comments (post_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_direct_messages_pair ON direct_messages (sender_id, recipient_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_direct_messages_recipient_unread ON direct_messages (recipient_id, read_at)",
        "CREATE INDEX IF NOT EXISTS ix_social_blocks_pair ON social_blocks (blocker_id, blocked_id)",
    ):
        conn.execute(text(statement))
