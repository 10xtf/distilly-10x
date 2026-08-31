# Agent Note: Local file ingest and Preview parsers

Status: implemented

## Problem

The real Preview runtime could complete a Profile only when a caller first converted every source into `MaterialInput`. That left the required user journey—select local material, retain its raw evidence, distill it, and reopen the result—behind a test or custom integration. The full parser roadmap contains several formats that are not necessary to prove this first vertical product path.

## Decision

The first local-material slice supports exactly UTF-8 TXT, Markdown, JSON, SRT, and VTT. `@distilly/adapters` owns deterministic parser contracts, exact media-type registration, stable JSON rendering, subtitle cleanup, fatal UTF-8 handling, and the no-truncation output bound. It performs no filesystem or authority writes.

`@distilly/runtime/preview` reads only explicit user-selected regular files, retains only each basename as the public label, selects the built-in parser, and returns raw bytes plus any validated draft through a trusted seam. Engine derives `RawId` from the complete raw bytes, binds successful drafts to `raw_extract`, and commits the subject/raw relation, accepted material, generation, pending job, operation result, and events in one SQLite transaction. Each raw authority row can claim only one canonical text tuple; a later parser interpretation with different content, kind, method, or producer fails inside that transaction instead of entering briefing beside the first. Parser failure keeps a raw-only item without changing the material set or enqueueing work. RequestId replay and conflict resolution happen before Runtime reads a path.

Material reads verify both canonical text and any referenced raw blob before reporting `rawAvailable=true`. Raw blob publication may precede the SQLite transaction and leave an unreferenced content-addressed blob after failure, matching the existing ingest transaction model; it cannot expose partial product state.

## Alternatives considered

- Adding PDF, EML/MBOX, Lark export, or OCR now was rejected because the user explicitly limited the first Preview to the five formats needed for the local vertical path. Those formats remain later independent parser features.
- Letting parsers persist raw bytes or assign `RawId` was rejected because Engine must remain the only authority writer and identity owner.
- Sending file paths through MCP was rejected because the five-tool model boundary is unchanged; explicit file selection belongs to the direct user/runtime surface.
- Storing absolute paths as provenance was rejected because local filesystem topology is private and unnecessary for replay, audit, or evidence reads.
- Treating parser failure as an ingest failure was rejected because retaining the immutable raw evidence allows a later supported extraction while correctly preventing invisible content from entering distillation.

## Consequences

The Preview can now create a subject from user-selected local files, preserve unsupported or malformed inputs as raw-only evidence, and distill deterministic text without another model API key. Replaying a completed file ingest remains stable even after the selected file is moved or deleted, while a changed input or actor conflicts before any read. The stable Runtime root remains empty, source providers remain absent, and the parser set makes no claim about PDF, mail archives, Lark exports, images, or OCR.

The schema adds raw material and subject-to-raw authority tables. Existing unreleased Preview roots created under the earlier private schema are not migrated by this feature; compatibility migration remains deferred until after the runnable Developer Preview path.

## Verification

- Adapter tests cover exact registry behavior, UTF-8 failure, whitespace refusal, stable JSON, SRT/VTT cleanup, and exact/+1 output byte bounds.
- A real Runtime root atomically ingests parsed and unsupported files, preserves raw-only zero-delta state, replays before deleted-file reads, rejects changed input/actor/method reuse, refuses a second canonical interpretation of identical raw bytes, verifies raw CAS bytes and `rawAvailable` after reopen, and leaves no product-visible state or absolute path on read failure.
- Node 22 focused tests, formatting/lint, typecheck, build, package boundaries, built package smokes, pack/export checks, documentation, Agent Note, and diff checks pass.
