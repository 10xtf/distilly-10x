# Agent Note: Developer Preview installation and community documentation

Status: implemented

## Problem

The root README, installation guide, contribution guide, roadmap, and language mirrors still described the legacy Python `dot-skill` product. A reader following those pages would miss the TypeScript Developer Preview, use obsolete commands, or assume that every listed host was already verified. The branch also had no visible update explaining the request for additional coding-agent Plugin contributors.

## Decision

Make the current `codex/distilly-plugin` Preview the only installation path documented on this branch. The root README and `INSTALL.md` now give separate agent and human instructions using the built `distilly` CLI, state the Node/pnpm and exact Codex evidence requirements, describe the five MCP tools and local parser scope, and explain that Plugin uninstall preserves person data. The roadmap and new `UPDATES.md` identify Codex as the first verified host, keep Claude Code and other hosts explicitly unverified, and ask the community to build Plugin packages for Grok Bot, Claude Code, OpenCode, Pi agent, and DeepSeek Harness (DSH), with active maintainer review.

All README and roadmap language mirrors now point to the same Preview branch and no longer expose legacy Python or `dot-skill` installation commands. The historical name is retained only as a short explanatory label in the root README. Current architecture, testing, and release documents remain the source of detailed implementation claims.

## Alternatives considered

- Keeping the old README and adding a banner was rejected because stale commands below the banner would still be easy to copy.
- Claiming `npx` or a registry install was rejected because this Preview has no published npm package.
- Listing every existing capability factory as a verified host was rejected because exact host/version/capacity evidence exists only for Codex.
- Updating only the root English page was rejected because the language mirrors would continue to advertise obsolete installation paths.
- Mixing the community request into a one-line roadmap item was rejected because host contributors need the exact target list and acceptance expectations in a visible update.

## Consequences

A new reader can clone the intended branch, build the current product, run setup/doctor, restart the host, and remove the integration without following legacy instructions. The documentation makes the Preview boundary explicit: Codex is verified, other requested hosts are community work, local parsers are intentionally limited, and no registry release is implied. The language pages are concise current summaries rather than full duplicated manuals; the root README remains authoritative.

## Verification

- `python3 -B scripts/verify_docs.py` passes all Markdown link, anchor, and file-ending checks.
- Prettier check passes for the root docs and all README/roadmap mirrors.
- Manual link review confirms the branch checkout, CLI commands, release manifest, design, testing, roadmap, and update targets exist.
- The documented commands match `packages/cli/src/main.ts`: `setup`, `doctor`, `install`, `uninstall`, and `mcp`, with `--host codex`.
