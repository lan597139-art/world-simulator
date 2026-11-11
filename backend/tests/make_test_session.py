"""创建本地用户的临时测试会话，只输出 token。"""

import hashlib
import secrets

import models
from database import SessionLocal

from datetime import datetime, timedelta

token = secrets.token_urlsafe(32)
db = SessionLocal()
db.add(models.AuthSession(
    user_id="local",
    token_hash=hashlib.sha256(token.encode()).hexdigest(),
    expires_at=datetime.utcnow() + timedelta(hours=2),
))
db.commit()
db.close()
print(token)
