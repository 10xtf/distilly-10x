# Code review

This is the review contract. The skill [.agents/skills/distilly-code-review/SKILL.md](../../.agents/skills/distilly-code-review/SKILL.md) is the walk, not a second standard.

Four standing rules: this is guidance, not a complete checklist; a short review with one substantiated blocker beats a list of nits; green gates do not prove prose or design; omit findings a passing gate already enforces.

A check this tree does not run is **out of scope for review**. If it is not in [docs/development.md](../development.md) or [design §24](../design/v2/24-governance-toolchain.md), do not require it: demanding evidence no command produces stops the diff without improving it.

## Before reading the diff

1. Query an explicit PR number or URL. A merge-blocking review requires `state=OPEN`; never let bare `gh pr view` select an old merged PR. Read the URL, live base branch/OID, head repository/branch, and exact remote head SHA from that metadata. A Distilly product PR normally targets `distilly`; maintenance of the published skill normally targets `dot-skill`.
2. Choose a remote matching the PR URL's base repository. Fetch its base and `pull/<number>/head` ref so fork PRs are included; do not assume a contributor's `origin` is the base repository. Verify both fetched OIDs against metadata and inspect that immutable range. Without PR metadata, require an explicit base instead of guessing.
3. After a retarget or merge, re-establish the base and re-read the new range.
4. Read enough surrounding code and the owning [design section](../design/README.md) to understand the change. The report of paths is not the review.

Prioritize correctness, lifecycle, security, secrets, and broken required behavior over style.

## Sources of truth

- Root [AGENTS.md](../../AGENTS.md)
- [docs/design/system-v2.md](../design/system-v2.md) and the chapter that owns the change
- [docs/architecture.md](../architecture.md) for what the live tree actually is
- [docs/AGENTS.md](../AGENTS.md) for placement and prose
- [docs/testing.md](../testing.md)
- [docs/process/defensive-patterns.md](defensive-patterns.md)
- [Agent Notes](../../.agents/notes/README.md) — disagreement with a note is a design discussion, not an automatic veto

## Blocking requirements

1. **New prose receives semantic review.** Every added or changed Markdown passage, docstring, comment, prompt, description, diagnostic, and visible string is checked for coverage, accuracy, placement, and editorial quality against the owning code or the design chapter. `verify_agent_notes.py` and compile do not establish those properties.
2. **Docs match the code.** Public behavior, config, defaults, errors, and on-disk fields update the owning README or design chapter in the same diff. Comments state non-obvious contracts. Flag implementation narration, test walkthroughs, review history, and duplicated rationale.
3. **Design corpus matches.** Product behavior must not contradict a locked item in [design §5.1](../design/v2/05-locked-and-open.md), and must not reopen an item frozen in §5.3 without a note. A departure needs a new Agent Note that names the alternative that lost, and an edit to the design parent. Closing an open item writes `closed YYYY-MM-DD`, lands the resolved rule in §5.1 or its owning chapter, and links the Agent Note.
4. **Required evidence exists.** The author ran the [narrowest checks](../development.md) that the diff can break. Review the semantic gaps those commands cannot see.
5. **The handoff is recoverable.** A completed PR fills the equivalent PR-template fields. Incomplete or transferred work includes the full handoff: base, HEAD, decisions, actual verification, unverified work, risk, workspace state, and the exact next action.

## Distilly-specific blockers

Flag as a blocker, not a nit:

- Growing top-level `work.md` / `persona.md` as the product split
- Fattening `Person` or the `distilly` root export with panel, marketplace, or adapter registry methods
- Merging `ingest` and `commit` into one verb (breaks the zero-key path)
- Writing a temporary persona into global `AGENTS.md`, `CLAUDE.md`, or `agent.md`
- Silent salience truncation or a host adapter that trims instead of failing closed
- `O(n²)` graph rebuild on `commit`
- A bot that invents its own persona files
- A collector that writes the fact layer itself, or a constructor that does network or credential I/O
- Putting profile state in a cloud database
- Shipping a required embedding or multimodal API key on the default path

TypeScript-era blockers, from [design §4](../design/v2/04-language-runtime.md), [§7](../design/v2/07-package-cut.md), and [§11](../design/v2/11-public-api.md):

- New product behavior written in Python, or added to frozen `tools/` instead of `packages/`
- A synchronous public method, or a sync twin of an async one
- Bare `string` where a branded id is required, or an error without its frozen `code`
- Runtime validation, a fallback branch, or a hostile-input test on a typed same-process call, when the value is not crossing one of the six boundaries in §11.5
- An upward or circular package dependency, such as the engine importing the facade or a shared type living outside `@distilly/protocol`
- A `switch` on a discriminant union that does not end in `assertNever`
- A dependency that needs a native prebuild, or SQLite holding a fact instead of a projection that `.index/` can lose

## Manual checks

- **Intent and interfaces:** both sides of every changed function or protocol. Errors, cancellation, ownership, and teardown match the PR and the design chapter.
- **Lifecycle:** credentials, subprocesses, temp dirs, and queues follow [defensive-patterns.md](defensive-patterns.md).
- **Consumer fit:** collection stays on `SourceAdapter`; injection stays on `HostInjector`; product verbs stay on `Distilly` / `Person`. A method whose only caller is one internal consumer does not belong on the public client.
- **Scope:** every new abstraction, option, and compatibility path has a current consumer. Speculative generality is out of scope.
- **Model perspective:** inspect the exact prompt, tool schema, result, or host instructions the model sees. Flag concepts outside the task. Stable projection text is asserted, not trusted from an agent report.
- **Enforcement:** follow every denial (confidence gate, host unsupported, adapter auth) to the operation that executes it. Alternate callers must not bypass it.
- **Fact vs index:** Markdown / jsonl remain reconstructable after deleting `.index/`.
- **Real entry path:** tests call the shipped CLI, module, or installer when that is what users run. A hand-wired helper is not the entry path.
- **Test strength:** assertions fail on the intended regression and check external state (files under a temp `DISTILLY_ROOT`, queue rows, version pointers). Coverage of a line is not evidence.
- **Implemented notes:** a PR that ships a `proposed/` note moves and rewrites it to present tense in the same diff.

## Reporting

State the defect, path, impact, and evidence. Put a local defect on the tightest diff range; use a PR-level comment for cross-cutting design. Separate blockers from suggestions. Do not restate a green gate. When receiving review, fix or rebut on technical grounds.
