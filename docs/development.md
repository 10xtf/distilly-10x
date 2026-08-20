# Development

## Clone and branch

```sh
git clone https://github.com/titanwings/colleague-skill.git
cd colleague-skill
git checkout distilly   # product path; default published branch remains dot-skill
python3 -m pip install -r requirements.txt
python3 -m pip install -r requirements-dev.txt
```

Product implementation reads [design/README.md](design/README.md) before code. The design is the target contract; [architecture.md](architecture.md) records what is shipped.

Python 3.9+ is required for the tooling that exists today. The TypeScript product targets Node `^22.19 || ^24`; its workspace and toolchain are not shipped in this design-only state, and [design §27](design/v3/27-testing-and-governance.md) owns the future gate contract.

Optional local hooks run only cheap deterministic checks. Enable the tracked hook for this clone with `git config core.hooksPath .githooks`. On a feature branch, resolve the PR base from the base repository and record its exact metadata SHA with `git config branch.<branch>.distillyBase <baseRefOid>`; a fork's `origin` is not automatically the base repository. The hook requires a clean, checked-out local head and rejects multi-branch pushes, persistent-branch deletion, and non-fast-forward updates; push another branch separately from its own clean checkout. CI remains authoritative because Git cannot force contributors to install a hook.

## Daily checks

Match the check to the change. Do not default to the full suite.

| Surface | Command |
|---|---|
| Markdown or generated design chapters | `python3 -B scripts/verify_docs.py` |
| Agent Notes | `python3 -B scripts/verify_agent_notes.py` |
| Governed feature / PR diff | `python3 -B scripts/verify_agent_notes.py --base <resolved-base-sha> --head <exact-head-sha> --range-mode merge-base` |
| Python tools or governance scripts | `python3 -m compileall -q tools scripts tests`, `ruff check tools scripts tests`, and the owning `tests/test_*.py` |
| Behavior of a collector or writer | the unittest that would fail if that behavior regressed |
| Outgoing product PR | [distilly-code-review](../.agents/skills/distilly-code-review/SKILL.md) against [process/code-review.md](process/code-review.md) |

Before push, follow [.agents/skills/distilly-pre-push-checks/SKILL.md](../.agents/skills/distilly-pre-push-checks/SKILL.md).

## Feature commit boundary

1. Name one reviewable feature or bug fix and its acceptance checks before coding. If it cannot fit one independently understandable commit, split the feature boundary now rather than later by file.
2. Finish that feature's implementation, tests, generated artifacts, current-state documentation, and required Agent Note changes. Subagents leave their contributions in the shared worktree for the coordinating/root agent; they do not create partial commits.
3. Collect and integrate every contribution for the feature, including problems found before the next independent feature begins.
4. Run the checks that can fail for the complete feature.
5. Stage only that feature, review `git diff --cached --stat`, `git diff --cached`, and `git diff --cached --check`, then create one local feature commit. Do not create checkpoint, WIP, fixup, or contribution-by-contribution history.
6. Begin another independent feature only after the previous feature commit exists. Local commits need no additional permission; push, PR, and publication remain opt-in.

CI on `dot-skill`, `distilly`, and `main` runs governance once, compile and `python -B scripts/run_tests.py` on Python 3.9/3.11, and Ruff. Missing tests are an error, not a successful skip. CI becomes a merge/push gate only when the base repository has the [required branch protection](cookbook/protecting-governed-branches.md); otherwise it is post-push detection.

GitHub loads community PR templates from the default branch. Shared discovery files such as root `AGENTS.md` and `.github/PULL_REQUEST_TEMPLATE.md` must land on the default `dot-skill` branch as well as the branch that consumes them; a `distilly`-only copy does not change the new-PR form.

## Verify the diff base

Never assume `origin/dot-skill`, and do not use one head definition for two different jobs.

- **Before push:** the outgoing head is local `git rev-parse HEAD`, including commits the remote PR cannot see yet. Query an explicit PR number/URL and use its metadata only when `state=OPEN`, its head branch/repository matches the checkout and push destination, and its base repository is verified; never reuse a merged PR selected by bare `gh pr view`. Resolve the configured remote base or explicit base SHA before running the Note and whitespace gates. Keep the checkout clean so tree gates and the outgoing commit are the same tree.
- **PR review:** read the PR URL, base ref/OID, and exact remote head SHA from current PR metadata. Fetch the base and `pull/<number>/head` from a remote matching the base repository, not blindly from `origin`; verify both fetched OIDs, then review that immutable range. Re-establish both after a retarget or new push.
- **No PR:** require an explicit remote base or exact SHA. Only a direct push to `distilly`, `dot-skill`, or `main` uses that branch's existing remote tip as its outgoing base.

Feature/PR comparisons use the merge-base range. A direct persistent-branch push compares the old and new snapshots with `--range-mode direct`; this still sees governed deletions during a rewind.

The governed-diff Note gate covers product and governance paths listed in [.agents/notes/README.md](../.agents/notes/README.md). Tests-only, translations, and assets do not trigger it. A semantic reviewer still decides whether an otherwise exempt change introduced a shared decision.

## Docs-first

1. Search `.agents/notes/` for an owner. Update it instead of writing a second note.
2. Unbuilt product work starts in `proposed/`.
3. A shipped decision moves to `implemented/` in the same PR as the code, present tense.
4. Standing docs state what is true now. History stays in the note or the PR.

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

Product code goes in the `packages/` workspaces named in [design §25](design/v3/25-package-and-source-tree.md): `@distilly/protocol`, `@distilly/engine`, `@distilly/runtime`, `@distilly/adapters`, `@distilly/bindings`, `@distilly/mcp`, `@distilly/panel`, `@distilly/cli`, and the `distilly` facade. The dependency direction is one-way: engine, bindings, adapters, facade, MCP, and Panel web depend on protocol; Panel server additionally depends on MCP's narrow ReviewPresenter type; runtime composes engine + bindings + adapters; CLI composes runtime + MCP + Panel. A shared wire type belongs in protocol, not whichever package needed it first.

None of those packages exist yet, and the first change to create one lands the workspace and its gates together ([design §29.1 step 2](design/v3/29-landing-and-evolution.md)). Until then, `tools/` and `prompts/` take defect fixes for the published skill only — no new behavior and no third tree invented to avoid the package cut.
