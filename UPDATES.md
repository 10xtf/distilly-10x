# Distilly updates

## 2026-09 — Developer Preview is open for host contributors

The `distilly-plugin` branch is now the repository's default public Developer Preview. It packages a real TypeScript/SQLite product path for Codex: local material intake, versioned Person Profiles, five MCP tools, correction review, and explicit profile Skill installation. The legacy `dot-skill` branch remains available as a separate maintenance line.

Until a host has a verified native Plugin binding, users may explicitly install that branch as a best-effort Legacy Skill compatibility mode. This keeps the older local-file distillation flow available on Claude Code, OpenClaw, Hermes, DeepSeek Harness, Pi agent, Grok Build, and OpenCode; Grok Bot remains a manual saved/private Skill path. It is not an automatic fallback and does not claim the Preview's SQLite, five-tool MCP, Panel, lifecycle, or security guarantees. See [INSTALL.md](INSTALL.md#legacy-skill-compatibility-for-non-codex-hosts).

Codex is the first verified host. The next bottleneck is host binding coverage, not another layer of storage abstraction. We need contributors who can build and run Plugin packages for:

- Grok Bot
- Claude Code
- OpenClaw
- Hermes
- Grok Build
- OpenCode
- Pi agent
- DeepSeek Harness (DSH)

Contributions can add a binding, a host fixture, a deterministic launcher check, or a focused documentation/test improvement. Keep each host implementation in its own branch or worktree, preserve the five-tool contract, and include a reproducible local test. Please open a focused GitHub issue or pull request against `distilly-plugin`; do not target the legacy `dot-skill` branch for Preview work.

I will actively review host contributions, especially real setup/doctor/restart/uninstall runs and evidence that the host discovers the same canonical Skill bytes. A host should be called verified only after its exact version, release tuple, capacity, launcher, and five-tool behavior have been tested.

For installation and the current Preview limits, start with the root [README](README.md). The staged priorities are tracked in [ROADMAP.md](ROADMAP.md).
