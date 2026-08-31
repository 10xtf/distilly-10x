# Agent Note: SQLite brief and lease authority

Status: implemented

## Problem

SQLite already owns subject generations and pending jobs, but `distill.pending`, `distill.brief`, `distill.renew`, and `distill.release` still run through a sibling queue database, file state, request and subject locks, a lease journal, and mutation-specific recovery. That leaves one logical job split across two authorities and makes a crash require application-level reconciliation even though SQLite/WAL can commit the whole lease mutation atomically.

The first SQLite schema was committed only as unreleased local product work. Treating that private schema as published would create a compatibility promise before any runtime can have installed it. A complete briefing can also be several megabytes, so storing its idempotent operation result inline would duplicate private material text in the structured database instead of using the shared immutable blob store.

## Decision

Keep one canonical private schema v1 and fold the lease tables into that exact shape before any product runtime or installer exists. The schema version is a compatibility boundary, not a local implementation-step counter: new roots create the twelve-table v1 directly, a malformed or earlier local v1 shape fails exact verification without mutation, and a future `user_version` remains `schema_unsupported`. Canonical v1 adds one optional lease row per authoritative pending job and an operation-result blob reference table. Renew and release keep their small stable results inline. Brief stores a complete canonical template in the blob store and a small operation envelope that binds its RequestId, input checksum, subject, template pointer, and exact final lease.

Replace the live lease service with a SQLite implementation. Pending reads derive `pending` or `leased` from the optional lease and the caller's clock without expiry writes. Briefing loads and verifies the complete first-version material set under one shared blob-access lease, pins the prompt contract, builds a complete template with fixed-width placeholder lease fields, and passes fixed-point capacity checks before its write transaction. The transaction replays or conflicts on RequestId, rechecks the exact job generation and material-set snapshot, takes a fresh `acquiredAt`, grants the full 30-minute lease, overlays only fixed-width lease fields, atomically replaces only an absent or expired lease, and writes the operation and one `job.changed` event. The template and final result have the same canonical byte length, so the pre-transaction capacity result remains exact. Renew and release perform the equivalent active-owner compare-and-set in one transaction.

Include trusted actor, lease owner, and, for brief, the exact trusted capacity in the idempotency preimage. Exact replay short-circuits current job, expiry, prompt, and capacity state. Duplicate ingest must preserve an active lease when the material generation is unchanged; a new generation replaces the pending job and cascades the old lease.

Keep any still-needed file-backed lease implementation only as an explicit test fixture for the not-yet-migrated commit and review slices. The SQLite composition must have no transitive dependency on the sibling queue, lease transaction journal, file locks, or recovery service.

## Alternatives considered

- Keep the sibling queue as a projection and dual-write its lease marker. Rejected because pending job and lease would still have two writable authorities and two crash protocols.
- Bump the still-private schema from v1 to v2 or migrate the earlier local v1 shape. Rejected because no runtime or installer has shipped either shape; treating internal commit history as a disk-compatibility boundary would create migration obligations without an installed population.
- Store `HostDistillBriefing` inline in `operations.result_json`. Rejected because the result contains complete private material text and can approach the 4 MiB briefing ceiling; the blob store is the designated authority for large immutable result payloads.
- Fix `acquiredAt` before publishing the complete result blob. Rejected because prompt, serialization, Blob I/O, or scheduler delay would consume the caller's lease before SQLite had claimed the job. The fixed-width template plus transaction-owned lease envelope preserves both pre-transaction Blob I/O and a full post-acquisition lifetime.
- Reattach the legacy version store so incremental briefings work in this slice. Rejected because SQLite has no version authority yet and a dual read would make a briefing span incompatible storage systems. The reachable schema-v1 path remains first-version, no-baseline briefing until the commit/version slice lands.
- Delete expired lease rows during reads or on a timer. Rejected because expiry is a clock-derived view; a read must not become an unjournaled mutation or emit a synthetic expiry event.

## Consequences

SQLite is now authoritative for package-private create, ingest, pending, brief, renew, and release. New roots use the exact twelve-table canonical schema v1; malformed local v1 shapes and future versions fail without permission, journal-mode, or schema mutation. The schema still has no version, claim, or baseline membership authority, so the live briefing path is deliberately first-version only and rejects unexpected current, suspended, or base-version state.

Pending reads filter before limit, order by `queuedAt` and binary `JobId`, and derive lease expiry without writes. Schema v1 has no failed-job authority, so `state="failed"` returns an empty page instead of widening to all jobs. Duplicate ingest preserves the same-generation lease, while a new generation replaces the pending row and cascades its old lease.

Brief, renew, and release each own one SQLite transaction for lease, operation, and event state. Brief acquisition time is read inside that transaction and expiry is exactly 30 minutes later even when material preparation or template publication is delayed. Exact brief replay verifies the template and envelope without consulting the current pending row, prompt, expiry, or capacity. Renew preserves lease identity, owner, acquisition time, generation, and contract; release deletes only the active owned lease.

A losing brief race or pre-COMMIT crash can leave an unreferenced immutable template file. It is invisible because no SQLite authority references it, and the future generic GC owns cleanup rather than a brief-specific journal. The remaining file-backed commit, read, and review pipeline is reachable only through explicitly named test fixtures. Protocol journal/recovery types remain until their owning migrations complete, as required by design step 10; they do not restore a production legacy path.

## Verification

- Node 22.23.1: `pnpm exec vitest run packages/engine/src/distill/lease-service.sqlite.test.ts packages/engine/src/distill/lease-service.sqlite.crash.test.ts packages/engine/src/storage/mutation-ledger.test.ts` passes 3 files and 31 tests.
- Node 22.23.1: `pnpm exec vitest run packages/engine/src` passes 45 files and 501 tests, including the relocated legacy fixtures and real brief `SIGKILL` cases.
- `pnpm run build`, `pnpm run typecheck`, and `pnpm run gates:fast` pass after a clean build.
- Package-boundary tests pass 36 cases; build-artifact tests pass 19 cases; `pnpm run hygiene` passes built smokes, Knip, plugin assembly, the 282-file Engine dry-run pack check, publint, and `attw`.
- `python3 -B scripts/verify_docs.py`, `python3 -B scripts/verify_agent_notes.py`, and `git diff --check` pass.

Node 24 is not installed in this local environment; the existing Node 22/24 CI matrix owns that second runtime lane. Commit/version authority, correction, production verified reads and projections, doctor/GC/backup, runtime, host composition, CLI, Panel composition, migration, and installable Plugin acceptance remain unverified by this feature and belong to later slices.
