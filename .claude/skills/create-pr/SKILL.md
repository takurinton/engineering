---
name: create-pr
description: ブランチを切ってプルリクエストを作成する
---

# Create PR - ブランチ & プルリクエスト作成

`$ARGUMENTS` の内容に基づいてブランチを切り、変更を加えてプルリクエストを作成する。

## テンプレート変数

使用前に以下を各プロジェクトに合わせて置換すること:

- `{{REPO}}` — GitHubリポジトリ（例: `owner/repo`）
- `{{CI_WORKFLOW}}` — CI ワークフローファイル名（例: `regression.yaml`）。不要なら手順7を削除。

## 手順

1. **現状確認**
   ```
   git status
   git branch
   ```
   未コミットの変更がある場合は `git stash` で退避する。

2. **main を最新に更新してからブランチ作成**
   - **必ず** main に戻って pull してから新規ブランチを切る
   - 作業中のブランチがあっても、そのまま使わない
   ```
   git checkout main
   git pull origin main
   git checkout -b feat/branch-name
   ```
   - ブランチ名は `feat/`, `fix/`, `chore/` などのプレフィックスを付ける
   - 英数字・ハイフンのみ使用（日本語不可）

3. **変更を実施**
   - 指定されたタスクを実装する

4. **コミット**
   ```
   git add -A
   git commit -m "type: 変更内容の説明"
   ```
   コミットメッセージは Conventional Commits 形式（feat / fix / chore / docs / refactor）。

5. **プッシュ**
   ```
   git push origin HEAD
   ```

6. **PR 作成**
   ```
   gh pr create \
     --repo {{REPO}} \
     --title "PRタイトル" \
     --body "## 概要\n\n変更内容の説明\n\n## 変更点\n\n- 変更1\n- 変更2"
   ```

7. **CI ワークフローを起動**（PR作成成功後、{{CI_WORKFLOW}} が設定されている場合）
   - ブランチ名を取得して以下を実行:
     ```
     gh workflow run {{CI_WORKFLOW}} \
       --repo {{REPO}} \
       --field ref=<ブランチ名>
     ```

8. **セッション振り返り & evalケース追加 & 自己改善**（PR作成成功後、バックグラウンドで並行実行）
   - `general-purpose` Agent をバックグラウンドで起動し、以下を実行させる:
     1. セッション中に発生した **手戻り・判断ミス・ユーザーからの指摘** を振り返る
     2. 改善すべき点がある場合、該当する問題を検証する **evalケース** を `.claude/evals/cases/` に追加する
     3. `node .claude/evals/run.mjs --auto-fix` を実行する（evals実行 → Judge採点 → FAILケースがあれば improve-skill 自動実行 → 改善PR作成）
     4. 改善点がない場合は何もしない
   - Agent プロンプト例:
     ```
     このセッションを振り返り、以下の観点で改善点がないか分析してください:
     1. ユーザーに指摘されて方針変更した箇所
     2. 手戻りが発生した箇所（revert、やり直し等）
     3. 外部サービス選定ミス、アーキテクチャ判断ミス等

     改善点がある場合:
     - 該当する問題を検証するevalケースを .claude/evals/cases/ 配下の適切なYAMLに追加
     - node .claude/evals/run.mjs --auto-fix を実行
     - evalsのauto-fixが改善PRを自動作成する（手動でskill修正しない）
     - auto-fixでPRが作られなかった場合（rate limitエラー等）でも、evalケース追加など
       ローカルに未コミット変更がある場合は、自分でブランチを切ってPRを作成する:
       git stash → git checkout main && git pull origin main → git checkout -b chore/ブランチ名 → git stash pop → commit → push → gh pr create

     改善点がない場合は何もしない。
     ```
   - ユーザーへは「PR作成完了、バックグラウンドで CI 実行中 & セッション振り返り中。レビュー＆マージは `/code-review <番号>` で実行できます」と伝える

## PR 記載内容

- **タイトル:** 変更内容を簡潔に（日本語OK）
- **本文:**
  - 概要（何を・なぜ変更したか）
  - 変更点（箇条書き）
  - 関連 Issue（あれば `Closes #番号`）

## 注意

- `main` ブランチへの直接コミットは行わない
- PR 作成前に `gh pr list --repo {{REPO}}` で重複がないか確認する
- **作業中ブランチがあっても必ず main に戻り pull してから新規ブランチを切る**（既存ブランチを流用しない）
- **1 PR = 1 目的**。機能実装とドキュメント/skill改善は別ブランチ・別PRにする。実装中にフィードバックや改善点に気づいた場合は、メモだけ残して現在のタスク完了後に対応する
