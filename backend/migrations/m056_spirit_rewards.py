"""M056 D2/D5/D7：奖励规则、领取记录、创建消耗幂等。"""

from sqlalchemy import text

VERSION = "M056"


def apply(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_reward_rules (
            id VARCHAR PRIMARY KEY,
            key VARCHAR NOT NULL UNIQUE,
            name VARCHAR NOT NULL,
            description TEXT DEFAULT '',
            category VARCHAR NOT NULL DEFAULT 'event',
            fruit_amount INTEGER NOT NULL DEFAULT 0,
            plant_type_id VARCHAR,
            plant_quantity INTEGER NOT NULL DEFAULT 0,
            claim_mode VARCHAR NOT NULL DEFAULT 'once',
            condition JSON,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            daily_limit INTEGER NOT NULL DEFAULT 1,
            total_limit INTEGER NOT NULL DEFAULT 1,
            cooldown_seconds INTEGER NOT NULL DEFAULT 0,
            starts_at DATETIME,
            ends_at DATETIME,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_reward_claims (
            id VARCHAR PRIMARY KEY,
            rule_id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            claim_key VARCHAR NOT NULL,
            fruit_amount INTEGER NOT NULL DEFAULT 0,
            plant_type_id VARCHAR,
            plant_quantity INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            UNIQUE (rule_id, user_id, claim_key)
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS spirit_operations (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            operation VARCHAR NOT NULL,
            idempotency_key VARCHAR NOT NULL,
            result JSON,
            created_at DATETIME,
            UNIQUE (user_id, operation, idempotency_key)
        )
    """))
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_spirit_reward_rules_category ON spirit_reward_rules (category)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_reward_claims_user_time ON spirit_reward_claims (user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_reward_claims_rule_time ON spirit_reward_claims (rule_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_spirit_operations_user_time ON spirit_operations (user_id, created_at)",
    ):
        conn.execute(text(statement))
