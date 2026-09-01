# Development

## Clone and branch

```sh
git clone https://github.com/titanwings/colleague-skill.git
cd colleague-skill
git checkout distilly   # product path; default published branch remains dot-skill
python3 -m pip install -r requirements.txt
python3 -m pip install -r requirements-dev.txt
corepack enable
pnpm install --frozen-lockfile
```

Product implementation reads [design/README.md](design/README.md) before code. The design is the target contract; [architecture.md](architecture.md) records what is shipped.

Python 3.9+ remains required for the published skill and repository governance. The TypeScript product requires Node `^22.19 || ^24`; Corepack reads the pinned package manager from `package.json`, and `pnpm install --frozen-lockfile` installs exactly the committed lock. The workspace contains the Protocol, SQLite Preview authority and verified reads, opt-in Engine/Runtime, injected Facade/MCP/Panel leaves, verified capability plus full Codex/Claude Code bindings, canonical skill assembly, and an explicit private `@distilly/cli/preview` outer graph over a real local root. The `0.1.0-preview.1` Codex-first assembler bundles only production output, the prompt, Panel assets, release/Codex manifests, and canonical Skill into a self-contained digest-owned directory with no source, workspace dependency, symlink, test fake, or sentinel. Setup copies that exact runtime into `~/.distilly/runtime/0.1.0-preview.1/`, writes an absolute launcher, serves exactly five MCP tools, and lazily opens the real Panel; deleting the unpacked bootstrap does not break doctor, MCP, person installation, or uninstall. The Panel promotes, rejects, and rolls back against the same SQLite root without requiring deep Doctor. `distilly install <subject-id> --host codex` is the explicit human surface over the existing `Person.install` path; Plugin uninstall preserves both person data and separately installed person Skills. The release-bound capacity evidence was regenerated through real Codex 0.146.0, and a fresh Codex process can discover both the Plugin Skill and a persistent person Skill without a model call. Claude Code remains disabled until it has equivalent evidence and packaged acceptance. The stable CLI root remains empty, and there is still no authenticated cross-process attach, upgrade, production deep Doctor, or published product ([design §27](design/v3/27-testing-and-governance.md)).

Optional local hooks run only cheap deterministic checks. Enable the tracked hook for this clone with `git config core.hooksPath .githooks`. On a feature branch, resolve the PR base from the base repository and record its exact metadata SHA with `git config branch.<branch>.distillyBase <baseRefOid>`; a fork's `origin` is not automatically the base repository. The hook requires a clean, checked-out local head and rejects multi-branch pushes, persistent-branch deletion, and non-fast-forward updates; push another branch separately from its own clean checkout. CI remains authoritative because Git cannot force contributors to install a hook.

## Daily checks

Match the check to the change. Do not default to the full suite.

| Surface | Command |
|---|---|
| Markdown or generated design chapters | `python3 -B scripts/verify_docs.py` |
| Agent Notes | `python3 -B scripts/verify_agent_notes.py` |
| Governed feature / PR diff | `python3 -B scripts/verify_agent_notes.py --base <resolved-base-sha> --head <exact-head-sha> --range-mode merge-base` (requires a newly added or lifecycle-renamed feature Note) |
| Python tools or governance scripts | `python3 -m compileall -q tools scripts tests`, `ruff check tools scripts tests`, and the owning `tests/test_*.py` |
| Behavior of a collector or writer | the unittest that would fail if that behavior regressed |
| TypeScript formatting or lint | `pnpm run gates:fast` |
| TypeScript signatures | `pnpm run typecheck` |
| Protocol behavior | `pnpm run test` or the narrow owning Vitest file |
| Source-adapter contracts and direct-user collection schemas | `pnpm exec vitest run packages/adapters/src` |
| Engine SQLite create/ingest/pending/brief/lease/commit/review/rollback/correction and Preview verified reads, plus retained legacy regression behavior | `pnpm exec vitest run packages/engine/src` |
| Injected `Distilly` / `Person` facade mappings | `pnpm exec vitest run packages/distilly/src` |
| Five-tool MCP mappings and lifecycle | `pnpm exec vitest run packages/mcp/src` |
| Real Preview Facade/MCP/Panel composition, Chromium review actions, person projections, and reopen | `pnpm exec vitest run packages/cli/src/preview.test.ts`; set `DISTILLY_VERIFY_CODEX_DISCOVERY` to a real Codex executable for the opt-in fresh-process discovery check; after build, `pnpm --filter @distilly/cli run smoke:built` |
| Self-contained Codex Preview package | `pnpm run package:preview:codex`; with real Codex 0.146.0, `pnpm --filter @distilly/cli run verify:package:codex --package <absolute-artifact-path> --codex <absolute-codex-path>` |
| Codex/Claude capability and full bindings | `pnpm exec vitest run packages/bindings/src` |
| Panel loopback server, browser client, and launcher | `pnpm run test:panel-http` |
| Built Panel web app in real Chromium | `pnpm run test:panel-browser` |
| Package dependency direction and cycles | `pnpm run test:boundaries`, `pnpm run check:boundaries` |
| Canonical skill and plugin release assembly | `pnpm run test:plugins`, `pnpm run check:plugins` |
| TypeScript coverage report | `pnpm run test:coverage` |
| Protocol public snapshot | `pnpm run snapshots` |
| Built package or export map | `pnpm run build`, then `pnpm run hygiene` |
| Full local gate aggregation | `pnpm run gates` |
| Outgoing product PR | [distilly-code-review](../.agents/skills/distilly-code-review/SKILL.md) against [process/code-review.md](process/code-review.md) |

Before push, follow [.agents/skills/distilly-pre-push-checks/SKILL.md](../.agents/skills/distilly-pre-push-checks/SKILL.md).

## Feature commit boundary

1. Name one reviewable feature or bug fix and its acceptance checks before coding. Give it one concise dedicated Agent Note; aggregate Notes may link to that owner but do not absorb its detailed decisions. If the slice cannot fit one independently understandable commit, split the feature boundary now rather than later by file.
2. Finish that feature's implementation, tests, generated artifacts, current-state documentation, and dedicated Agent Note. Subagents leave their contributions in the shared worktree for the coordinating/root agent; they do not create partial commits.
3. Collect and integrate every contribution for the feature, including problems found before the next independent feature begins.
4. Run the checks that can fail for the complete feature, then move its Note to `implemented` when the feature is complete.
5. Stage only that feature, review `git diff --cached --stat`, `git diff --cached`, and `git diff --cached --check`, then create one local feature commit. Do not create checkpoint, WIP, fixup, or contribution-by-contribution history.
6. Begin another independent feature only after the previous feature commit exists. Local commits need no additional permission; push, PR, and publication remain opt-in.

CI on `dot-skill`, `distilly`, and `main` runs governance once; frozen install, fast gates, typecheck, tests, coverage, snapshots, build, and package hygiene on Node 22.19/24 across Linux and macOS; compile and `python -B scripts/run_tests.py` on Python 3.9/3.11; and Ruff. Missing tests are an error, not a successful skip. CI becomes a merge/push gate only when the base repository has the [required branch protection](cookbook/protecting-governed-branches.md); otherwise it is post-push detection.

GitHub loads community PR templates from the default branch. Shared discovery files such as root `AGENTS.md` and `.github/PULL_REQUEST_TEMPLATE.md` must land on the default `dot-skill` branch as well as the branch that consumes them; a `distilly`-only copy does not change the new-PR form.

## Verify the diff base

Never assume `origin/dot-skill`, and do not use one head definition for two different jobs.

- **Before push:** the outgoing head is local `git rev-parse HEAD`, including commits the remote PR cannot see yet. Query an explicit PR number/URL and use its metadata only when `state=OPEN`, its head branch/repository matches the checkout and push destination, and its base repository is verified; never reuse a merged PR selected by bare `gh pr view`. Resolve the configured remote base or explicit base SHA before running the Note and whitespace gates. Keep the checkout clean so tree gates and the outgoing commit are the same tree.
- **PR review:** read the PR URL, base ref/OID, and exact remote head SHA from current PR metadata. Fetch the base and `pull/<number>/head` from a remote matching the base repository, not blindly from `origin`; verify both fetched OIDs, then review that immutable range. Re-establish both after a retarget or new push.
- **No PR:** require an explicit remote base or exact SHA. Only a direct push to `distilly`, `dot-skill`, or `main` uses that branch's existing remote tip as its outgoing base.

Feature/PR comparisons use the merge-base range. A direct persistent-branch push compares the old and new snapshots with `--range-mode direct`; this still sees governed deletions during a rewind.

The governed-diff Note gate covers product and governance paths listed in [.agents/notes/README.md](../.agents/notes/README.md). Tests-only, translations, and assets do not trigger it. A semantic reviewer still decides whether an otherwise exempt change introduced a shared decision.

## Docs-first

1. Search `.agents/notes/` for decisions the feature extends or supersedes, then give the new reviewable feature its own Note and cross-link the earlier owner when useful.
2. Unbuilt or incomplete work starts in `proposed/`; do not append its implementation details to an aggregate Note.
3. After the feature and its gates are complete, move its Note to `implemented/` in the same feature commit and use present tense.
4. Standing docs state what is true now. Rationale stays in the dedicated Note; task progress stays out of Notes.

## Agent Handoff

Before pausing or changing agents, leave this full handoff in the task response, PR description, or PR comment. For a completed PR, the equivalent fields in the repository PR template are the handoff. An incomplete or transferred PR includes the full form below. Do not commit one scratch handoff per task: decisions belong in Agent Notes and current behavior belongs in standing docs.

```markdown
## Agent Handoff

### Identity
- Repository and branch:
- Base repository/remote, ref, and resolved metadata SHA:
- Local outgoing HEAD SHA or remote review head SHA:
- Task / issue / PR:
- Status: complete | in progress | blocked

### Objective and acceptance
- Objective:
- Acceptance criteria:
- Explicit non-goals:

### Authority read
- Root and local AGENTS:
- Design, architecture, and Agent Note owners:

### Completed work
- Behavior and files changed:
- Decisions made and their durable owner:

### Verification
| Command or check | Result | What it proves |
|---|---|---|
| `...` | PASS / FAIL / PENDING | ... |

### Not verified
- Check, reason, and expected owner (local / CI / reviewer / user):

### Workspace state
- Clean / staged / unstaged / untracked:
- Pre-existing user changes to preserve:

### Remaining work
1. Exact next action, or `None`:
2. Files or symbols to open first:

### Risks and review focus
- Known uncertainty, compatibility, migration, security, or data risk:
- What the reviewer should inspect:

### Do not redo / external state
- Completed evidence and rejected alternatives already recorded:
- Remote branch, CI, reviews, and required user decision:
```

A successful handoff lets the next agent recover the exact repo, base, objective, evidence, dirty-tree ownership, and next executable action without reading the previous chat. Never include credentials or personal data.

## Layout for new work

Product code goes in the `packages/` workspaces named in [design §25](design/v3/25-package-and-source-tree.md): `@distilly/protocol`, `@distilly/engine`, `@distilly/runtime`, `@distilly/adapters`, `@distilly/bindings`, `@distilly/mcp`, `@distilly/panel`, `@distilly/cli`, and the `distilly` facade. The dependency direction is one-way: engine, bindings, adapters, facade, MCP, and Panel web depend on protocol; Panel server additionally depends on MCP's narrow ReviewPresenter type. The current Preview Runtime composes Protocol, Engine, Adapters, and one caller-selected full Binding; CLI is the outer composition and may depend on bindings, runtime, facade, MCP, and Panel. A shared wire type belongs in protocol, not whichever package needed it first.

The workspace, its gates, Protocol, SQLite create/text-and-file-ingest/distill/review/correction/host-operation authority and Preview reads, explicit in-process Engine/LocalRuntime, injected Facade/MCP/Panel leaves, full host bindings/injectors, canonical plugin source, and repo-local CLI lifecycle are implemented locally. The CLI currently wires Codex to one verified absolute launcher and starts the real five-tool graph over `~/.distilly`; temporary Profile use and explicit person-Skill install/export/uninstall are live, and Plugin uninstall preserves both the data root and separately installed person Skills. Claude Code's binding remains a tested leaf but is not active in the CLI until matching host evidence is recorded. The superseded file paths remain isolated regression surfaces. A complete cross-process service, remaining methods, self-contained packaged runtime, upgrade/deep doctor, and packaged fresh-install acceptance remain target work; do not infer them from the repo-local Preview.
