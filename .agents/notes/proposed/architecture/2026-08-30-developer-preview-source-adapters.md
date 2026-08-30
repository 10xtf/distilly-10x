# Agent Note: Developer Preview source-adapter boundary

Status: proposed

## Problem

The V3 contract kept SourceAdapter as an extension seam but prohibited first-party provider APIs in the initial repository. That would leave the Developer Preview unable to preserve useful source collection without either treating the Plugin as a thin skill wrapper, giving credentials to the host model, adding model-facing collection tools, or reviving browser automation for private chats.

## Proposal

The Developer Preview will support exactly Codex and Claude Code and keep the model-facing surface at exactly five MCP tools. The product may provide reviewed TypeScript builtins in `@distilly/adapters`: region-explicit Lark/Feishu collection, DingTalk documents and knowledge bases with message history returning non-retryable `host_unsupported`, scope-bound and provider-rate-aware Slack messages, bounded and directly confirmed Xquik public-post candidates, and deterministic local parsers for common text, export, mail, subtitle, and embedded-text PDF formats.

Credentialed collection will be a direct user action in CLI or Panel. Configuration will store only opaque secret references; production composition will resolve values at the adapter boundary and never expose them to the model, browser state, EngineClient, material, briefing, logs, or diagnostics. Panel collection will use a separate strict `/sources` transport over an injected user-bound UserCollectionClient; it will not weaken the exact EngineMethodMap `/rpc` contract. Xquik will receive an injected, non-persisted MeteredReadConsentPort rather than a config value or serialized grant. Adapter output will reach authority only through a user-bound EngineClient ingest call, so collection adds no Protocol method, CoreEngineClient method, or MCP descriptor.

SourceAdapter will remain generic over an adapter-owned resource schema so community adapters are not closed out by the builtin selection union. DingTalk `messages` will remain a known builtin resource whose resource-bound preflight and collect path fail before secret resolution or network I/O. One raw input will still produce at most one canonical text. Mailbox and Lark exports will use read-only subject display names, aliases, and identity hints to filter exact target records before deterministic aggregation; missing or ambiguous target identity will leave the raw unparsed instead of attaching a multi-person export to one subject. Output will use the existing inclusive one-material content limit and will never be silently truncated.

Developer Preview bindings will report private UI capture unavailable and ship no browser, Playwright, Computer Use, screenshot, or recording path for private messages. Users will provide exports or pasted text, or explicitly run a reviewed official-API adapter within its granted scope. The more extensive private-capture types remain a future contract and are not an installable Preview capability.

## Alternatives considered

- Keeping all provider collection outside the repository was rejected because the Plugin would preserve orchestration but omit the repeatable source acquisition that users rely on.
- Adding `distilly_collect` or adapter-specific MCP tools was rejected because it would break the exact-five contract and let a model reach credentialed, potentially billable operations.
- Passing tokens in model prompts, config values, CLI flags, or Panel browser payloads was rejected because those surfaces are routinely persisted or inspected.
- Browser automation for private chats was rejected because the Preview cannot prove account/thread isolation, screen-data handling, or zero incidental capture in Codex and Claude Code.
- Advertising DingTalk message history through an unofficial fallback was rejected because the reviewed Preview integration only has a supportable documents/knowledge-base contract; capability absence is `host_unsupported`, not malformed user input.
- Closing the generic adapter request type around four builtins was rejected because it would contradict the community SourceAdapter seam; each adapter instead owns a strict resource schema.
- Reusing Panel `/rpc` for collection was rejected because `/rpc` is the exact EngineMethodMap transport. A separate injected `/sources` client keeps collection out of Protocol and the engine method registry.
- Auto-detecting Lark region, allowing unbounded Xquik queries, persisting Xquik consent, or assuming Slack's historical page size were rejected because region, billing consent, and rate limits must be explicit and current.
- Splitting one export into an unbounded material array was rejected because the current raw-parser invariant is one canonical text; exact target filtering plus bounded deterministic aggregation preserves that invariant without misattributing a multi-person export.

## Acceptance criteria

- Codex and Claude Code are the only Preview host manifests, and both report private UI capture unavailable.
- Exactly five MCP tools remain; source list/configure/preflight/collect exist only on direct user CLI and Panel paths.
- Panel injects a UserCollectionClient, exposes a strict authenticated `/sources` route, and binds source mutations to route-aware one-use nonces without accepting secret values in browser payloads.
- Every registered adapter supplies a strict resource schema. Builtin and community resources validate before secret resolution or network I/O.
- Lark region routing, DingTalk message refusal, Slack scope/rate handling, and Xquik bounded consent are covered by offline fixtures with secret-redaction assertions.
- Local parsers cover the listed real formats, exact subject filtering, an inclusive 1,048,576-byte success boundary, and a 1,048,577-byte unparsed failure without truncation.
- The final implementation updates live architecture and tests before this Note moves to `implemented`.

## Risks

The source action surface adds a fourth authenticated Panel POST route and a second borrowed client, so route isolation, nonce cross-replay, teardown ownership, and response bounds need dedicated tests. Dynamic community resource schemas could become a validation bypass if the registry exposes an unparsed adapter handle. Provider API scope and pagination behavior can change, so production code must fail closed against injected offline contracts and never infer a broader permission. This Note describes target behavior only; adapters, runtime, CLI, Panel controls, and full bindings are not shipped yet.
