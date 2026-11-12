"""Phase N1 feature flags.

M1 建立开关；M2–M6 的新路径默认启用（未设置环境变量时），显式设为
0/false/off 可回滚到旧路径。测试清理环境变量后为空字符串，仍视为关闭。
"""

from __future__ import annotations

import os
from typing import Final

from fastapi import Depends, HTTPException

FLAGS: Final[dict[str, str]] = {
    "persona_instances": "WS_PERSONA_INSTANCES",
    "user_journal_v2": "WS_USER_JOURNAL_V2",
    "ai_info_grants": "WS_AI_INFO_GRANTS",
    "community_publications": "WS_COMMUNITY_PUBLICATIONS",
}

# 未显式配置时，M2–M6 的路径默认启用；显式空字符串仍视为关闭。
DEFAULT_ENABLED: Final[dict[str, bool]] = {name: True for name in FLAGS}


def _truthy(raw: str | None) -> bool:
    return (raw or "").strip().lower() in {"1", "true", "yes", "on"}


def is_enabled(name: str) -> bool:
    """读取开关；未注册的名称直接报错，避免拼写错误静默关闭。"""
    if name not in FLAGS:
        raise KeyError(f"unknown feature flag: {name}")
    raw = os.getenv(FLAGS[name])
    if raw is None:
        return DEFAULT_ENABLED[name]
    return _truthy(raw)


def snapshot() -> dict[str, bool]:
    """当前进程的开关快照，便于诊断和测试。"""
    return {name: is_enabled(name) for name in FLAGS}


def require(name: str):
    """FastAPI 依赖：关闭时返回 404，避免暴露未启用功能。"""
    def dependency() -> None:
        if not is_enabled(name):
            raise HTTPException(status_code=404, detail="功能未启用")
    return Depends(dependency)
