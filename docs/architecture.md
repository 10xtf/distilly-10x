# Architecture

This file is the **live-tree map**. The published skill path still writes colleague-family artifacts (`work.md`, `persona.md`, `SKILL.md`), while the `distilly` product path now has a TypeScript foundation. New work must land on the design in [design/system-v3.md](design/system-v3.md), not on the legacy artifact split.

Do not implement from this page alone. Load [design/README.md](design/README.md) and the chapter that owns the change.

## What exists now

This section describes the current product tree. Workspace experiments outside the governed product diff are not shipped evidence.

- The root `pnpm` workspace pins Node `^22.19 || ^24`, its package manager and dependencies in `pnpm-lock.yaml`, and real format, lint, typecheck, Vitest, coverage, snapshot, build, built-entry, export-map, type-resolution, and dependency-hygiene commands.
- `packages/protocol/` provides the V3 §29.1 Protocol slice: branded ids and value families, wire/error envelopes, trusted-session and private-capture values, fact-record shapes, all 35 EngineMethodMap schemas, EngineClient/Event contracts, the exact five MCP tool descriptors with runtime and draft-2020-12 schemas, strict runtime boundary schemas, and a built ESM entry.
- `packages/engine/` provides the internal V3 §29.1 Fact foundation and Step 5 atomic-ingest slice: confined paths; canonical full-SHA identities; atomic fact and staging publication; verified space/subject/material/state/event/root-operation/root-transaction/version-manifest stores; request/catalog/space/subject cross-process locks; deterministic subject/material normalization; and atomic create-or-existing text ingest. A prepared root journal makes the state swap or complete created directory the fact commit point, then idempotently materializes the stored operation, events, and pending queue projection.
- The package-internal Step 6 slice adds deterministic `source-groups-v1`, a verified reader for immutable version manifests and claims baselines, a packaged content-addressed host-distill prompt and evidence rules, fail-closed briefing capacity checks, incremental briefing construction, and state-authoritative `brief`/`renew`/`release` lease transactions. Lease journals preserve the exact stored briefing and recover target-first across crashes without regenerating model-visible input.
- The package-internal Step 7 slice resolves evidence against that pinned briefing context, applies claim-only patches, derives claim strength and quality, evaluates the mechanical review gate, and renders `profile-renderer-v1` bytes deterministically. A root commit journal makes the `state.json` swap the fact commit point, publishes a fully verified immutable version plus current-profile projection, preserves risky candidates as suspended versions, and completes or aborts idempotently across crash points.
- The Engine's `node:sqlite` queue v2 remains disposable: a fixed dirty marker brackets projection writes, verified `state.json` markers own pending and lease facts, reads derive active versus expired lease state, and the internal composition rebuilds a missing, dirty, or structurally invalid database from those facts. The package root intentionally exports no partial Engine API.
- `packages/distilly/` is the browser-safe Step 8 facade. Its root exports `Distilly`, `Person`, `DistillyError`, and the reviewed Protocol type surface; it accepts a caller-supplied complete `EngineClient`, maps every public query and mutation without filesystem or Node imports, keeps each `Person` bound to its subject, and delegates `close()` only to that injected client. It has no `openInProcess`, `distilly/node`, or local runtime constructor.
- `packages/mcp/` is the Step 8 MCP adapter. Its transport-neutral root exports `createMcpServer` plus the narrow server and `ReviewPresenter` types, registers exactly the five Protocol descriptors, maps them to a caller-supplied complete `EngineClient`, normalizes every product outcome to a Protocol-parsed output, and presents only suspended review references. The Node-only `@distilly/mcp/stdio` subpath owns bounded stdio teardown; neither entry owns the injected client or presenter.
- `packages/bindings/` is the Step 9 host-capability leaf. It exports the capability/full binding contracts, discriminated `HostRegistry`, and injected-provider Codex and Claude Code capability factories. Both concrete factories validate trusted net-capacity evidence against the exact host/environment/release/wire/skill tuple, force private UI capture unavailable, and perform no HOME, executable, network, install, injector, form-renderer, doctor, or runtime work.
- `plugins/shared/skills/distilly/` is the one canonical Step 9 skill tree; the Codex and Claude Code copies are byte-identical generated mirrors. The repository assembler hashes every regular file and the sorted recursive tree, synchronizes platform manifest versions with `@distilly/mcp`, writes `plugins/release-manifest.json`, rejects symlinks and stale targets, and keeps both MCP templates explicitly source-only and unlaunchable until Step 12.
- The current internal dependency edges are `@distilly/engine → @distilly/protocol`, `distilly → @distilly/protocol`, `@distilly/mcp → @distilly/protocol`, and `@distilly/bindings → @distilly/protocol`. Facade, MCP, bindings, and Engine have no upward or mutual edge beyond that allowlist; negative fixtures cover bare, subpath, workspace, link, file, and directory aliases.
- A built stdio smoke starts a real child and connects through the official MCP client, but that child injects a full test-only EngineClient and presenter. It proves server identity, exact descriptors, five calls, structured failures, byte projection, and teardown; it is not a `DISTILLY_ROOT` backend, production MCP command, CLI, or correction/review implementation.
- No complete Engine factory or `EngineRuntime`, production MCP/CLI/setup composition, review/correction/evolution service, full binding, concrete injector/form renderer, Panel, plugin runtime, or user `~/.distilly/` installation exists yet. The package-internal Engine, injected-client adapters, capability preflight, and source-only plugin assets are testable implementation evidence, not a runnable user product.
- `tools/` and `prompts/` remain frozen Python serving the published skill. Tests under `tests/` cover that skill writer, installers, research helpers, and repository governance; TypeScript tests live with their source under `packages/*/src/`, with built-entry scripts under each package.
- CI on `dot-skill`, `distilly`, and `main` reports documentation and Agent Note governance once, exercises the TypeScript workspace, Protocol contract, package-boundary gate, Engine fact/ingest/briefing/lease/claim-commit/version-recovery/queue slices, Facade/MCP/bindings tests, built stdio child conformance, and plugin release assembly on Node 22.19 and 24 across Linux and macOS, and retains Python 3.9/3.11 compile and fail-closed unittest lanes plus Ruff while the legacy skill remains.
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
| On-disk facts, transactions, and recovery | [design/v3/06-fact-layer-and-recovery.md](design/v3/06-fact-layer-and-recovery.md) |
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
internal engine:    packages/engine/src   → verified facts + ingest + brief/lease + claim commit/version recovery + queue v2
package root:       @distilly/engine      → intentionally empty; no EngineRuntime yet
injected facade:    distilly              → Distilly + Person over a caller-supplied EngineClient
injected MCP:       @distilly/mcp         → five handlers + separate stdio transport over borrowed ports
host capabilities:  @distilly/bindings    → injected trusted preflight; no full binding/runtime
plugin sources:     plugins/shared        → recursive canonical skill → exact Codex/Claude mirrors + release manifest
stdio fixture:      real MCP child        → full test fake only; no local fact backend
```

## Target data flow (design)

```
host LLM     research / files → five MCP tools → claim patch
                                      │
runtime      host binding + parser → typed EngineClient, actor per client
                                      │
engine       ingest → queue → brief/lease → validate/apply/render → current|suspended
                                      │
store        ~/.distilly/        immutable facts + state.json commit point
             .index/             disposable queue, graph, and Library projections
                                      │
surfaces     Distilly + Person | local Panel | CLI/plugin projections
```

Signatures, field lists, and host pitfalls stay in the design chapters. This page only orients.
