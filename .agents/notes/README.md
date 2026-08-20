# Agent Notes

An Agent Note records a decision that code and standing docs cannot carry: the why, what we gave up, and how to verify it.

## Path

`{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`

Lifecycle:

- `proposed/` — not built, or only partly built. Future tense is allowed.
- `implemented/` — shipped. Present tense. Keep paths and names current in the same change that moves them.
- `rejected/` — declined. Keep only while the reason still prevents a real mistake.

Class (closed set): `feature`, `bug-fix`, `simplification`, `architecture`, `process`, `testing`.

Architecture is about product and source structure; its lifecycle says whether that structure is proposed or shipped. Process is tooling and workflow around the source.

There is no `INDEX.md`. Browse the folders.

## When to write one

Every governed change adds or updates at least one note in the same PR. The diff gate deliberately uses paths instead of guessing prose semantics. Governed paths are `packages/`, `src/`, `tools/`, `scripts/`, `prompts/`, `.githooks/`, `.agents/skills/`, `.github/`, `docs/cookbook/`, `docs/design/`, `docs/process/`, the live architecture/development/testing docs, every local `AGENTS.md`/`CLAUDE.md`, and root instruction, skill, dependency, package-manager, TypeScript, ESLint, Vitest, Knip, and Prettier configuration files.

Tests-only changes — including co-located `*.test.ts` / `*.spec.ts` files and their `__snapshots__/` output — translations, assets, and local-only work do not trigger the diff gate. A semantic reviewer still requires a Note if an exempt path changes behavior, architecture, a shared contract, process, testing strategy, or an on-disk / wire / config format.

Update the note that already owns the decision. A new decision gets a new note and a cross-link. Do not rewrite an implemented note into the opposite conclusion.

Search the tree for supersession before adding a note.

## File format

Lines 1–4:

```markdown
# Agent Note: <title>

Status: proposed
```

`Status:` must match the folder: `proposed`, `implemented`, or `rejected — <one-line reason>`.

Then `## Problem` first.

### proposed/

`## Problem` `## Proposal` `## Alternatives considered` `## Acceptance criteria` `## Risks`

### implemented/

`## Problem` `## Decision` `## Alternatives considered` `## Consequences` `## Verification`

Banned headings: `## Proposal`, `## Plan`, `## Migration plan`, `## Acceptance criteria`.

### rejected/

Keeps proposal-era sections. The verdict is the `Status:` line.

`## Alternatives considered` is required. Each real alternative and why it lost.

`python3 -B scripts/verify_agent_notes.py` enforces the tree and format. Before a feature push or PR, `python3 -B scripts/verify_agent_notes.py --base <resolved-base-sha> --head <exact-head-sha> --range-mode merge-base` also enforces governed-diff ownership. Direct persistent-branch push events use `--range-mode direct` so a rewind cannot disappear behind a merge-base diff. English-only notes are enough on this branch; a later pairing gate may require `.zh.md`.
