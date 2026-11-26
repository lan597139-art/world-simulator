"""M062 活动灵植福利截止时间。

「世界灵植 / 活动灵植」是平台福利，需要明确的时间截止。本迁移：

- 为 ``spirit_plant_types`` 增加 ``expires_at`` 列（为空表示长期有效）。
- 为存量活动灵植（key 形如 ``event_plant_*``）补一个 30 天的截止时间，
  让福利在时间上可控；长期灵植（world_seed / oc_seed）不受影响。

仅新增列与默认截止，不改动价格、库存或历史流水。
"""

from sqlalchemy import text

VERSION = "M062"


def apply(conn):
    # 新建库时 create_all 已带该列，先探测再补充，避免重复列报错。
    columns = {row[1] for row in conn.execute(text("PRAGMA table_info(spirit_plant_types)"))}
    if "expires_at" not in columns:
        conn.execute(
            text("ALTER TABLE spirit_plant_types ADD COLUMN expires_at DATETIME")
        )
    conn.execute(
        text(
            "UPDATE spirit_plant_types "
            "SET expires_at = datetime('now', '+30 days') "
            "WHERE key LIKE 'event_plant_%' AND expires_at IS NULL"
        )
    )
