# Agent Note: Protocol storage parity

Status: implemented

## Problem

The in-force storage contract already distinguished stable privacy-purge results from live blob-GC health and kept whole-root backup/restore outside ordinary business methods. Protocol and the public Facade still exposed purge as a null result, omitted live GC diagnostics, and had no typed maintenance boundary, so the next SQLite slice could not implement the design without changing public contracts mid-feature.

## Decision

Protocol publishes a strict `PurgeResult` discriminated by `physicalDeletion`, with `pendingBlobCount` required only as a safe positive integer on the pending branch. `DoctorSnapshot.storage.pendingBlobGcCount` is a safe non-negative live count. `Distilly.purge` returns the complete stable result instead of discarding it.

Whole-root backup and restore use `EngineAdministrationClient` plus a separate `engineAdministrationSchemas` registry. The registry validates strict input/result objects but remains outside the exact 35-key `EngineMethodMap`, the Panel RPC surface, and the five MCP tools. The design's `ReviewService.reject` signature now matches the already-shipped version method and service result: the rejected `VersionSummary`.

## Alternatives considered

- Keeping purge as `null` until SQLite landed was rejected because it would force the storage implementation and its callers to land against a knowingly stale public contract.
- Adding backup and restore to `EngineMethodMap` was rejected because whole-authority maintenance freezes or replaces the root and is not an idempotent subject business mutation.
- Reusing the original pending purge result as live GC status was rejected because RequestId replay must remain stable after background physical deletion completes.

## Consequences

Every complete EngineClient fixture now supplies deletion status and the doctor GC count. Future storage code must persist the original `PurgeResult` for replay while computing doctor health from current GC state. Runtime and CLI may borrow the administration client from the single root owner; ordinary SDK, Panel, and MCP clients cannot call it.

## Verification

Protocol type/runtime tests cover both purge branches, positive/non-negative integer boundaries, strict administration schemas, exact method-registry separation, operation-result correlation, and explicit public exports. Facade, MCP fake, Panel transport fixtures, built smoke, typecheck, snapshots, documentation generation, and Agent Note governance pass on Node 22.

SQLite purge, GC, backup, restore, runtime composition, and CLI commands remain unimplemented and therefore unverified; this feature ships their shared contracts only.
