# Distilly — Developer Preview

このページは現在のプレビューを要約しています。完全で正式な手順は[ルート README](../../README.md)を参照してください。

Distilly は、ユーザーが明示的に提供した資料を、バージョン管理された **Person Profiles for Agents** に変換します。呼び出し面は Skill のままですが、ストレージ、ランタイム、レビュー、ホストのライフサイクルをローカル Plugin として提供します。

## インストール

プレビューは `distilly-plugin` ブランチにあり、現在は Codex で検証済みです。Node.js `22.19+` または `24`、pnpm `10.32+`、ローカルの Codex CLI が必要です。

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

セットアップ後に Codex を再起動してください。ホスト連携を削除しても人物、Profile、資料は保持されます。

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

モデル向けの MCP 契約は次の5ツールのみです: `distilly_get`、`distilly_ingest`、`distilly_pending`、`distilly_commit`、`distilly_correct`。

## 現在の範囲

ユーザーが選択した TXT、Markdown、JSON、SRT/VTT ファイル、貼り付けテキスト、公開 URL に対応します。Codex は検証済みです。Claude Code、Grok Bot、OpenCode、Pi agent、DeepSeek Harness (DSH) はコミュニティの binding と fixture が必要です。

[ロードマップ](../../ROADMAP.md)と[2026-09 更新](../../UPDATES.md)をご覧ください。
