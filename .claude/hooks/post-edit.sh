#!/bin/bash
# Post-edit hook - ファイル編集後の自動フォーマット
#
# 使い方:
#   各プロジェクトに合わせて言語・フォーマッタのセクションを追加・削除する。
#   settings.json の hooks.PostToolUse で Edit にマッチさせて登録する。
#
# 設定例 (settings.json):
#   "hooks": {
#     "PostToolUse": [{
#       "matcher": "Edit",
#       "hooks": [{ "type": "command", "command": ".claude/hooks/post-edit.sh" }]
#     }]
#   }

FILE_PATH="$1"

# --- TypeScript / JavaScript ---
# if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
#     echo "Auto-formatting: $FILE_PATH"
#     npx prettier --write "$FILE_PATH"
# fi

# --- Rust ---
# if [[ "$FILE_PATH" =~ \.rs$ ]]; then
#     echo "Auto-formatting Rust file: $FILE_PATH"
#     cargo fmt --quiet
# fi

# --- Go ---
# if [[ "$FILE_PATH" =~ \.go$ ]]; then
#     echo "Auto-formatting Go file: $FILE_PATH"
#     gofmt -w "$FILE_PATH"
# fi

# --- Python ---
# if [[ "$FILE_PATH" =~ \.py$ ]]; then
#     echo "Auto-formatting Python file: $FILE_PATH"
#     black "$FILE_PATH" --quiet
# fi
