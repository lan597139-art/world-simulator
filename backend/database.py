import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. 优先读取 DATABASE_URL
_raw_url = os.getenv("DATABASE_URL", "").strip()

# 2. 如果没有 DATABASE_URL，再读取 DB_PATH（Fly.io 环境）
if not _raw_url:
    db_path = os.getenv("DB_PATH", "").strip()
    if db_path:
        # 如果传进来的路径没带协议头，自动补全为 sqlite 绝对路径（注意是四个斜杠）
        if not db_path.startswith("sqlite:"):
            _raw_url = f"sqlite:///{db_path}"
        else:
            _raw_url = db_path
    else:
        # 3. 本地开发时的默认回退路径
        _raw_url = "sqlite:///./world_simulator.db"

# 兼容 Render / Fly 的 postgres:// 写法
if _raw_url.startswith("postgres://"):
    _raw_url = "postgresql+psycopg://" + _raw_url[len("postgres://"):]
elif _raw_url.startswith("postgresql://"):
    _raw_url = "postgresql+psycopg://" + _raw_url[len("postgresql://"):]

SQLALCHEMY_DATABASE_URL = _raw_url
IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

_engine_kwargs = {"pool_pre_ping": not IS_SQLITE}
if IS_SQLITE:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)


if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _):
        """SQLite 默认不启用外键，逐连接打开。"""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# 获取数据库会话的依赖函数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()