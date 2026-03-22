# Engineering using claude for me

プロジェクト横断で再利用可能な Claude Code 設定・スキル・評価基盤。

## 全体像

```mermaid
graph TB
    subgraph engineering["engineering/.claude（共通）"]
        PG[prompt-guide]
        CR[code-review]
        CP[create-pr]
        IS[improve-skill]
        WR[weekly-review]
        EV[evals基盤]
        HK[hooks テンプレート]
    end

    subgraph projectA["Project A .claude/"]
        direction TB
        A_CR[code-review<br/>REPO=owner/a]
        A_CP[create-pr<br/>REPO=owner/a]
        A_IS[improve-skill]
        A_EV[evals + cases/]
        A_DOMAIN[domain skills<br/>api, db, auth...]
        A_HK[hooks<br/>prettier, eslint]
    end

    subgraph projectB["Project B .claude/"]
        direction TB
        B_CR[code-review<br/>REPO=owner/b]
        B_CP[create-pr<br/>REPO=owner/b]
        B_IS[improve-skill]
        B_EV[evals + cases/]
        B_DOMAIN[domain skills<br/>pipeline, infra...]
        B_HK[hooks<br/>cargo fmt, clippy]
    end

    CR -->|コピー & 変数置換| A_CR
    CR -->|コピー & 変数置換| B_CR
    CP -->|コピー & 変数置換| A_CP
    CP -->|コピー & 変数置換| B_CP
    IS --> A_IS
    IS --> B_IS
    EV -->|基盤コピー| A_EV
    EV -->|基盤コピー| B_EV
    HK -->|テンプレ適用| A_HK
    HK -->|テンプレ適用| B_HK
    PG -->|そのまま| A_CR
    PG -->|そのまま| B_CR
```

## スキル間の連携フロー

```mermaid
flowchart LR
    User([ユーザー]) -->|"/create-pr 機能Xを実装"| CP[create-pr]

    CP -->|1. branch作成| Git[(Git)]
    CP -->|2. 実装 & commit| Git
    CP -->|3. push & PR作成| GH[(GitHub)]
    CP -->|4. CI起動| CI[CI Workflow]
    CP -->|5. バックグラウンド| Reflect[セッション振り返り]

    Reflect -->|手戻りあり?| EV[evals 実行]
    EV -->|FAIL検出| IS[improve-skill]
    IS -->|skill修正 & PR| GH

    User -->|"/code-review 42"| CR[code-review]
    CR -->|diff取得| GH
    CR -->|レビューコメント| GH
    CR -->|low以下?| Merge{自動マージ}
    Merge -->|Yes| GH
    Merge -->|No| User
```

## 評価 → 自己改善サイクル

```mermaid
flowchart TD
    A[テストケース YAML] -->|run.mjs| B[Claude 実行]
    B -->|ツールログ抽出| C[LLM-as-Judge]
    C -->|採点 1-5| D{全ケース PASS?}

    D -->|Yes| E[完了]
    D -->|No| F[auto-fix]

    F -->|FAILケースを分析| G[improve-skill 実行]
    G -->|SKILL.md 修正| H[PR 作成]
    H -->|再実行| B

    subgraph Judge["Judge 採点基準"]
        J1[skill-routing<br/>正しいスキルが呼ばれたか]
        J2[intent<br/>意図を正しく解釈したか]
        J3[compliance<br/>ルールを遵守したか]
        J4[fix-completeness<br/>全箇所を修正したか]
    end

    C --- Judge
```

## コードレビューフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant C as Claude Code
    participant A as Review Agent
    participant GH as GitHub

    U->>C: /code-review 42
    C->>A: バックグラウンドAgent起動

    A->>GH: gh pr view & diff 取得
    A->>A: レビュー観点で分析
    Note over A: エラーハンドリング<br/>N+1クエリ<br/>API後方互換性<br/>コード品質

    A->>A: ビルド実行
    alt ビルド失敗
        A->>GH: レビューコメント投稿（マージしない）
    else ビルド成功
        A->>A: 重要度判定
        alt critical/high/medium あり
            A->>GH: レビューコメント投稿（マージしない）
        else low のみ or 問題なし
            A->>GH: レビューコメント投稿
            A->>GH: gh pr merge --auto
        end
    end

    A->>A: マージ待機（30秒ごと、最大30分）
    A-->>C: 完了通知
    C-->>U: 結果報告
```

## 重要度フラグ

```mermaid
graph LR
    subgraph 自動マージ可
        LOW[🟢 low<br/>可読性・慣習・nit]
        NONE[🟢 問題なし]
    end

    subgraph マージ保留
        MED[🟡 medium<br/>パフォーマンス<br/>API互換性]
        HIGH[🟠 high<br/>バグ・データ不整合<br/>エラーハンドリング欠落]
        CRIT[🔴 critical<br/>セキュリティ脆弱性<br/>データ破壊・本番障害]
    end

    CRIT --> HIGH --> MED --> LOW --> NONE
```

## 使い方

各プロジェクトの `.claude/` から、必要なスキルやファイルをコピーして `{{変数}}` を置換する。

```bash
# 例: engineering repo から chat repo にスキルをコピー
cp -r ../engineering/.claude/skills/code-review .claude/skills/

# 例: シンボリックリンク（prompt-guide など変数なしのスキル向き）
ln -s ../../../engineering/.claude/skills/prompt-guide .claude/skills/prompt-guide
```

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
