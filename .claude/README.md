# Engineering using claude for me

## 使い方

各プロジェクトの `.claude/` から、必要なスキルやファイルをコピーまたはシンボリックリンクで参照する。

```bash
# 例: engineering repo から chat repo にスキルをコピー
cp -r ../engineering/.claude/skills/code-review .claude/skills/

# 例: シンボリックリンク
ln -s ../../../engineering/.claude/skills/prompt-guide .claude/skills/prompt-guide
```

プロジェクト固有の値（リポジトリ名、ビルドコマンド等）は各スキル内の `{{変数名}}` を置換すること。

## Directory Structure

```
.claude/
├── README.md                  — このファイル
├── skills/                    — 汎用スキル
│   ├── prompt-guide/SKILL.md  — Claude 4.x プロンプトエンジニアリングガイド
│   ├── code-review/SKILL.md   — PRコードレビュー（Agent別セッション実行、自動マージ判定）
│   ├── create-pr/SKILL.md     — ブランチ & プルリクエスト作成フロー
│   ├── improve-skill/SKILL.md — フィードバックによる自己改善
│   └── weekly-review/SKILL.md — 定期メッセージ分析 & Issue 起票
├── evals/                     — 設定品質の評価基盤
│   ├── run.mjs                — テストケース実行 + LLM-as-Judge 採点 + auto-fix
│   ├── compare.mjs            — before/after 比較
│   ├── judge-prompt.md        — 審査員プロンプト（採点基準）
│   └── cases/                 — テストケース（YAML）※プロジェクトごとに用意
│       ├── skill-routing/
│       ├── intent/
│       └── compliance/
└── hooks/                     — フックテンプレート
    ├── post-edit.sh           — ファイル編集後の自動フォーマット
    ├── pre-commit.sh          — コミット前のコード品質チェック
    └── user-prompt-submit.sh  — プロンプト送信時のコンテキスト注入
```

## Available Skills

| スキル          | 説明                           | テンプレート変数                        |
| --------------- | ------------------------------ | --------------------------------------- |
| `prompt-guide`  | Claude 4.x プロンプトガイド    | なし（そのまま使用可）                  |
| `code-review`   | PR コードレビュー + 自動マージ | `{{REPO}}`, `{{BUILD_COMMAND}}`         |
| `create-pr`     | ブランチ & PR 作成フロー       | `{{REPO}}`, `{{CI_WORKFLOW}}`           |
| `improve-skill` | フィードバック自己改善         | `{{REPO}}`                              |
| `weekly-review` | 定期分析 & Issue 起票          | `{{REPO}}`, `{{MESSAGE_FETCH_COMMAND}}` |

## Hooks

| Hook               | トリガー         | 動作               | カスタマイズ                  |
| ------------------ | ---------------- | ------------------ | ----------------------------- |
| PostToolUse (Edit) | ファイル編集後   | 自動フォーマット   | 言語・フォーマッタを設定      |
| PreCommit          | コミット前       | コード品質チェック | lint/typecheck コマンドを設定 |
| UserPromptSubmit   | プロンプト送信時 | コンテキスト注入   | 必要に応じて有効化            |

## 評価基盤 (Evals)

テストケース（YAML）→ Claude 実行 → LLM-as-Judge 採点 → auto-fix のサイクルで `.claude/` 設定を継続改善する。

```bash
# 全テストケース実行
node .claude/evals/run.mjs

# auto-fix 付き（FAIL → improve-skill → PR作成）
node .claude/evals/run.mjs --auto-fix

# 比較
node .claude/evals/compare.mjs
```

テストケースはプロジェクトごとに `cases/` 配下に用意する。
