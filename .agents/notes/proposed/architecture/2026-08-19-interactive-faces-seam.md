# Agent Note: reserve the TUI and panel seam before either is built

Status: proposed

## Problem

The design has four faces but only two of them were specified. The model tools, the host plugin, and the bot binding each got a chapter; the panel got two sentences saying a tool returns a loopback URL, and a TUI was never mentioned at all. Both are planned surfaces, so the gap is not "we decided against them" — it is an unwritten interface that the first product code would guess at.

The guess is expensive in one specific way. Everything specified so far is request/response: a call arrives, a result goes out, the process moves on. A TUI and a panel stay open while background work changes the same data underneath them, which is a property no existing face has. Serving that with the current surface leaves only polling — a directory walk per tick that reports "something changed" without saying what, so the screen can only redraw wholesale. Adding change notification later means changing `EngineClient`, and that is the single transport seam every face shares, so a late addition touches all of them at once.

Two smaller gaps follow from the same omission. The panel runs in a browser, so it is the first out-of-process caller, and nothing said what its transport or its authorization is — a local HTTP server that drives the engine is reachable by any process and any web page on the machine. And nothing said who owns the numbers a screen displays, which is how two interfaces end up reporting two different maturity values for the same subject.

## Proposal

Specify both surfaces now and build neither yet. [design §16](../../../../docs/design/v2/16-interactive-faces.md) is the new chapter; §16 through §25 shifted up one number, and the chapter projections, entry documents, and the generator's name list moved with them.

The TUI and the panel are two renderings of the **third** face, not a fifth one. They read the same aggregates over the same transport seam and differ only in rendering medium and process boundary, so design §5.1 item 10 still counts four faces.

Decisions, each with the failure it prevents:

- **`EngineClient.watch` is a required member, and its events are re-read signals.** The payload locates a change (which subject, which version) and carries no profile content; the consumer re-reads. This is the same eventual-consistency rule the index already follows, so a display cannot become a second source of truth. Every event corresponds to a write that already landed on disk — no event exists for a state the fact layer does not have. `kind` is an extensible union, so a consumer that meets an unknown kind re-reads rather than crashing or discarding.
- **Required, not optional.** The in-process implementation emits after a successful commit and costs nearly nothing. An optional capability would make every consumer write the same "does this client support watch" branch.
- **The panel is `EngineClient` over loopback HTTP**, with `/rpc` carrying the identical method names and `/events` carrying `watch` as Server-Sent Events. No second protocol, and no second write path: the panel's writes reach the same `CommitService`, and it never touches files under `~/.distilly` directly.
- **Four panel-server refusals are security invariants, not configuration**: bind `127.0.0.1` only, require a per-run token, reject cross-site `Origin`, and exit when the port is taken instead of silently choosing another one — a silently moved port makes the address already printed to the user point somewhere else. `/rpc` input is validated as untrusted JSON at the same boundary as model input; being our own front end earns no exemption.
- **Interfaces render and never derive product facts.** Confidence, maturity, and facet coverage are read from `SubjectStatus`. A screen that computes its own completeness percentage gives the product a second answer to a question the engine already owns.
- **A screen's aggregate is an engine read method.** Any new aggregate enters the capability inventory and the facade first, then both interfaces consume it. There is no interface-only package to hold shared view logic, because such a package starts computing values and the two renderings then disagree.
- **Both interface packages are deletable leaves.** `@distilly/tui` depends on the facade, `@distilly/panel` depends only on protocol types and speaks HTTP at runtime, and `@distilly/cli` hosts the panel server without depending on the panel's build output: missing assets fail loudly with an install instruction rather than serving a blank page. Neither may import `@distilly/engine`, which the undeclared-dependency gate enforces mechanically rather than leaving to review.
- **No resident daemon.** The panel server lives for the duration of its command; the CLI keeps connecting in-process. Concurrent writers need locking and orphan recovery, which the queue already solved once — that work waits for a real second writer. This closes the open item that asked whether the panel and CLI share a daemon.

Landing order places the in-process `watch` with the commit path, because it derives from the same write, and puts the TUI before the panel so the browsing aggregates are proven by a local caller before an HTTP transport exists.

## Alternatives considered

- **Leave the panel at "a tool returns a URL" and skip the TUI** — rejected: that is what created this gap. The first interactive caller would either poll or reach into the engine, and both are far more expensive to undo than to specify.
- **Polling instead of `watch`** — rejected: it costs a directory walk per tick, cannot say what changed, and its interval becomes a tunable that is wrong on both sides — too slow to feel live, too fast to be cheap.
- **Make `watch` an optional capability on `EngineClient`** — rejected: every consumer would carry a capability check, and the in-process implementation is nearly free, so the branch buys nothing.
- **Put profile content in the event payload** — rejected: the payload becomes a second copy of state that can disagree with disk, and it grows the transport for every subscriber whether or not the screen is showing that subject.
- **A `@distilly/view` package with shared view models** — rejected: shared *types* already belong in protocol, and a package for shared view *logic* would start deriving numbers, which is exactly the divergence the render-only rule prevents.
- **Let the TUI call `@distilly/engine` directly to avoid facade round-trips** — rejected: it skips the validation boundary and the aggregate ownership rule, and the round-trip is in-process anyway.
- **A resident daemon serving both CLI and panel from day one** — rejected: it buys nothing until two clients write concurrently, and it brings locking, orphan recovery, and lifecycle management that nothing yet needs.
- **Serve the panel from the panel package's own binary** — rejected: two executables to install, and the server is a thin layer over `EngineClient` that belongs with the other entry points.
- **Skip the token because the server binds loopback** — rejected: loopback stops remote hosts, not other local processes and not a malicious page in the user's browser, which can post to `127.0.0.1` freely.
- **Append the chapter at the end to avoid renumbering** — rejected: delivery surfaces belong together, and agents load this contract by chapter, so a misfiled chapter costs more over time than a mechanical renumber the link gate verifies.

## Acceptance criteria

- `EngineClient.watch` returns an unsubscribe function, and every emitted event corresponds to a write already present in lineage or queue state.
- A consumer handling an unrecognized event kind re-reads instead of throwing, proven by a test that emits a kind the consumer does not know.
- The panel server refuses a request with no token, a wrong token, and a cross-site `Origin`, and exits non-zero when the port is occupied — four tests, each observed red before it passes.
- A panel write and the equivalent CLI write produce the same version and the same lineage entry, because both pass through one commit path.
- No interface package appears in another package's dependency graph, and neither imports `@distilly/engine`; the undeclared-dependency gate fails when that is violated.
- Every value the TUI displays is traceable to a field the engine returned; the TUI computes no confidence, maturity, or coverage of its own.
- Deleting `@distilly/tui` and `@distilly/panel` leaves the workspace compiling and every remaining test passing.

## Risks

- Specifying two unbuilt surfaces risks designing for imagined needs. The mitigation is that only one interface member is added now — `watch`, which the commit path can emit for free — while the TUI screens and the panel server stay unbuilt and their open items (terminal library, who opens the URL) are recorded rather than guessed.
- A required `watch` obliges every future transport to carry a subscription. Server-Sent Events covers the HTTP case, and a transport that genuinely cannot subscribe would be a new locked-item argument, not a silent fallback.
- Event volume during a batch distillation could flood a subscriber. Because events are re-read signals with no content, a consumer may coalesce them per subject; that is a consumer concern and needs no engine-side buffering yet.
- The token lives in a URL fragment, which keeps it out of server logs and the `Referer` header but leaves it in the user's browser history on that machine. It is per-run, so a stale token authorizes nothing.
- Renumbering ten chapters invalidates any external link to the old numbers. The link gate covers everything in the repository; anything outside it is not a specification source.
