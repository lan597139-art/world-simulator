"""含媒体世界包验收：ZIP 导出、媒体清单、导入落盘与 URL 回填。"""

import io
import os
import tempfile
import uuid
import zipfile
from pathlib import Path

os.environ.pop("WS_AUTH_DISABLED", None)
_upload = tempfile.mkdtemp(prefix="ws-package-upload-")
os.environ["WS_UPLOAD_DIR"] = _upload
Path(_upload, "creator_assets").mkdir(parents=True, exist_ok=True)
Path(_upload, "creator_assets", "portrait.webp").write_bytes(b"RIFF-fake-webp")
Path(_upload, "creator_assets", "cover.png").write_bytes(b"\x89PNG-fake")

from fastapi.testclient import TestClient

import main
import models
import storage
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
    user = models.AppUser(username=f"pkg-{suffix}", display_name="世界包验收", password_hash=hash_password("password-123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    world = models.World(name=f"媒体世界 {suffix}", owner_id=user.id, product_scene="game", map_image_url="/uploads/creator_assets/cover.png")
    db.add(world)
    db.commit()
    db.refresh(world)
    char = models.Character(world_id=world.id, name="带图角色", owner_user_id=user.id, basic_profile={"avatar": "/uploads/creator_assets/portrait.webp"})
    db.add(char)
    db.commit()
    world_id, username = world.id, user.username
    db.close()

    headers = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'username': username, 'password': 'password-123'}).json()['token']}"}
    export = client.get(f"/api/worlds/{world_id}/export-package", headers=headers)
    check("世界可导出含媒体 ZIP", export.status_code == 200 and export.headers.get("content-type", "").startswith("application/zip"), export.text[:200])
    if export.status_code == 200:
        with zipfile.ZipFile(io.BytesIO(export.content)) as zf:
            names = zf.namelist()
            manifest = zf.read("manifest.json").decode("utf-8")
        check("ZIP 含 world.json", "world.json" in names, names)
        check("ZIP 含两张媒体", len([n for n in names if n.startswith("media/")]) == 2, names)
        check("媒体清单记录原 URL", "/uploads/creator_assets/portrait.webp" in manifest, manifest[:300])

    imported = client.post("/api/worlds/import-package", headers=headers, files={"file": ("world.zip", export.content, "application/zip")})
    body = imported.json() if imported.status_code == 200 else {}
    check("含媒体 ZIP 可导入", imported.status_code == 200 and body.get("ok") is True, imported.text[:300])
    check("导入报告媒体数量", body.get("media") == 2, body)
    new_id = body.get("world_id")
    if new_id:
        payload = client.get(f"/api/worlds/{new_id}/export", headers=headers).json()
        avatar = (payload.get("characters") or [{}])[0].get("basic_profile", {}).get("avatar", "")
        map_url = payload.get("world", {}).get("map_image_url", "")
        check("人物头像 URL 已回填", avatar.startswith("/uploads/creator_assets/imported-"), avatar)
        check("世界地图 URL 已回填", map_url.startswith("/uploads/creator_assets/imported-"), map_url)
        check("媒体文件真实落盘", Path(_upload, "creator_assets", Path(avatar).name).is_file(), avatar)

    bad = client.post("/api/worlds/import-package", headers=headers, files={"file": ("bad.zip", b"not-a-zip", "application/zip")})
    check("拒绝非 ZIP", bad.status_code == 422, bad.text[:200])
    empty = io.BytesIO()
    with zipfile.ZipFile(empty, "w") as zf:
        zf.writestr("manifest.json", "{}")
    bad2 = client.post("/api/worlds/import-package", headers=headers, files={"file": ("empty.zip", empty.getvalue(), "application/zip")})
    check("拒绝缺少 world.json", bad2.status_code == 422, bad2.text[:200])

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
