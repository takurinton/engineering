# Engineering

プロジェクト横断で再利用する Claude/Codex 設定、スキル、評価基盤を管理する repository。

## Codex

- Codex 用の共通設定は `.codex/` に置く。
- Codex 用スキルは `.agents/skills/` から参照する。
- `.agents/skills/*` は `.claude/skills/*` への symlink。スキル本文の実体は `.claude/skills/` を編集する。
- 各利用 repo は `./engineering/scripts/sync.sh` を直接実行して、repo トップレベルの `.agents/`, `.codex/`, `AGENTS.md` を更新する。

## 注意

- 利用 repo 側に wrapper script を置かない。
- 共通ロジックや共通設定はこの repository に集約し、利用 repo は submodule の commit を更新して取り込む。
