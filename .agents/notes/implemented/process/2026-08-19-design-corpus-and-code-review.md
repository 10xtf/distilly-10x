# Agent Note: Design corpus in-tree and a written review contract

Status: implemented

## Problem

The first governance PR compressed the product conversation into an 80-line architecture map. An agent that only loaded standing docs could not reconstruct locked mechanisms (SDK signatures, seven host pitfalls, profile facets, landing order). Review had a Note gate and no written review contract, so a green CI could ship a design violation.

## Decision

The uncut target design lives in a `docs/design/system-v*.md` parent. [scripts/sync_design_chapters.py](../../../../scripts/sync_design_chapters.py) generates its sections into a sibling `v*/` folder for topic loading and rewrites relocated relative links; each parent is a `Corpus` entry in that script. Chapters are not hand-edited; the docs gate rejects drift. This landed with the v1.1 parent. The in-force parent is [system-v2.md](../../../../docs/design/system-v2.md); superseding a design adds the next parent and leaves the previous one deprecated in place.

`docs/` is now graded by job: `design/` (contract), `architecture.md` (live tree), `cookbook/` (steps), `process/` (review), `testing.md` (what green means).

Review splits in two: the contract in [docs/process/code-review.md](../../../../docs/process/code-review.md), the walk in [distilly-code-review](../../../skills/distilly-code-review/SKILL.md). Blockers include semantic prose review, docs matching code, design-corpus match, required evidence, and the distilly-specific list (no work/persona split, no ingest+commit merge, no global persona files, no silent trim, no O(n²) commit). Review scope stops at the checks this tree actually runs: the contract points at the command list rather than naming a gate no command produces.

## Alternatives considered

- **Keep architecture.md as the only spec** — rejected: the user required the full design, and the compressed map had already dropped the capability inventory, the value types, and the injection pitfalls.
- **Design as one file with no chapter split** — rejected: agents implementing one seam need to load that section. The parent remains canonical.
- **A maximal review checklist covering every gate we might ever want** — rejected: demanding evidence that no command in this tree can produce trains reviewers to skip the checklist entirely.
- **Put review rules only in the skill** — rejected: an agent that skips the skill must still see the contract.

## Consequences

- Product sessions start at `docs/design/README.md`, not at architecture.md.
- Changing a locked item without a new note is a review blocker.
- PR review has a named walk. Format-green is not a design review.
- Target contracts and shipped state use separate labels and owners; design text cannot be cited as proof that code exists.

## Verification

- `python3 scripts/sync_design_chapters.py --check`
- `python3 -B scripts/verify_docs.py`
- Semantic review of [docs/process/code-review.md](../../../../docs/process/code-review.md) against the root standing orders
