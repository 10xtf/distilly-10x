# Protect governed branches

The tracked hook and CI report violations, but repository files cannot prevent a direct push from landing or prevent that push from deleting the workflow itself. GitHub branch protection or a repository ruleset owns that external enforcement boundary.

## Configure

In the base repository's GitHub **Settings → Rules → Rulesets**, create an active branch ruleset targeting `dot-skill`, `distilly`, and `main`:

1. Require a pull request before merge.
2. Require every blocking CI job after a successful run exposes its exact check name: `Governance`, `Python 3.9`, `Python 3.11`, and `Ruff` for the current workflow.
3. Block force pushes and branch deletion.
4. Do not grant a broad bypass role. If administrators may bypass, record that exception as an external risk in the PR handoff.
5. Require the branch to be current before merge only if the team accepts the extra update churn; this is independent of requiring the four checks.

Apply the same policy to all three branches. Protecting only `main` does not govern the published `dot-skill` branch or the product `distilly` branch.

## Verify

Use read-only API calls against the base repository; a contributor fork is not sufficient evidence:

```sh
gh api repos/<owner>/<repo>/rulesets
gh api repos/<owner>/<repo>/branches/dot-skill/protection
gh api repos/<owner>/<repo>/branches/distilly/protection
gh api repos/<owner>/<repo>/branches/main/protection
```

Verification is successful only when the live response shows an active matching ruleset or branch protection, the four required checks, deletion and force-push denial, and the intended bypass policy. A `404`, an empty ruleset list, or checks limited to the Python matrix means governance is detection only.
