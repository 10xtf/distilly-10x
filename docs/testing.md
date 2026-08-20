# Testing

Commands live in root [AGENTS.md](../AGENTS.md). This file is what a green run must mean.

## Tiers we have

- **Python unit** (`python3 -B scripts/run_tests.py`): stdlib unittest next to the behavior it pins. The runner fails when discovery finds zero tests. Prefer errors, skip paths, on-disk layout, and contract regressions.
- **Compile** (`python3 -m compileall -q tools scripts tests`): syntax only. CI also compiles `src/` when that directory exists.
- **Docs** (`python3 -B scripts/verify_docs.py`): portable local links, exact trailing newline, and canonical design projections. It does not prove prose is true.
- **Agent Notes** (`python3 -B scripts/verify_agent_notes.py`): lifecycle, path, date, status, required non-empty sections, and duplicate ownership. `--base <sha> --head <sha>` also requires a changed Note for governed paths; `merge-base` owns feature/PR ranges and `direct` owns old-to-new push snapshots. It is not a design review.
- **Python lint** (`ruff check tools scripts tests`): blocking static errors. It is not a formatter or type checker.
- **TypeScript fast** (`pnpm run gates:fast`): Prettier check plus ESLint, including the type-aware Promise, discriminant, and public-contract rules configured for product sources. It does not typecheck package exports or run behavior.
- **TypeScript typecheck** (`pnpm run typecheck`): no-emit checks for every package and the repository tool configuration. A green result proves the current source graph typechecks, not that its built entry resolves.
- **TypeScript Protocol** (`pnpm run test` or a narrow Protocol Vitest file): Vitest covers all public id/time/facet grammars, strict wire and typed error envelopes, shared limits, host/private-capture values, method-correlated fact-record schema round-trips, every branch of the 35-method runtime schema registry, EngineEvent compatibility decoding, and all five MCP descriptor runtime/JSON-schema input and output contracts. Distilly extension keywords preserve byte and cross-field constraints that draft-2020-12 cannot express; the runtime schema remains the authoritative MCP boundary when a generic validator ignores those keywords. These tests prove serializable Protocol behavior, not persistence or Engine services.
- **Engine fact foundation** (`pnpm exec vitest run packages/engine/src`): real temporary roots cover canonical checksums and material hashes, atomic previous-or-target publication under injected failures, strict UTF-8 and stable-symlink refusal, all six concrete fact stores and their cross-record invariants, owner-bound locks, dead-owner stale-heartbeat recovery, and candidate-safe lock paths. The built Engine smoke adds two real processes contending for one subject lock. This proves storage primitives, not defense against an attacker already controlling the same local filesystem account, create/ingest transactions, queueing, journal recovery, or a complete Engine runtime.
- **Package boundaries** (`pnpm run test:boundaries`, also enforced by `pnpm run hygiene`): a fail-closed TypeScript-AST checker verifies the current internal package allowlist, manifest and source import direction, cross-package relative-import refusal, static module specifiers, and cycle detection. It resolves `npm:` and `workspace:` aliases plus local `link:`, directory `file:`, and bare directory specs, including source imports through an alias subpath, back to the real internal package; renaming the dependency key cannot bypass the graph. Knip remains responsible for unused and undeclared dependency hygiene.
- **Coverage** (`pnpm run test:coverage`): reports V8 coverage for TypeScript product sources without a per-file percentage gate. It is evidence of exercised lines, not semantic completeness.
- **Snapshots** (`pnpm run snapshots`): pins the protocol root's complete explicit type/runtime symbol allowlists, wire vocabulary, 35-method order, and every serializable field of the exact five MCP descriptors, including their draft-2020-12 input/output schemas, `x-distilly-*` constraints, and annotations. It is not yet a model-visible `prompt()`, `SKILL.md`, or host-instruction snapshot.
- **Build and package face** (`pnpm run build`, then `pnpm run hygiene`): TypeScript project references emit packages; the boundary checker, Knip, built-entry import smokes, publint, and `attw --pack --profile esm-only` check dependency direction, unused or undeclared dependencies, runtime importability, exports, and published type resolution. The private Engine root smoke also pins that no incomplete runtime API leaks while exercising built cross-process locking. Source tests alone do not establish these properties.
- **CI** on `dot-skill`, `distilly`, and `main` runs governance once, the TypeScript workspace, Protocol contract, and Engine fact foundation on Node 22.19 and 24 across Linux and macOS, and the retained Python 3.9/3.11 plus Ruff lanes. Locally run only what the diff can break.

We do not have, and do not pretend to have: a complete Engine service, create/ingest transaction and recovery tests, queue or projection rebuild tests, host workflow or fresh-install tests, per-file 100% coverage, keyless model-visible snapshots, or real-API e2e. When a model-visible projection ships (`prompt()`, `SKILL.md`, host instructions), add a keyless fixture that diffs the rendered text.

The remaining TypeScript tiers — create/ingest and crash recovery, deterministic source grouping and claim functions, model-visible projections, host workflows, Panel security, and fresh install — are specified in [design §27](design/v3/27-testing-and-governance.md). They are designed, not available, and cannot be cited as current evidence.

## Rules

- Tests describe behavior, not correctness theater. Change obsolete behavior with its tests.
- Mock only the expensive or non-deterministic edge (network, clock, LLM). Keep the store, hasher, and renderer real.
- Assert the world: files under a temporary root, version pointers, claim lines, refusal errors. Do not trust an agent's own summary.
- Do not hit live APIs in CI.
- A test of an installer or CLI boots that entry, not an internal helper that skips argument parsing.
- Distill correctness: the same material-set hash skips automatically; accepted patches render byte-stably, while an explicitly requested external-model redistill may propose a different evidence-bounded patch and must be diffed/versioned rather than called deterministic.
- A test command that discovers zero tests is not evidence. Required test directories and entry points fail closed.
