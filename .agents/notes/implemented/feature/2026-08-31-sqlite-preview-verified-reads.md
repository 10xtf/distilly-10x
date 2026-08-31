# Agent Note: SQLite Preview verified reads

Status: implemented

## Problem

The live mutation path committed subjects, materials, versions, review decisions, rollbacks, and corrections to SQLite/WAL, but most read services still depended on the retired file authority and JSON Library projection. A runtime built on those services would either miss committed SQLite state after reopen or revive a second authority before the Developer Preview could run end to end.

## Decision

One package-internal SQLite read service implements only the reads consumed by the first Preview: subject list and resolution; Profile get, prompt, and status; material list and get; version list, diff, and lineage; and Library list. Each operation uses a SQLite read snapshot and verifies the authority rows, immutable versions, events, and content blobs required by its result. Material reads acquire shared blob access before the SQLite snapshot and retain it through digest-verified delivery.

Current material rows are rebound to the authoritative subject material-set hash, and any pending total must match the same verified membership. The Library derives privacy and status from that membership in the same SQLite snapshot instead of introducing a durable projection. Existing deterministic cursors, profile and prompt rendering, semantic diffing, source grouping, and immutable-version verification remain the shared algorithms. The root composition exposes these reads without exporting a runtime.

## Alternatives considered

- Keeping the file-backed read services was rejected because they cannot observe the live SQLite authority and would preserve journal, recovery, and lock dependencies that the migration is removing.
- Rebuilding the JSON Library projection in this feature was rejected because SQLite can answer the Preview query directly and the projection would add reconciliation and failure modes without serving the vertical path.
- Adding a generic read repository or projection framework was rejected because the first runtime has a known, small consumer surface and no demonstrated second implementation.
- Combining runtime, parsers, or host bindings with the storage reads was rejected because those are downstream features that need this query contract committed first.
- Physically relocating the retained file-read regression surface was deferred because it would turn the vertical slice into a broad test-fixture migration; the live composition has no dependency on it.

## Consequences

Create, ingest, commit, correction, review, rollback, and reopen now feed the same verified subject, Profile, material, version, lineage, review, and Library reads. A missing pending-only material fails closed instead of silently lowering Library privacy. The Library is currently an in-snapshot local aggregate, so it does not need a projection watermark or repair protocol.

The first Preview intentionally aggregates all local subjects for subject and Library filtering. Lineage currently validates all events for the selected subject before applying its page boundary. Event correlation covers canonical EventRecord bytes, checksum, request, actor, and subject scope, but deeper operation-method/result correlation is deferred. Subject resolution requires the stored canonical URL or provider-qualified locator after basic query normalization; equivalence normalization for alternate URL spellings is also deferred. These bounded hardening items do not introduce a second authority and remain outside the local-material Preview critical path.

## Verification

- Focused SQLite tests cover create, ingest, commit, current and historical Profiles/materials/versions, prompt, semantic diff, lineage, method/filter-bound cursors, subject resolution, Library search/status/privacy, close/reopen, suspended review, reject, correction, rollback, and material-set corruption.
- The material corruption case deletes one pending-only row and proves both material and Library reads fail with `storage_corrupt` rather than returning an incomplete or less-private snapshot.
- Related SQLite composition tests and retained file-read/projection regressions pass; the live composition source graph contains no `CommittedVersionReader`, JSON Library projection, file journal, staging, or recovery dependency.
- Node 22 formatting, ESLint, full workspace typecheck, build, `gates:fast`, package-boundary checks, Engine pack, documentation verification, Agent Note verification, and `git diff --check` pass.
