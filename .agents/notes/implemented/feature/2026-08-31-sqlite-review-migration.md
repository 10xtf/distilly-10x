# Agent Note: SQLite review and rollback migration

Status: implemented

## Problem

SQLite is authoritative for immutable committed versions, claims, evidence, status pointers, pending jobs, operations, and events, but active-review reads and promote/reject/rollback mutations previously existed only in the file-authority test fixture. The live storage path therefore could not finish a suspended candidate decision or create an immutable rollback descendant without the review journals, staging, and semantic recovery that the SQLite design retires.

## Decision

The package-internal SQLite composition owns active-review listing and one `ReviewService` for promote, reject, and rollback. Review listing uses one read snapshot and validates only the directly needed subject pointers, active statuses, immutable current/candidate rows, memberships, and claims before rendering the canonical diff; it does not read pending work or scan full history.

Each mutation resolves global RequestId replay/conflict, rechecks its subject and active pointers inside one short SQLite write transaction, records the stable result and fixed event tuple, and publishes only after commit. Promote makes the prior current historical and the exact active candidate current. Reject makes the exact candidate rejected while preserving the existing pending row and lease byte-for-byte. Rollback accepts a same-subject historical target and inserts a new immutable current descendant whose semantic snapshot comes from that target while parent, creation source, actor, time, and `VersionId` belong to the new mutation. Promote and rollback recompute the material delta against the new current; remaining work receives a fresh JobId, mutation-time `queuedAt`, and no lease, including when no old pending row exists.

The pure `summarizeVersion` projection lives in an internal dependency-light module so production review composition does not inherit the still-unmigrated file reader's type graph. The former file review/rollback service and its recovery branches are deleted. A copied file review query remains only as an explicitly named test fixture for the unmigrated read suite, while a source-graph gate prevents any legacy authority, lock, recovery, queue, or projection from becoming transitively reachable from the SQLite composition.

## Alternatives considered

- Keep using the file review fixture against SQLite-created versions. This would make two authorities cooperate across incompatible transaction boundaries and preserve the recovery protocol being retired.
- Update the current pointer to an old row during rollback. This would erase the rollback action from immutable lineage and give historical bytes a new actor/time without a new `VersionId`.
- Import the pure version-summary helper from the legacy-coupled version service. The source dependency would pull file facts and subject locks into the production composition even though TypeScript erases some imports, so the helper is isolated instead.
- Land correction with review/rollback. Correction depends on these transitions but also adds a correction blob and replacement-claim semantics, so combining them would make the critical SQLite feature too large to review.

## Consequences

SQLite/WAL now decides whether a review or rollback mutation committed; there is no review/rollback TransactionRecord, staging directory, target/previous/third-state recovery, or dual write in the live path. Exact replay does not allocate new ids or duplicate rows/events, and a changed method, normalized input, or trusted actor for the same RequestId fails with `idempotency_conflict`.

The Engine package root remains empty and no public runtime or user installation is introduced. File-backed profile/material/version/Library reads, their coordination primitives, and retained lease/commit recovery remain packaged but uncomposed until their owner migrations. Legacy persistence types still present in Protocol are not removed by this feature; the later authority/Protocol cleanup owns that closure. Correction, projections, doctor, and production event/outbox composition also remain later features.

## Verification

- Real temporary SQLite roots cover first-version and incremental candidates, filtered/paged review reads, canonical diffs, pointer/status corruption, promote/reject/rollback transitions, event reason/source metadata, exact replay/conflict, competing decisions, and all pending/lease rules.
- Real child processes receive `SIGKILL` immediately before and after COMMIT for promote, reject, and rollback; reopening observes either the complete previous world or the complete target and then replays exactly without mutation-specific recovery.
- Rollback tests compare target and descendant material, claim, evidence, quality, renderer, and accepted-patch authority while requiring a new immutable id, current parent, actor, time, and rollback creation edge.
- The complete Engine source suite catches transitive legacy imports; the dependency-light summary extraction restores a clean SQLite composition boundary. Package-boundary fixtures also reject production imports of named legacy test fixtures.
- Build-artifact and dry-run pack checks require the real SQLite review/query composition, reject retired review runtime markers and modules, exclude all test fixtures, and run suspended commit through promote, immutable rollback, reopen, and exact replay from built output.
- Node 22 focused review, read-regression, boundary, typecheck, build, pack, and hygiene checks pass; documentation, Agent Note, and whitespace verification pass for the completed feature tree.
