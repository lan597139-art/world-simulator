"""HTTP 套件鉴权：run_all 预置的临时会话 token。"""

import os


def auth_headers(extra=None):
    headers = dict(extra or {})
    token = os.getenv("WS_TEST_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers
