"""M058 灵果货币体系重构：调整灵植兑换价与注册奖励默认值。

主线四统一虚拟货币：取消现金商业体系，灵果为平台唯一资源消耗单位。
本迁移只更新灵植目录价格与注册奖励默认值，**不修改任何用户余额、
灵植库存或历史流水**，确保既有用户数据与账本保持完整。

- 世界灵植：100 灵果/株（仅用于创建世界）。
- OC 灵植：30 灵果/株（仅用于创建 OC）。
- 新账户注册奖励：500 灵果。
"""

from sqlalchemy import text

VERSION = "M058"


def apply(conn):
    # 灵植目录价格对齐主线四规则；按 key 更新，避免依赖行顺序。
    conn.execute(
        text("UPDATE spirit_plant_types SET price_fruit = 100 WHERE key = 'world_seed'")
    )
    conn.execute(
        text("UPDATE spirit_plant_types SET price_fruit = 30 WHERE key = 'oc_seed'")
    )
    # 新账户初始灵果；历史账户余额不在迁移中改动。
    conn.execute(
        text("UPDATE spirit_reward_rules SET fruit_amount = 500 WHERE key = 'registration_bonus'")
    )
