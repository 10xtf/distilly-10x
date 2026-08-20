# Agent Note: full-lifecycle governance for the TypeScript tree

Status: proposed

## Problem

The governance layer this branch already runs — documentation contracts, the Agent Note tree, a governed-diff gate, per-directory instructions, and a pre-push hook — is implemented in Python and only inspects Python and Markdown. Once product code is [TypeScript](../architecture/2026-08-19-typescript-product-line.md), the existing gates cannot see the failures that actually matter in that ecosystem: a package that type-checks but publishes broken export maps, an unused export that reveals a dependency-direction violation, an unhandled Promise, a non-exhaustive `switch`, or a model-visible projection that changed without anyone reading the diff.

There is also a sequencing trap. If TypeScript gates arrive only after the product code, the first several product PRs land with no mechanical checks at all, and the branch learns to treat red as normal.

## Proposal

Land the gate suite with the TypeScript foundation, before later product slices, and define the whole lifecycle rather than a pile of commands. V2 first specified the lifecycle; [V3 §27](../../../../docs/design/v3/27-testing-and-governance.md) is now the in-force contract for the evidence classes and gates. This note owns why the shape is that way and what was rejected.

Sixteen stages from bootstrap to monthly audit, each with an owner and a verdict. The ones that carry the design weight:

- **`pnpm run gates` is the single aggregator.** It runs the fast checks, typecheck, tests, model-visible snapshots, documentation, notes, build, and hygiene in that order, printing each exact command so a report can quote it instead of paraphrasing. Existing practice already forbids writing only "tests pass".
- **Fast and full are separate entry points.** `gates:fast` is what a task agent runs against the surface it changed; `gates` is the CI equivalent. Defaulting to the full suite locally teaches agents to skip checks.
- **The release face has its own gates.** `publint` and a type-resolution check plus an import smoke over the built entry, because the common TypeScript failure is a package that passes every source test and still cannot be imported.
- **`knip` enforces unused and undeclared dependency hygiene, not V3 §25 package direction.** A dedicated import-boundary and cycle gate lands with the second package, when a real cross-package edge exists; Knip alone cannot prove that an otherwise declared and used import points in the allowed direction.
- **Coverage is reported, not gated per file.** Per-file totals are a resource commitment this tree cannot honor yet, and a covered line is not an assertion.
- **Model-visible output is snapshot-tested without any key.** `prompt()`, `SKILL.md`, and host instructions are the product's real output; a changed snapshot must be explained in the PR, never bulk-accepted.
- **Repository governance has one implementation per check.** V3 does not reserve an empty `@distilly/governance` package. Existing Python doc/Note verifiers remain until a real TypeScript replacement lands with accepted/rejected parity, at which point the Python implementation is deleted in the same PR. The legacy product CI job exists only while `tools/` does and is deleted rather than disabled.
- **The local hook stays cheap.** It runs the deterministic subset and verifies the outgoing local `HEAD`; the remote CI is the only merge authority, because Git cannot force a contributor to install a hook.
- **Gates never score prose.** V3 §27.9 draws the line explicitly: structure, links, exit codes, and export maps are mechanical; whether a rationale is true, whether an assertion would catch the intended defect, and whether every non-trivial change wrote a Note remain semantic review under [code-review.md](../../../../docs/process/code-review.md).

Growth is signal-driven. V3 §27 keeps target gates tied to a behavior or release face, so the suite does not acquire twenty verifiers on day one. A checker with no corresponding failure is pure cost: it slows every change and gets whitelisted after its first false positive.

## Alternatives considered

- **Keep the Python gates and add a second TypeScript suite** — rejected: two implementations of the same documentation and Note contracts drift, and the drift is invisible until they disagree about a real PR.
- **Port the gates only after the product code lands** — rejected: the first product PRs would have no mechanical floor, and a branch that starts red stays red.
- **One `gates` command with no fast subset** — rejected: a slow default is the reason agents bypass checks, and the repository already requires choosing the narrowest check the diff can break.
- **Per-file 100% coverage from the start** — rejected: that gate is affordable only with the maintenance budget behind it, and it rewards covering lines over asserting behavior.
- **`oxlint` instead of ESLint** — rejected for now: the rules that matter here are type-aware and JSDoc-shaped. Speed is not the binding constraint on a repository this size.
- **A bundler-produced dist plus source-only tests** — rejected: it hides exactly the publish-face failures stage 10 exists to catch. `tsc -b` emits, and the built entry is smoke-tested.
- **Enable changesets and a release pipeline immediately** — rejected: nothing is published, and documenting a release flow that has never run violates the rule that standard commands must be real.
- **Let the hook run the full suite** — rejected: contributors disable slow hooks, and CI is the authority anyway.

## Acceptance criteria

- `pnpm run gates` exits non-zero for each of these seeded defects, one at a time: a type error, a lint violation, a failing test, an empty test discovery, a broken local Markdown link, a design chapter that drifts from its parent, a governed path changed without a Note, an unused export, and a package whose export map cannot be resolved.
- `pnpm run gates:fast` finishes fast enough to run on every change, and its command list is a strict subset of `gates`.
- Every command written into root `AGENTS.md`, [docs/development.md](../../../../docs/development.md), and [docs/testing.md](../../../../docs/testing.md) has been executed in this repository, or is labeled with the environment and credential it needs.
- CI reports governance once, and reports tests across Node 22 and 24 on Linux and macOS.
- The pre-push hook verifies the local outgoing `HEAD`, not a stale remote head.
- Deleting the last Python product file removes the `legacy-python` job and its documentation in the same change.
- A cold-start agent reads root `AGENTS.md`, the documentation map, and design V3, then names what it may change, where each fact lives, which command to run, and whether a Note is required.

## Risks

- The stage table is longer than the current tree needs. The mitigation is that unimplemented commands stay labeled as design targets, and V3 §27 requires real entry-path evidence before a gate is claimed as available.
- A dual-language window means one PR can pass the TypeScript gates and break the Python ones. CI runs both, so the failure is visible; the risk is agents reading only the job they expected to matter.
- `pnpm run gates` becomes a place to hide slow checks. Keeping the fast subset a strict subset, and printing each command, is what keeps that honest.
- Snapshot tests invite bulk acceptance. Review treats an unexplained snapshot update as a blocker.
- Handing the documentation and Note verifiers from Python to TypeScript is a behavior-preserving rewrite of gates that currently protect the branch. It needs the accepted and rejected cases ported first, so the gate cannot silently become permissive.
- Node's built-in test tooling and `node:sqlite` are still moving. Vitest and the disposable `.index/` keep both changes confined.
