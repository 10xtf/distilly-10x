# Agent Note: Developer Preview runtime

Status: implemented

## Problem

The SQLite business path and verified reads are runnable only through a package-private composition. The injected Distilly, MCP, and Panel surfaces therefore still depend on complete test clients and cannot bind a trusted actor, engine-owned lease owner, or verified briefing capacity to real local data. Waiting for every deferred maintenance, bundle, parser, and host method would keep the first local-material Preview unusable even though its vertical product path is implemented.

## Decision

Explicitly named Preview subpaths avoid claiming the production runtime contract. `@distilly/engine/preview` owns the real root-scoped SQLite core runtime, and `@distilly/runtime/preview` composes it as a local `EngineClient`. Each connection accepts only a trusted actor and optional capacity; the engine allocates a fresh opaque lease owner. Calls parse method parameters, mutation context, and results at the runtime boundary, then dispatch the methods backed by the live SQLite composition.

The twelve deferred MethodMap entries fail visibly with non-retryable `schema_unsupported` after their boundary input is validated. They never return placeholder success. The ordinary `@distilly/engine` and `@distilly/runtime` roots and the future production runtime names remain unavailable until the full contract closes. Runtime close stops new work, drains accepted calls, detaches client watches, closes SQLite, and releases in-process root ownership; client close affects only that session.

## Alternatives considered

- Exporting the target production `openEngine` and `LocalRuntime` now was rejected because it would falsely imply that host install, doctor, bundles, parsers, and every core method are implemented.
- Blocking runtime work until all 35 methods exist was rejected because the user explicitly prioritized a runnable local-material Developer Preview and deferred noncritical methods.
- Returning empty or synthetic results for deferred methods was rejected because it would make tests pass without a usable or auditable product.
- Adding a daemon, RPC protocol, cross-process takeover, adapters, parsers, or bindings in this feature was rejected because those are downstream slices and would prevent a small reviewable runtime commit.
- Letting callers supply `LeaseOwnerId` was rejected because it would break session isolation and trusted idempotency preimages.

## Consequences

The Distilly facade, five-tool MCP presenter, and later Panel/CLI composition can now borrow one real local client instead of a storage fake. Separate connections receive different engine-owned lease authority, watches detach per client, and runtime close rejects new work only after accepted calls drain. A second in-process owner for the same normalized root fails with `busy`; close or a failed open releases that reservation.

This Preview owns one root only within a process. A later launcher/service feature must provide authenticated cross-process attach or fail-closed ownership before Codex and Claude Code can safely use the same root concurrently. The explicit unsupported MethodMap entries are a temporary Preview compatibility surface; downstream main-flow code must not treat them as feature availability, and the production root exports remain gated on real handlers.

## Verification

- A real temporary root completes create, text ingest, pending, capacity-bound brief, owner-isolated commit, Profile, and prompt through the Preview client and remains readable after runtime close and reopen.
- Focused tests cover normalized same-root races, failed-open reservation release, strict open/session/params/context/result boundaries, per-client watch and close isolation, in-flight drain, and explicit core/runtime-owned unsupported methods.
- Built Engine and Runtime smokes import the package subpaths by name, keep both stable roots empty, and open/read/close a real SQLite root. Package-boundary fixtures admit only Runtime to Protocol plus Engine.
- Node 22 focused tests, formatting, ESLint, workspace typecheck and build, boundary and build-artifact tests, Engine pack, Knip, publint, Runtime type-package validation, documentation, Agent Note, and diff checks pass.
