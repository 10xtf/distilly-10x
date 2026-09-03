# Development

The public Developer Preview and repository default branch are `distilly-plugin`. The separate `dot-skill` branch remains the legacy maintenance line.

## Local setup

Use Node.js `22.19+` or `24`, pnpm `10.32+`, and Python `3.9+` for the repository-only assembly and documentation scripts.

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
```

The production code is TypeScript under `packages/`. The canonical orchestration Skill and host manifests are under `plugins/`. Python under `scripts/` exists only for repository verification and Plugin assembly; it is not part of the installed runtime.

## Checks

Run the narrowest checks that cover a change, then run the full gate before publishing a release candidate.

| Change | Minimum check |
| --- | --- |
| TypeScript formatting or lint | `pnpm run gates:fast` |
| TypeScript behavior or public types | `pnpm run typecheck && pnpm run test` |
| Protocol/public exports | `pnpm run snapshots` |
| Documentation or generated design chapters | `pnpm run docs` |
| Plugin Skill or manifests | `pnpm run test:plugins` |
| Build/package graph | `pnpm run build && pnpm run hygiene` |
| Repository Python scripts | `python3 -B scripts/run_tests.py && ruff check scripts tests` |
| Full outgoing candidate | `pnpm run gates` |

The Codex package acceptance check is:

```bash
pnpm run package:preview:codex
pnpm --filter @distilly/cli run verify:package:codex
```

It uses temporary homes and a self-contained package. It must not depend on an existing Distilly installation or a checkout path after setup.

## Contribution workflow

Keep each feature focused, with its implementation, tests, generated artifacts, and current-state documentation in one reviewable commit. Use an independent branch or worktree for unrelated work. Pull requests for the Preview target `distilly-plugin`; do not mix legacy maintenance into it.

Never commit local person data, source material, environment files, credentials, Agent-specific instructions, generated databases, or host state. The root `.gitignore` covers the standard local paths, but contributors must still inspect the complete outgoing diff.

Before calling a host verified, test setup, doctor, restart discovery, exactly five MCP tools, profile prompt/install, and uninstall with person data retained on a clean local home.
