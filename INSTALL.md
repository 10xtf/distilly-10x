# Install Distilly Developer Preview

This document describes the current TypeScript Plugin preview on the `distilly-plugin` branch. The separate Legacy Skill compatibility path is documented below for hosts that do not yet have a verified Plugin binding.

## Requirements

These requirements apply only to the native Codex Plugin path. Legacy Skill mode below does not require Codex, Node, or pnpm; its full older workflow requires an ordinary local Skill host with filesystem/Bash/Python capabilities.

- Node.js `22.19+` or `24`;
- pnpm `10.32+`; and
- a locally installed Codex CLI whose version matches the release evidence.

The current release evidence is for Codex CLI `0.146.0`. An unknown host version fails closed instead of installing an unverified integration.

## Source checkout

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
```

## Install for Codex

Run the built lifecycle command from the checkout:

```bash
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Restart Codex after setup. The command installs a self-contained runtime under `~/.distilly/`, registers the Plugin through the host's normal lifecycle, and starts the absolute launcher only from the verified installation tree. It does not copy private source material into the Plugin.

To install an approved Person Profile as a persistent Skill:

```bash
node packages/cli/lib/bin.js install subject_<32 lowercase hex characters> --host codex
```

Replace the subject id with the exact value returned by Distilly. Profile installation writes only the self-contained Profile and its digest manifest.

## Remove the host integration

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

This removes Distilly's verified host Plugin and runtime projection. It keeps `~/.distilly/` person data, source materials, profiles, and separately installed person Skills. A modified or foreign installation is left untouched and reported for manual review.

## Run the packaged preview

To assemble a distributable local directory instead of running from the checkout:

```bash
pnpm run package:preview:codex
./artifacts/distilly-0.1.0-preview.1-codex/distilly setup --host codex
./artifacts/distilly-0.1.0-preview.1-codex/distilly doctor --host codex
```

The artifact is local preview output; it is not an npm package or a tagged release.

## Verify the five-tool surface

After restarting Codex, confirm that the installed Plugin exposes exactly:

`distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit`, and `distilly_correct`.

The binding performs host preflight before starting MCP. If capacity evidence, the host version, or the release digest does not match, setup stops without writing an unverified integration.

## Legacy Skill compatibility for non-Codex hosts

The Plugin preview is currently verified only for Codex. On another host, explicitly install the maintained `dot-skill` branch as a Legacy Skill instead of running Plugin setup:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git \
  <target-directory>
git -C <target-directory> rev-parse HEAD
```

Create its parent first, then use a new, empty target whose final directory is `distilly`:

| Host | Legacy Skill target |
| --- | --- |
| Claude Code | `~/.claude/skills/distilly` |
| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
| Hermes | `~/.hermes/skills/openclaw-imports/distilly` |
| DeepSeek Harness (DSH) | `~/.dsh/skills/distilly` or `$DSH_HOME/skills/distilly` |
| Pi agent | `~/.pi/agent/skills/distilly` |
| Grok Build | `~/.grok/skills/distilly` |
| OpenCode | `~/.config/opencode/skills/distilly` |
| Grok Bot | No verified local repository import; migrate the workflow manually into a saved/private Skill |

Restart or rescan the host, verify that it discovers exactly one `distilly`, and keep the reported Git commit with any bug report. If another copy is already active in the same discovery scope, leave both copies untouched until you choose manually which one to disable or remove. This route is best-effort until each host receives a native, tested Plugin binding.

Legacy Skill mode is a separate file-based product line. It does not provide the Preview's SQLite authority, exact five MCP tools, Panel lifecycle, setup/doctor guarantees, or automatic migration. The CLI reports this guide for an unsupported non-Codex host request but never installs the Legacy Skill. Any Plugin setup or preflight failure remains fail-closed and never changes modes automatically.

For now, use local files or pasted text in Legacy Skill mode. Do not enable its older provider collectors while the Plugin uses the same home directory: those collectors can write credential configuration into the same `~/.distilly/` namespace, have not passed the Plugin security review, and must not be treated as interoperable with Plugin data. Never install from a working copy that contains private `knowledge/` or generated `skills/`; clone a clean copy directly into the target above.

## Local materials

The Preview's zero-configuration intake accepts explicit TXT, Markdown, JSON, and SRT/VTT files, pasted text, and user-selected public URLs. It does not crawl adjacent paths or silently read chat history. PDF, email containers, provider exports, and hosted source adapters are planned follow-up work.

For the product flow and community host work, see the [root README](README.md), [roadmap](ROADMAP.md), and [updates](UPDATES.md).
