#!/bin/bash
# User prompt submit hook - プロンプト送信時に実行
#
# 使い方:
#   コンテキスト注入やプリチェックに利用する。
#   settings.json の hooks.UserPromptSubmit で * にマッチさせて登録する。
#
# 設定例 (settings.json):
#   "hooks": {
#     "UserPromptSubmit": [{
#       "matcher": "*",
#       "hooks": [{ "type": "command", "command": ".claude/hooks/user-prompt-submit.sh" }]
#     }]
#   }

# 例: 開発サーバーの起動状態チェック
# if ! pgrep -f "vite" > /dev/null; then
#     echo "Note: Dev server doesn't appear to be running"
# fi

# 例: 環境変数の確認
# if [ -z "$DATABASE_URL" ]; then
#     echo "Warning: DATABASE_URL is not set"
# fi

exit 0
