# Architecture

This file is the **live-tree map**. The published code on `distilly` still writes colleague-family artifacts (`work.md`, `persona.md`, `SKILL.md`). New work must land on the design in [design/system-v2.md](design/system-v2.md), not on that split.

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
| Any term used below | [design/v2/00-how-to-read.md](design/v2/00-how-to-read.md) |
| Product origin, who we remember, five faces | [design/v2/01-intent.md](design/v2/01-intent.md) |
| Why TypeScript, and what it costs | [design/v2/04-language-runtime.md](design/v2/04-language-runtime.md) |
| A locked rule, an open item, or a frozen one | [design/v2/05-locked-and-open.md](design/v2/05-locked-and-open.md) |
| Layers, queues, executor split | [design/v2/06-architecture.md](design/v2/06-architecture.md) |
| Package cut and dependency direction | [design/v2/07-package-cut.md](design/v2/07-package-cut.md) |
| On-disk home | [design/v2/08-home-tree.md](design/v2/08-home-tree.md) |
| A field name that reaches disk or the wire | [design/v2/10-value-types.md](design/v2/10-value-types.md) |
| `Distilly` / `Person` / errors / MCP tools | [design/v2/11-public-api.md](design/v2/11-public-api.md) |
| Engine internals and the queue | [design/v2/12-engine.md](design/v2/12-engine.md) |
| Collection | [design/v2/13-source-adapters.md](design/v2/13-source-adapters.md) |
| Injection, three load paths, seven pitfalls | [design/v2/14-host-injection.md](design/v2/14-host-injection.md) |
| CLI and plugin packages | [design/v2/15-cli-and-plugins.md](design/v2/15-cli-and-plugins.md) |
| TUI, panel server, and the `watch` seam | [design/v2/16-interactive-faces.md](design/v2/16-interactive-faces.md) |
| Profile core / domain / claim | [design/v2/19-profile-layer.md](design/v2/19-profile-layer.md) |
| Confidence, maturity, and who owns shipped facts | [design/v2/20-completeness.md](design/v2/20-completeness.md) |
| Relations | [design/v2/21-relations.md](design/v2/21-relations.md) |
| Gates, CI, and what only review can judge | [design/v2/24-governance-toolchain.md](design/v2/24-governance-toolchain.md) |
| Retiring the Python tooling | [design/v2/25-python-migration.md](design/v2/25-python-migration.md) |
| Order of work and first-slice acceptance | [design/v2/26-landing-and-evolution.md](design/v2/26-landing-and-evolution.md) |

## Live data flow (today)

```
materials → tools/ + prompts/ → work.md + persona.md + SKILL.md → host skills/
```

## Target data flow (design)

```
bindings     Claude / Codex / LangGraph / Hermes / Telegram
             Recall = get / prompt     Capture = ingest | acceptCollect
                  │
facade       distilly            Distilly + Person, async only
                  │
protocol     @distilly/protocol  branded ids, value types, error codes
                  │
engine       @distilly/engine    collect → Material → queue → distill → version → project
                                 relations, corrections, promote / reject
                  │
store        ~/.distilly/        Markdown / jsonl are facts
             .index/sqlite/      disposable queue and graph projection
```

Signatures, field lists, and host pitfalls stay in the design chapters. This page only orients.
