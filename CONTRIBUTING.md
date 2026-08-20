# Contributing to colleague.skill / 贡献指南

> English first, 中文在下方。

Agents: read [AGENTS.md](AGENTS.md) first. Product work reads [docs/design/system-v3.md](docs/design/system-v3.md); product code is TypeScript. Review follows [docs/process/code-review.md](docs/process/code-review.md).

The published default branch is `dot-skill`. Product work lands on `distilly`.

Thank you for considering a contribution! This project turns colleagues (and anyone else) into AI skills, and it's only as good as its community.

感谢你愿意贡献。这个项目的目标是把同事（以及任何人）蒸馏成 AI skill，社区越活跃它就越好。

---

## Ways to contribute / 贡献方式

- **Report bugs** — open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- **Suggest features** — open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- **Translate docs** — see `docs/lang/` for existing languages
- **Add a data source collector** — e.g. `tools/slack_auto_collector.py` is a reference implementation
- **Submit a community skill** — submit to the [gallery](https://titanwings.github.io/colleague-skill-site/)
- **Improve prompts** — files under `prompts/` shape skill behavior; small wording tweaks are welcome

---

## Development setup / 开发环境

```bash
git clone https://github.com/titanwings/colleague-skill.git
cd colleague-skill
pip3 install -r requirements.txt
pip3 install -r requirements-dev.txt
```

Python 3.9+ is required. Optional extras (`openpyxl`, auto-collector credentials) are covered in [INSTALL.md](INSTALL.md).

---

## Branch & PR workflow / 分支和 PR 流程

1. Fork the repo and create a branch from `dot-skill` (or from `distilly` for product work):
   - `feat/<short-name>` for new features
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for docs only
   - `chore/<short-name>` for tooling / infra
   If `origin` is your fork, add or verify an `upstream` remote for `titanwings/colleague-skill`; pre-push and review resolve the PR base from that base-repository remote, not from `origin` by habit.
2. Make your changes. Keep PRs focused — one concern per PR. Changes to the [governed paths](.agents/notes/README.md#when-to-write-one) add or update an Agent Note in the same PR; a reviewer can also require one when an exempt path changes a shared decision.
3. Run the checks that match the diff. [docs/development.md](docs/development.md) is the command owner:

   | Change | Minimum local evidence |
   |---|---|
   | Markdown | `python3 -B scripts/verify_docs.py` |
   | Agent Note | `python3 -B scripts/verify_agent_notes.py` |
   | Python | compile, Ruff, and the owning unittest |
   | Outgoing governed diff | Note gate against the verified PR base |

   Do not claim commands you did not run. CI owns the full Python-version matrix.
4. Open a PR against `dot-skill` or `distilly`. Fill out every applicable PR-template field; that template is the completed-work handoff. Incomplete or transferred work uses the full handoff in [docs/development.md](docs/development.md#agent-handoff).
5. CI must pass. A maintainer will review — please be patient, and feel free to ping on Discord if it's been a week.

---

## Commit message style / 提交信息规范

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Notion auto-collector
fix: handle 429 rate limit in feishu_parser
docs: translate INSTALL to Korean
chore: bump requests to 2.32
test: cover skill_writer rollback edge cases
```

Keep the subject under 72 characters. Use the body for the *why*, not the *what*.

---

## Code style / 代码风格

- Match surrounding code. Ruff is blocking; the repository does not enforce an auto-formatter.
- Python: prefer standard library where possible; add to `requirements.txt` only if necessary
- Tools under `tools/` should be runnable as standalone CLIs (`if __name__ == "__main__":`)
- Prompts under `prompts/` are plain Markdown — keep them concise and task-specific

---

## Tests / 测试

New functionality should come with tests under `tests/test_*.py`. Use `unittest` (stdlib) — no extra test framework.

When adding a new data source collector, at minimum cover:
- Auth modes (token / user+password / etc.)
- Rate-limit / retry behavior (mock HTTP)
- Output format consistency with existing collectors

Don't hit live APIs in CI. Mock with `unittest.mock` or the `responses` library.

---

## Security / 安全

- **Never commit secrets, tokens, or personal data.** If you accidentally do, rotate the credential immediately and let a maintainer know.
- Config files that hold credentials should be written to the user's home (e.g. `~/.colleague-skill/`) with permission `0600`.
- If you find a security issue, **do not open a public issue.** Email the maintainer or DM on Discord.

---

## Docs / 文档

- Product contract changes → edit `docs/design/system-v3.md`, then run `python3 scripts/sync_design_chapters.py`; generated chapters are never hand-edited, and deprecated V2/V1 bodies are not rewritten
- User-facing skill behavior → update `README.md`, `SKILL.md`, and `INSTALL.md`
- If you add a language translation of the README, also update the language nav strip in every other `docs/lang/README_*.md`
- Prefer English for code comments; docs can be bilingual

---

## Community / 社区

- [💬 Discord](https://discord.gg/NVX66RxWZv) — main chat
- [GitHub Discussions](https://github.com/titanwings/colleague-skill/discussions) — long-form Q&A and design threads
- [Skill gallery](https://titanwings.github.io/colleague-skill-site/) — browse and submit skills

Be kind. Assume good intent. Disagree on the idea, not the person.

---

## License / 许可

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
