# Agent Note: distilly product code is TypeScript

Status: proposed

## Problem

The approved v1 design specified the product in Python: `src/distilly/api.py`, synchronous signatures, and `models.py` living inside the client package. Three of the four faces the product must serve are Node hosts — the Claude Code plugin, the Codex plugin and its MCP App surface, and the later panel. Keeping the engine in Python forces the protocol to be written twice, and the two copies will drift on exactly the field names v1 promised to freeze. The Python signatures are also synchronous, which blocks a host event loop when the same calls run inside an MCP server.

There was no runnable user product or `~/.distilly/` installation when this language decision was made. The TypeScript workspace could therefore replace the unshipped Python product design without migrating user data or preserving two production implementations.

## Proposal

Product code is TypeScript. V2 first introduced that contract and deprecated V1; [docs/design/system-v3.md](../../../../docs/design/system-v3.md) now inherits the language decision and is the in-force product contract. [docs/design/system-v2.md](../../../../docs/design/system-v2.md) and [docs/design/system-v1.md](../../../../docs/design/system-v1.md) remain deprecated history. This note owns the language decision; [2026-08-19-distilly-product.md](2026-08-19-distilly-product.md) keeps the product rules, [the V3 note](2026-08-20-design-v3.md) owns later workflow/package refinements, and [the storage authority note](../../implemented/simplification/2026-08-21-single-writer-sqlite-storage-authority.md) owns persistence.

Structural decisions that differ from v1, each with a reason:

- **`@distilly/protocol` owns the shared vocabulary** — branded ids, value types, method names, error codes, and the zod schemas. v1 put `models.py` in the client, which forced the engine to depend upward on its own consumer.
- **`distilly` is a facade package** whose browser-safe root holds `Distilly` and `Person` over an injected `EngineClient`; the future Node composition entry connects to the local Engine service only after a complete runtime exists. A separate thin client package would have had exactly one consumer, so it is not cut.
- **Every public I/O operation returns a `Promise`.** No synchronous twin. Pure `person()` handle construction is the explicit exception; synchronous fs inside an MCP server still stalls the host.
- **Errors carry a frozen `code` union**, because the code is what survives a JSON-RPC or MCP hop; the class name does not.
- **Validation happens only at the eight boundaries listed in V3 design §7.6** — model/RPC input, ingest, brief/commit, claim patch, disk, config, and extension/bundle input. Typed same-process calls get no defensive branches.
- **Branded ids use a `unique symbol` brand**, so `SubjectId` cannot be passed where `VersionId` is required. Python could only ask review to catch that.

V2 froze the three open items that then blocked implementation. V3 supersedes their concrete wire shape without reversing the language decision: create is the discriminated target of atomic ingest, commit accepts only a claim patch after briefing, correction calls no model and MCP-relayed corrections suspend for confirmation, and relations are an additive post-core method extension over a rebuildable graph projection.

Profile layering, claim evidence, version lineage, zero-extra-key default, and the relations-only graph remain. V3 intentionally changes the not-yet-shipped material digest, version transaction, host workflow, and package composition; those changes are owned by the V3 Note, not by this language decision.

`EngineClient` gained one member after this note: [2026-08-19-interactive-faces-seam.md](2026-08-19-interactive-faces-seam.md) specifies the TUI and panel surfaces and adds a required `watch` subscription to the transport seam.

## Alternatives considered

- **Stay in Python (v1 as written)** — rejected: the plugin and panel need a second language anyway, so the protocol and its frozen field names would exist twice, with two gate suites maintained indefinitely.
- **Python engine behind a TypeScript plugin shell** — rejected: it creates two sources of truth and makes every shared product value cross a second language boundary.
- **Rust or Go engine with a TypeScript shell** — rejected: distribution and host plugin ecosystems do not match, while contributor and FFI/RPC cost rises without a demonstrated need.
- **Port only the MCP layer to TypeScript** — rejected: that layer is the thinnest one, so it does not repay a two-language repository, and `commit` validation must live on the same side as the engine.
- **Rewrite `prompts/` into TypeScript string constants** — rejected: the distillation prompts are text assets. The engine reads the files.
- **Delete the published Python skill now** — rejected: `dot-skill` has users. Retirement conditions are in V3 design §28.6.
- **Keep both `@distilly/client` and a facade** — rejected: the client package's only consumer would be the facade.

## Acceptance criteria

- A host agent completes the no-extra-key path through the five MCP tools: resolve, atomic ingest/create, pending brief, claim-only commit, get, and correction.
- `prompt()` text drops into a Claude sub-agent or Codex child instructions without writing any repository instruction file.
- Deleting a rebuildable projection loses no semantic state, and relation lookup does not require an all-history scan.
- `neighbors` and `link` touch no full-log scan, and `commit` performs no all-pairs comparison.
- A mechanically risky candidate leaves `current` in place until `promote`.
- `distilly migrate` converts a real published legacy-skill fixture through the confirmed import path and refuses an unknown source schema/version instead of guessing.
- A new `SourceAdapter` or `HostBinding` registers without changing `Person`.
- Importing the built package entry — not the source — constructs an engine and reads a profile.

## Risks

- The repository is two languages until V3 design §28.6 is satisfied. The mitigation is an expiry rule, not a permanent second lane: the legacy CI job is deleted, never disabled.
- OCR, transcription, and document parsing are stronger in Python. Parsers stay replaceable external processes, and unparsed material never enters distillation, so this stays outside the engine.
- Full-profile injection will hit context limits. The first version fails visibly instead of trimming silently.
- `zod` is a runtime dependency on the protocol boundaries. If bundle size later becomes a measured problem, changing that choice requires a new owned design decision rather than an untracked exception.
- Contributors who only write Python can change `prompts/` and documentation until the migration completes.
- Renaming the GitHub repository and the `DISTILLY_*` environment variables is still open and will touch every install document.
