# Agent Note: SQLite create and ingest landing reconciliation

Status: implemented

## Problem

The storage landing order contradicted itself. Subject identity deferred standalone `subjects.create` while the first SQLite foundation required it beside `materials.ingest`; deleting the old queue in the same slice would also have pulled pending reads and leases into the wrong feature. Shared file stores and locks still support unreplaced package-internal tests, but treating them as a live compatibility path would create dual authority.

The ingest contract also excluded `title` and `capturedAt` from MaterialId while describing every source-field difference under an existing MaterialId as corruption. A later retrieval can legitimately change those display-only values without changing the frozen material identity.

## Decision

The first SQLite business-method slice implements standalone `subjects.create` and `materials.ingest(existing|create)` over one root-scoped `node:sqlite` WAL store. Both paths share a package-private transaction-local identity primitive; create-ingest never calls the standalone public-style service and atomically commits the subject, first material membership, pending marker, stable operation result, and events.

Normalized material bodies are published to the immutable SHA-256 blob store before the short SQL transaction. One mutation-scoped shared access lease covers the complete reference snapshot, every blob access, and the SQL commit or rollback; it is released before post-commit observers. This prevents a queued maintenance writer from splitting a multi-blob mutation. The snapshot distinguishes an existing blob authority row from dependent material references: a dependent without its authority parent fails closed. A digest with an existing authority row is verified read-only and fails closed if its physical blob is missing or inconsistent; commit also refuses to recreate a referenced parent that disappeared after the snapshot. Only a digest with neither authority nor dependent reference may use no-replace CAS. A failed mutation may leave an unreferenced immutable blob for the later generic GC, but it leaves no visible subject, material reference, pending row, operation, or event.

The SQLite composition has no transitive file-store, business-lock, journal, recovery, staging, queue, or projection dependency. The live ingest transaction record, staging tree, ingest recovery branch, and space catalog/identity locks are removed. Shared file mechanisms needed by unmigrated brief/commit/review tests are reachable only through `legacy-file-engine.test.fixture.ts`; they neither mirror nor adapt the SQLite path.

Material rows retain first-seen `title`, `capturedAt`, and engine `storedAt`. Later-only differences in those fields classify as a duplicate without rewriting the row. Content, provenance, source identity, and all other identity-bearing semantics must remain exact, and stored material facts are checksum-verified before use.

Storage preflight uses one read-only SQLite snapshot so `user_version` and `sqlite_schema` cannot straddle another process's initialization commit. The bounded, connection-local busy timeout applies before that snapshot; persistent permission, WAL, foreign-key, and synchronous configuration still waits until schema trust is established. Existing schema v1 is verified against the exact Distilly shape before permissions or journal mode are changed; unversioned unknown data and future versions are likewise rejected without mutation. Schema v1 has no versions authority, so both version pointers are constrained to NULL and verified reads reject bypassed dangling values.

Exact locators are checked globally before resolving the requested space; locators that independently identify different healthy subjects produce a stable `ambiguous_subject`, while multiple owners or a missing locator parent remain storage corruption. Same-label aliases inspect only their owning space before a complete subject read: a missing subject or space parent fails closed, a healthy different-space owner is outside the targeted read, and only same-space owners participate in conflict resolution. A missing built-in or explicitly requested space is not recreated or reported absent when existing subjects still reference it. Each event is transactionally bound to the same RequestId operation and must match its canonical actor and subject scope.

The root build removes only each direct TypeScript-reference package's real `lib/` directory before a forced build. The Engine dry-run package gate rejects test support, fixtures, and the retired create/ingest artifacts while allowing file modules that still belong to later migrations. This makes removal of compiled legacy artifacts reproducible rather than dependent on a developer's previous build tree.

This implements the first vertical part of the [single-writer SQLite authority decision](../simplification/2026-08-21-single-writer-sqlite-storage-authority.md). It does not expose a complete Engine factory or claim that the later method migrations are complete.

## Alternatives considered

- Deferring standalone create was rejected because it would leave a declared mutation unimplemented after its shared identity transaction already existed.
- Calling standalone create before ingest was rejected because two mutations can expose an empty subject and cannot atomically store the first generation, operation, and events.
- Deleting the legacy queue here was rejected because pending reads and lease mutations own that migration; retaining it as a live adapter or dual-write target was also rejected.
- Treating changed display-only metadata as corruption was rejected because those fields intentionally do not participate in MaterialId. Updating the old row was rejected because immutable first-seen provenance must not drift.
- Recreating a missing referenced blob and then reporting corruption was rejected because a concurrent caller could observe the temporary repair and succeed. Referenced content therefore has a verify-only path.
- Taking a separate blob lease per digest was rejected because writer priority lets queued maintenance deadlock a multi-blob mutation between puts. Removing writer priority was rejected because it can starve maintenance.
- Adding an outbox consumer, projection, doctor, backup, restore, or GC task abstraction was rejected because none has a consumer in this vertical slice.

## Consequences

SQLite is authoritative only for the package-private create/ingest composition until later feature commits migrate the remaining methods. The package root stays empty, the old brief/commit/review code has no production composition, and the disposable legacy queue remains test-only until brief/lease migration deletes it. The version migration must advance the private schema before it can store current or suspended pointers.

Exact RequestId retries return the stored result without duplicate rows or events; changed input, actor, or method conflicts globally. WAL plus one business transaction replaces create/ingest mutation-specific crash recovery. Schema v1 is deliberately limited to the identity, material reference, pending, operation, and event relations consumed by this slice.

## Verification

- `pnpm exec vitest run packages/engine/src/storage/sqlite-engine-store.test.ts packages/engine/src/storage/content-addressed-blob-store.test.ts packages/engine/src/storage/mutation-ledger.test.ts packages/engine/src/subject/service.sqlite.test.ts packages/engine/src/ingest/service.test.ts packages/engine/src/ingest/composition.boundary.test.ts packages/engine/src/facts/transaction-store.test.ts` passes 54 tests on Node 22.
- `pnpm exec vitest run packages/engine/src packages/protocol/src` completed 53 of 54 files and 742 of 743 tests; its sole failure was the unmigrated file-journal commit-recovery case exceeding 45 seconds under the full suite's filesystem load. That exact case passed alone in 6.97 seconds with `--maxWorkers=1`, so no assertion or SQLite composition regression remained.
- `pnpm run build` followed by `pnpm --filter @distilly/engine run smoke:built` reopens committed storage, races two real create-ingest processes, and uses real `SIGKILL` after blob publication, immediately before COMMIT, and immediately after COMMIT. Pre-COMMIT crash cases verify the exact content-addressed path is a regular file with byte-identical content before retrying.
- `pnpm run gates:fast`, `pnpm run typecheck`, the Protocol snapshot check, package-boundary tests, documentation verification, and Agent Note verification pass.
- The reproducible clean build plus `pnpm run check:engine-pack` verifies 302 dry-run Engine package files and contains no retired ingest staging, space lock, legacy fixture, test-support, or obsolete child-script artifact.

Brief/lease, commit, review/rollback, correction, verified read, projection, doctor, GC, backup/restore, runtime, binding, CLI, Panel composition, and Plugin acceptance remain unverified by this feature and are owned by later slices.
