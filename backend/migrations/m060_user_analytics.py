"""M060 用户创作与画像分析：作品点击量字段。

- 作品表新增点击量字段，与既有阅读量（view_count）分离：
  阅读量统计详情打开，点击量统计作品卡片/详情入口点击，二者口径不同。
- 历史作品数据保持原样，点击量从 0 起算，不回填虚构值。
"""

from sqlalchemy import text

VERSION = "M060"


def apply(conn):
    conn.execute(
        text("ALTER TABLE community_publications ADD COLUMN click_count INTEGER DEFAULT 0")
    )
