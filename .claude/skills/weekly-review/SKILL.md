---
name: weekly-review
description: 直近1週間のメッセージ/アクティビティを取得・分析してGitHub issueを起票する
---

# Weekly Review - 定期分析 & Issue 起票

## テンプレート変数

使用前に以下を各プロジェクトに合わせて置換すること:

- `{{REPO}}` — GitHubリポジトリ（例: `owner/repo`）
- `{{MESSAGE_FETCH_COMMAND}}` — メッセージ/アクティビティ取得コマンド（例: `make weekly-messages`）

## 実行手順

1. **データ取得**
   ```
   {{MESSAGE_FETCH_COMMAND}}
   ```
   JSON形式で直近7日分のデータが出力される。

2. **分析観点**
   取得したデータを以下の観点で確認する：
   - バグ報告・エラー・不具合の言及
   - 機能リクエスト・改善要望
   - UX上の問題（使いにくい、わかりにくいなど）
   - パフォーマンス・安定性の懸念
   - セキュリティ・データ品質の問題

3. **Issue 起票**
   課題が見つかった場合のみ、以下で起票する：
   ```
   gh issue create --repo {{REPO}} --title "タイトル" --body "説明"
   ```

   **起票しない場合:** 課題が見つからなければ何もしない。

## Issue 記載内容

- **タイトル:** 具体的・簡潔に（日本語OK）
- **本文:**
  - 背景・文脈（どのデータから判断したか）
  - 期待する動作 / 改善内容
  - 関連キーワード（あれば）

4. **Issue を実装する**
   起票した各 Issue について、以下の手順で実装・PR を作成する：

   a. **ブランチを作成**
      Issue の種別に合わせたプレフィックスを使用する（`feat/`, `fix/`, `chore/` など）。
      ```
      git checkout -b fix/issue-title-summary
      ```

   b. **実装**
      Issue の内容に従いコードを修正・追加する。
      実装が複雑または影響範囲が不明な場合は、ユーザーに確認してから進める。

   c. **コミット**
      ```
      git add <関連ファイル>
      git commit -m "fix: 変更内容の説明"
      ```
      コミットメッセージは Conventional Commits 形式（feat / fix / chore / docs / refactor）。

   d. **PR 作成**
      ```
      gh pr create \
        --repo {{REPO}} \
        --title "PRタイトル" \
        --body "## 概要\n\n変更内容\n\n## 変更点\n\n- 変更1\n\nCloses #<issue番号>"
      ```
      - Issue番号を `Closes #番号` で本文に含める
      - PR 作成前に `gh pr list --repo {{REPO}}` で重複がないか確認する
      - 複数 Issue がある場合は、関連する変更をまとめて1PRにしてよい

## 注意

- 1つのデータから複数issueを起票しない（関連するものはまとめる）
- 雑談・挨拶など課題性のないデータは無視する
- 重複しそうなissueは起票前に `gh issue list --repo {{REPO}}` で確認する
- 実装が不明瞭・リスクが高い場合はユーザーに確認してから進める
- `main` ブランチへの直接コミットは行わない
