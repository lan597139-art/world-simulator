"""对象存储适配：本地磁盘（默认）或 S3 兼容存储。

部署时通过环境变量切换，不把二进制塞进 PostgreSQL：
WS_STORAGE_BACKEND=local|s3
WS_UPLOAD_DIR=./uploads
WS_S3_BUCKET / WS_S3_ENDPOINT / WS_S3_REGION / WS_S3_ACCESS_KEY / WS_S3_SECRET_KEY
WS_S3_PUBLIC_BASE（可选，CDN/自定义域名）
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

LOCAL_PREFIX = "/uploads/creator_assets"


def backend_name() -> str:
    explicit = os.getenv("WS_STORAGE_BACKEND", "").strip().lower()
    if explicit in {"local", "s3"}:
        return explicit
    return "s3" if os.getenv("WS_S3_BUCKET", "").strip() else "local"


def upload_root() -> Path:
    root = Path(os.getenv("WS_UPLOAD_DIR", str(Path(__file__).resolve().parent / "uploads")))
    (root / "creator_assets").mkdir(parents=True, exist_ok=True)
    return root


def _s3_client():
    import boto3

    endpoint = os.getenv("WS_S3_ENDPOINT", "").strip() or None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=os.getenv("WS_S3_REGION", "auto").strip() or "auto",
        aws_access_key_id=os.getenv("WS_S3_ACCESS_KEY", "").strip() or None,
        aws_secret_access_key=os.getenv("WS_S3_SECRET_KEY", "").strip() or None,
    )


def _public_url(key: str) -> str:
    base = os.getenv("WS_S3_PUBLIC_BASE", "").strip()
    if base:
        return f"{base.rstrip('/')}/{quote(key)}"
    bucket = os.getenv("WS_S3_BUCKET", "").strip()
    endpoint = os.getenv("WS_S3_ENDPOINT", "").strip()
    region = os.getenv("WS_S3_REGION", "").strip()
    if endpoint:
        return f"{endpoint.rstrip('/')}/{bucket}/{quote(key)}"
    suffix = f".s3.{region}.amazonaws.com" if region and region != "auto" else ".s3.amazonaws.com"
    return f"https://{bucket}{suffix}/{quote(key)}"


def save(key: str, data: bytes, content_type: str = "") -> dict:
    """保存文件，返回前端可直接使用的 URL 与存储位置。"""
    if backend_name() == "s3":
        bucket = os.getenv("WS_S3_BUCKET", "").strip()
        if not bucket:
            raise RuntimeError("WS_S3_BUCKET 未配置")
        object_key = f"creator_assets/{key}"
        extra = {"ContentType": content_type} if content_type else {}
        _s3_client().put_object(Bucket=bucket, Key=object_key, Body=data, **extra)
        return {
            "file_url": _public_url(object_key),
            "storage": "s3",
            "storage_key": object_key,
        }
    path = upload_root() / "creator_assets" / key
    path.write_bytes(data)
    return {
        "file_url": f"{LOCAL_PREFIX}/{key}",
        "storage": "local",
        "storage_key": key,
    }


def delete(file_url: str) -> None:
    """只删除本系统管理的对象；外部 URL 原样保留。"""
    if not file_url:
        return
    if file_url.startswith(LOCAL_PREFIX + "/"):
        name = Path(file_url).name
        path = upload_root() / "creator_assets" / name
        if path.exists():
            path.unlink()
        return
    if backend_name() == "s3" and "/creator_assets/" in file_url:
        bucket = os.getenv("WS_S3_BUCKET", "").strip()
        key = file_url.split("/creator_assets/", 1)[1].split("?", 1)[0]
        if bucket and key:
            try:
                _s3_client().delete_object(Bucket=bucket, Key=f"creator_assets/{key}")
            except Exception:
                # 删除远端失败不应阻断数据库清理；由运维在对象存储侧做生命周期回收。
                pass
