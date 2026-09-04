# Contributing to Distilly

> Formerly: **Colleague Skill / colleague-skill**. The current creator entrypoint is `/distilly` on slash-name hosts.

Thank you for considering a contribution! Distilly turns source material about a person into reusable Skills for AI agents and compatible bots, and it is only as good as its community.

---

## Ways to contribute

- **Report bugs** — open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- **Suggest features** — open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- **Improve prompts** — files under `prompt_kor/` shape skill behavior; small wording tweaks are welcome

---

## Development setup

```bash
git clone --branch 10x/ko-hardening https://github.com/10xtf/distilly-10x.git distilly
cd distilly
pip3 install -r requirements.txt
```

Python 3.11+ is required. `requirements.txt` currently declares no runtime dependency — Distilly runs on the standard library. Host setup is covered in [INSTALL.md](INSTALL.md).

---

## Branch & PR workflow

1. Fork the repo and create a branch from the repository's default branch:
   - `feat/<short-name>` for new features
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for docs only
   - `chore/<short-name>` for tooling / infra
2. Make your changes. Keep PRs focused — one concern per PR.
3. Run tests and compile checks locally:
   ```bash
   python -m compileall tools/
   python -m unittest discover -s tests -p 'test_*.py' -v
   ```
4. Open a PR against the repository's default branch. Fill out the PR template.
5. CI must pass. A maintainer will review — please be patient, and feel free to ping on the issue if it's been a week.

---

## Commit message style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Notion auto-collector
fix: handle malformed MIME headers in email_parser
docs: translate INSTALL to Korean
chore: bump requests to 2.32
test: cover skill_writer rollback edge cases
```

Keep the subject under 72 characters. Use the body for the *why*, not the *what*.

---

## Code style

- Match surrounding code — we don't enforce a formatter yet, but consistency matters
- Python: prefer standard library where possible; add to `requirements.txt` only if necessary
- Tools under `tools/` should be runnable as standalone CLIs (`if __name__ == "__main__":`)
- Prompts under `prompt_kor/` are plain Markdown — keep them concise and task-specific

---

## Tests

New functionality should come with tests under `tests/test_*.py`. Use `unittest` (stdlib) — no extra test framework.

When adding a new data source collector, at minimum cover:
- Auth modes (token / user+password / etc.)
- Rate-limit / retry behavior (mock HTTP)
- Output format consistency with existing collectors

Don't hit live APIs in CI. Mock with `unittest.mock` or the `responses` library.

---

## Security

- **Never commit secrets, tokens, or personal data.** If you accidentally do, rotate the credential immediately and let a maintainer know.
- Config files that hold credentials should be written to the user's home under `~/.distilly/` with permission `0600`; readers may keep a read-only fallback for legacy `~/.colleague-skill/` files.
- If you find a security issue, **do not open a public issue.** Contact the repository maintainer directly.

---

## Docs

- User-facing behavior changes → update `README.md`, `SKILL.md`, and `INSTALL.md`
- Prefer English for code comments. Keep each user-facing localized document in one language.

---

## Community

- [GitHub Discussions](https://github.com/10xtf/distilly-10x/discussions) — long-form Q&A and design threads

Be kind. Assume good intent. Disagree on the idea, not the person.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
