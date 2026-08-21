# Agent Note: Step 10 verified review and injected Panel

Status: implemented

## Problem

Step 10 crosses immutable facts, recovery, a disposable Library projection, and a browser transport. Without one feature boundary, a staged or orphaned version could become readable, a review decision could survive only partly, a clean Library could lag committed facts, or the local Panel could exercise engine authority without a verifiable user action.

## Decision

The feature is the package-internal verified read/review slice plus the injected-client `@distilly/panel` leaf. Canonical rules remain in [Design V3](../../../../docs/design/system-v3.md).

- Verified reads reconcile, hold the subject lock through one snapshot, and require immutable files, materials, state, and exact lifecycle events to prove one connected current lineage with a unique leaf. Physical materials must equal the union referenced by current state and committed versions.
- Promote, reject, and rollback are idempotent journaled transactions with atomic state replacement as the commit point. Recovery accepts only an exact target or exact previous state and verifies the complete correlated event tuple. Promote and rollback rebase pending work; reject preserves it; rollback creates a new immutable descendant.
- Library remains disposable. A Library-changing writer durably records intent before fact mutation and holds its reservation through projection apply and journal terminalization. Only a clean terminal writer clears its exact token; dirty or interrupted work retains intent until reconciliation proves no prepared owner remains. Query reads only the validated projection; rebuild scans verified seeds under the Library lock without acquiring every subject lock.
- Panel borrows a complete `EngineClient`. Exact loopback Host, Origin, Bearer authentication, bounded HTTP/static responses, authenticated fetch-streamed SSE, CSP, and a single-use nonce bound to token, method, request, and canonical params constrain browser authority. Launcher lifecycle is single-flight, terminal on close, and never owns the borrowed client.
- The feature excludes production runtime composition, CLI/setup, Correction, archive/install, raw extraction, and production doctor behavior. The Panel exposes only implemented read and promote/reject/rollback paths.

## Alternatives considered

- Trusting every schema-valid artifact directory was rejected because publication precedes the state commit point and journal-less orphans are not committed facts.
- Pointer-only review and unjournaled rollback were rejected because crashes could split state, events, operations, projections, queue rebasing, and immutable output.
- Dirty marker plus projection lock alone was rejected because a crash between fact commit and dirty creation can leave a clean-stale index; durable pre-mutation intent closes that window.
- `EventSource`, browser confirmation alone, and partial runtime exports were rejected because they cannot respectively carry the required Bearer header, prove mutation scope, or honestly represent production handler availability.

## Consequences

Every new Library-changing writer must preserve request/identity/subject/Library lock order and intent settlement. Panel is a loopback single-user boundary, not a remote or multi-user service. A complete injected transport must not be described as production composition.

## Verification

Node 22 gates pass for 862 TypeScript tests, 46 Panel HTTP tests, the built Chromium path, package boundaries, Protocol/Engine/Facade/MCP/Bindings suites, typechecking, snapshots, builds, hygiene, Python tests, documentation generation, and Agent Note governance. Fixtures cover committed-version/material invariants, promote/reject/rollback replay and crash recovery, Library dirty/intent races, all Engine method RPC mappings, nonce rebinding and consumption, SSE lifecycle, review evidence, and Launcher races.

Production runtime/CLI/setup, Correction, raw extraction, real host installation, and fresh-install end-to-end behavior remain unverified because they are later features.
