# Agent Note: distilly product code is TypeScript

Status: proposed

## Problem

The approved v1 design specified the product in Python: `src/distilly/api.py`, synchronous signatures, and `models.py` living inside the client package. Three of the four faces the product must serve are Node hosts — the Claude Code plugin, the Codex plugin and its MCP App surface, and the later panel. Keeping the engine in Python forces the protocol to be written twice, and the two copies will drift on exactly the field names v1 promised to freeze. The Python signatures are also synchronous, which blocks a host event loop when the same calls run inside an MCP server.

Nothing has shipped yet: there is no `src/`, no product package, and no on-disk `~/.distilly/`. The cost of changing language is a design rewrite, not a migration of running code.

## Proposal

Product code is TypeScript. [docs/design/system-v2.md](../../../../docs/design/system-v2.md) is the new contract; [docs/design/system-v1.md](../../../../docs/design/system-v1.md) becomes deprecated history and is not edited to stay consistent. v2 is self-contained: it defines its own vocabulary, restates every language-neutral product conclusion, and lists every value type, so a first-time reader needs no other document. This note owns the language and structural decision; [2026-08-19-distilly-product.md](2026-08-19-distilly-product.md) keeps the product rules it locked, minus its Python layout.

Structural decisions that differ from v1, each with a reason:

- **`@distilly/protocol` owns the shared vocabulary** — branded ids, value types, method names, error codes, and the zod schemas. v1 put `models.py` in the client, which forced the engine to depend upward on its own consumer.
- **`distilly` is a facade package** holding `Distilly`, `Person`, and `openInProcess`. Swapping the in-process engine for a daemon changes one file. A separate thin client package would have had exactly one consumer, so it is not cut.
- **Every public method returns a `Promise`.** No synchronous twin. Synchronous fs inside an MCP server stalls the host.
- **Errors carry a frozen `code` union**, because the code is what survives a JSON-RPC or MCP hop; the class name does not.
- **Validation happens only at the six boundaries listed in design §11.5** — tool JSON, `commit` drafts, disk reads, config, adapter output, and future worker or daemon hops. Typed same-process calls get no defensive branches.
- **`node:sqlite` backs the queue and the graph projection.** Node ships it, so the index costs no native build. Retrieval still does not use it: the first version injects the whole profile.
- **Branded ids use a `unique symbol` brand**, so `SubjectId` cannot be passed where `VersionId` is required. Python could only ask review to catch that.

The three open items that blocked implementation are frozen in design §5.3: one signature each for `create` and `commit` with provenance derived by the engine rather than passed in; `correct` as a deterministic engine path that writes evidence and mints a version without calling a model; and `neighbors` served by a rebuildable SQLite projection over the append-only relations log.

The disk format, profile layering, claim evidence, version lineage, four faces, zero-key default, objective distillation, and relations-only graph are unchanged. Language does not touch them.

`EngineClient` gained one member after this note: [2026-08-19-interactive-faces-seam.md](2026-08-19-interactive-faces-seam.md) specifies the TUI and panel surfaces and adds a required `watch` subscription to the transport seam.

## Alternatives considered

- **Stay in Python (v1 as written)** — rejected: the plugin and panel need a second language anyway, so the protocol and its frozen field names would exist twice, with two gate suites maintained indefinitely.
- **Python engine behind a TypeScript plugin shell** — rejected: two sources of truth, and the cross-process protocol becomes a public contract in the first version, contradicting the locked decision that v1 runs in-process.
- **Rust or Go engine with a TypeScript shell** — rejected: distribution and host plugin ecosystems do not match, contributor cost rises, and the zero-native-dependency property from `node:sqlite` is lost.
- **Port only the MCP layer to TypeScript** — rejected: that layer is the thinnest one, so it does not repay a two-language repository, and `commit` validation must live on the same side as the engine.
- **Rewrite `prompts/` into TypeScript string constants** — rejected: the distillation prompts are text assets. The engine reads the files.
- **Delete the published Python skill now** — rejected: `dot-skill` has users. Retirement conditions are in design §25.3.
- **Keep both `@distilly/client` and a facade** — rejected: the client package's only consumer would be the facade.

## Acceptance criteria

- A host agent completes the six-step path with no API key: `create`, `ingest`, `pending`, `commit`, `get` / `prompt`, `correct`, with `corrections/` holding the evidence.
- `prompt()` text drops into a Claude sub-agent or Codex child instructions without writing any repository instruction file.
- Deleting `.index/` loses no memory: the queue rebuilds from each subject's `state.json` and material inventory, and `neighbors` rebuilds from `graph/relations.jsonl`.
- `neighbors` and `link` touch no full-log scan, and `commit` performs no all-pairs comparison.
- A confidence drop on `commit` leaves `current` in place until `promote`.
- `distilly migrate` converts a real legacy skill fixture into `subjects/` and refuses an unknown `meta.json` schema version by number.
- A new `SourceAdapter` or `HostInjector` registers without changing `Person`.
- Importing the built package entry — not the source — constructs an engine and reads a profile.

## Risks

- The repository is two languages until design §25.3 is satisfied. The mitigation is an expiry rule, not a permanent second lane: the legacy CI job is deleted, never disabled.
- OCR, transcription, and document parsing are stronger in Python. Parsers stay replaceable external processes, and unparsed material never enters distillation, so this stays outside the engine.
- Full-profile injection will hit context limits. The first version fails visibly instead of trimming silently.
- `zod` is a runtime dependency on the default path. If panel bundle size later makes it a problem, design §5.2 item K owns the re-evaluation.
- `node:sqlite` is young. It is confined to `.index/`, which is disposable, so a defect there cannot corrupt the fact layer.
- Contributors who only write Python can change `prompts/` and documentation until the migration completes.
- Renaming the GitHub repository and the `DISTILLY_*` environment variables is still open and will touch every install document.
