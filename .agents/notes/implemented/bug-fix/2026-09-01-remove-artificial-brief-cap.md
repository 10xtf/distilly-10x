# Agent Note: Remove the artificial Codex briefing cap

Status: implemented

## Problem

The Codex Preview capacity fixture used a 16,384-byte complete briefing because that was the first conservative observation chosen for the host harness. The harness proved that value survived the real structured/text MCP path and reached the model, but it did not prove that the next byte failed. Treating the sampled value as the product maximum blocked a 30,496-byte first-profile briefing even though the same host path already carried a 65,536-byte tool result.

## Decision

Use 65,536 bytes as both the verified complete-briefing budget and tool-result budget for the exact Codex CLI 0.146.0, release, wire, Skill, descriptor, and serializer tuple. The real-host harness fills each exact-size payload with deterministic high-entropy text, places different unseen markers at the beginning, multiple middle positions, and the end, and requires the model to return all markers in order. A binding fixture advertises an exact net budget proven complete at that value; it does not claim to have discovered the host's true failure threshold. The Engine continues to require a complete briefing and never truncates materials.

## Alternatives considered

- Remove every capacity check. Rejected because an unverified host truncation could produce a Profile that silently omitted evidence.
- Keep 16,384 and ask users to shorten supplied material. Rejected because that number was a proven safe sample, not a measured host failure boundary, and it blocked an ordinary 30,496-byte briefing.
- Add briefing pagination or map-reduce in this fix. Deferred because it requires a new completeness proof and protocol shape; it remains the correct separate solution for inputs beyond the verified transport budget.

## Consequences

The current 30,496-byte case passes without user intervention, and the Preview accepts complete briefings up to the verified 65,536-byte budget. The generic 4 MiB Engine ceiling, 999-reference bound, exact host-tuple matching, and fail-closed no-truncation behavior remain unchanged. This changes no MCP tool, wire schema, canonical Skill byte, storage format, or Panel behavior.

## Verification

- A real Codex 0.146.0 run observed the exact 65,536-byte high-entropy briefing and tool result, preserved structured/text equality, and returned every distributed unseen marker from both payloads.
- The immutable fixture test asserts both advertised net budgets are exactly 65,536 bytes.
- The self-contained Codex package verifier covers setup, exact five-tool discovery, the local profile flow, correction and review, person-Skill persistence, and uninstall data preservation with the regenerated evidence.
