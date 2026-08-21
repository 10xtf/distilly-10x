# Agent Note: Single-writer SQLite storage authority

Status: implemented

## Problem

The unreleased Engine treated many files as independently authoritative while several product processes could write them. Preserving one mutation across those files required mutation-specific journals, staging, recovery branches, layered locks, projection markers, and full-history validation on ordinary reads. That machinery grew faster than the distillation product.

## Decision

Each `DISTILLY_ROOT` has one local Engine writer. SQLite/WAL is the sole structured transaction authority; normalized material, raw, and other large immutable bodies use a content-addressed blob store; Markdown, prompt, Library, queue/search views, plugin files, and human-readable JSON are rebuildable projections or exports. Each business mutation has one SQLite transaction.

One Engine-private in-memory blob access gate protects both pre-reference puts and active blob reads; GC runs only with its exclusive maintenance lease and after rechecking database references and pins. Complete backup/restore uses a separate, narrow Engine administration contract and CLI path because switching an entire authority is not a subject business mutation.

The contract changes in this feature do not claim the package-internal file implementation has migrated. Later vertical feature commits replace one live method path at a time and remove its corresponding old mechanism in the same commit.

## Alternatives considered

- Continuing file authority was rejected because each mutation added another journal, recovery validator, staging protocol, and crash matrix without product capability.
- Keeping several direct writers over SQLite was rejected because it preserves cross-process coordination and adds another medium to reconcile.
- Putting large/raw bodies in SQLite was rejected because immutable content-addressed files are simpler to deduplicate and stream; SQLite owns their references and visibility.
- A generic storage provider was rejected because the product needs one reliable local implementation, not speculative backends.
- Migrating the unreleased V3 file layout was rejected because no public runtime or user V3 store exists; only the published legacy skill remains a real import source.

## Consequences

The target deletes direct storage writers, per-mutation TransactionRecords and recovery/staging protocols, business file-lock hierarchies, Library intent/dirty reservation, queue transaction simulation, full-history hot reads, and public persistence schemas. Claim/evidence, incremental distillation, deterministic ids/rendering, immutable versions, review/correction/rollback, provenance, RequestId replay, privacy, exports, backup/restore, and complete audit remain product requirements.

No surface may import storage or write the root. Projections expose source generation/LSN and fail stale; doctor, restore, and bundle import retain exhaustive audit. The current paused Step 11a journal/staging/recovery work is not part of the target and remains uncommitted pending its later correction vertical slice.

## Verification

- `python3 -B scripts/sync_design_chapters.py`
- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
- `python3 -B -m unittest tests.test_sync_design_chapters tests.test_verify_docs tests.test_verify_agent_notes`
- `ruff check scripts/sync_design_chapters.py tests/test_sync_design_chapters.py`
- `git diff --check`
- Independent `distilly-code-review` rounds found no P0; every reported P1 was corrected before the feature commit.
