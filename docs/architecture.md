# Architecture

This file is the **live-tree map**. The published skill path still writes colleague-family artifacts (`work.md`, `persona.md`, `SKILL.md`), while the `distilly` product path now has a TypeScript foundation. New work must land on the design in [design/system-v3.md](design/system-v3.md), not on the legacy artifact split.

Do not implement from this page alone. Load [design/README.md](design/README.md) and the chapter that owns the change.

## What exists now

This section describes the current product tree. Workspace experiments outside the governed product diff are not shipped evidence.

- The root `pnpm` workspace pins Node `^22.19 || ^24`, its package manager and dependencies in `pnpm-lock.yaml`, and real format, lint, typecheck, Vitest, coverage, snapshot, build, built-entry, export-map, type-resolution, and dependency-hygiene commands.
- `packages/protocol/` provides the V3 §29.1 Protocol slice: branded ids and value families, wire/error envelopes, trusted-session and private-capture values, fact-record shapes, all 35 EngineMethodMap schemas, EngineClient/Event contracts, the exact five MCP tool descriptors with runtime and draft-2020-12 schemas, strict runtime boundary schemas, and a built ESM entry.
- `packages/engine/` provides the internal V3 §29.1 Fact-foundation slice: confined layout paths, canonical JSON and full SHA-256 fact/material identities, durable atomic file publication, concrete space/subject/material/state/event/operation stores, and space-identity/subject cross-process locks with heartbeat and dead-owner recovery. Store reads validate Protocol schemas, checksums, path ids, subject/space references, material bodies, and current material manifests. The package root intentionally exports no partial Engine API.
- No complete Engine factory or runtime, create/ingest service, prepared journal or recovery service, queue/index, facade, MCP server, CLI, binding, Panel, plugin runtime, deterministic source-grouping/claim functions, or user `~/.distilly/` installation exists yet. Protocol types and the internal fact foundation are not a runnable product.
- `tools/` and `prompts/` remain frozen Python serving the published skill. Tests under `tests/` cover that skill writer, installers, research helpers, and repository governance; TypeScript tests live with their source under `packages/*/src/`, with built-entry scripts under each package.
- CI on `dot-skill`, `distilly`, and `main` reports documentation and Agent Note governance once, exercises the TypeScript workspace, Protocol contract, package-boundary gate, and Engine fact foundation on Node 22.19 and 24 across Linux and macOS, and retains Python 3.9/3.11 compile and fail-closed unittest lanes plus Ruff while the legacy skill remains.
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
fact foundation:    packages/engine/src   → verified local facts + locks; no EngineRuntime yet
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
