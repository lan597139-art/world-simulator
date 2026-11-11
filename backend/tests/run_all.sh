#!/usr/bin/env bash
# 全量后端验收：逐个套件运行，任一失败即退出。
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-../venv/bin/python}"
export PYTHONPATH=.
# 既有业务回归在单用户本地模式下运行；认证行为由 smoke_auth 单独覆盖。
export WS_AUTH_DISABLED=1
# 少量套件走真实 HTTP，需要临时会话；结束时清理。
export WS_TEST_TOKEN="$("$PY" tests/make_test_session.py)"
cleanup() { "$PY" tests/clear_test_session.py >/dev/null 2>&1 || true; }
trap cleanup EXIT
SUITES=(smoke_flow smoke_auth smoke_writing smoke_character_runtime smoke_ai_access smoke_product smoke_workspace smoke_storyline smoke_event_choices smoke_story_threads smoke_self_avatar smoke_diary smoke_biography_citations smoke_official_storyline smoke_chat smoke_multipath smoke_assistant)
total=0
for suite in "${SUITES[@]}"; do
  line="$("$PY" "tests/${suite}.py" | tail -1)"
  count="$(printf '%s' "$line" | sed -n 's/.*===== \([0-9]*\) passed.*/\1/p')"
  total=$((total + ${count:-0}))
  printf '%-30s %s\n' "$suite" "$line"
done
printf 'TOTAL %s passed across %s suites\n' "$total" "${#SUITES[@]}"
echo "== 迁移副本演练 =="
"$PY" migrations/rehearse.py | tail -3
