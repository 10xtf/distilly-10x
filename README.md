<div align="center">

<img src="docs/social-preview.png" alt="Distilly — Distill how they think into Person Profiles for Agents." width="100%">

<br>

# Distilly

### Distill how they think into Person Profiles for Agents.

**Colleague Skill / colleague-skill (original name)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.19%2B-339933.svg)](https://nodejs.org/)
[![Codex Preview](https://img.shields.io/badge/Codex-Developer%20Preview-black)](https://github.com/titanwings/distilly/tree/distilly-plugin)

</div>

Distilly is a local-first product for turning a person's source material, working habits, judgment, and voice into a versioned **Person Profile for Agents**. The profile can be recalled temporarily during a run or explicitly installed as a long-lived host Skill. The storage authority stays local; no additional model API key is required.

This branch is the unreleased `0.1.0-preview.1` Developer Preview. Codex is the first fully verified host. The repository is public for review, but this branch is not the default release and is not an npm package yet.

[Chinese](docs/lang/README_ZH.md) · [Español](docs/lang/README_ES.md) · [Deutsch](docs/lang/README_DE.md) · [日本語](docs/lang/README_JA.md) · [한국어](docs/lang/README_KO.md) · [Português](docs/lang/README_PT.md) · [Русский](docs/lang/README_RU.md)

## Install the Developer Preview

### For an agent

Give your coding agent the following task and let it run the commands in a fresh checkout:

> Install the Distilly Developer Preview from the `distilly-plugin` branch, build it with Node 22.19+ (or Node 24), run `distilly setup --host codex`, run `distilly doctor --host codex`, and report the result. Do not modify another branch.

The exact checkout and setup commands are shown below so the agent can verify every step.

### For a human

Requirements: Node.js `22.19+` or `24`, pnpm `10.32+`, and a locally installed Codex CLI. From a terminal:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Restart Codex after setup. The launcher registers the self-contained Plugin and its five MCP tools. To remove the host integration while keeping all local people, profiles, and source data:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

To install one approved profile as a persistent Skill after a profile has been created, use its exact subject id:

```bash
node packages/cli/lib/bin.js install subject_<32 lowercase hex characters> --host codex
```

There is no legacy Python or `dot-skill` installation step on this branch.

## The first usable flow

After the restart, ask Codex to research and distill a person. Supply only the files, text, or public URLs you want included. Distilly then:

1. resolves or creates the person;
2. imports the selected material with deterministic local parsers;
3. creates a pending research job and a complete evidence-bound briefing;
4. commits a versioned Person Profile;
5. returns the profile or a complete temporary prompt for the current run;
6. accepts an explicit correction and sends a candidate to review;
7. lets you promote, reject, or roll back the candidate in the local Panel; and
8. installs the approved profile as a self-contained host Skill when you ask it to.

The model-facing surface remains exactly five MCP tools:

`distilly_get` · `distilly_ingest` · `distilly_pending` · `distilly_commit` · `distilly_correct`

Distilly never silently truncates a complete briefing or profile prompt. If a verified host budget cannot carry the complete value, it reports a bounded capacity error with measurements and keeps the stored data unchanged.

## Supported hosts

| Host | Preview status |
| --- | --- |
| Codex | Fully verified in this release branch |
| Claude Code | Binding included; exact host fixture and community validation still needed |
| Grok Bot | Community binding planned |
| OpenCode | Community binding planned |
| Pi agent | Community binding planned |
| DeepSeek Harness (DSH) | Community binding planned |

Host compatibility is a binding concern. A host is not listed as verified merely because it can read a Skill file.

## Local material formats

The first Preview accepts explicit local `TXT`, `Markdown`, `JSON`, and `SRT/VTT` files. It also accepts pasted text and public URLs through the host's visible research flow. Files are read only from the paths or sources the user supplies; symlinked selected files and duplicate file names are rejected. PDF, email, provider exports, and hosted connectors are follow-up work.

## 📣 2026-09 update: help expand coding-agent Plugins

Codex is the first verified Plugin path. We need community support to build and validate more coding-agent Plugin packages for **Grok Bot, Claude Code, OpenCode, Pi agent, and DeepSeek Harness (DSH)**. I will actively review those contributions and keep the public contracts, release digests, and host behavior aligned.

See the full call for contributors in [UPDATES.md](UPDATES.md) and the current priorities in [ROADMAP.md](ROADMAP.md).

## Project documents

- [Detailed Preview installation](INSTALL.md)
- [Architecture and shipped-state map](docs/architecture.md)
- [Testing contract](docs/testing.md)
- [Development workflow](docs/development.md)
- [Design corpus](docs/design/README.md)
- [Release manifest](plugins/release-manifest.json)
- [Contributing](CONTRIBUTING.md)

Distilly is released under the [MIT License](LICENSE). Created by [@titanwings](https://github.com/titanwings).
