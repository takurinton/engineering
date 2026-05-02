---
name: prompt-guide
description: Claude 4.x 最新プロンプトエンジニアリングガイドと推奨構成
disable-model-invocation: true
---

# Claude 4.x プロンプトエンジニアリングガイド (2025-2026)

## 1. 基本原則

### 1.1 明確かつ直接的に指示する

曖昧な指示は避け、具体的に書く。

```
# Bad
ダッシュボードを作って

# Good
分析ダッシュボードを作成してください。グラフにはRechartsを使い、
日次/週次/月次の切り替えフィルターを含めてください。
```

### 1.2 XMLタグで構造化する

Claudeは構造化プロンプトの訓練を受けている。XMLタグで意味を明確にする。

```xml
<instructions>やること・振る舞い方</instructions>
<context>背景情報、データ、ドキュメント</context>
<task>このインタラクションでの具体的な依頼</task>
<output_format>期待する出力形式</output_format>
```

### 1.3 例を示す (Multishot Prompting)

1つの良い例は段落の説明に勝る。入出力ペアを2-3個示す。

```xml
<examples>
  <example>
    <input>ユーザーがログインできない</input>
    <output>認証トークンの期限切れが原因です。リフレッシュトークンのフローを確認してください。</output>
  </example>
</examples>
```

### 1.4 思考させる (Chain of Thought)

複雑な問題ではステップバイステップの推論を促す。
ただし **Extended Thinking が有効な場合は「ステップバイステップで考えて」は不要**（冗長でトークン浪費）。

### 1.5 役割を与える

```
あなたは: [役割]
目標: [達成すべきゴール]
制約:
- [制約1]
- [制約2]
不明な場合: 明示的にそう伝え、1つ明確化の質問をする
```

---

## 2. Claude 4.x 固有のベストプラクティス

### 2.1 Adaptive Thinking (Claude Opus 4.6)

手動の `budget_tokens` ではなく、`effort` パラメータで深さを制御する。

```python
client.messages.create(
    model="claude-opus-4-6",
    max_tokens=64000,
    thinking={"type": "adaptive"},
    output_config={"effort": "high"},  # max, high, medium, low
    messages=[...],
)
```

### 2.2 Prefilled Responses は非推奨

Claude Opus 4.6 以降、最後の assistant ターンでの prefill は非サポート。

代替手段:
- **出力フォーマット**: Structured Outputs または明示的な指示
- **前置き排除**: `前置きなしで直接回答してください。"Here is..." のようなフレーズで始めないでください。`
- **継続**: 継続テキストを user メッセージに移動

### 2.3 Anti-Laziness プロンプトを控える

Claude 4.x は以前より積極的。過剰な強調は逆効果 (overtriggering)。

```
# Bad (過剰)
CRITICAL: You MUST ALWAYS use this tool when...

# Good (適切)
このツールは～の場合に使ってください。
```

### 2.4 並列ツール呼び出し

```xml
<use_parallel_tool_calls>
依存関係のない複数のツール呼び出しは並列で実行してください。
</use_parallel_tool_calls>
```

### 2.5 サブエージェントの制御

Claude Opus 4.6 はサブエージェントを過剰に使う傾向がある。

```
サブエージェントは以下の場合に使用:
- タスクが並列実行可能
- 独立したコンテキストが必要
- 独立したワークストリーム
単純なタスク、単一ファイル編集、ステップ間のコンテキスト維持が必要な場合は直接作業する。
```

### 2.6 自律性と安全性のバランス

```
アクションの可逆性と影響範囲を考慮してください。
ローカルで可逆的なアクション（ファイル編集、テスト実行）は自由に。
破壊的・共有システムへのアクション（ファイル削除、force-push、外部投稿）は確認後に。
```

### 2.7 過剰な探索を抑制

```
アプローチを決めたらコミットしてください。
推論に直接矛盾する新情報がない限り、決定を再考しないでください。
```

### 2.8 ハルシネーション防止

```xml
<investigate_before_answering>
開いていないコードを推測しないでください。
ユーザーが特定ファイルを参照した場合、回答前にファイルを必ず読んでください。
根拠のある、ハルシネーションのない回答をしてください。
</investigate_before_answering>
```

### 2.9 オーバーエンジニアリング防止

```
直接要求されたか明らかに必要な変更のみ行う。
依頼されていない機能追加、リファクタリング、「改善」はしない。
仮定の将来要件のための設計はしない。
```

---

## 3. CLAUDE.md のベストプラクティス

### 含めるべきもの

- Claudeが推測できないビルド/テスト/リントコマンド
- デフォルトと異なるコードスタイルルール
- テスト方法と推奨テストランナー
- リポジトリ規約（ブランチ命名、PRコンベンション）
- プロジェクト固有のアーキテクチャ決定
- 環境固有の注意点

### 含めないもの

- コードを読めばわかること
- 標準的な言語規約
- 詳細なAPIドキュメント（リンクで代替）
- 頻繁に変わる情報
- ファイルごとのコードベース説明
- 自明なプラクティス（「クリーンなコードを書く」等）

### 目安

フロンティアLLMは約150-200の指示を合理的に処理可能。
各行について「これを削除するとClaudeはミスするか？」と自問し、Noなら削除。

### ファイル配置

```
~/.claude/CLAUDE.md          # 全セッション共通（グローバル）
./CLAUDE.md                   # プロジェクトルート（git管理、チーム共有）
./CLAUDE.local.md             # 個人設定（gitignore）
親ディレクトリ/CLAUDE.md      # モノレポ用
子ディレクトリ/CLAUDE.md      # オンデマンド読み込み
```

### `@` インポートで他ファイル参照

```markdown
プロジェクト概要は @README.md を参照。
npmコマンドは @package.json を確認。
```

---

## 4. Skills のベストプラクティス

CLAUDE.md を軽量に保つため、ドメイン知識はスキルに分離する。

### ディレクトリ構造

```
.claude/skills/
├── skill-name/
│   └── SKILL.md
```

### SKILL.md のフォーマット

```markdown
---
name: skill-name
description: このスキルの説明
disable-model-invocation: true  # /skill-name で明示的に呼び出す場合
---

# スキル名

## 手順
1. ...
2. ...
```

### 呼び出し可能ワークフロー

```markdown
---
name: fix-issue
description: GitHub issue を修正する
disable-model-invocation: true
---
GitHub issue $ARGUMENTS を分析・修正してください。
1. `gh issue view` で issue 詳細を取得
2. コードベースで関連ファイルを検索
3. 変更を実装、テスト作成、検証
4. 説明的なコミットを作成しPRをpush
```

---

## 5. Hooks のベストプラクティス

Hooks は CLAUDE.md の指示（助言的）と違い、**例外なく毎回**実行される。

| Hook | 用途 |
|------|------|
| `PostToolUse (Edit)` | ファイル編集後の自動フォーマット |
| `UserPromptSubmit` | コンテキスト注入 |
| `PreCommit` | コード品質チェック |

---

## 6. ワークフロー

### 4フェーズワークフロー

1. **探索** (Plan Mode): ファイルを読み、コードベースを理解
2. **計画** (Plan Mode): 詳細な実装計画を作成
3. **実装** (Normal Mode): 検証しながらコーディング
4. **コミット**: 説明的なメッセージとPR

### 修正レイヤーの判断（バグ修正時）

バグ修正のissueに取り組む前に、**根本原因がどのレイヤーにあるか**を判断する。

```
判断基準:
- データが不正/不要 → バックエンドで修正（保存・送信をスキップ）
- データは正しいが表示が不正 → フロントエンドで修正
- 迷ったら → ユーザーに確認する

例:
- 「空のlink cardが表示される」→ 空データを保存しないバックエンド修正が正解
  （フロントで非表示にするのは対症療法）
- 「日付のフォーマットが間違い」→ フロントエンド修正が正解
```

### 検証手段を与える（最も効果の高い施策）

```
# Bad
メールアドレスを検証する関数を実装して

# Good
validateEmail 関数を書いてください。
テストケース: user@example.com → true, invalid → false, user@.com → false
実装後にテストを実行してください。
```

### コンテキスト管理

- 無関係なタスク間で `/clear` を実行
- `/compact <instructions>` で対象を絞った要約
- 調査にはサブエージェントを使いメインコンテキストをクリーンに保つ
- 2回修正に失敗したら `/clear` して初期プロンプトを書き直す

---

## 7. よくある失敗パターン

| パターン | 対策 |
|----------|------|
| キッチンシンクセッション（無関係タスクの混在） | タスク間で `/clear` |
| 何度も修正を繰り返す | 2回失敗後、`/clear` してプロンプトを書き直す |
| CLAUDE.md の肥大化 | 削除しても問題ないなら削除 |
| 信頼後に検証しない | テスト・スクリプト・スクリーンショットで検証 |
| 無限の探索 | 調査範囲を狭めるかサブエージェントを使う |
| 質問・提案を実装依頼と誤解する | 「〜した方がいい？」「〜はどう？」は意見を返すだけにとどめ、明示的に依頼されるまで実装しない |
| 修正レイヤーを誤る | 表示の問題でもデータの問題なら根本原因（バックエンド）で修正する。実装前に「どのレイヤーで直すべきか」を判断する |
| 複数タスクを同時に依頼されたとき片方を忘れる | 着手前にすべての依頼を「1. ... 2. ...」と箇条書きで確認・列挙する。各タスク完了後に残りのタスクが残っていないかチェックしてから返答する |

---

## Sources

- [Prompt Engineering Overview - Anthropic Docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/overview)
- [Claude 4 Best Practices - Anthropic Docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Using CLAUDE.md Files - Claude Blog](https://claude.com/blog/using-claude-md-files)
