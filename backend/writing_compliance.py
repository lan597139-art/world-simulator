"""写作敏感词：用户自维护词表 + 正文扫描。

不做平台级词库推断，也不内置任何具体词条；词表完全由用户导入/维护。
"""

from __future__ import annotations

import re
from datetime import datetime
from functools import lru_cache

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

import models
from auth import current_user
from common import fail
from database import get_db

router = APIRouter()

MAX_WORDS = 5000
MAX_TEXT = 200_000


def _now() -> datetime:
    return datetime.utcnow()


@lru_cache(maxsize=16)
def _compile(words: tuple[str, ...]) -> re.Pattern[str]:
    ordered = sorted({word for word in words if word}, key=len, reverse=True)
    return re.compile("|".join(re.escape(word) for word in ordered), re.IGNORECASE)


def _normalize_word(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()[:48]


@router.get("/api/writing/sensitive-words")
def list_words(request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    rows = (
        db.query(models.WritingSensitiveWord)
        .filter(models.WritingSensitiveWord.owner_user_id == user.id)
        .order_by(models.WritingSensitiveWord.word.asc())
        .all()
    )
    return [
        {
            "id": row.id,
            "word": row.word,
            "category": row.category or "通用",
            "severity": row.severity or "warn",
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.put("/api/writing/sensitive-words")
def save_words(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    raw = payload.get("words") or []
    if not isinstance(raw, list):
        fail(422, "VALIDATION_ERROR", "words 必须是数组")
    replace = bool(payload.get("replace"))
    normalized: dict[str, dict] = {}
    for item in raw:
        if isinstance(item, str):
            word, category, severity = _normalize_word(item), "通用", "warn"
        elif isinstance(item, dict):
            word = _normalize_word(item.get("word") or "")
            category = str(item.get("category") or "通用")[:40]
            severity = str(item.get("severity") or "warn")
            if severity not in {"warn", "block"}:
                severity = "warn"
        else:
            continue
        if word:
            normalized[word] = {"word": word, "category": category, "severity": severity}
    if len(normalized) > MAX_WORDS:
        fail(422, "TOO_MANY_WORDS", f"最多维护 {MAX_WORDS} 个词")
    if replace:
        db.query(models.WritingSensitiveWord).filter(
            models.WritingSensitiveWord.owner_user_id == user.id
        ).delete(synchronize_session=False)
    existing = {
        row.word: row
        for row in db.query(models.WritingSensitiveWord)
        .filter(models.WritingSensitiveWord.owner_user_id == user.id)
        .all()
    }
    for word, meta in normalized.items():
        row = existing.get(word)
        if row:
            row.category = meta["category"]
            row.severity = meta["severity"]
            row.updated_at = _now()
        else:
            db.add(
                models.WritingSensitiveWord(
                    owner_user_id=user.id,
                    word=word,
                    category=meta["category"],
                    severity=meta["severity"],
                )
            )
    db.commit()
    return {"status": "ok", "count": len(normalized)}


@router.delete("/api/writing/sensitive-words/{word_id}")
def delete_word(word_id: str, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    row = db.query(models.WritingSensitiveWord).filter(models.WritingSensitiveWord.id == word_id).first()
    if not row or row.owner_user_id != user.id:
        fail(404, "NOT_FOUND", "词条不存在")
    db.delete(row)
    db.commit()
    return {"status": "ok", "deleted": True}


@router.post("/api/writing/sensitive-scan")
def scan_text(payload: dict, request: Request, db: Session = Depends(get_db)):
    user = current_user(request, db)
    text = str(payload.get("text") or "")
    if len(text) > MAX_TEXT:
        fail(422, "TEXT_TOO_LONG", f"单次最多扫描 {MAX_TEXT} 字")
    rows = (
        db.query(models.WritingSensitiveWord)
        .filter(models.WritingSensitiveWord.owner_user_id == user.id)
        .all()
    )
    words = [row.word for row in rows if row.word]
    if not words or not text:
        return {"hits": [], "total": 0, "word_count": len(words), "text_length": len(text)}
    pattern = _compile(tuple(sorted(words)))
    meta = {row.word: row for row in rows}
    hits: dict[str, dict] = {}
    for match in pattern.finditer(text):
        word = match.group(0)
        key = word.lower()
        row = meta.get(word) or next((item for item in rows if item.word.lower() == key), None)
        bucket = hits.setdefault(
            key,
            {
                "word": word,
                "count": 0,
                "severity": row.severity if row else "warn",
                "category": row.category if row else "通用",
                "positions": [],
            },
        )
        bucket["count"] += 1
        if len(bucket["positions"]) < 20:
            bucket["positions"].append(match.start())
    result = sorted(hits.values(), key=lambda item: (-item["count"], item["word"]))
    return {
        "hits": result,
        "total": sum(item["count"] for item in result),
        "word_count": len(words),
        "text_length": len(text),
    }
