"""迁移器：create_all 之后执行，按版本号登记，全部步骤幂等。"""

import importlib
import logging

from sqlalchemy import text

from database import engine

logger = logging.getLogger("migrations")

MODULES = [
    "m001_world_foundation",
    "m002_geography",
    "m003_organization",
    "m004_relationship_history",
    "m005_rules_time",
    "m006_society_resource",
    "m007_event_entities",
    "m008_relationship_events",
    "m009_relationship_type_fixes",
    "m010_event_time_columns",
    "m011_writing_workspace",
    "m012_character_runtime",
    "m013_simulation_presets",
    "m014_archive_trash_snapshots",
    "m015_multipath",
]


def run_migrations() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """CREATE TABLE IF NOT EXISTS schema_migrations (
                       version TEXT PRIMARY KEY,
                       applied_at DATETIME,
                       note TEXT DEFAULT ''
                   )"""
            )
        )
        applied = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}
        for name in MODULES:
            module = importlib.import_module(f"migrations.{name}")
            version = getattr(module, "VERSION", name)
            if version in applied:
                continue
            logger.info("applying migration %s", version)
            module.apply(conn)
            conn.execute(
                text(
                    "INSERT INTO schema_migrations (version, applied_at, note) "
                    "VALUES (:v, datetime('now'), :n)"
                ),
                {"v": version, "n": name},
            )
    logger.info("migrations up to date")
