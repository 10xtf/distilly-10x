# Distilly — Developer Preview

This page mirrors the current English landing page. For the complete and canonical instructions, use the [root README](../../README.md).

Distilly turns explicit source material into versioned **Person Profiles for Agents**. The callable surface remains a Skill, while storage, runtime, review, and host lifecycle are delivered as a local-first Plugin.

## Install

This preview lives on the `codex/distilly-plugin` branch and currently verifies Codex. Use Node.js `22.19+` or `24`, pnpm `10.32+`, and a local Codex CLI:

```bash
git clone --branch codex/distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Restart Codex after setup. Uninstalling the host integration preserves local people, profiles, and source data:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

The model-facing contract is exactly five MCP tools: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit`, and `distilly_correct`.

## Current scope

The Preview accepts explicit TXT, Markdown, JSON, and SRT/VTT files, pasted text, and user-selected public URLs. It creates a profile, returns a complete temporary prompt, accepts corrections, supports review decisions, and can install an approved profile as a persistent Skill. Codex is verified; Claude Code, Grok Bot, OpenCode, Pi agent, and DeepSeek Harness (DSH) need community host bindings and fixtures.

See the [roadmap](../../ROADMAP.md) and the [2026-09 update](../../UPDATES.md) for current priorities.
