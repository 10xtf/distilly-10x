---
name: distilly-pre-push-checks
description: Use before pushing or opening a PR on the distilly branch to run the smallest checks that can fail for the outgoing diff.
---

# distilly pre-push checks

This workflow verifies commits that are about to leave the clone. The head is therefore the current local `HEAD`, including commits that PR metadata cannot see yet. Use PR metadata only to establish the base branch and confirm that the checked-out branch is the PR head branch. The checkout must be clean so tree gates read the outgoing commit; preserve unrelated work and use a separate clean worktree instead of deleting, stashing, or bundling it without the owner's direction.

```sh
git status --short --branch
git rev-parse HEAD
gh pr view <pr-number-or-url> --json number,state,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner,url
git remote -v
git fetch <base-repository-remote> <verified-base>
git rev-parse <base-repository-remote>/<verified-base>
git diff --stat <baseRefOid>...HEAD
```

Always pass an explicit PR number or URL. Reject metadata unless `state` is `OPEN`, `headRefName` is the checked-out branch, and the head repository matches the push destination; a bare `gh pr view` may silently return an old merged PR. Choose the remote whose URL matches the base repository in the PR URL; in a fork clone this is normally `upstream`, not `origin`. Verify the fetched base resolves to metadata `baseRefOid`, then store that exact SHA so the hook can reproduce the range: `git config branch.<branch>.distillyBase <baseRefOid>`. Without a matching open PR, require an explicit base-repository remote ref or exact SHA. Only a direct push to the persistent `distilly`, `dot-skill`, or `main` branch uses its existing remote tip as the base.

Then run only what the diff can break:

| If the diff touches | Run |
|---|---|
| Markdown | `python3 -B scripts/verify_docs.py` |
| `.agents/notes/` | `python3 -B scripts/verify_agent_notes.py` |
| Governed outgoing diff | `python3 -B scripts/verify_agent_notes.py --base <resolved-base-sha> --head <local-head-sha>` |
| `tools/` or `scripts/` | compile, Ruff, and the owning unittest file from `docs/development.md` |
| Tests only | that test file |
| Product behavior or a PR to merge | [distilly-code-review](../distilly-code-review/SKILL.md) |

Do not run the full unittest suite by default. CI on `distilly` / `dot-skill` owns the matrix.

If this clone enables `.githooks`, it reads the outgoing ref records from Git, resolves the same configured base, and checks the clean checked-out head. It rejects another local branch in the same push, persistent-branch deletion, and non-fast-forward persistent updates. Do not bypass it unless the user explicitly asks. Before transfer or PR, produce the handoff from `docs/development.md`.
