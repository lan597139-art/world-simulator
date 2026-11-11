"""清理临时测试会话。"""

import hashlib
import os

import models
from database import SessionLocal

token = os.getenv("WS_TEST_TOKEN", "").strip()
if token:
    db = SessionLocal()
    db.query(models.AuthSession).filter(
        models.AuthSession.token_hash == hashlib.sha256(token.encode()).hexdigest()
    ).delete()
    db.commit()
    db.close()
