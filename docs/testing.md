# Testing

Commands live in root [AGENTS.md](../AGENTS.md). This file is what a green run must mean.

## Tiers we have

- **Unit** (`python3 -B scripts/run_tests.py`): stdlib unittest next to the behavior it pins. The runner fails when discovery finds zero tests. Prefer errors, skip paths, on-disk layout, and contract regressions.
- **Compile** (`python3 -m compileall -q tools scripts tests`): syntax only. CI also compiles `src/` when that directory exists.
- **Docs** (`python3 -B scripts/verify_docs.py`): portable local links, exact trailing newline, and canonical design projections. It does not prove prose is true.
- **Agent Notes** (`python3 -B scripts/verify_agent_notes.py`): lifecycle, path, date, status, required non-empty sections, and duplicate ownership. `--base <sha> --head <sha>` also requires a changed Note for governed paths; `merge-base` owns feature/PR ranges and `direct` owns old-to-new push snapshots. It is not a design review.
- **Lint** (`ruff check tools scripts tests`): blocking static errors. It is not a formatter or type checker.
- **CI** on `dot-skill`, `distilly`, and `main` runs governance once and the Python matrix. It is the exhaustive lane. Locally run only what the diff can break.

We do not have, and do not pretend to have: per-file 100% coverage, keyless snapshot transcripts, or real-API e2e. When a model-visible projection ships (`prompt()`, `SKILL.md`, host instructions), add a keyless fixture that diffs the rendered text.

The tiers that arrive with the TypeScript packages — Vitest, model-visible snapshots, and the publish-face checks that catch a package which passes every source test yet cannot be imported — are specified in [design §24](design/v2/24-governance-toolchain.md). They are designed, not available; do not cite them as evidence. Coverage there is reported, not gated per file, for the same reason it is absent here.

## Rules

- Tests describe behavior, not correctness theater. Change obsolete behavior with its tests.
- Mock only the expensive or non-deterministic edge (network, clock, LLM). Keep the store, hasher, and renderer real.
- Assert the world: files under a temporary root, version pointers, claim lines, refusal errors. Do not trust an agent's own summary.
- Do not hit live APIs in CI.
- A test of an installer or CLI boots that entry, not an internal helper that skips argument parsing.
- Distill objectivity: same material-set hash skips; a second distill of the same set must keep structured claim fields stable once that path exists.
- A test command that discovers zero tests is not evidence. Required test directories and entry points fail closed.
