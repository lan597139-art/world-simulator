import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# 本地默认 SQLite；线上用 DATABASE_URL 指向持久磁盘。
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./world_simulator.db")

_engine_kwargs = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_engine_kwargs)


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
