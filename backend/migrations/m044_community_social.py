"""M044 内容社区社交：讨论、小组、关注、好友、动态通知。"""

from sqlalchemy import text

VERSION = "M044"

TABLES = [
    """CREATE TABLE IF NOT EXISTS community_topics (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, category TEXT DEFAULT 'discussion',
        title TEXT NOT NULL, body TEXT DEFAULT '', tags JSON DEFAULT '[]', status TEXT DEFAULT 'active',
        view_count INTEGER DEFAULT 0, created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_topic_replies (
        id TEXT PRIMARY KEY, topic_id TEXT NOT NULL REFERENCES community_topics(id) ON DELETE CASCADE,
        owner_user_id TEXT NOT NULL, body TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_groups (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '',
        category TEXT DEFAULT 'interest', visibility TEXT DEFAULT 'public', status TEXT DEFAULT 'active',
        created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_group_members (
        id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL, role TEXT DEFAULT 'member', status TEXT DEFAULT 'active', created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_group_posts (
        id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
        owner_user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '', status TEXT DEFAULT 'active',
        created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_group_replies (
        id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES community_group_posts(id) ON DELETE CASCADE,
        owner_user_id TEXT NOT NULL, body TEXT DEFAULT '', status TEXT DEFAULT 'active', created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_follows (
        id TEXT PRIMARY KEY, follower_id TEXT NOT NULL, followee_id TEXT NOT NULL, created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_friend_requests (
        id TEXT PRIMARY KEY, requester_id TEXT NOT NULL, addressee_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending', message TEXT DEFAULT '', created_at DATETIME, responded_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_friendships (
        id TEXT PRIMARY KEY, user_a_id TEXT NOT NULL, user_b_id TEXT NOT NULL, created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS community_notifications (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT DEFAULT 'system', actor_id TEXT,
        object_type TEXT, object_id TEXT, title TEXT DEFAULT '', body TEXT DEFAULT '',
        read_at DATETIME, created_at DATETIME
    )""",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_community_topics_status_time ON community_topics(status, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_community_topic_replies_topic ON community_topic_replies(topic_id)",
    "CREATE INDEX IF NOT EXISTS ix_community_groups_status_time ON community_groups(status, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_community_group_members_group ON community_group_members(group_id)",
    "CREATE INDEX IF NOT EXISTS ix_community_group_posts_group ON community_group_posts(group_id)",
    "CREATE INDEX IF NOT EXISTS ix_community_group_replies_post ON community_group_replies(post_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_community_follow ON community_follows(follower_id, followee_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_community_group_member ON community_group_members(group_id, user_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_community_friendship ON community_friendships(user_a_id, user_b_id)",
    "CREATE INDEX IF NOT EXISTS ix_community_notifications_user_time ON community_notifications(user_id, created_at)",
]


def apply(conn):
    for sql in TABLES:
        conn.execute(text(sql))
    for sql in INDEXES:
        conn.execute(text(sql))
