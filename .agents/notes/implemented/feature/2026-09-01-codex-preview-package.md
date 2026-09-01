# Agent Note: Codex self-contained Preview package

Status: implemented

## Problem

The Codex vertical Preview runs from compiled workspace files, but setup records that workspace entry in its launcher. Moving or deleting the checkout therefore breaks MCP, doctor, and uninstall. The source-only plugin tree also contains a launcher sentinel and is not an installable archive. There is no packaged acceptance test proving that the product survives removal of its unpacked bootstrap directory or that a user can persist a completed Profile as a Codex person Skill.

## Decision

Assemble one Codex-only `0.1.0-preview.1` directory from production build output. Bundle the CLI/runtime dependency graph into a small Node ESM tree, copy only the runtime prompts, Panel assets, release manifest, Codex manifest, and canonical Skill, and record every packaged file digest in a private runtime manifest. Omit the MCP template, Claude tree, source, tests, fixtures, and development dependencies. `--force` may replace only an exact previously verified runtime package, and does so only after the replacement staging tree has assembled successfully; it never recursively removes an arbitrary existing directory.

Packaged setup verifies the source manifest, atomically copies the exact bundle into `~/.distilly/runtime/0.1.0-preview.1/`, writes an absolute launcher to the copied entry, and installs a Codex plugin tree containing a generated real `.mcp.json`. The installed CLI reuses that copied tree for doctor, MCP, person installation, and uninstall. A narrow human command installs a current Profile by subject id through the existing `Person.install` path; the five model-facing MCP tools remain unchanged. Last-host uninstall removes only the verified owned runtime and plugin projection, preserving SQLite, blobs, and separately installed person Skills.

## Alternatives considered

- Shipping the pnpm workspace or a `pnpm deploy --legacy` tree was rejected because it is much larger and contains symlinks whose targets can escape or depend on the checkout.
- Keeping the launcher pointed at the unpacked package was rejected because deleting the bootstrap directory would break a supposedly installed product.
- Adding a sixth MCP tool for installation was rejected because the exact five-tool contract is a product invariant; the human CLI is the narrow explicit confirmation surface.
- Enabling Claude Code in the same package was rejected because the user requested Codex first and Claude does not yet have equivalent verified host evidence.
- Embedding the source `.mcp.json.template` was rejected because it is an assembler fixture, not an installable component; the full binding already owns deterministic `.mcp.json` generation.

## Consequences

- The package is versioned `0.1.0-preview.1`, contains only production Codex bytes, and has no sentinel, MCP template, test fake, symlink, or checkout path.
- Setup from a path containing spaces and non-ASCII characters installs a verified runtime copy and absolute launcher; deleting the unpacked package does not break doctor or MCP initialize/tools-list.
- The installed Codex plugin validates, has a real `.mcp.json`, and a fresh real Codex 0.146.0 process discovers the Distilly Skill.
- The packaged flow creates a person, ingests local material, commits and retrieves a Profile, applies and reviews a correction, installs the person Skill, and a fresh Codex process discovers that Skill.
- Uninstall removes the owned plugin, launcher, and versioned runtime while preserving SQLite/person data and the independently installed person Skill.
- Tampering with an owned runtime byte makes doctor fail and prevents destructive runtime removal.
- A populated unowned output directory is rejected without changing its contents; package rebuild can replace only a fully verified prior Distilly artifact.

The first package is intentionally Codex-only and macOS/Linux-only. It does not implement upgrade, daemon attach, deep Doctor, backup/restore, or Claude activation. Runtime installation is a file projection around the existing in-process single writer, so concurrent host processes remain unsupported. The source-to-installed copy is not a business transaction; ownership digests and fail-closed deletion limit its recovery surface until a later upgrade design.

The bundle must be built only from compiled package output. The repository TypeScript path aliases are therefore disabled for esbuild, and the assembler rejects any `packages/*/src/` input. Without both checks, a source and compiled copy of Protocol can enter the same bundle; typed errors then fail `instanceof` checks across those copies and become generic internal errors in the Panel.

## Verification

- `pnpm exec vitest run packages/cli/src packages/bindings/src/full-binding.test.ts packages/mcp/src/server.test.ts packages/panel/src/server-http.test.ts` under Node 22: 61 tests passed.
- `pnpm run gates:fast`, `pnpm run typecheck`, `pnpm run build`, `pnpm run hygiene`, the built CLI and package-safety smokes, plugin assembly/check, documentation validation, and Agent Note validation passed.
- `pnpm run package:preview:codex` produced the local 2.2 MiB `0.1.0-preview.1` artifact with no symlink, source input, workspace dependency, test path, sentinel, or checkout path.
- The Codex plugin validator accepted a plugin installed from the assembled bytes.
- The real-package verifier passed with Codex CLI 0.146.0 from a path containing spaces and non-ASCII characters. It removed the unpacked source, then proved official Plugin/MCP discovery, server release identity, exactly five descriptor-equal tools, create/ingest/brief/commit/get/prompt, relayed correction and Chromium Panel promotion, explicit person-Skill installation, fresh-process Skill discovery, reopen, and uninstall with byte-identical SQLite and person-Skill preservation.
- The immutable release-capacity fixture was regenerated through real Codex observations at the 65,536-byte tool-result and 16,384-byte briefing boundaries.
- The full pre-existing workspace test command still contains an unrelated stale Protocol assertion that submits 65,536 UTF-8 correction bytes even though the committed wire limit is 16,384; the same assertion is present at the feature base and is deferred rather than folded into this package commit. A read-service timeout seen only while the full suite, hygiene, Chromium, and real Codex verifier ran concurrently passed immediately when rerun alone.
