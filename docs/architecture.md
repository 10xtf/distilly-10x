# Architecture

This file is the **live-tree map**. The published code on `distilly` still writes colleague-family artifacts (`work.md`, `persona.md`, `SKILL.md`). New work must land on the design in [design/system-v3.md](design/system-v3.md), not on that split.

Do not implement from this page alone. Load [design/README.md](design/README.md) and the chapter that owns the change.

## What exists now

- `tools/` and `prompts/` distill and install Claude-oriented skills. They are frozen Python serving the published skill; product behavior is now designed in TypeScript, and no `packages/` workspace exists yet.
- Tests under `tests/` cover that skill writer, installers, and research helpers.
- CI on `dot-skill`, `distilly`, and `main` reports documentation and Agent Note governance, compiles Python sources on 3.9/3.11, runs fail-closed unittest discovery, and reports Ruff failures.
- Generated design chapters, local Markdown links, and governed-diff Note ownership are checked by scripts under `scripts/`.
- Required-check enforcement is external GitHub state, not a fact stored in this tree. Verify it with the [branch-protection cookbook](cookbook/protecting-governed-branches.md) before claiming a red check blocks a push or merge.
- `packages/` and `~/.distilly/` are specified, not shipped. Nothing in the tree is TypeScript yet: there is no `package.json` workspace, no `tsconfig`, and no `pnpm` lockfile.

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
materials → tools/ + prompts/ → work.md + persona.md + SKILL.md → host skills/
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
