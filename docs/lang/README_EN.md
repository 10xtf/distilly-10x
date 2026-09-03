# Distilly — Developer Preview

This page mirrors the current English landing page. For the complete and canonical instructions, use the [root README](../../README.md).

Distilly turns explicit source material into versioned **Person Profiles for Agents**. The callable surface remains a Skill, while storage, runtime, review, and host lifecycle are delivered as a local-first Plugin.

## Install

This preview lives on the `distilly-plugin` branch and currently verifies Codex. Use Node.js `22.19+` or `24`, pnpm `10.32+`, and a local Codex CLI:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
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

## Legacy Skill compatibility

The Node.js, pnpm, and Codex prerequisites above apply only to the native Codex Plugin; Legacy mode does not require Codex, Node.js, or pnpm, but its full workflow relies on the host's ordinary Skill support plus filesystem, Bash, and Python capabilities.

Codex is currently the only host verified for the `distilly-plugin` Plugin. If a local Skill host does not yet have a verified Plugin binding, the user may explicitly install the maintained legacy Skill from the `dot-skill` branch:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

This is a separate implementation with no supported shared data model. Legacy collectors may use the `~/.distilly` namespace; do not run the Legacy and Plugin paths together until that interaction has been isolated and audited. For now, compatibility covers only local files and pasted text. It does not provide the Preview's SQLite authority, five MCP tools, Panel, or Plugin lifecycle. A failed Plugin setup or preflight never switches to it automatically. Keep only one active `distilly` installation in the same host discovery scope; disable or remove any other copy before restarting. Grok Bot has not yet been verified for local Skill repository import; for now, use a manually saved/private Skill.

## Current scope

The Preview accepts explicit TXT, Markdown, JSON, and SRT/VTT files, pasted text, and user-selected public URLs. It creates a profile, returns a complete temporary prompt, accepts corrections, supports review decisions, and can install an approved profile as a persistent Skill. Codex is verified; native Plugin bindings for Claude Code, OpenClaw, Hermes, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode, and Grok Bot still need community fixtures, and Grok Bot has no verified local repository import.

See the [roadmap](../../ROADMAP.md) and the [2026-09 update](../../UPDATES.md) for current priorities.
