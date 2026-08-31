# Agent Note: Source adapter contracts

Status: implemented

## Problem

The Developer Preview source-adapter design defines direct and delegated collection seams, opaque secret references, and a separate direct-user collection method table, but the workspace had no package that owned those contracts. Adding provider implementations before this boundary existed would have encouraged each adapter, Panel, or CLI path to invent a different resource shape, config format, or validation rule.

## Decision

`@distilly/adapters` is a contract-only package with a Protocol-only internal dependency. It exports the direct/delegated `SourceAdapter` union, adapter-owned strict resource parsers, public config plus opaque secret references, a content-free registry view, and strict runtime schemas for exactly `source.list`, `source.configure`, `source.preflight`, and `source.collect`.

The generic user-action resource accepts bounded finite JSON so community adapters can define their own shapes, while every registered adapter must supply the strict parser used before provider-specific dispatch. Config validation keeps secret-like keys out of public values and never resolves an opaque secret reference. The registry validates registrations and exposes frozen metadata snapshots, not callable adapter handles.

The package adds no built-in adapter ids, HTTP clients, credential resolution, collection service, MaterialParser surface or implementation, runtime composition, CLI command, EngineMethodMap method, or MCP tool. Those implementations remain owned by the proposed [Developer Preview source-adapter boundary](../../proposed/architecture/2026-08-30-developer-preview-source-adapters.md).

## Alternatives considered

- Putting adapter contracts in Protocol was rejected because source collection is not an EngineMethodMap or model wire capability; only shared product values belong in Protocol.
- Starting with Lark or another concrete adapter was rejected because provider code would prematurely own the generic configuration, validation, and user-action boundary.
- Exporting registry lookup handles was rejected because it would give unvalidated callers a way around each adapter's strict resource parser; the public registry view remains content-free.
- Adding secret resolution to the config contract was rejected because resolved values must exist only inside later production composition during preflight or collect.

## Consequences

Concrete adapters, parsers, and the later user collection service now have one typed boundary to implement without changing Protocol or the five-tool MCP surface. The open generic resource envelope remains safe only as a bounded transport value; provider-specific semantics and unknown-key rejection still belong to the adapter-owned parser. This feature proves registration and boundary validation, not that any provider can collect data.

## Verification

- `pnpm run gates:fast`
- `pnpm exec vitest run packages/adapters/src`
- `pnpm run test:boundaries`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm run snapshots`
- `pnpm run hygiene`
- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
