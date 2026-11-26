"""AI 用量日志：仅记录调用次数，不产生任何资源账户或费用结算。

平台统一采用虚拟货币灵果作为资源消耗单位；AI 调用不消耗灵果，也不存在
AI 专属资源账户，因此这里只做轻量用量统计，不涉及充值、订单、账本或结算。
记录内容不含提示词、响应内容或 API Key，仅保留路由、来源与状态码。
"""

from __future__ import annotations

import os
import re

from database import SessionLocal

import models

_AI_ROUTE_PATTERNS = (
    re.compile(r"^/api/simulate$"),
    re.compile(r"^/api/assistant/chat$"),
    re.compile(r"^/api/writing/(generate|assist|extract)$"),
    re.compile(r"^/api/branches/"),
    re.compile(r"^/api/writings/[^/]+/(analyze|extract)$"),
    re.compile(r"^/api/characters/[^/]+/biography/generate$"),
    re.compile(r"^/api/events/[^/]+/directions/suggest$"),
    re.compile(r"^/api/personas/[^/]+/chat$"),
    re.compile(r"^/api/chat/threads/[^/]+/(messages|turns|memories/summarize|impact/preview)$"),
)


def is_ai_usage_route(path: str) -> bool:
    if path == "/api/ai/status":
        return False
    return any(pattern.search(path) for pattern in _AI_ROUTE_PATTERNS)


def record_ai_usage(user_id: str, path: str, personal: bool, status_code: int, model: str = "", method: str = "POST") -> None:
    """轻量记录 AI 调用次数；不记录提示词、响应或 Key。"""
    if not user_id or method.upper() == "GET" or not is_ai_usage_route(path):
        return
    if (os.getenv("WS_BILLING_USAGE_LOG", "1") or "").strip().lower() in {"0", "false", "no", "off"}:
        return
    db = SessionLocal()
    try:
        db.add(models.BillingAiUsage(
            user_id=user_id,
            route=path[:160],
            provider="personal" if personal else "platform",
            model=(model or "")[:120],
            status_code=int(status_code),
            units=1,
        ))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
