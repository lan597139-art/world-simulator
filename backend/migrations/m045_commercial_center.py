"""M045 商业与服务中心：余额账户、会员、订单、流水、AI 用量与创作者结算。"""

from sqlalchemy import text

VERSION = "M045"

TABLES = [
    """CREATE TABLE IF NOT EXISTS billing_accounts (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, balance_cents INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'CNY', ai_monthly_call_limit INTEGER DEFAULT 0,
        created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS billing_memberships (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active', cycle TEXT DEFAULT '', started_at DATETIME,
        expires_at DATETIME, auto_renew BOOLEAN DEFAULT 0, created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS billing_orders (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, sku TEXT DEFAULT '',
        title TEXT DEFAULT '', amount_cents INTEGER DEFAULT 0, currency TEXT DEFAULT 'CNY',
        status TEXT DEFAULT 'pending', payment_method TEXT DEFAULT '', paid_at DATETIME,
        details JSON DEFAULT '{}', created_at DATETIME, updated_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS billing_ledger_entries (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, order_id TEXT, entry_type TEXT NOT NULL,
        amount_cents INTEGER DEFAULT 0, balance_after_cents INTEGER DEFAULT 0,
        description TEXT DEFAULT '', details JSON DEFAULT '{}', created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS billing_ai_usage (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, route TEXT DEFAULT '',
        provider TEXT DEFAULT 'platform', model TEXT DEFAULT '', status_code INTEGER DEFAULT 200,
        units INTEGER DEFAULT 1, created_at DATETIME
    )""",
    """CREATE TABLE IF NOT EXISTS billing_settlements (
        id TEXT PRIMARY KEY, creator_id TEXT NOT NULL, period_start DATETIME, period_end DATETIME,
        gross_cents INTEGER DEFAULT 0, platform_fee_cents INTEGER DEFAULT 0,
        net_cents INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', details JSON DEFAULT '{}',
        created_at DATETIME, paid_at DATETIME
    )""",
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_billing_accounts_user ON billing_accounts(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_memberships_user ON billing_memberships(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_billing_orders_user_time ON billing_orders(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_billing_ledger_user_time ON billing_ledger_entries(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_billing_ai_usage_user_time ON billing_ai_usage(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_billing_settlements_creator_time ON billing_settlements(creator_id, created_at)",
]


def apply(conn):
    for sql in TABLES:
        conn.execute(text(sql))
    for sql in INDEXES:
        conn.execute(text(sql))
