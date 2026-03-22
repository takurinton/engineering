#!/usr/bin/env bash
# engineering テンプレートスキルを呼び出し元プロジェクトに同期する
#
# 使い方:
#   ./engineering/scripts/sync.sh            # .claude/sync-vars.conf から変数を読む
#   ./engineering/scripts/sync.sh --dry-run  # 差分だけ表示（書き込みしない）
#
# 設定ファイル: <PROJECT_ROOT>/.claude/sync-vars.conf (KEY=VALUE 形式)
#   REPO=owner/repo
#   BUILD_COMMAND=cd frontend && pnpm run build
#   CI_WORKFLOW=ci.yaml
#   MESSAGE_FETCH_COMMAND=make weekly-messages
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(pwd)"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# --- 設定ファイル ---
CONF="$PROJECT_ROOT/.claude/sync-vars.conf"
if [ ! -f "$CONF" ]; then
  echo "ERROR: $CONF not found"
  echo "Create it with template variable values. Example:"
  echo "  REPO=owner/repo"
  echo "  BUILD_COMMAND=cd frontend && pnpm run build"
  echo "  CI_WORKFLOW=regression.yaml"
  echo "  MESSAGE_FETCH_COMMAND=make weekly-messages"
  exit 1
fi

# --- awk でテンプレート変数を一括置換 ---
substitute() {
  awk -v conf="$CONF" '
    BEGIN {
      while ((getline line < conf) > 0) {
        # コメント・空行スキップ
        if (line ~ /^[[:space:]]*#/ || line ~ /^[[:space:]]*$/) continue
        eq = index(line, "=")
        if (eq == 0) continue
        key = substr(line, 1, eq - 1)
        val = substr(line, eq + 1)
        keys[++n] = key
        vals[n] = val
      }
      close(conf)
    }
    {
      for (i = 1; i <= n; i++) {
        pat = "{{" keys[i] "}}"
        while ((idx = index($0, pat)) > 0) {
          $0 = substr($0, 1, idx - 1) vals[i] substr($0, idx + length(pat))
        }
      }
      print
    }
  ' "$1"
}

# --- 同期対象スキル ---
SKILLS="code-review create-pr improve-skill weekly-review"

ENG_SKILLS="$ENG_ROOT/.claude/skills"
DST_SKILLS="$PROJECT_ROOT/.claude/skills"

# REPO を表示用に取得
REPO_VAL="$(awk -F= '/^REPO=/{print $2; exit}' "$CONF")"

echo "=== engineering → project skill sync ==="
echo "Config: $CONF"
echo "REPO=$REPO_VAL"
echo ""

for skill in $SKILLS; do
  src="$ENG_SKILLS/$skill/SKILL.md"
  dst="$DST_SKILLS/$skill/SKILL.md"

  if [ ! -f "$src" ]; then
    echo "SKIP: $skill (not found in engineering)"
    continue
  fi

  new_content="$(substitute "$src")"

  if [ -f "$dst" ]; then
    old_content="$(cat "$dst")"
    if [ "$new_content" = "$old_content" ]; then
      echo "  OK: $skill (no changes)"
      continue
    fi
  fi

  if $DRY_RUN; then
    echo "DIFF: $skill"
    diff <(cat "$dst" 2>/dev/null || true) <(printf '%s\n' "$new_content") || true
  else
    mkdir -p "$(dirname "$dst")"
    printf '%s\n' "$new_content" > "$dst"
    echo "SYNC: $skill"
  fi
done

echo ""
echo "=== done ==="
