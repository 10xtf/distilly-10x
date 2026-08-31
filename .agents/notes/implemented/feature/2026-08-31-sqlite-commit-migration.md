# Agent Note: SQLite commit migration

Status: implemented

## Problem

The live SQLite path can create subjects, ingest material, and issue briefing leases, but `distill.commit` still exists only as a test-only file-authority fixture. A successful host patch therefore cannot atomically become immutable claim/version authority, and the SQLite briefing path cannot yet produce an incremental baseline after a first commit.

## Decision

The private schema-v1 authority includes immutable versions, canonical material membership, version-scoped claims and evidence, independent version status, same-subject lineage constraints, and unique current/suspended status. `distill.commit` uses one SQLite transaction that rechecks the active job, lease owner, generation, current/suspended pointers, material membership, and pinned contract before inserting all version facts, updating exactly one current or suspended pointer, deleting pending work, recording the stable operation result, and appending fixed events.

The existing deterministic evidence, claim, quality, review-gate, version-id, and renderer functions remain pure preparation logic. A targeted verified version reader checks the directly returned authority rows, canonical memberships, deterministic identities, renderer/source-grouping dispatch, status, lineage subjects, and a sealed envelope that binds the accepted-patch digest. Ingest and briefing use that reader for the current baseline. Projections, review actions, correction, and a runtime remain outside this feature.

## Alternatives considered

- Keep the file commit service beside SQLite and copy its result into the database. This loses the one-authority and one-transaction guarantees and would preserve the recovery protocol this feature exists to retire.
- Store only a rendered profile or one opaque version JSON document. This prevents relational evidence membership checks and makes later review, doctor, and verified reads depend on an untyped duplicate authority.
- Migrate commit, promote/reject, rollback, and correction together. Those mutations share concepts but have different state transitions; combining them would make the critical storage boundary too large to review and would violate the required serial landing order.

## Consequences

SQLite is now the sole live commit authority and can feed later incremental briefing without a file-version fallback. The partial unique status indexes require an incremental current commit to retire the previous current inside the same transaction before inserting the new current status; rollback restores both if any later write fails. The former file commit, staging paths, state swap, and semantic recovery survive only as explicitly named test fixtures for the still-unmigrated read/review tests.

## Risks

The private schema is still unreleased, so changing schema v1 is intentional, but every exact-schema test and build-pack guard must move in the same feature. Ordinary reads must validate the rows and blobs they directly use without turning this slice into the later full-history doctor or projection feature.

## Verification

- Exact retry replays the stored `CommitResult`; reuse of the RequestId with different params, actor, or lease owner fails with `idempotency_conflict`.
- Invalid or stale evidence, base, generation, contract, lease, or active suspended state performs zero business writes and preserves pending work.
- A valid patch writes immutable version metadata, canonical material/claim/evidence membership, one independent status, the current or suspended pointer, operation result, and two events in one SQLite transaction, then removes the pending job and lease.
- Process termination before SQLite commit exposes only the previous state; termination after commit exposes the complete target without mutation-specific recovery.
- A committed current version is a verified baseline for later ingest and briefing, including canonical incremental refs and stable brief replay.
- Legacy staging/recovery regressions remain green from their test-only locations. The built Engine smoke executes ingest → brief → commit, closes, reopens, and replays from packaged output; build-pack tests accept the new production commit module and reject the retired staging module and all fixtures.
