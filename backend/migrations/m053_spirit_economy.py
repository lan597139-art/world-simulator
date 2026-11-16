"""M053 灵果经济：账户、灵植目录、库存与用户流水。"""

from sqlalchemy import text

VERSION = "M053"


def apply(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_accounts (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL UNIQUE,
            fruit_balance INTEGER NOT NULL DEFAULT 0,
            developer_exempt BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_plant_types (
            id VARCHAR PRIMARY KEY,
            key VARCHAR NOT NULL UNIQUE,
            name VARCHAR NOT NULL,
            category VARCHAR NOT NULL,
            description TEXT DEFAULT '',
            price_fruit INTEGER NOT NULL DEFAULT 60,
            unit VARCHAR DEFAULT '株',
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_inventory (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            plant_type_id VARCHAR NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            updated_at DATETIME,
            UNIQUE (user_id, plant_type_id)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_transactions (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            kind VARCHAR NOT NULL,
            fruit_amount INTEGER NOT NULL DEFAULT 0,
            plant_type_id VARCHAR,
            plant_quantity INTEGER NOT NULL DEFAULT 0,
            balance_after INTEGER NOT NULL DEFAULT 0,
            counterparty_user_id VARCHAR,
            ref_type VARCHAR DEFAULT '',
            ref_id VARCHAR DEFAULT '',
            note TEXT DEFAULT '',
            meta JSON,
            created_at DATETIME
        )
    """))
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_spirit_transactions_user_time ON spirit_transactions (user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_transactions_kind ON spirit_transactions (kind)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_inventory_user ON spirit_inventory (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_plant_types_category ON spirit_plant_types (category)",
    ):
        conn.execute(text(statement))
