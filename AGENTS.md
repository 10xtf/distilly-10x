# AGENTS.md

Route work by the checked-out branch before editing: `distilly` is the target product path; `dot-skill` is maintenance of the currently published skill; another branch inherits its verified PR base. Never infer branch identity from this file alone.

## Publishing is opt-in

`distilly` is local-only. Commit freely, but **never push, open a PR, or otherwise publish it without an explicit request in the current session.** The repository is public; `dot-skill` is its default branch and carries only the published skill. Design material and unreleased product work stay on the local `distilly` branch and out of every remote ref, including PR branches, because a merged PR's objects stay retrievable after any branch rewrite.

## Feature-level local commits

Before coding, name one reviewable feature or bug-fix slice and its acceptance checks. Complete and integrate that slice, collect all subagent work, run its checks, and have the coordinating/root agent create one local commit before starting another independent feature. A feature commit contains its implementation, tests, generated artifacts, current-state documentation, and required Agent Note updates.

Do not create per-file, per-function, per-test, subagent, checkpoint, fixup, or WIP commits, and do not combine independent features in one commit. If a slice is too large for one reviewable commit, redefine its feature boundary before coding instead of mechanically splitting files afterward. Subagents only modify the shared worktree and report results; they do not commit partial work. Problems found before the next feature starts fold into the current feature commit. Local feature commits need no additional permission, but pushing, opening a PR, or otherwise publishing still requires explicit user authorization.

## Standing orders

- Before product code on `distilly`, read [docs/design/README.md](docs/design/README.md) and the chapter that owns the change. [docs/design/system-v3.md](docs/design/system-v3.md) is the in-force contract; V2 and V1 are deprecated history; [docs/architecture.md](docs/architecture.md) is the shipped-state map. Do not apply target APIs as current behavior on `dot-skill`.
- Product code is TypeScript. `tools/` and `prompts/` are frozen Python serving the published skill: defects only, no new behavior. Retirement conditions are in [design §28](docs/design/v3/28-migration-and-compatibility.md).
- The current local TypeScript tree is the `pnpm` workspace, the V3 §29.1 `@distilly/protocol` slice, `@distilly/engine` through its package-internal Step 10 verified reads, review/rollback transactions, and JSON Library projection, the Step 8 injected-client `distilly` Facade and `@distilly/mcp` adapter, the Step 9 capability-only `@distilly/bindings` package plus canonical skill/release assembly, and the Step 10 injected-client `@distilly/panel` server/web leaf. Engine still exports no partial runtime, the stdio conformance child and Panel browser fixture inject full test fakes rather than a `DISTILLY_ROOT` backend, and both host entries stop at trusted capability preflight. No complete `EngineRuntime`, full binding, production MCP/CLI/setup/Panel composition, correction service, plugin runtime, or user `~/.distilly/` installation is shipped.
- Every governed change adds or updates an [Agent Note](.agents/notes/README.md) in the same PR. The diff gate defines governed paths; tests, translations, assets, and local-only edits are exempt unless they change a shared decision.
- Document current state in standing docs. Put rationale in Agent Notes; put procedures in [docs/cookbook/](docs/cookbook/).
- Target implementation invariant (not shipped): Markdown and jsonl under `~/.distilly/` are the fact layer; indexes are disposable.
- Target implementation invariant (not shipped): the host LLM may vary semantically, but the engine's hashing, evidence resolution, patch application, rendering, and transaction are deterministic; unchanged material-set hash skips; corrections land in `corrections/`.
- Target implementation invariant (not shipped): the default is zero extra API key and exactly five MCP tools; `ingest` → `pending(brief)` → claim-only `commit`, with no required embedding or multimodal key.
- Target implementation invariant (not shipped): the public client is `Distilly` + `Person`; seven capability groups stay internal.
- Target implementation invariant (not shipped): temporary personas enter only that sub-run via `get` / `prompt`, never global `AGENTS.md`, `CLAUDE.md`, or `agent.md`.
- Target implementation invariant (not shipped): first-version recall injects the full profile and fails visibly if it does not fit.
- Target implementation invariant (not shipped): `SourceAdapter` and `HostInjector` are separate seams; relations are an additive post-core slice; commit is not O(n²).
- Target implementation invariant (encoded in Protocol types and schemas; implementations and callers remain unshipped): every public I/O operation is async, ids are branded, the error `code` union is the wire contract, and runtime validation happens only at the boundaries listed in [design §7.6](docs/design/v3/07-protocol-types.md).
- Target implementation invariant (not shipped): the `~/.distilly/` format is language-neutral; immutable versions plus `state.json` are facts, while `node:sqlite` backs only disposable queue and graph projections, never retrieval.
- Target implementation invariant (not shipped): claims are the semantic truth; the host cannot submit ids, actor, quality, version, or Markdown, and risky valid candidates suspend without replacing current.
- When reviewing a PR or an outgoing product diff, follow [docs/process/code-review.md](docs/process/code-review.md) and [distilly-code-review](.agents/skills/distilly-code-review/SKILL.md).
- Tests describe behavior. Run the narrowest check the diff can break.
- Local commits need no permission; publishing does. When a push is requested, follow [distilly-pre-push-checks](.agents/skills/distilly-pre-push-checks/SKILL.md); the hook must verify the outgoing local `HEAD`, not a stale remote PR head.
- Before pausing or transferring work, produce the full [Agent Handoff](docs/development.md#agent-handoff). A completed PR uses the equivalent fields in its PR template; an incomplete or transferred PR includes the full handoff. Do not put task progress in Agent Notes.
- Files end with exactly one trailing newline.

## Where facts live

| Home | Job |
|---|---|
| This file | Standing orders for every session |
| [docs/README.md](docs/README.md) | Folder map |
| [docs/design/](docs/design/README.md) | Product contract |
| [docs/architecture.md](docs/architecture.md) | Live tree |
| [docs/process/](docs/process/README.md) | Review contract |
| [docs/testing.md](docs/testing.md) | What green tests mean |
| [docs/development.md](docs/development.md) | Daily checks |
| [.agents/notes/](.agents/notes/README.md) | Why, alternatives, verification |
| [.agents/skills/](.agents/skills/) | Repeatable workflows, not contracts |

## Checks

```sh
pnpm install --frozen-lockfile
pnpm run gates:fast
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run snapshots
pnpm run build
pnpm run hygiene
python3 -B scripts/verify_docs.py
python3 -B scripts/verify_agent_notes.py
python3 -m compileall -q tools scripts tests
ruff check tools scripts tests
python3 -B scripts/run_tests.py
```

Run the narrowest set that can fail for the change. CI runs on `dot-skill`, `distilly`, and `main`; branch protection determines whether a red result merely detects or actually blocks the change.

These are the gates that exist today. The TypeScript suite currently proves the workspace, Protocol wire contract, exact current package dependency direction, Engine fact primitives and internal ingest/source-grouping/briefing/lease/claim-commit/version-recovery/read/review/rollback/Library-projection slices, injected-client Facade/MCP mappings, real stdio transport conformance over a full test fake, capability-only host preflight, canonical skill/plugin release bytes, and the injected Panel's real loopback HTTP plus Chromium behavior; a production local runtime, full binding, CLI/setup/Panel composition, correction service, and later release tiers remain in [design §27](docs/design/v3/27-testing-and-governance.md).

Edit this file, not `CLAUDE.md` (`CLAUDE.md` is a symlink).
