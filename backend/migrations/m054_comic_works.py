"""M054 漫画工作台：章节、图片页与作品图片资产。"""

from sqlalchemy import text

VERSION = "M054"


def apply(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS comic_chapters (
            id VARCHAR PRIMARY KEY,
            work_id VARCHAR NOT NULL,
            title VARCHAR NOT NULL,
            summary TEXT DEFAULT '',
            order_index INTEGER NOT NULL DEFAULT 0,
            status VARCHAR NOT NULL DEFAULT 'draft',
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS comic_pages (
            id VARCHAR PRIMARY KEY,
            work_id VARCHAR NOT NULL,
            chapter_id VARCHAR NOT NULL,
            image_url VARCHAR NOT NULL,
            caption TEXT DEFAULT '',
            kind VARCHAR NOT NULL DEFAULT 'page',
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME,
            updated_at DATETIME
        )
    """))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS comic_assets (
            id VARCHAR PRIMARY KEY,
            work_id VARCHAR NOT NULL,
            kind VARCHAR NOT NULL DEFAULT 'illustration',
            title VARCHAR NOT NULL,
            file_url VARCHAR NOT NULL,
            mime_type VARCHAR DEFAULT '',
            file_size INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME
        )
    """))
    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_comic_chapters_work_order ON comic_chapters (work_id, order_index)",
        "CREATE INDEX IF NOT EXISTS ix_comic_pages_chapter_order ON comic_pages (chapter_id, order_index)",
        "CREATE INDEX IF NOT EXISTS ix_comic_pages_work ON comic_pages (work_id)",
        "CREATE INDEX IF NOT EXISTS ix_comic_assets_work ON comic_assets (work_id)",
    ):
        conn.execute(text(statement))
