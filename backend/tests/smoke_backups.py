"""开发者备份验收：快照、媒体打包、列表、下载与权限。"""

import os
import tempfile
import uuid
import zipfile
from pathlib import Path

os.environ.pop("WS_AUTH_DISABLED", None)
_backup_dir = tempfile.mkdtemp(prefix="ws-backup-")
_upload_dir = tempfile.mkdtemp(prefix="ws-upload-")
os.environ["WS_BACKUP_DIR"] = _backup_dir
os.environ["WS_UPLOAD_DIR"] = _upload_dir
Path(_upload_dir, "hello.txt").write_text("media payload", encoding="utf-8")

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
    owner = models.AppUser(username=f"backup-owner-{suffix}", display_name="备份验收", password_hash=hash_password("password-123"), is_owner=True)
    member = models.AppUser(username=f"backup-member-{suffix}", display_name="普通用户", password_hash=hash_password("password-123"))
    db.add_all([owner, member])
    db.commit()
    db.refresh(owner)
    db.refresh(member)
    owner_name, member_name = owner.username, member.username
    owner_id, member_id = owner.id, member.id
    db.close()

    oh = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'username': owner_name, 'password': 'password-123'}).json()['token']}"}
    mh = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'username': member_name, 'password': 'password-123'}).json()['token']}"}

    created = client.post("/api/admin/backups", headers=oh)
    body = created.json() if created.status_code == 200 else {}
    name = body.get("name", "")
    check("开发者可创建备份", created.status_code == 200 and body.get("ok") is True and name.startswith("backup-"), created.text[:300])
    check("备份包含媒体计数", body.get("uploads", 0) >= 1, body)

    listed = client.get("/api/admin/backups", headers=oh)
    check("备份列表可读取", listed.status_code == 200 and any(row["name"] == name for row in listed.json().get("items", [])), listed.text[:300])

    download = client.get(f"/api/admin/backups/{name}", headers=oh)
    check("备份可下载", download.status_code == 200 and download.headers.get("content-type", "").startswith("application/zip"), download.text[:300])
    if download.status_code == 200:
        path = Path(_backup_dir) / name
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
            manifest = zf.read("manifest.json").decode("utf-8")
        check("ZIP 含数据库", "worlds.db" in names, names[:10])
        check("ZIP 含上传文件", "uploads/hello.txt" in names, names[:10])
        check("ZIP 含 manifest", "world-simulator" in manifest, manifest[:200])

    denied = client.post("/api/admin/backups", headers=mh)
    check("普通用户不能创建备份", denied.status_code == 403, denied.text[:300])
    denied_list = client.get("/api/admin/backups", headers=mh)
    check("普通用户不能查看备份", denied_list.status_code == 403, denied_list.text[:300])
    denied_download = client.get(f"/api/admin/backups/{name}", headers=mh)
    check("普通用户不能下载备份", denied_download.status_code == 403, denied_download.text[:300])
    bad = client.get("/api/admin/backups/..%2Fworlds.db", headers=oh)
    check("拒绝路径穿越", bad.status_code in {400, 404}, bad.text[:300])

    print(f"\n===== {passed} passed, {failed} failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main_test()
