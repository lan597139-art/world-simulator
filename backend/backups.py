"""开发者备份：SQLite 一致性快照 + 上传目录，打包为可下载 ZIP。"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from auth import current_user
from database import get_db, engine

router = APIRouter()
NAME_RE = re.compile(r"^backup-[0-9]{8}-[0-9]{6}(-[0-9]{3})?\.zip$")
KEEP = 7


def _dir() -> Path:
    raw = os.getenv("WS_BACKUP_DIR", "").strip()
    if raw:
        path = Path(raw)
    elif Path("/data").exists():
        path = Path("/data/backups")
    else:
        path = Path(__file__).resolve().parent / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sqlite_path() -> Path:
    if not str(engine.url).startswith("sqlite"):
        raise HTTPException(status_code=400, detail="当前数据库不是 SQLite，无法使用内置备份")
    path = engine.url.database
    if not path:
        raise HTTPException(status_code=400, detail="无法定位数据库文件")
    return Path(path)


def _uploads() -> Path:
    raw = os.getenv("WS_UPLOAD_DIR", "").strip()
    if raw:
        return Path(raw)
    if Path("/data/uploads").exists():
        return Path("/data/uploads")
    return Path(__file__).resolve().parent / "uploads"


def _snapshot(db_path: Path, target: Path):
    source = sqlite3.connect(str(db_path))
    dest = sqlite3.connect(str(target))
    try:
        source.backup(dest)
    finally:
        dest.close()
        source.close()


def _zip_dir(zf: zipfile.ZipFile, root: Path, prefix: str):
    if not root.exists():
        return 0
    count = 0
    for path in root.rglob("*"):
        if path.is_file():
            try:
                zf.write(path, f"{prefix}/{path.relative_to(root)}")
                count += 1
            except OSError:
                continue
    return count


@router.post("/api/admin/backups")
def create_backup(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可创建备份")
    folder = _dir()
    now = datetime.utcnow()
    name = f"backup-{now.strftime('%Y%m%d-%H%M%S')}.zip"
    target = folder / name
    if target.exists():
        target = folder / f"backup-{now.strftime('%Y%m%d-%H%M%S')}-{now.microsecond // 1000:03d}.zip"
    snapshot = folder / f".{name}.db"
    files = 0
    try:
        _snapshot(_sqlite_path(), snapshot)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(snapshot, "worlds.db")
            files = _zip_dir(zf, _uploads(), "uploads")
            zf.writestr("manifest.json", json.dumps({
                "created_at": now.isoformat(),
                "database": "worlds.db",
                "uploads": files,
                "app": "world-simulator",
            }, ensure_ascii=False, indent=2))
    finally:
        snapshot.unlink(missing_ok=True)
    backups = sorted(folder.glob("backup-*.zip"), key=lambda item: item.stat().st_mtime, reverse=True)
    for old in backups[KEEP:]:
        old.unlink(missing_ok=True)
    return {"ok": True, "name": target.name, "size": target.stat().st_size, "uploads": files}


@router.get("/api/admin/backups")
def list_backups(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可查看备份")
    folder = _dir()
    items = []
    for path in sorted(folder.glob("backup-*.zip"), key=lambda item: item.stat().st_mtime, reverse=True):
        stat = path.stat()
        items.append({"name": path.name, "size": stat.st_size, "created_at": datetime.utcfromtimestamp(stat.st_mtime).isoformat()})
    return {"items": items, "keep": KEEP}


@router.get("/api/admin/backups/{name}")
def download_backup(name: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    if not user.is_owner:
        raise HTTPException(status_code=403, detail="仅开发者可下载备份")
    if not NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="备份文件名无效")
    path = _dir() / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="备份不存在")
    return FileResponse(path, media_type="application/zip", filename=name)
