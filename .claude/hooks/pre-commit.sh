#!/bin/bash
# Pre-commit hook - コミット前のコード品質チェック
#
# 使い方:
#   各プロジェクトに合わせてチェック対象の言語・コマンドを設定する。
#   settings.json の hooks.PreToolUse で Bash(git commit) にマッチさせるか、
#   git の pre-commit hook として登録する。

set -e

echo "Running pre-commit checks..."

# --- TypeScript / JavaScript ---
# ステージされたファイルにフロントエンドの変更が含まれる場合
# if git diff --cached --name-only | grep -q "\.tsx\?$\|\.jsx\?$"; then
#     echo "Running lint..."
#     npm run lint
#
#     echo "Running type check..."
#     npx tsc --noEmit
# fi

# --- Rust ---
# if git diff --cached --name-only | grep -q "\.rs$"; then
#     echo "Running cargo check..."
#     cargo check
#
#     echo "Running cargo clippy..."
#     cargo clippy -- -D warnings
# fi

# --- Go ---
# if git diff --cached --name-only | grep -q "\.go$"; then
#     echo "Running go vet..."
#     go vet ./...
#
#     echo "Running golangci-lint..."
#     golangci-lint run
# fi

# --- Python ---
# if git diff --cached --name-only | grep -q "\.py$"; then
#     echo "Running ruff..."
#     ruff check .
#
#     echo "Running mypy..."
#     mypy .
# fi

echo "Pre-commit checks passed!"
