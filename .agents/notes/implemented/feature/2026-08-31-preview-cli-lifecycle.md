# Agent Note: Developer Preview CLI lifecycle

Status: implemented

## Problem

The Preview had a real local Engine/MCP graph and concrete Codex/Claude Code bindings, but no executable connected them. A developer could not run one setup command, obtain an absolute launcher, diagnose the host projection, start the five-tool server through that launcher, or remove the host integration without hand-written composition.

## Decision

The repo-local Developer Preview binary exposes only `setup`, narrow `doctor`, `uninstall`, and the plugin-owned `mcp --host` entry. Setup validates Node and the supported macOS/Linux platform, resolves the selected executable, probes its exact `--version`, and requires a matching immutable host/version/environment/release/wire/Skill net-capacity fixture before writing. It then writes digest-owned launcher and runtime locator bytes under `~/.distilly`, invokes the full host binding, and records the observed host identity in a private lifecycle manifest.

The launcher records exact absolute Node and built-entry paths. Every lifecycle parent is checked as a real non-symlink directory before write or delete. The first enabled projection records the fixed Codex host argument; the public CLI rejects Claude Code until that exact host has equivalent real capacity evidence. The lifecycle manifest owns no person data. Doctor and uninstall use the same exact plugin file-set verification. Uninstall verifies all bootstrap bytes before mutation, removes the Codex projection and launcher/runtime locator, and never recursively removes `~/.distilly`, SQLite, blobs, Profiles, or person Skills.

The Codex net-capacity record is not a guessed constant. A bounded governance harness launches the current five-tool server through real `codex exec`, verifies a 65,536-byte result retains deep-equal `structuredContent` and repeated JSON text, verifies a separate 16,384-byte `HostDistillBriefing`, and requires the model to return unseen tail markers from both independent sessions. The immutable schema-versioned record binds that observation to the exact host version, environment, release, wire version, canonical Skill digest, tool-contract digest, and serializer. Unknown tuples and Claude Code without its own record fail closed before product writes.

## Alternatives considered

- A launcher containing bare `distilly mcp` was rejected because setup cannot depend on global `PATH` after installation.
- Inheriting host identity from ambient shell state was rejected because each owned plugin can pass its exact host argument.
- Treating any executable with the right filename as a supported host was rejected because host identity and briefing capacity require an observed exact version and matching fixture.
- Registering every final CLI command as an unsupported placeholder was rejected because the Preview exposes only commands that actually run.
- Copying the workspace as a pretend runtime was rejected because the later packaged Preview owns self-contained release assembly; this slice launches one checked built entry.
- Removing the whole `~/.distilly` root during uninstall was rejected because product data belongs to the user independently of plugin/bootstrap state.
- Claiming Windows support with a POSIX launcher was rejected; the first repo-local lifecycle fails visibly outside macOS/Linux.

## Consequences

Developers with the verified Codex version can build the workspace and run the same executable for setup, doctor, MCP startup, and uninstall. Unknown or updated versions and Claude Code fail before product writes until a matching real-host capacity fixture is reviewed. Same-release setup is replay-safe and lifecycle or plugin-tree tampering fails closed. The binary is intentionally not the final public CLI: stable library exports remain narrow, data subcommands are absent, and Claude activation, versioned code copying, upgrade/rollback, deep Engine doctor, cross-process attach, and a self-contained `0.1.0-preview.1` archive remain later slices.

## Verification

- `node packages/cli/scripts/verify-host-capacity-fixture.mjs codex` — the real Codex 0.146.0 host surface passes both fixed boundaries and produces the committed immutable evidence record.
- `pnpm exec vitest run packages/cli/src packages/bindings/src/full-binding.test.ts` — focused lifecycle, evidence, composition, and binding tests pass, including unknown-version, unverified-Claude, parent-symlink, and exact doctor ownership regressions.
- `pnpm run test:boundaries` — 49 tests pass with the explicit CLI-to-bindings edge.
- `pnpm run build` — the binary, lifecycle, bindings, and existing Preview composition compile together.
- `pnpm --filter @distilly/cli run smoke:built` — the real built binary installs Codex in a temporary home, rejects deferred Claude activation, doctor reports a healthy projection, the installed absolute launcher exposes exactly five MCP tools through the official client, uninstall succeeds, and SQLite plus person data remain.
