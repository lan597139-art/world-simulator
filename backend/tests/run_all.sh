#!/usr/bin/env bash
# 全量后端验收：逐个套件运行，任一失败即退出。
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PYTHON:-../venv/bin/python}"
export PYTHONPATH=.
SUITES=(smoke_flow smoke_writing smoke_character_runtime smoke_ai_access smoke_product smoke_workspace smoke_storyline smoke_official_storyline smoke_chat smoke_multipath smoke_assistant)
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
