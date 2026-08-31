# Architecture

This file is the **live-tree map**. The published skill path still writes colleague-family artifacts (`work.md`, `persona.md`, `SKILL.md`), while the `distilly` product path now has a TypeScript foundation. New work must land on the design in [design/system-v3.md](design/system-v3.md), not on the legacy artifact split.

Do not implement from this page alone. Load [design/README.md](design/README.md) and the chapter that owns the change.

## What exists now

This section describes the current product tree. Workspace experiments outside the governed product diff are not shipped evidence.

- The root `pnpm` workspace pins Node `^22.19 || ^24`, its package manager and dependencies in `pnpm-lock.yaml`, and real format, lint, typecheck, Vitest, coverage, snapshot, build, built-entry, export-map, type-resolution, and dependency-hygiene commands.
- `packages/protocol/` provides the V3 §29.1 Protocol slice: branded ids and value families, wire/error envelopes, trusted-session and private-capture values, fact-record shapes, all 35 EngineMethodMap schemas, EngineClient/Event contracts, the separate root-owner `EngineAdministrationClient` backup/restore schema pair, strict purge/GC diagnostics, the exact five MCP tool descriptors with runtime and draft-2020-12 schemas, strict runtime boundary schemas, and a built ESM entry. The administration pair is not part of EngineMethodMap, Panel RPC, or MCP.
- `packages/engine/` now provides the package-private SQLite/WAL create, ingest, pending, brief, renew, and release slice. Its exact twelve-table canonical private schema v1 owns spaces, subjects, aliases and identity hints, current material membership, authoritative pending jobs and optional leases, stable operations, blob-backed operation-result references, and audit events; immutable normalized bodies and complete canonical briefing templates live in the SHA-256 content-addressed blob store. Create and ingest share one transaction-local identity primitive; brief atomically claims an absent or expired generation lease after complete material and capacity verification; renew and release compare the active owner; every mutation commits its structured effects in one short transaction and replays RequestIds exactly. Schema v1 still has no versions authority and therefore requires both version pointers to remain NULL.
- The SQLite briefing path verifies the complete first-version material snapshot under one blob access lease, pins `source-groups-v1` and the packaged prompt contract, and refuses silent capacity truncation before publishing a fixed-width placeholder template. The write transaction takes a fresh acquisition time, grants the full 30-minute lease, and stores a small canonical envelope that binds RequestId, input checksum, subject, template pointer, and exact final lease. Replay verifies both authorities and overlays only the fixed-width lease fields, preserving the capacity fixed point while reconstructing the exact original `HostDistillBriefing` without consulting the current job or prompt. Duplicate ingest preserves a same-generation lease, while a changed generation replaces the pending job and cascades its prior lease.
- An explicit `legacy-file-engine.test.fixture.ts` keeps the unmigrated package-internal claim/version pipeline executable without entering the SQLite composition. Its supporting test-only files retain deterministic source grouping, verified immutable version/claims baselines, incremental briefing construction, and the former file-backed lease flow only as regression setup for commit, read, and review tests.
- The same test-only legacy fixture exercises the unmigrated Step 7 evidence resolution, claim-only patching, strength, quality, mechanical review gate, deterministic `profile-renderer-v1`, immutable version publication, current versus suspended results, and commit crash recovery. These file-backed writers are migration fixtures, not a production fallback for the SQLite path.
- The package-internal Step 10 read slice implements `library.list`, `materials.list/get`, `profiles.get/prompt/status`, `versions.list/diff/lineage`, and `reviews.list` over verified facts. Subject reads reconcile prepared journals, hold the subject lock through one complete fact snapshot, require every physical immutable version and lineage reference to have one consistent durable lifecycle, bind cursors to method and normalized filters, and fail closed for orphaned or contradictory versions; `raw_extract` remains unsupported without a verified raw reader.
- The package-internal Step 10 write slice implements promote, reject, and immutable-copy rollback with globally idempotent RequestIds, subject CAS, typed journals, `state.json` as the commit point, target-first recovery, exact-previous abort, third-state corruption, event publication only after durable facts, and pending-job rebase after a new current version. All three refresh the Library projection; promote and rollback replace the current profile, while reject leaves the current profile and pending marker unchanged.
- The former `node:sqlite` sibling queue, lease journal/recovery path, file locks, file-backed commit/review services, and checksummed JSON Library projection are reachable only through explicitly named test fixtures. Their regressions remain executable for unmigrated commit/read/review behavior, but the SQLite composition has no import or runtime path to them and no queue database or dirty marker in its layout. The package root intentionally exports no partial Engine API.
- SQLite is therefore current authority for create, ingest, pending, brief, renew, and release. Commit, verified reads, review/rollback, Library, and correction still require feature-by-feature migration before a complete root-scoped Engine writer exists; every migration removes its replaced file path instead of adapting or dual-writing it.
- `packages/distilly/` is the browser-safe Step 8 facade. Its root exports `Distilly`, `Person`, `DistillyError`, and the reviewed Protocol type surface; it accepts a caller-supplied complete `EngineClient`, maps every public query and mutation without filesystem or Node imports, preserves the complete `PurgeResult`, keeps each `Person` bound to its subject, and delegates `close()` only to that injected client. It has no `openInProcess`, `distilly/node`, or local runtime constructor.
- `packages/mcp/` is the Step 8 MCP adapter. Its transport-neutral root exports `createMcpServer` plus the narrow server and `ReviewPresenter` types, registers exactly the five Protocol descriptors, maps them to a caller-supplied complete `EngineClient`, normalizes every product outcome to a Protocol-parsed output, and presents only suspended review references. The Node-only `@distilly/mcp/stdio` subpath owns bounded stdio teardown; neither entry owns the injected client or presenter.
- `packages/bindings/` is the Step 9 host-capability leaf. It exports the capability/full binding contracts, discriminated `HostRegistry`, and injected-provider Codex and Claude Code capability factories. Both concrete factories validate trusted net-capacity evidence against the exact host/environment/release/wire/skill tuple, force private UI capture unavailable, and perform no HOME, executable, network, install, injector, form-renderer, doctor, or runtime work.
- `packages/panel/` is the Step 10 injected-client Panel leaf with no root barrel. Its `@distilly/panel/server` subpath owns a literal-`127.0.0.1` server, exact Bearer/Host/Origin checks, fixed assets and CSP, bounded request/response/header/SSE handling, all-mutation one-use nonces, and a single-flight `ReviewPresenter` launcher; its browser-safe `@distilly/panel/web` subpath owns the complete EngineMethodMap HTTP client, authenticated `POST /events` re-read stream, and Library, Subject, Review, and Settings/Doctor rendering. It enables real reads plus promote/reject/rollback over a borrowed full client, never reads Engine stores, exports no runtime or CLI, and gives unsupported production features no fake success.
- `plugins/shared/skills/distilly/` is the one canonical Step 9 skill tree; the Codex and Claude Code copies are byte-identical generated mirrors. The repository assembler hashes every regular file and the sorted recursive tree, synchronizes platform manifest versions with `@distilly/mcp`, writes `plugins/release-manifest.json`, rejects symlinks and stale targets, and keeps both MCP templates explicitly source-only and unlaunchable until Step 12.
- The current internal dependency edges are `@distilly/engine → @distilly/protocol`, `distilly → @distilly/protocol`, `@distilly/mcp → @distilly/protocol`, `@distilly/bindings → @distilly/protocol`, and `@distilly/panel → @distilly/protocol + @distilly/mcp`; the Panel web graph itself reaches only Protocol. Packages have no upward or mutual edge beyond that allowlist; negative fixtures cover bare, subpath, workspace, link, file, and directory aliases.
- A built stdio smoke starts a real child and connects through the official MCP client, but that child injects a full test-only EngineClient and presenter. It proves server identity, exact descriptors, five calls, structured failures, byte projection, and teardown; it is not a `DISTILLY_ROOT` backend, production MCP command, CLI, or production review/Panel composition.
- No complete Engine factory or `EngineRuntime`, production MCP/CLI/setup/Panel composition, correction/evolution service, full binding, concrete injector/form renderer, plugin runtime, or user `~/.distilly/` installation exists yet. The package-internal Engine, injected-client adapters and Panel, capability preflight, and source-only plugin assets are testable implementation evidence, not a runnable user product.
- `tools/` and `prompts/` remain frozen Python serving the published skill. Tests under `tests/` cover that skill writer, installers, research helpers, and repository governance; TypeScript tests live with their source under `packages/*/src/`, with built-entry scripts under each package.
- CI on `dot-skill`, `distilly`, and `main` reports documentation and Agent Note governance once, exercises the TypeScript workspace, Protocol contract, package-boundary gate, Engine fact/ingest/briefing/lease/claim-commit/version-recovery/read/review/rollback/queue/Library slices, Facade/MCP/bindings/Panel tests, built stdio child conformance, real Chromium Panel behavior, and plugin release assembly on Node 22.19 and 24 across Linux and macOS, and retains Python 3.9/3.11 compile and fail-closed unittest lanes plus Ruff while the legacy skill remains.
- Generated design chapters, local Markdown links, and governed-diff Note ownership are checked by scripts under `scripts/`.
- Required-check enforcement is external GitHub state, not a fact stored in this tree. Verify it with the [branch-protection cookbook](cookbook/protecting-governed-branches.md) before claiming a red check blocks a push or merge.

## What must be built

The contract is the uncut design. Entry points:

| If you are changing | Read |
|---|---|
| Any term used below | [design/v3/00-how-to-read.md](design/v3/00-how-to-read.md) |
| Product promise and user journeys | [design/v3/01-product.md](design/v3/01-product.md), [design/v3/02-user-journeys.md](design/v3/02-user-journeys.md) |
| A locked rule or superseded V2 decision | [design/v3/03-locked-and-superseded.md](design/v3/03-locked-and-superseded.md) |
| LLM versus engine trust boundary | [design/v3/04-trust-and-principles.md](design/v3/04-trust-and-principles.md) |
| Layers, processes, and state machines | [design/v3/05-architecture-and-state.md](design/v3/05-architecture-and-state.md) |
| Target storage authority, transactions, and audit | [design/v3/06-storage-authority-and-transactions.md](design/v3/06-storage-authority-and-transactions.md) |
| A field name that reaches disk or the wire | [design/v3/07-protocol-types.md](design/v3/07-protocol-types.md) |
| The exact five MCP tools | [design/v3/08-mcp-tools.md](design/v3/08-mcp-tools.md) |
| Research, adapters, and provenance | [design/v3/10-research-provenance.md](design/v3/10-research-provenance.md) |
| Ingest, queue, briefing, and lease | [design/v3/11-ingest-and-queue.md](design/v3/11-ingest-and-queue.md), [design/v3/12-briefing-and-lease.md](design/v3/12-briefing-and-lease.md) |
| Claims, rendering, commit, and review gates | [design/v3/13-profile-and-claims.md](design/v3/13-profile-and-claims.md), [design/v3/14-commit-and-quality.md](design/v3/14-commit-and-quality.md) |
| Local Panel and its security boundary | [design/v3/15-local-panel.md](design/v3/15-local-panel.md) |
| Recall, injection, and host bindings | [design/v3/16-recall-and-injection.md](design/v3/16-recall-and-injection.md), [design/v3/17-host-bindings.md](design/v3/17-host-bindings.md) |
| `Distilly`, `Person`, EngineClient, and methods | [design/v3/18-public-sdk.md](design/v3/18-public-sdk.md) |
| CLI, setup, MCP composition, and plugins | [design/v3/19-cli-and-plugins.md](design/v3/19-cli-and-plugins.md) |
| Corrections and version evolution | [design/v3/20-corrections-and-evolution.md](design/v3/20-corrections-and-evolution.md) |
| Relations and rebuildable indexes | [design/v3/22-relations.md](design/v3/22-relations.md), [design/v3/23-index-and-search.md](design/v3/23-index-and-search.md) |
| Local bundles and future Profile Catalog | [design/v3/24-profile-catalog.md](design/v3/24-profile-catalog.md) |
| Package cut and dependency direction | [design/v3/25-package-and-source-tree.md](design/v3/25-package-and-source-tree.md) |
| Gates, CI, and what only review can judge | [design/v3/27-testing-and-governance.md](design/v3/27-testing-and-governance.md) |
| Retiring Python and compatibility | [design/v3/28-migration-and-compatibility.md](design/v3/28-migration-and-compatibility.md) |
| Order of work and release acceptance | [design/v3/29-landing-and-evolution.md](design/v3/29-landing-and-evolution.md) |

## Live data flow (today)

```
published skill: materials → tools/ + prompts/ → work.md + persona.md + SKILL.md → host skills/
product protocol:   packages/protocol/src → types + runtime schemas + ESM lib entry
internal engine:    packages/engine/src   → SQLite create/ingest/pending/brief/lease + test-only legacy claim fixture
package root:       @distilly/engine      → intentionally empty; no EngineRuntime yet
injected facade:    distilly              → Distilly + Person over a caller-supplied EngineClient
injected MCP:       @distilly/mcp         → five handlers + separate stdio transport over borrowed ports
host capabilities:  @distilly/bindings    → injected trusted preflight; no full binding/runtime
injected Panel:     @distilly/panel       → loopback server + browser UI over a borrowed complete EngineClient
plugin sources:     plugins/shared        → recursive canonical skill → exact Codex/Claude mirrors + release manifest
stdio fixture:      real MCP child        → full test fake only; no local fact backend
```

## Target data flow (design)

```
host LLM      research / files → five MCP tools → claim patch
surfaces      Distilly + Person | local Panel | CLI/plugin
                                       │ EngineClient only
runtime       host binding + parser → actor-bound client
                                       │
engine        ingest → pending → brief/lease → validate/apply/render → current|suspended
                  │                                      │
                  ▼                                      ▼
authority     SQLite/WAL metadata + immutable blobs   LSN projections / exports / host files
```

Signatures, field lists, and host pitfalls stay in the design chapters. This page only orients.
