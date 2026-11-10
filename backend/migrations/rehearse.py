"""在 sqlite 副本上演练全部迁移（不触碰线上/本地正式库）。

用法（在 backend/ 下）：
    PYTHONPATH=. ../venv/bin/python migrations/rehearse.py
    ... --source world_simulator.db --keep
"""

import argparse
import os
import shutil
import tempfile
from pathlib import Path

from sqlalchemy import create_engine, event, text

import models
from migrations import runner


def _source_path(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    url = os.getenv("DATABASE_URL", "sqlite:///./world_simulator.db")
    if not url.startswith("sqlite:///"):
        raise SystemExit("仅支持 sqlite 副本演练；请用 --source 指定 .db 文件")
    return Path(url.replace("sqlite:///", "", 1)).expanduser().resolve()


def rehearse(source: Path, keep: bool) -> int:
    if not source.exists():
        raise SystemExit(f"源数据库不存在：{source}")
    fd, temp_name = tempfile.mkstemp(prefix="ws-migrate-", suffix=".db")
    os.close(fd)
    target = Path(temp_name)
    shutil.copy2(source, target)
    print(f"演练副本：{target}（源：{source}）")

    engine = create_engine(f"sqlite:///{target}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _pragmas(conn, _):
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    original = runner.engine
    runner.engine = engine
    try:
        models.Base.metadata.create_all(bind=engine)
        runner.run_migrations()
        runner.run_migrations()  # 第二次验证幂等
        with engine.connect() as conn:
            applied = {row[0] for row in conn.execute(text("SELECT version FROM schema_migrations"))}
            tables = conn.execute(
                text("SELECT count(*) FROM sqlite_master WHERE type='table'")
            ).scalar()
        expected = set()
        import importlib
        for name in runner.MODULES:
            module = importlib.import_module(f"migrations.{name}")
            expected.add(getattr(module, "VERSION", name))
        missing = sorted(expected - applied)
        print(f"迁移记录：{len(applied)} / 预期 {len(expected)}；表数量：{tables}")
        if missing:
            print(f"❌ 未应用的迁移：{missing}")
            return 1
        print("✅ 迁移副本演练通过（重复执行无新增）")
        return 0
    finally:
        runner.engine = original
        engine.dispose()
        if keep:
            print(f"保留副本：{target}")
        else:
            target.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="sqlite 迁移副本演练")
    parser.add_argument("--source", help="源 .db 文件，默认取 DATABASE_URL")
    parser.add_argument("--keep", action="store_true", help="保留演练副本")
    args = parser.parse_args()
    raise SystemExit(rehearse(_source_path(args.source), args.keep))
