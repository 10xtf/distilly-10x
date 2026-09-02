# Contributing to Distilly

Distilly has two deliberate product lines:

- `dot-skill` is the published legacy Skill line.
- `codex/distilly-plugin` is the local TypeScript Developer Preview.

Preview work belongs on `codex/distilly-plugin` or a branch based on it. Do not mix Preview changes into the default legacy line.

## Start here

Read [AGENTS.md](AGENTS.md), the [design index](docs/design/README.md), and the [development workflow](docs/development.md). Product code is TypeScript and targets Node.js `22.19+` or `24`.

```bash
git clone --branch codex/distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run gates:fast
pnpm run typecheck
```

Keep each change focused. Governed code, Plugin files, and live product documentation need a dedicated Agent Note in the same feature commit. Tests should sit beside their TypeScript source and use offline fixtures; never put secrets or personal material in the repository.

## Host Plugin contributions

The next community priority is a real, tested binding for **Grok Bot, Claude Code, OpenCode, Pi agent, and DeepSeek Harness (DSH)**. A useful host contribution includes:

- an isolated binding and launcher;
- setup, doctor, restart/discovery, and uninstall checks;
- exact host/version/release/capacity evidence;
- the unchanged five-tool contract; and
- a focused Agent Note and reproducible local test.

A copied Skill directory or a logo-only entry is not host verification. Keep provider credentials in the system keychain or environment variables; configuration files may store only secret references.

## Checks

Run the narrowest checks that cover your diff, then report exactly what ran:

| Change | Minimum check |
| --- | --- |
| Markdown | `python3 -B scripts/verify_docs.py` |
| Agent Note | `python3 -B scripts/verify_agent_notes.py` |
| TypeScript formatting and lint | `pnpm run gates:fast` |
| TypeScript behavior and types | `pnpm run test` and `pnpm run typecheck` |
| Plugin assembly | `python3 -B scripts/assemble_plugins.py --check` |
| Built Preview | `pnpm run build` and the relevant packaged smoke |

Do not claim a host is verified until a clean local HOME has completed setup, restart discovery, the five-tool check, and uninstall with user data retained.

## Branches and publication

Use a separate worktree for independent features and make one reviewable local commit per feature. Open Preview pull requests against `codex/distilly-plugin`; keep the default `dot-skill` branch unchanged. Never push credentials or private source material.

For questions, open a focused issue or start a discussion. See [UPDATES.md](UPDATES.md) for the current host-contributor call.
