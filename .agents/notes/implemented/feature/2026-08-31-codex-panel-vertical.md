# Agent Note: Codex Panel vertical Preview

Status: implemented

## Problem

The Codex MCP composition returned a real loopback ReviewLaunch and injected a separate direct-user EngineClient into the Panel, but its product path was not yet a reliable vertical Preview. Review-route recovery required the deferred deep Doctor and therefore turned a successful promote or reject into a Panel error. The CLI also selected and released a Panel port when MCP started even though the Panel might not bind until much later. Finally, the checked-in browser bundle was stale and the built CLI smoke stopped at `/health`, so no test proved that the real SQLite authority could be reviewed through the browser UI.

## Decision

The Codex ReviewLaunch remains the only Preview Panel entry. The Runtime tags its intentionally deferred Doctor error with `details.kind=preview_method_deferred` and `details.method=system.doctor`; Panel-wide recovery tolerates only that tagged, non-retryable `schema_unsupported` result, and Settings renders the limitation as read-only text. Every unrelated Doctor failure still surfaces. Automatic port selection now occurs inside each lazy Panel start attempt; tests may still supply a fixed port. The built Codex MCP smoke drives Chromium through the existing token, nonce, RPC, and UI paths against one real LocalRuntime/SQLite root to promote one correction, reject another, roll back to the initial historical version, verify every result through MCP, and verify the result again after reopening.

## Alternatives considered

- Adding `distilly panel` was rejected because the suspended-result URL is already the required Codex entry and the current design does not enable that command in this Preview.
- Implementing deep Doctor was rejected because it is explicitly deferred and is not required for review.
- Replacing the existing Panel with a second minimal UI was rejected because the injected server/web implementation already owns the reviewed security and mutation paths.
- Keeping only HTTP assertions was rejected because the remaining risk was the composition between the built browser bundle and the real backend; existing HTTP and fake-browser suites already cover their isolated contracts.

## Consequences

Codex users can follow a correction ReviewLaunch into the real local Panel, inspect Library, Subject, evidence, versions, and active reviews, then promote, reject, or roll back against the same SQLite authority used by MCP. Review recovery stays usable while deep Doctor remains deferred, without pretending Doctor succeeded. The checked-in browser bundle is regenerated from the current Protocol and UI source.

Automatic port selection still has the normal short free-port probe-to-bind race. Because allocation occurs inside each lazy start attempt and PanelLauncher returns to `new` after a start failure, a repeated review action can select a new port instead of being pinned to a stale MCP-startup choice. Eliminating even that short race requires a separately designed internal port-zero server seam and remains post-Preview work.

## Verification

- `pnpm exec vitest run packages/runtime/src/preview.test.ts packages/panel/src/web-recovery.test.ts packages/cli/src/preview.test.ts`
- `pnpm exec vitest run packages/cli/src packages/panel/src/web-recovery.test.ts`
- `pnpm --filter @distilly/panel run typecheck`
- `pnpm --filter @distilly/panel run build:web`
- `pnpm --filter @distilly/panel run snapshots`
- `pnpm run test:panel-http`
- `pnpm run test:panel-browser`
- `pnpm --filter @distilly/cli run smoke:built`
- `pnpm run gates:fast`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run hygiene`
- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
