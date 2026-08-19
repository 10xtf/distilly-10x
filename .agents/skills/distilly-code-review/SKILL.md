---
name: distilly-code-review
description: Use when reviewing a pull request or an outgoing product diff on the distilly branch.
---

# Reviewing a distilly PR

**This skill is guidance, not a complete checklist.** The contract is [docs/process/code-review.md](../../../docs/process/code-review.md). Query an explicit PR number or URL and require `state=OPEN` for a merge-blocking review; do not let bare `gh pr view` select a merged PR. Read the URL, `baseRefName`, `baseRefOid`, and exact remote `headRefOid` from metadata. Choose the remote matching the PR URL's base repository, then fetch both the base and that remote's `pull/<number>/head`; this covers fork PRs even when `origin` is the contributor fork. Verify the fetched objects equal both metadata OIDs, then diff those immutable SHAs before reading the owning [design chapter](../../../docs/design/README.md). Distilly product PRs normally target `distilly`; do not silently substitute `dot-skill`. Re-establish the range after a retarget or push. A short review with one substantiated blocker is better than a list of nits.

```sh
gh pr view <pr-number-or-url> --json number,state,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner,url
git fetch <base-repository-remote> <baseRefName> pull/<number>/head:refs/remotes/<base-repository-remote>/pr/<number>
git rev-parse <base-repository-remote>/<baseRefName> refs/remotes/<base-repository-remote>/pr/<number>
```

## Walk

1. Confirm the base repository/remote, base ref plus metadata/fetched SHA, and metadata/fetched head SHA. Read the PR body for the design owner, Agent Note, verification, unverified work, risks, and handoff.
2. Open [docs/process/code-review.md](../../../docs/process/code-review.md) and apply every blocking requirement, including the distilly-specific list.
3. Read the chapter that owns the change in [docs/design/v2/](../../../docs/design/README.md). Do not review product behavior against `architecture.md` alone, and do not accept a v1 chapter as the requirement.
4. For async, credentials, adapters, or queues, apply [defensive-patterns.md](../../../docs/process/defensive-patterns.md).
5. For tests, apply [docs/testing.md](../../../docs/testing.md). Confirm the author ran the [narrowest checks](../../../docs/development.md).
6. Semantically review every new prose passage. Format gates do not do this.
7. Report with defect, path, impact, and evidence. Separate blockers from suggestions. Omit issues a green gate already caught.

## Red flags — stop and re-read the design

- "The compressed architecture is enough"
- "I'll note the work.md split as a follow-up"
- "ingest and commit can be one helper for now"
- "A style nit list with no blocker"
- "CI is green so the prose is fine"

Those mean the review has not happened yet.
