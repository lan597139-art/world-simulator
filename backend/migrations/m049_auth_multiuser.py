"""M049 公开注册：邮箱、邀请码、邮箱验证待处理注册。"""

from sqlalchemy import text

from .util import add_column, create_index

VERSION = "M049"


def apply(conn):
    add_column(conn, "app_users", "email", "TEXT")
    add_column(conn, "app_users", "email_verified_at", "DATETIME")
    create_index(conn, "ix_app_users_email", "app_users", "email")
    conn.execute(text("""CREATE UNIQUE INDEX IF NOT EXISTS ux_app_users_email
                         ON app_users(email) WHERE email IS NOT NULL"""))
    conn.execute(text("""CREATE TABLE IF NOT EXISTS invite_codes (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        code_prefix TEXT DEFAULT '',
        label TEXT DEFAULT '',
        created_by TEXT NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at DATETIME,
        revoked_at DATETIME,
        created_at DATETIME,
        last_used_at DATETIME
    )"""))
    create_index(conn, "ix_invite_codes_code_hash", "invite_codes", "code_hash")
    conn.execute(text("""CREATE TABLE IF NOT EXISTS invite_redemptions (
        id TEXT PRIMARY KEY,
        invite_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        redeemed_at DATETIME,
        FOREIGN KEY(invite_id) REFERENCES invite_codes(id) ON DELETE CASCADE
    )"""))
    create_index(conn, "ix_invite_redemptions_invite_id", "invite_redemptions", "invite_id")
    create_index(conn, "ix_invite_redemptions_user_id", "invite_redemptions", "user_id")
    conn.execute(text("""CREATE TABLE IF NOT EXISTS pending_registrations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT DEFAULT '',
        password_hash TEXT NOT NULL,
        invite_id TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        code_expires_at DATETIME NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_sent_at DATETIME,
        consumed_at DATETIME,
        created_at DATETIME
    )"""))
    create_index(conn, "ix_pending_registrations_email", "pending_registrations", "email")
    create_index(conn, "ix_pending_registrations_username", "pending_registrations", "username")
    create_index(conn, "ix_pending_registrations_invite_id", "pending_registrations", "invite_id")
