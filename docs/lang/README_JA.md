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

OpenClaw と Hermes にはローカル互換 binding があります。OpenClaw は Claude 互換 bundle をインストールして検出し、Hermes は管理対象 Skill をインストールし、wrapper と設定を通じて同じ MCP サーバーを登録します。両 binding はインストール、検出、5 ツールの smoke check を実行します。このリリースには両ホストの exact briefing-capacity fixture がまだないため、setup は briefing の前に fail closed し、完全な蒸留対応とは宣言しません。

モデル向けの MCP 契約は次の5ツールのみです: `distilly_get`、`distilly_ingest`、`distilly_pending`、`distilly_commit`、`distilly_correct`。

## Legacy Skill 互換

上記の Node.js、pnpm、Codex の前提条件はネイティブ Codex Plugin にのみ適用され、Legacy モードに Codex、Node.js、pnpm は不要ですが、完全な旧フローにはホストの通常の Skill 対応と filesystem、Bash、Python の機能が必要です。

現時点で `distilly-plugin` Plugin の briefing capacity が検証済みなのは Codex だけです。OpenClaw と Hermes には互換 binding がありますが、exact capacity fixture はまだありません。まだ検証済みの Plugin binding がないローカル Skill ホストでは、ユーザーが明示的に `dot-skill` ブランチで保守されている Legacy Skill をインストールできます。

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

これは独立した実装で、サポートされた共有データモデルはありません。Legacy の collector が `~/.distilly` 名前空間を使う場合があるため、その相互作用を分離・監査するまで Legacy と Plugin の経路を併用しないでください。現在の互換範囲はローカルファイルと貼り付けテキストだけです。Preview の SQLite authority、5つの MCP ツール、Panel、Plugin lifecycle は提供しません。Plugin の setup または preflight が失敗しても自動で切り替えません。同じホストの discovery scope には active な `distilly` を1つだけ置き、再起動前に他のコピーを無効化または削除してください。Grok Bot のローカル Skill リポジトリ import はまだ検証されていないため、現時点では saved/private Skill として手動で保存する方法だけを推奨します。

## 現在の範囲

ユーザーが選択した TXT、Markdown、JSON、SRT/VTT ファイル、貼り付けテキスト、公開 URL に対応します。Codex は briefing について検証済みです。OpenClaw と Hermes はインストール、検出、5 ツールのローカル互換 smoke check に合格しますが、briefing setup を成功させるには exact capacity fixture が必要です。Claude Code、DeepSeek Harness (DSH)、Pi agent、Grok Build、OpenCode、Grok Bot のネイティブ Plugin binding にはコミュニティの fixture が必要で、Grok Bot には検証済みのローカルリポジトリ import もありません。

[ロードマップ](../../ROADMAP.md)と[2026-09 更新](../../UPDATES.md)をご覧ください。
