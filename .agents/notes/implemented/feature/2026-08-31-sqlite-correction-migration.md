# Agent Note: SQLite correction migration

Status: implemented

## Problem

SQLite owned the live subject, material, pending, version, review, operation, and event authority, but `profiles.correct` had no package-internal service over that authority. A correction therefore could not preserve its private text as evidence, replace claims deterministically, or produce a reviewable immutable version without inventing a second ingest/commit sequence or reviving the paused file-journal implementation.

## Decision

The package-internal composition owns one SQLite-backed `CorrectionService`. Its boundary normalizes a `CorrectionDraft`, binds direct-user or relayed provenance to the trusted actor, and stores the canonical correction body through the shared content-addressed blob store. The current version or explicitly targeted active candidate supplies the content baseline, while the transaction-time current remains the quality baseline. One full-body replacement claim is always `user_asserted`; explicit targets become superseded by that same claim.

One SQLite transaction rechecks RequestId replay, subject generation, current/candidate pointers, material membership, and claim targets before writing the correction material reference, generation-plus-one membership, immutable current or suspended version, optional candidate replacement lineage, pointers/statuses, a fresh unleased pending job, stable result, and fixed events. A successful current correction intentionally permits `addedMaterialCount = 0`, while ordinary duplicate ingest still does not create a meaningless zero-delta job. Correction uses no journal, staging directory, recovery protocol, or dual write.

## Alternatives considered

- Implementing correction as `materials.ingest` followed by `distill.commit` was rejected because it exposes an intermediate pending state, requires a model patch for a direct assertion, and loses one-transaction idempotency.
- Reusing the paused file-journal correction work was rejected because it would reintroduce a second authority, target-first recovery, and correction-specific cleanup.
- Treating correction text as metadata was rejected because the replacement evidence could not then verify, retain, or later purge its actual private body.
- Migrating general verified reads and projections in the same feature was rejected because they are consumers of correction authority, not part of its critical mutation.

## Consequences

Direct user correction can become current when no mechanical review reason exists; every non-user correction records matching relayed provenance and suspends with `relayed_correction`. An explicitly targeted active candidate can be replaced atomically while preserving its rejected lineage. The shared pending schema now accepts zero added materials, and its verified readers support the resulting empty incremental briefing without changing ordinary ingest enqueue behavior.

The private unreleased schema-v1 contract and Protocol correction byte limit move together: correction text is capped at the claim-text limit of 16 KiB. The Engine package remains package-internal; this feature does not create a runtime, CLI, binding, Panel composition, or installable Plugin.

## Verification

- Focused correction tests cover normalization, direct and relayed outcomes, candidate replacement, exact RequestId replay/conflict, concurrent serialization, atomic rollback, zero-delta pending/brief behavior, and ordinary duplicate-ingest regression.
- Real child processes receive `SIGKILL` immediately before and after correction COMMIT. Reopen sees only the previous world or the complete target; post-COMMIT retry replays without allocating ids or adding rows/events.
- The built Engine smoke executes direct and relayed correction, closes, reopens, and replays both from packaged output.
- Production composition and package gates reject legacy authority plus correction journal, transaction, staging, and recovery artifacts; the dry-run Engine package requires the real correction service.
- Node 22 typecheck, build, focused boundary tests, build-artifact tests, Engine smoke, and the 314-file Engine pack check pass.
