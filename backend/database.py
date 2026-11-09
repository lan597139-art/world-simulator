from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# 使用 SQLite 数据库，文件会生成在 backend 目录下
SQLALCHEMY_DATABASE_URL = "sqlite:///./world_simulator.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)


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
