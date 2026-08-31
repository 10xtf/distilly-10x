# Agent Note: Codex person Profile projections

Status: implemented

## Problem

The Codex Preview could install and launch the five-tool Plugin, and the public `Person` facade already exposed temporary `get` / `prompt` plus explicit `install` / `export` / `uninstall` methods. The LocalRuntime still rejected all three host mutations, however, and the MCP entry constructed only a capability binding. A committed Profile therefore could not reach the existing self-contained Codex person-Skill projector through the product path, and host mutation RequestIds had no SQLite replay authority.

## Decision

The Engine Preview now owns a narrow authority for the three host-mutation operation records while filesystem projection remains in the full Codex binding. Runtime composes that full binding, resolves current or explicitly pinned Profiles through verified Engine reads, invokes only its binding-created injector, and finalizes the exact result in the SQLite operation ledger. The outer CLI reconstructs the verified full Codex binding from its owned install record and passes the binding plus trusted host context into the MCP application.

This slice accepts one full host projection because the active Preview command is host-specific. Missing or mismatched bindings fail closed, and the public `Person` and Protocol contracts remain unchanged. Uninstall verifies that its exact `InstallRef` came from a canonical prior install result before the binding can touch the filesystem.

## Alternatives considered

- Returning the existing injector result directly from Runtime was rejected because it would lose global RequestId replay and conflict semantics.
- Letting Runtime open or write SQLite was rejected because Engine remains the only structured-storage writer.
- Passing a bare injector from CLI into Runtime was rejected because the in-force target graph makes Runtime the binding composition owner; the CLI supplies a verified full binding and trusted host context instead.
- Adding an installation catalog, crash-orphan collector, or multi-host registry in this slice was rejected because none is required for the Codex vertical Preview flow.
- Calling a live model to prove discovery was rejected because Codex exposes a local prompt-input diagnostic. A fresh Codex process verifies that the installed person Skill is model-visible without authentication or model API usage.

## Consequences

- A committed Profile supports `Person.get`, `Person.prompt`, and explicit Codex install/export/uninstall through LocalRuntime.
- Install writes only a self-contained `SKILL.md` and digest ownership manifest under the canonical Codex skills root; raw materials and private source paths are absent.
- Exact RequestId replay returns the stored result without repeating a completed projection, while conflicting reuse fails with `idempotency_conflict`.
- Closing and reopening Runtime retains the Profile and installed person Skill, and Plugin uninstall leaves SQLite data and a separately installed person Skill intact.
- The filesystem effect still precedes SQLite operation completion. Idempotent install/export/uninstall retries converge when the same resolved projection is retried, but this slice does not provide a durable pre-effect reservation. A concurrent mutation can claim the RequestId after the filesystem effect, and a retry of an unpinned install/export can resolve a different current Profile. Exhaustive crash injection, orphan collection, and durable cross-boundary coordination remain post-Preview hardening; this feature does not claim a cross-filesystem/SQLite atomic transaction.

## Verification

- `pnpm exec vitest run packages/engine/src/host/mutation-authority.sqlite.test.ts packages/runtime/src/preview.test.ts packages/bindings/src/full-binding.test.ts packages/cli/src/preview.test.ts packages/cli/src/lifecycle.test.ts`
- `node --test tests/check_package_boundaries.test.mjs`
- `pnpm run gates:fast`, `pnpm run typecheck`, `pnpm run build`, and `pnpm run hygiene`
- `python3 -B scripts/verify_docs.py` and `python3 -B scripts/verify_agent_notes.py`
- A fresh local Codex `0.146.0` process passed the opt-in discovery case with `DISTILLY_VERIFY_CODEX_DISCOVERY=/opt/homebrew/bin/codex`; the test runs `codex debug prompt-input` and observes the generated person Skill in the model-visible prompt input without making a model call.
