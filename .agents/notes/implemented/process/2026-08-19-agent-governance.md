# Agent Note: Agent standing orders and repository governance

Status: implemented

## Problem

This repository is about to be developed as a product (distilly) primarily by coding agents. Prose conventions in CONTRIBUTING.md did not load into every session, did not record rejected alternatives, and CI watched `main` while the default branch was `dot-skill`, so the published tree had no running gate. Without a small, mechanical governance layer, agents will re-litigate design, grow standing docs without a home, and treat the skill directory as the product root.

## Decision

The `distilly` branch carries a governance layer sized to what this repo can enforce today: standing orders that load into every session, decisions recorded with what they defeated, and gates that only check what a machine can settle.

- Root [AGENTS.md](../../../../AGENTS.md) holds standing product and process orders. `CLAUDE.md` is a symlink to that file.
- [docs/AGENTS.md](../../../../docs/AGENTS.md) defines documentation tiers and one-home-per-fact placement.
- [docs/architecture.md](../../../../docs/architecture.md) is the live-tree map. The product contract is the in-force design parent, now [docs/design/system-v2.md](../../../../docs/design/system-v2.md). Cookbooks hold steps. Agent Notes hold rationale.
- Agent Notes live under `.agents/notes/{lifecycle}/{class}/` with real dates, unique status and section structure, non-empty required sections, and cross-lifecycle ownership checked by [scripts/verify_agent_notes.py](../../../../scripts/verify_agent_notes.py). A verified-base diff also requires a changed Note for governed paths.
- Skills under `.agents/skills/` describe workflows (doc placement, pre-push evidence, PR review). Contracts stay in docs so an agent that skips a skill still sees the rule.
- [scripts/verify_docs.py](../../../../scripts/verify_docs.py) owns portable Markdown links and endings. [scripts/sync_design_chapters.py](../../../../scripts/sync_design_chapters.py) generates the topic chapters from each canonical design parent, one chapter per numbered section.
- `tools/`, `scripts/`, `prompts/`, and `tests/` carry local Agent instructions. Every local `AGENTS.md` has a sibling `CLAUDE.md` symlink, and the docs gate enforces that both host names expose the same rules.
- Root instructions are branch-neutral and route by the checked-out branch. Shared discovery files and the PR template must also land on GitHub's default branch; a product-branch-only copy is not visible to every clone or new-PR form.
- CI on `dot-skill`, `distilly`, and `main` runs governance once, compile and fail-closed unittest discovery on Python 3.9/3.11, and blocking Ruff. PR checks use the exact metadata base/head range; push checks use the event before/head range. Local contributors run the narrowest matching commands; they do not owe a full-matrix rehearsal.
- [docs/development.md](../../../../docs/development.md) owns the task handoff contract. Handoffs carry transient progress and evidence in the task or PR; Agent Notes remain durable decisions.
- `.githooks/pre-push` provides cheap local governance, lint, and whitespace feedback when a clone enables the tracked hooks. It requires a clean checked-out head so tree gates inspect the committed tree, compares it with the explicitly configured feature-branch base or existing persistent-branch tip, and rejects persistent deletion/non-fast-forward updates. CI is a detection backstop; the [branch-protection procedure](../../../../docs/cookbook/protecting-governed-branches.md) owns remote enforcement.

This is docs-first in the narrow sense: a governed change has a note in the same PR; a semantic reviewer can require one for an otherwise exempt path; unbuilt work may land as `proposed/` before code; implemented notes stay present-tense with the code.

## Alternatives considered

- **Keep CONTRIBUTING.md as the only process doc** — rejected: agents do not reliably load it, and it cannot record alternatives or fail CI.
- **Open with a maximal gate set** — rejected: this tree is still a Python skill plus scripts, so a gate suite sized for a finished product would fail on content we do not own yet and would train `--no-verify`.
- **Put the standard only in SKILL.md** — rejected: an agent editing docs without invoking the skill would miss the contract. The contract lives in docs, the workflow in skills.
- **Leave CI on `main` only** — rejected: the default branch is `dot-skill`. A gate that never runs is not a gate.
- **Keep hand-copying design chapters** — rejected: correct prose with a broken relocated link already escaped review. Generated projections make the parent the only writable source.
- **Store every task handoff as a committed Markdown file** — rejected: transient progress goes stale and becomes a second current-state source. The task or PR carries the handoff; durable decisions and behavior retain their existing homes.

## Consequences

- Agents opening this branch get standing orders without a human pasting a checklist.
- Product decisions that are not yet code live in `proposed/` and can be reviewed before implementation.
- Note tree, governed-diff ownership, document portability, generated chapter drift, Ruff errors, compile failures, and tests produce a failing CI result. Branch protection must require that result before it becomes a merge/push block.
- Contributors still use unittest and compileall for tool behavior; governance does not replace those tests.
- A fresh agent can recover authority, actual evidence, remaining work, and workspace ownership without the previous chat.

## Verification

- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
- `python3 -B scripts/verify_agent_notes.py --base origin/distilly --head HEAD --range-mode merge-base`
- `ruff check tools scripts tests`
- `python3 -B scripts/run_tests.py`
