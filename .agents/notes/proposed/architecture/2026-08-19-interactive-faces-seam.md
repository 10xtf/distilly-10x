# Agent Note: reserve the watch and local Panel seam

Status: proposed

## Problem

V2 had four faces but only two of them were specified. The model tools, host plugin, and bot binding each got a chapter; the Panel got two sentences saying a tool returns a loopback URL, and a TUI was never mentioned. That left an unwritten interactive interface which the first product code would have guessed at.

The guess is expensive in one specific way. Everything specified so far is request/response: a call arrives, a result goes out, the process moves on. A TUI and a panel stay open while background work changes the same data underneath them, which is a property no existing face has. Serving that with the current surface leaves only polling — a directory walk per tick that reports "something changed" without saying what, so the screen can only redraw wholesale. Adding change notification later means changing `EngineClient`, and that is the single transport seam every face shares, so a late addition touches all of them at once.

Two smaller gaps follow from the same omission. The panel runs in a browser, so it is the first out-of-process caller, and nothing said what its transport or its authorization is — a local HTTP server that drives the engine is reachable by any process and any web page on the machine. And nothing said who owns the numbers a screen displays, which is how two interfaces end up reporting two different maturity values for the same subject.

## Proposal

V2 originally specified both surfaces and deferred both. [Design V3](2026-08-20-design-v3.md) supersedes that landing choice: [the local Panel](../../../../docs/design/v3/15-local-panel.md) is required in the first usable release because evidence and suspended candidates need a trustworthy product surface; TUI remains a later EngineClient consumer and gets no empty first-release package. The `watch`, aggregate ownership, loopback transport, and security decisions below are retained.

Panel and a future TUI read the same protocol-owned aggregates through EngineClient. Their rendering medium does not grant either a second fact path.

Decisions, each with the failure it prevents:

- **`EngineClient.watch` is a required member, and its events are re-read signals.** The payload locates a change (which subject, which version) and carries no profile content; the consumer re-reads. This is the same eventual-consistency rule the index already follows, so a display cannot become a second source of truth. Every event corresponds to a write that already landed on disk — no event exists for a state the fact layer does not have. `kind` is an extensible union, so a consumer that meets an unknown kind re-reads rather than crashing or discarding.
- **Required, not optional.** The in-process implementation emits after a successful commit and costs nearly nothing. An optional capability would make every consumer write the same "does this client support watch" branch.
- **The panel is `EngineClient` over loopback HTTP**, with `/rpc` carrying the identical method names and `/events` carrying `watch` as Server-Sent Events. No second protocol, and no second write path: the panel's writes reach the same `CommitService`, and it never touches files under `~/.distilly` directly.
- **Four panel-server refusals are security invariants, not configuration**: bind `127.0.0.1` only, require a per-run token, reject cross-site `Origin`, and exit when the port is taken instead of silently choosing another one — a silently moved port makes the address already printed to the user point somewhere else. `/rpc` input is validated as untrusted JSON at the same boundary as model input; being our own front end earns no exemption.
- **Interfaces render and never derive product facts.** Quality summary, maturity, and facet coverage are read from engine aggregates. A screen that computes its own completeness percentage gives the product a second answer to a question the engine already owns.
- **A screen's aggregate is an engine read method.** Any new aggregate enters the capability inventory and the facade first, then both interfaces consume it. There is no interface-only package to hold shared view logic, because such a package starts computing values and the two renderings then disagree.
- **The Panel is a deletable leaf.** Its server and web entries depend on protocol/EngineClient, and CLI supplies the local runtime and built assets. It never imports engine stores. A future TUI must follow the same rule when a real slice justifies the package.
- **No resident daemon.** The Panel server lives for the duration of its command; CLI, MCP, and Panel use actor-bound clients from one local runtime. V3 requires cross-process subject locking and recovery because those are now real writers, but a permanently resident service still adds lifecycle cost without changing the fact contract.

Landing order places in-process `watch` with the commit path, then ships the Panel with the first complete plugin slice. Protocol contract fixtures prove aggregates before the HTTP UI; a speculative TUI is not used as scaffolding.

The implemented Step 10 rationale lives in the [dedicated verified review and Panel feature Note](../../implemented/feature/2026-08-21-step-10-verified-review-and-panel.md).

## Alternatives considered

- **Leave the Panel at “a tool returns a URL”** — rejected: the first interactive caller would either poll or reach into the engine, and both are far more expensive to undo than to specify.
- **Polling instead of `watch`** — rejected: it costs a directory walk per tick, cannot say what changed, and its interval becomes a tunable that is wrong on both sides — too slow to feel live, too fast to be cheap.
- **Make `watch` an optional capability on `EngineClient`** — rejected: every consumer would carry a capability check, and the in-process implementation is nearly free, so the branch buys nothing.
- **Put profile content in the event payload** — rejected: the payload becomes a second copy of state that can disagree with disk, and it grows the transport for every subscriber whether or not the screen is showing that subject.
- **A `@distilly/view` package with shared view models** — rejected: shared *types* already belong in protocol, and a package for shared view *logic* would start deriving numbers, which is exactly the divergence the render-only rule prevents.
- **Build a TUI first only to prove aggregates** — rejected by V3: protocol and integration fixtures prove the contract without adding a product surface that does not enter first-release acceptance.
- **A resident daemon serving CLI and Panel from day one** — rejected: subject locks and recovery are required regardless, while a permanent service adds startup, upgrade, and ownership failure modes the foreground local runtime does not need.
- **Serve the panel from the panel package's own binary** — rejected: two executables to install, and the server is a thin layer over `EngineClient` that belongs with the other entry points.
- **Skip the token because the server binds loopback** — rejected: loopback stops remote hosts, not other local processes and not a malicious page in the user's browser, which can post to `127.0.0.1` freely.
- **Append the chapter at the end to avoid renumbering** — rejected: delivery surfaces belong together, and agents load this contract by chapter, so a misfiled chapter costs more over time than a mechanical renumber the link gate verifies.

## Acceptance criteria

- `EngineClient.watch` returns an unsubscribe function, and every emitted event corresponds to a write already present in lineage or queue state.
- A consumer handling an unrecognized event kind re-reads instead of throwing, proven by a test that emits a kind the consumer does not know.
- The panel server refuses a request with no token, a wrong token, and a cross-site `Origin`, and exits non-zero when the port is occupied — four tests, each observed red before it passes.
- A panel write and the equivalent CLI write produce the same version and the same lineage entry, because both pass through one commit path.
- Panel server and web do not import engine stores; the dependency gate fails when that is violated.
- Every value the Panel displays is traceable to an EngineMethodMap result; the Panel computes no quality, maturity, coverage, or review reason of its own.
- Deleting `@distilly/panel` leaves core engine, runtime, SDK, and protocol compiling; the first usable plugin release itself still requires Panel acceptance.

## Risks

- The Panel adds real first-release scope. V3 limits it to Library, Subject, Review, and Settings/Doctor over existing MethodMap aggregates; TUI and remote Discover stay out until a real slice exists.
- A required `watch` obliges every future transport to carry a subscription. Server-Sent Events covers the HTTP case, and a transport that genuinely cannot subscribe would be a new locked-item argument, not a silent fallback.
- Event volume during a batch distillation could flood a subscriber. Because events are re-read signals with no content, a consumer may coalesce them per subject; that is a consumer concern and needs no engine-side buffering yet.
- The token lives in a URL fragment, which keeps it out of server logs and the `Referer` header but leaves it in the user's browser history on that machine. It is per-run, so a stale token authorizes nothing.
- V2 chapter numbers remain historical; current authority links are mapped by topic to V3, and the link gate covers every repository reference.
