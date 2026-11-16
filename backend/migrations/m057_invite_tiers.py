"""M057 D3：邀请码分层、批次与邀请奖励。"""

from sqlalchemy import text

from migrations.util import add_column, create_index

VERSION = "M057"


def apply(conn):
    add_column(conn, "invite_codes", "kind", "VARCHAR NOT NULL DEFAULT 'normal'")
    add_column(conn, "invite_codes", "batch", "VARCHAR NOT NULL DEFAULT ''")
    add_column(conn, "invite_codes", "scope", "VARCHAR NOT NULL DEFAULT 'registration'")
    add_column(conn, "invite_codes", "reward_fruit", "INTEGER NOT NULL DEFAULT 0")
    add_column(conn, "invite_codes", "reward_plant_type_id", "VARCHAR")
    add_column(conn, "invite_codes", "reward_plant_quantity", "INTEGER NOT NULL DEFAULT 0")
    add_column(conn, "invite_codes", "inviter_reward_fruit", "INTEGER NOT NULL DEFAULT 0")
    add_column(conn, "invite_redemptions", "reward_fruit", "INTEGER NOT NULL DEFAULT 0")
    add_column(conn, "invite_redemptions", "reward_granted_at", "DATETIME")
    create_index(conn, "ix_invite_codes_batch", "invite_codes", "batch")
    duplicate = conn.execute(text(
        "SELECT invite_id, user_id FROM invite_redemptions "
        "GROUP BY invite_id, user_id HAVING COUNT(*) > 1 LIMIT 1"
    )).first()
    if duplicate is None:
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_invite_redemption ON invite_redemptions (invite_id, user_id)"
        ))
    else:
        create_index(conn, "ix_invite_redemption_pair", "invite_redemptions", "invite_id, user_id")
