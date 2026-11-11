"""M028 选择点持久化排序。"""

from sqlalchemy import text

from .util import add_column

VERSION = "M028"


def apply(conn):
    add_column(conn, "event_choices", "order_index", "INTEGER DEFAULT 0")
    # 既有选择按创建时间回填顺序，避免全部为 0 后排序不稳定。
    conn.execute(
        text(
            """
            WITH ranked AS (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at, id) - 1 AS rn
                FROM event_choices
            )
            UPDATE event_choices
            SET order_index = (SELECT rn FROM ranked WHERE ranked.id = event_choices.id)
            WHERE order_index IS NULL OR order_index = 0
            """
        )
    )
