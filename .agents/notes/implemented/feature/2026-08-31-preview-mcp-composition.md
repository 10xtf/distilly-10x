# Agent Note: Developer Preview MCP composition

Status: implemented

## Problem

The real SQLite Preview runtime, browser-safe facade, five-tool MCP adapter, and loopback Panel existed only as separate injected seams. The only stdio child still used a complete fake EngineClient, so no owned graph proved that one local authority could serve `Distilly`, `Person`, MCP, correction review, and a later process reopen.

## Decision

The private `@distilly/cli` package now exposes only the explicit `@distilly/cli/preview` composition. A trusted caller supplies the local root, host session and verified capacity, plus fixed Panel assets and port. The composition opens one Preview LocalRuntime, binds a capacity-bearing host client for MCP and a fixed-capacity direct-user client for the facade and Panel, registers exactly the existing five tools, and lazily starts the real authenticated Panel only when a suspended review is presented.

The composition owns teardown but performs no host installation. Stdio serving is single-flight and tracked. Teardown first stops and drains MCP and waits for its stdio transport, then closes the Panel presenter, both borrowed clients, and finally the runtime; an admitted correction can therefore finish presenting review before Panel shutdown. The stable CLI root remains empty and there is no executable, setup, doctor, uninstall, host manifest mutation, or cross-process attach in this feature.

## Alternatives considered

- Making MCP import Runtime was rejected because the presenter must remain transport-neutral and testable over an injected client.
- Making Runtime import MCP or Panel was rejected because transport and UI are outer composition concerns.
- Adding a test-only real-client fixture without a product composition was rejected because it would improve evidence without creating a reusable path for the host launcher.
- Shipping a partial command shell with unsupported setup and lifecycle commands was rejected because it would look runnable while returning placeholder failures.
- Returning a synthetic review URL was rejected because correction must prove the existing real loopback Panel boundary.

## Consequences

Bindings and the future CLI executable can now invoke one reviewed outer graph instead of rebuilding actor, capacity, presenter, and close ordering. Direct facade operations and MCP operations share the same SQLite root while retaining separate lease owners and actor identities. The current composition is still in-process and explicitly Preview-only; it cannot safely serve two independent host processes until the launcher/service feature supplies authenticated attach or fail-closed ownership.

## Verification

- A real temporary root completes create, ingest, brief, claim commit, `Person.get`, `Person.prompt`, direct correction, and close/reopen through the composed facade.
- A built child initializes over stdio, lists exactly five tools, calls ingest, pending/brief, commit, get, and host-relayed correction against SQLite, verifies the real Panel health endpoint, closes, reopens a second process, and reads the persisted Profile with no fake EngineClient.
- Focused lifecycle coverage closes an actively served stdio graph, waits for transport teardown, and immediately reopens the released root.
- Node 22 focused Vitest, built smoke, build, typecheck, fast gates, package-boundary tests, and build-artifact tests pass.
