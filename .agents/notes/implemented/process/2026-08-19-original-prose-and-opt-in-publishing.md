# Agent Note: Design prose states our own conclusions, and publishing is opt-in

Status: implemented

## Problem

Two properties of this repository constrain how design material may be written and where it may live.

It is public, and the published skill sits on the default branch, so anything that reaches a branch here is readable by anyone who clones it. A design document is therefore a product surface, not a private working note.

And branch history is not a retraction mechanism. Once a pull request targets a branch, its head and merge objects stay retrievable under `refs/pull/<n>/*` however the branches later move, so a rewrite cannot pull material back. Any control that depends on "we can rewrite it later" does not exist.

Without written rules for both, design prose drifts toward recording where a mechanism sits in the landscape instead of why it is correct here, and drafts reach a public branch before anyone decided they should.

## Decision

**Design prose states the conclusion, the mechanism, and the failure it prevents, in our own terms.** A row that cannot state its own reason is incomplete. Where a comparison is load-bearing it names a category — "a memory service that carries its own model credentials" — never a product. Integration targets and dependencies are still named, because an adapter cannot be implemented against an anonymous host.

The test is whether an implementer can act on the row alone. "This mechanism is standard practice" fails it; "one row per subject, so a worker that falls behind upserts to the latest state and dedupes for free" passes, because the reason names the failure it avoids. All design parents follow this rule: in-force [system-v3.md](../../../../docs/design/system-v3.md) and deprecated [system-v2.md](../../../../docs/design/system-v2.md) / [system-v1.md](../../../../docs/design/system-v1.md) are equally public even though only V3 is authoritative.

**Publishing is opt-in**, stated at the top of the root [AGENTS.md](../../../../AGENTS.md). The `distilly` branch is local, and pushing it requires an explicit request. `dot-skill` holds only the published skill. Review happens on the local branch and in the working tree; a pull request is the last step, not the medium.

## Alternatives considered

- **Let each chapter choose its own citation style** — rejected: the rule has to be uniform to be checkable, and the mixed result reads as an inventory rather than a specification.
- **Hold the deprecated parent to a weaker standard** — rejected: the archive rule protects decision history from silent revision, not public prose from a correction the whole tree needs. A reader cannot tell which parent is authoritative from the prose style.
- **Delete the deprecated parent instead of holding it to the standard** — rejected: the alternatives it records still explain why several current conclusions hold, and the in-force design cites it as its predecessor.
- **Apply the rule to design documents only, not to Agent Notes** — rejected: notes are published too, and a rejection reason phrased as an attribution is weaker than the requirement it actually encodes.
- **Push freely and rely on a later history rewrite** — rejected: a rewrite cannot reach a merged pull request's objects, so not publishing is the only control that holds.
- **Keep a private mirror for drafts** — rejected: two remotes for one branch guarantees they diverge, and the local branch already serves the purpose.

## Consequences

- A design row that cannot state its own reason is incomplete; naming a source does not repair it.
- Pushing `distilly` requires an explicit request. An agent that opens a pull request against `dot-skill` publishes permanently.
- Category comparisons stay legal, so a chapter can still explain why a whole class of approach was excluded.

## Verification

- Each adopt/exclude row in the storage chapter states a reason an implementer can act on without further lookup.
- `python3 -B scripts/sync_design_chapters.py --check`
- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
- `python3 -B scripts/run_tests.py`
- `git ls-remote origin` shows no `distilly` ref
