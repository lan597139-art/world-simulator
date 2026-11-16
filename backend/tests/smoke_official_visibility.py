"""官方演示世界可见性：普通用户、产品筛选、跨产品保留。"""

import os
import uuid

os.environ.pop("WS_AUTH_DISABLED", None)

from fastapi.testclient import TestClient

import main
import models
from auth import hash_password
from database import SessionLocal

client = TestClient(main.app)
passed = failed = 0
suffix = uuid.uuid4().hex[:6]


def check(name, condition, extra=None):
    global passed, failed
    if condition:
        passed += 1
        print(f"PASS {name}")
    else:
        failed += 1
        print(f"FAIL {name} extra={extra}")


def main_test():
    db = SessionLocal()
    official = db.query(models.World).filter(models.World.is_official.is_(True)).first()
    check("官方演示世界存在", official is not None)
    check("官方演示世界归属游戏创作", official is not None and official.product_scene == "game", official.product_scene if official else None)
    official_id = official.id
    user = models.AppUser(username=f"official-view-{suffix}", display_name="官方世界验收", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    username = user.username
    db.close()

    login = client.post("/api/auth/login", json={"username": username, "password": "password-123"})
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    for scene in ("game", "literature", "companion", "diary"):
        response = client.get(f"/api/worlds?product_scene={scene}", headers=headers)
        rows = response.json() if response.status_code == 200 else []
        hit = next((row for row in rows if row.get("id") == official_id), None)
        check(f"普通用户在产品 {scene} 能看到官方世界", response.status_code == 200 and hit is not None, response.text[:300])
        if hit:
            check(f"产品 {scene} 官方世界带只读标识", hit.get("is_official") is True and hit.get("access_role") == "none", hit)

    detail = client.get(f"/api/worlds/{official_id}", headers=headers)
    check("普通用户可打开官方世界", detail.status_code == 200 and detail.json().get("is_official") is True, detail.text[:300])

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
