# Install Distilly Developer Preview

This document describes the current TypeScript Plugin preview on the `distilly-plugin` branch. It supersedes the legacy Skill-only installation notes.

## Requirements

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

## Local materials

The Preview's zero-configuration intake accepts explicit TXT, Markdown, JSON, and SRT/VTT files, pasted text, and user-selected public URLs. It does not crawl adjacent paths or silently read chat history. PDF, email containers, provider exports, and hosted source adapters are planned follow-up work.

For the product flow and community host work, see the [root README](README.md), [roadmap](ROADMAP.md), and [updates](UPDATES.md).
