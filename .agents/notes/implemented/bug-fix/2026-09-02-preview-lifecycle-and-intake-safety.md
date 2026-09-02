# Agent Note: Developer Preview lifecycle and intake safety

Status: implemented

## Problem

The Codex setup path probed a fresh host before creating its ordinary `.codex` home, so a clean user home failed before the Plugin could be installed. Uninstall also treated a missing owned plugin tree as an unowned tree and left the host registration behind. Local file intake followed selected file symlinks, used filesystem modification time as capture provenance, and accepted duplicate basenames that could collapse the fallback source identity. Profile prompts had no session-bound capacity check even though the first version must be delivered complete.

## Decision

Codex setup creates only the regular `.codex` directory required by its version probe and rejects unsafe lifecycle paths through the existing directory guard. Uninstall distinguishes an absent owned tree from a present tree without Distilly ownership: an absent tree still has its verified host registration and marketplace entry removed, while a foreign or corrupt tree remains fail-closed.

The local loader uses `lstat` for the selected file, rejects a symlink at that path, verifies regular-file size and modification time after reading, and rejects duplicate basenames before any bytes are read. The Engine replaces loader-supplied capture timestamps with its trusted transaction clock for both raw and parsed source records. A connected session's complete profile prompt is checked against its trusted input and tool-result budgets using the same conservative UTF-8-byte upper bound as briefing; it is never truncated, and sessions without an advertised capacity retain direct SDK reads.

## Alternatives considered

- Creating `.codex` inside every generic host probe was rejected because doctor and uninstall must remain read-only with respect to missing host homes.
- Removing all marketplace entries whenever the plugin tree is missing was rejected because a present foreign or corrupt tree must not authorize destructive cleanup.
- Following symlinks and relying on `stat` was rejected because an explicitly selected path must not silently redirect to another file; rejecting every ancestor symlink was also rejected because macOS system paths such as `/var` legitimately use symlinked ancestors.
- Trusting file mtime as `capturedAt` was rejected because it describes filesystem history, not the acquisition event. Adding an arbitrary raw-file size ceiling was rejected because the parser's existing bounded output is the relevant product limit.
- Truncating a prompt or imposing a new fixed 16 KiB ceiling was rejected. The guard consumes only a verified session budget and returns `context_too_large` with numeric diagnostics when the complete prompt cannot fit.

## Consequences

Fresh Codex setup now reaches host preflight without a manual directory-creation workaround, and uninstall removes stale Distilly registration while preserving foreign installations and user data. Selected local symlink files and duplicate labels fail before subject creation or storage writes. Persisted source provenance is acquisition-time data owned by Engine rather than a caller-controlled mtime. Host-bound prompt calls fail visibly when their complete output exceeds the exact verified budget; no content is silently lost. The existing release skill bytes remain unchanged, so the immutable host-capacity fixture remains valid.

## Verification

- Node 22: `pnpm run build` passes.
- Node 22: `pnpm exec vitest run packages/cli/src/lifecycle.test.ts packages/bindings/src/full-binding.test.ts packages/runtime/src/preview.test.ts packages/engine/src/preview.test.ts packages/engine/src/distill/prompt-capacity.test.ts packages/protocol/src/mcp.test.ts --maxWorkers=1` passes 6 files and 52 tests.
- The tests cover fresh Codex homes, stale plugin registration cleanup, final-file symlink rejection, duplicate basename rejection, acquisition-time provenance, complete prompt capacity boundaries, and the UTF-8 correction boundary.
- `python3 -B scripts/assemble_plugins.py --check` verifies that the canonical skill, host mirrors, and release manifest remain byte-consistent.
