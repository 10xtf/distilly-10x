# AGENTS.md

Route work by the checked-out branch before editing: `distilly` is the target product path; `dot-skill` is maintenance of the currently published skill; another branch inherits its verified PR base. Never infer branch identity from this file alone.

## Publishing is opt-in

`distilly` is local-only. Commit freely, but **never push, open a PR, or otherwise publish it without an explicit request in the current session.** The repository is public; `dot-skill` is its default branch and carries only the published skill. Design material and unreleased product work stay on the local `distilly` branch and out of every remote ref, including PR branches, because a merged PR's objects stay retrievable after any branch rewrite.

## Feature-level local commits

Before coding, name one reviewable feature or bug-fix slice and its acceptance checks. Complete and integrate that slice, collect all subagent work, run its checks, and have the coordinating/root agent create one local commit before starting another independent feature. A feature commit contains its implementation, tests, generated artifacts, current-state documentation, and required Agent Note updates.

Do not create per-file, per-function, per-test, subagent, checkpoint, fixup, or WIP commits, and do not combine independent features in one commit. If a slice is too large for one reviewable commit, redefine its feature boundary before coding instead of mechanically splitting files afterward. Subagents only modify the shared worktree and report results; they do not commit partial work. Problems found before the next feature starts fold into the current feature commit. Local feature commits need no additional permission, but pushing, opening a PR, or otherwise publishing still requires explicit user authorization.

## Standing orders

- Before product code on `distilly`, read [docs/design/README.md](docs/design/README.md) and the chapter that owns the change. [docs/design/system-v2.md](docs/design/system-v2.md) is the in-force contract; [docs/design/system-v1.md](docs/design/system-v1.md) is deprecated history; [docs/architecture.md](docs/architecture.md) is the shipped-state map. Do not apply target APIs as current behavior on `dot-skill`.
- Product code is TypeScript. `tools/` and `prompts/` are frozen Python serving the published skill: defects only, no new behavior. Retirement conditions are in [design §25](docs/design/v2/25-python-migration.md).
- Every governed change adds or updates an [Agent Note](.agents/notes/README.md) in the same PR. The diff gate defines governed paths; tests, translations, assets, and local-only edits are exempt unless they change a shared decision.
- Document current state in standing docs. Put rationale in Agent Notes; put procedures in [docs/cookbook/](docs/cookbook/).
- Target implementation invariant (not shipped): Markdown and jsonl under `~/.distilly/` are the fact layer; indexes are disposable.
- Target implementation invariant (not shipped): distillation is objective; unchanged material-set hash skips; drift is a defect; corrections land in `corrections/`.
- Target implementation invariant (not shipped): the default is zero API key, `pending` then `commit`, with no required embedding or multimodal key.
- Target implementation invariant (not shipped): the public client is `Distilly` + `Person`; seven capability groups stay internal.
- Target implementation invariant (not shipped): temporary personas enter only that sub-run via `get` / `prompt`, never global `AGENTS.md`, `CLAUDE.md`, or `agent.md`.
- Target implementation invariant (not shipped): first-version recall injects the full profile and fails visibly if it does not fit.
- Target implementation invariant (not shipped): `SourceAdapter` and `HostInjector` are separate seams; graph v1 is relations only; commit is not O(n²).
- Target implementation invariant (not shipped): every public method is async, ids are branded, the error `code` union is the wire contract, and runtime validation happens only at the boundaries listed in [design §11.5](docs/design/v2/11-public-api.md).
- Target implementation invariant (not shipped): the `~/.distilly/` format is language-neutral and unchanged from v1; `node:sqlite` backs only the disposable queue and graph projection, never retrieval.
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
python3 -B scripts/verify_docs.py
python3 -B scripts/verify_agent_notes.py
python3 -m compileall -q tools scripts tests
ruff check tools scripts tests
python3 -B scripts/run_tests.py
```

Run the narrowest set that can fail for the change. CI runs on `dot-skill`, `distilly`, and `main`; branch protection determines whether a red result merely detects or actually blocks the change.

These are the gates that exist today. The TypeScript suite lands with the first packages; its stages, commands, and the machine/semantic split are in [design §24](docs/design/v2/24-governance-toolchain.md).

Edit this file, not `CLAUDE.md` (`CLAUDE.md` is a symlink).
