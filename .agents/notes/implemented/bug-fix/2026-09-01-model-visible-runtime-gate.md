# Agent Note: Model-visible runtime gate

Status: implemented

## Problem

The canonical Distilly Skill required a trusted `HostPreflight` result to be visible to the model before it could call any Distilly tool. Codex correctly keeps that result inside binding and runtime composition, so a healthy installation exposed all five MCP tools but the Skill still instructed the model to stop. This made the installed Preview unusable despite a successful internal preflight.

## Decision

The binding completes trusted preflight before starting MCP and keeps the accepted capacity bound to the runtime session. The model-facing gate checks only that the exact five Distilly tools are present. A missing tool or a real host-capability, handshake, or runtime error still fails closed. The Skill also gives the exact initial resolve envelope, including the top-level wire/request fields and nested subject query, after a fresh-host probe showed that prose-only request-id guidance could still produce an invalid first call. Optional source capabilities such as web, local-file conversion, OCR, or transcription are used only when the current session exposes a suitable tool or input path; five Distilly tools do not imply those capabilities.

The canonical Skill and generated Codex and Claude Code mirrors carry this rule. Because the immutable Codex host-capacity record is release-bound to the canonical Skill digest, the real-host evidence is regenerated for the corrected digest rather than bypassed.

## Alternatives considered

- Expose `HostPreflight` as a sixth MCP tool. Rejected because the public contract intentionally has exactly five tools and preflight is trusted binding/runtime state, not a model action.
- Ask the user to paste or confirm preflight data. Rejected because user-provided capability claims are not trusted evidence and would expose an internal implementation detail.
- Remove runtime gating entirely. Rejected because missing tools and genuine handshake or capacity failures must remain visible and fail closed.

## Consequences

Fresh Codex and Claude Code sessions can begin the workflow when the five tools are available without inventing an inaccessible prerequisite. Runtime safety remains enforced below the prompt boundary. Source acquisition remains conservative: unavailable conversion or research capabilities require a traceable textual fallback.

## Verification

- `python3 -B scripts/assemble_plugins.py --check`, `python3 -B -m unittest tests.test_assemble_plugins`, and the canonical Skill validator pass.
- Real Codex 0.146.0 capacity verification passes at the exact 16,384-byte briefing and 65,536-byte tool-result boundaries for the corrected Skill digest; the focused fixture test passes.
- `pnpm run package:preview:codex` and the real-host packaged Codex verifier pass in an isolated home, including exact five-tool discovery, the product flow, person-Skill installation, and data-preserving uninstall.
- The corrected package is reinstalled locally with unchanged SQLite bytes. `codex exec --ephemeral --sandbox read-only --json` with the installed `$distilly` Skill calls `distilly_get` once with the exact resolve envelope and returns `not_found` for a unique probe, without asking for `HostPreflight` or modifying person data.
