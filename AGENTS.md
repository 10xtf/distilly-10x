# AGENTS.md

Route work by the checked-out branch before editing: `distilly` is the target product path; `dot-skill` is maintenance of the currently published skill; another branch inherits its verified PR base. Never infer branch identity from this file alone.

## Publishing is opt-in

`distilly` is local-only. Commit freely, but **never push, open a PR, or otherwise publish it without an explicit request in the current session.** The repository is public; `dot-skill` is its default branch and carries only the published skill. Design material and unreleased product work stay on the local `distilly` branch and out of every remote ref, including PR branches, because a merged PR's objects stay retrievable after any branch rewrite.

## Feature-level local commits

Before coding, name one reviewable feature or bug-fix slice and its acceptance checks. Give that slice its own concise [Agent Note](.agents/notes/README.md); an aggregate Note may link to it but cannot own its detailed decisions. Complete and integrate the slice, collect all subagent work, run its checks, move the feature Note to `implemented` when complete, and have the coordinating/root agent create one local commit before starting another independent feature. A feature commit contains its implementation, tests, generated artifacts, current-state documentation, and dedicated Agent Note.

Do not create per-file, per-function, per-test, subagent, checkpoint, fixup, or WIP commits, and do not combine independent features in one commit. If a slice is too large for one reviewable commit, redefine its feature boundary before coding instead of mechanically splitting files afterward. Subagents only modify the shared worktree and report results; they do not commit partial work. Problems found before the next feature starts fold into the current feature commit. Local feature commits need no additional permission, but pushing, opening a PR, or otherwise publishing still requires explicit user authorization.

## Standing orders

- Before product code on `distilly`, read [docs/design/README.md](docs/design/README.md) and the chapter that owns the change. [docs/design/system-v3.md](docs/design/system-v3.md) is the in-force contract; V2 and V1 are deprecated history; [docs/architecture.md](docs/architecture.md) is the shipped-state map. Do not apply target APIs as current behavior on `dot-skill`.
- Product code is TypeScript. `tools/` and `prompts/` are frozen Python serving the published skill: defects only, no new behavior. Retirement conditions are in [design §28](docs/design/v3/28-migration-and-compatibility.md).
- The current committed TypeScript tree is the `pnpm` workspace, `@distilly/protocol`, contract-only `@distilly/adapters`, `@distilly/engine` with package-private SQLite/WAL create/ingest/pending/brief/lease/commit/review/rollback/correction authority plus the Preview-required subject/Profile/material/version/lineage/Library verified reads, the explicit `@distilly/engine/preview` and `@distilly/runtime/preview` in-process local composition, the injected-client `distilly` Facade and `@distilly/mcp` adapter, the capability-only `@distilly/bindings` package plus canonical skill/release assembly, and the injected-client `@distilly/panel` server/web leaf. Adapters defines direct/delegated seams and the separate direct-user collection boundary but has no built-in provider, MaterialParser surface or implementation, secret resolver, or collection service. Both stable runtime roots remain empty; the Preview subpaths dispatch only the real local-material methods and fail deferred MethodMap keys visibly. The stdio conformance child and Panel browser fixture still inject full test fakes, and both host entries stop at trusted capability preflight. No complete production single-writer service with cross-process attach, full SQLite method authority, full binding, production MCP/CLI/setup/Panel composition, plugin runtime, or user `~/.distilly/` installation is shipped.
- Every reviewable governed feature adds its own [Agent Note](.agents/notes/README.md) in the same feature commit, or lifecycle-renames the proposal that already belongs to that feature. Modifying an existing or aggregate Note alone does not satisfy the diff gate. Tests, translations, assets, and local-only edits are exempt unless they change a shared decision.
- Document current state in standing docs. Put rationale in Agent Notes; put procedures in [docs/cookbook/](docs/cookbook/).
- Target implementation invariant (not shipped): each `DISTILLY_ROOT` has one Engine writer; SQLite/WAL is the structured transaction authority, immutable large content lives in content-addressed blobs, and Markdown/JSON/Library/search/queue/plugin files are rebuildable projections or exports.
- Target implementation invariant (not shipped): the host LLM may vary semantically, but the engine's hashing, evidence resolution, patch application, rendering, and transaction are deterministic; unchanged material-set hash skips; correction metadata is authoritative in SQLite and correction content uses the shared immutable blob store.
- Target implementation invariant (not shipped): the default is zero extra API key and exactly five MCP tools; `ingest` → `pending(brief)` → claim-only `commit`, with no required embedding or multimodal key.
- Target implementation invariant (not shipped): the public client is `Distilly` + `Person`; seven capability groups stay internal.
- Target implementation invariant (not shipped): temporary personas enter only that sub-run via `get` / `prompt`, never global `AGENTS.md`, `CLAUDE.md`, or `agent.md`.
- Target implementation invariant (not shipped): first-version recall injects the full profile and fails visibly if it does not fit.
- Target implementation invariant (not shipped): `SourceAdapter` and `HostInjector` are separate seams; relations are an additive post-core slice; commit is not O(n²).
- Target implementation invariant (encoded in Protocol types and schemas; implementations and callers remain unshipped): every public I/O operation is async, ids are branded, the error `code` union is the wire contract, and runtime validation happens only at the boundaries listed in [design §7.6](docs/design/v3/07-protocol-types.md).
- Target implementation invariant (not shipped): one business mutation is one SQLite transaction; no product surface writes storage directly, no mutation gets its own file journal/staging/recovery protocol, and exhaustive history verification belongs to doctor/restore/import rather than every ordinary read.
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

These are the gates that exist today. The TypeScript suite currently proves the workspace, Protocol wire contract, source-adapter contracts, exact current package dependency direction, package-private SQLite create/ingest/pending/brief/lease/commit/review/rollback/correction authority and real crash behavior, Preview-required SQLite verified reads plus retained legacy regression fixtures, the explicit in-process Preview Engine/LocalRuntime over a real temporary root, injected-client Facade/MCP mappings, real stdio transport conformance over a full test fake, capability-only host preflight, canonical skill/plugin release bytes, and the injected Panel's real loopback HTTP plus Chromium behavior. The remaining SQLite methods, production cross-process runtime, full binding, CLI/setup/Panel composition, and later release tiers remain in [design §27](docs/design/v3/27-testing-and-governance.md).

Edit this file, not `CLAUDE.md` (`CLAUDE.md` is a symlink).
