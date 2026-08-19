# AGENTS.md — Documentation standard

Use [distilly-doc-standards](../.agents/skills/distilly-doc-standards/SKILL.md) for placement workflow. Rationale lives in the [governance Agent Note](../.agents/notes/implemented/process/2026-08-19-agent-governance.md) and the [design-corpus note](../.agents/notes/implemented/process/2026-08-19-design-corpus-and-code-review.md).

## Structure

A document owns full detail about its own subject. Direct children are summarized by purpose and high-level behavior, then linked. Classify each human-facing standing doc as a tutorial (ordered path to an outcome) or a reference (lookup, no teaching sequence).

The [design corpus](design/system-v2.md) is the product contract. It is allowed to stay long. Do not compress it back into architecture.md. Its deprecated predecessor stays in place unedited; superseding a design means writing the next one, not rewriting history.

Agent Notes sit outside this structural contract. They have their own [format](../.agents/notes/README.md).

## One home per fact

| Tier | Job | Does not belong there |
|---|---|---|
| Root `AGENTS.md` | Standing orders, one to three lines each | Stories, SDK signatures, host pitfalls |
| This file | Doc rules for `docs/` | Repo-wide coding conventions already in the root file |
| [docs/README.md](README.md) | Folder map | Spec text |
| [architecture.md](architecture.md) | Live tree: what the published code does *now* | Locked design, SDK signatures, rejected alternatives |
| [design/system-v2.md](design/system-v2.md) | In-force contract: TypeScript product and gate lifecycle | Live-tree status, cookbook steps |
| [design/v2/](design/v2/) | Generated topic projections of the parent | Hand edits or a second wording |
| [design/system-v1.md](design/system-v1.md), [design/v1/](design/v1/) | Deprecated history: which alternative lost, and why | Anything an implementer should follow today |
| [development.md](development.md) | Setup and which checks to run | Runtime design |
| [testing.md](testing.md) | What a green test must prove | Product verbs |
| [cookbook/](cookbook/README.md) | Shipped, executable how-tos with verify steps | Target-only APIs or design rationale |
| [process/code-review.md](process/code-review.md) | Review contract | How to invoke the skill |
| Agent Notes | Why, alternatives, verification | Current API catalogs |
| Tool / package README | Local contract | Restating the design corpus |

## Writing rules

- Current-state standing docs (`architecture.md`, cookbooks, and user READMEs) document shipped behavior. Root `AGENTS.md` may also carry explicitly labeled target implementation invariants that link to the design; those labels must not imply the APIs are available.
- The design corpus may keep conversation density, including what was rejected. Do not rewrite it into a slogan.
- Never edit a `design/v*/` chapter directly. Edit its parent `system-v*.md`, then run `python3 scripts/sync_design_chapters.py`. Adding a corpus means adding a `Corpus` entry in that script, not a hand-written folder.
- One physical line per paragraph in standing docs. Use editor soft wrap.
- Link repository files with relative Markdown paths.
- Comments and JSDoc state contracts (behavior, failure, ownership), not reasoning transcripts.
- Changes to governed paths ship an Agent Note in the same PR; the semantic exception for otherwise exempt paths is defined in [.agents/notes/README.md](../.agents/notes/README.md).
- Run `python3 -B scripts/verify_docs.py` after Markdown changes. It checks local links, portable syntax, trailing newlines, and generated chapters.

## Length

Keep root `AGENTS.md` and this file short enough to load in every session. The design corpus has no standing word budget. Do not shorten it to fit a session.
