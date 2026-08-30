# Agent Note: SQLite create and ingest landing reconciliation

Status: proposed

## Problem

The storage landing order contradicted itself. Subject identity said standalone `subjects.create` must wait for a later feature while the SQLite foundation required it beside `materials.ingest`; the same foundation also promised to delete queue dirty state even though the following feature still owned migration of pending reads and leases. Shared file stores and locks remain dependencies of unreplaced package-internal tests, so treating their temporary presence as a live compatibility path would either force unrelated migrations into one commit or create dual authority.

The ingest contract also said `title` and `capturedAt` do not participate in MaterialId while describing every source-field difference under an existing MaterialId as corruption. A normal later retrieval can change those display-only values without changing the frozen material identity.

## Proposal

The first SQLite implementation feature will deliver both standalone `subjects.create` and `materials.ingest(existing|create)`. They will share one package-private, transaction-local space and identity creation primitive. Ingest create will call that primitive inside its own transaction and will never chain through the public create method.

That feature will own the minimal structured authority needed by those methods: subject identity, material metadata and blob references, current material membership, pending jobs created by ingest, globally keyed stable operation results, and audit events. Blob puts will remain leased until the referencing SQLite transaction commits or rolls back. It will remove the live ingest journal, staging, recovery, space locks, and old composition. Shared file mechanisms needed only to keep unmigrated feature tests executable may remain behind an explicit test-only legacy fixture, with zero imports or writes from the SQLite composition. The brief and lease feature will then consume the already-authoritative pending rows and delete the disposable queue database, dirty marker, and lease recovery.

For an existing MaterialId, identity-bearing content, provenance, source identity, and source semantics must still match. First-seen `title` and `capturedAt` remain immutable display metadata: a later request that differs only in those fields is a duplicate and does not rewrite the stored row.

This proposal extends the implemented [single-writer SQLite authority decision](../../implemented/simplification/2026-08-21-single-writer-sqlite-storage-authority.md); it does not claim any SQLite business method is shipped.

## Alternatives considered

- Deferring standalone create was rejected because it conflicts with the approved implementation slice and leaves one declared EngineMethodMap mutation knowingly unimplemented after its shared identity transaction already exists.
- Making ingest call public create first was rejected because two mutations can expose an empty subject and cannot atomically store the first materials, generation, operation, and events.
- Deleting the legacy queue in the create/ingest feature was rejected because pending reads and lease mutations would then require their own migration in the wrong feature; retaining it as a live adapter or dual-write target was also rejected.
- Treating changed display-only metadata as corruption was rejected because those fields intentionally do not participate in MaterialId. Updating the old row was rejected because immutable first-seen provenance must not drift.
- Adding outbox, projection, doctor, backup, or GC service abstractions was rejected because none has a consumer in this vertical slice.

## Acceptance criteria

- The parent design and generated chapters agree that standalone create and create-ingest share a transaction-local primitive without public method chaining.
- The SQLite foundation owns authoritative pending rows produced by ingest; the next feature owns pending reads, leases, and deletion of the legacy queue/dirty path.
- The new SQLite composition has static zero references to file stores, business file locks, mutation journals, recovery, staging, and the disposable queue.
- Any surviving old mechanism is reachable only from an explicitly named test-only legacy fixture, performs no SQLite mirroring, and is deleted by its owning migration; the final authority step only verifies that none remain.
- Exact RequestId replay remains stable; same MaterialId with only first-seen display metadata differences is duplicate, while any identity-bearing mismatch fails closed.
- The feature adds no public SQL/storage type and no premature outbox, projection, doctor, backup, or GC task abstraction.

## Risks

The temporary legacy fixture can be mistaken for a compatibility implementation unless package boundaries and current-state documentation name it as tests only. Later migrations may accidentally postpone deletion of shared locks or the queue; each owning feature therefore needs an explicit removal assertion. First-seen display metadata preserves stable identity but can be stale, so future editable annotations must be a separate user action rather than mutation of the material fact.
