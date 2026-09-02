<div align="center">

# Distilly roadmap

### From a single Skill to a reliable Person Profile Plugin for Agents

*Last updated: 2026-09-02*

[README](README.md) · [Updates](UPDATES.md) · [Design](docs/design/README.md)

</div>

Distilly is moving from the original `colleague-skill` concept to a local-first product that can be one dependable step in an agent workflow: collect explicit evidence, distill a versioned Person Profile, review changes, and make the approved profile available to an agent. The callable surface remains a Skill, while the product around it is a Plugin with storage, runtime, host binding, and review boundaries.

## Current: Codex Developer Preview

The `codex/distilly-plugin` branch currently provides the first end-to-end Codex path:

- SQLite/WAL authority for subjects, materials, pending work, leases, versions, corrections, and review decisions;
- deterministic TXT, Markdown, JSON, and SRT/VTT local parsing;
- exactly five MCP tools: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit`, and `distilly_correct`;
- Codex setup, doctor, restart discovery, explicit profile installation, and safe uninstall;
- a local review Panel for promote, reject, rollback, and correction review; and
- a self-contained `0.1.0-preview.1` Plugin assembly with a canonical Skill shared by host mirrors.

This is a public preview branch, not the default release and not an npm publication. The root [README](README.md) is the current installation source; older `dot-skill` instructions do not apply here.

## Next: make the Preview easy to trust

1. Run the complete Codex flow on more clean machines and document recovery paths.
2. Finish the verified Claude Code binding and its exact host-capacity fixture.
3. Improve the Panel's profile/library experience without changing the five-tool model contract.
4. Add migration, doctor depth checks, backup/restore, and generic maintenance after the vertical flow remains stable.

## Community priority: more coding-agent Plugins

Codex is only the first verified host. We need community support to build and validate Plugin packages for:

| Host | Goal |
| --- | --- |
| Grok Bot | A reviewed binding, launcher, and restart/discovery check |
| Claude Code | Complete the full binding and host fixture |
| OpenCode | Add a native Plugin lifecycle and five-tool integration |
| Pi agent | Add a native Plugin lifecycle and five-tool integration |
| DeepSeek Harness (DSH) | Add a native Plugin lifecycle and five-tool integration |

I will actively review these contributions. The useful contribution is a runnable host path with an isolated test and exact release evidence, not just a new logo or a copied Skill directory. See [UPDATES.md](UPDATES.md) for the contribution request.

## Later product work

- Local Library and Panel marketplace for discovering, reviewing, and installing approved Person Profiles.
- Lark/Feishu, DingTalk, Slack, and other explicitly authorized source adapters.
- Additional local parsers, including PDF, email containers, and provider export formats.
- Two-stage migration from the original `dot-skill` data layout, with unrecoverable evidence marked `imported_unverified`.
- Generic GC, backup/restore, deep doctor diagnostics, and cross-process single-writer hardening.
- Additional host bindings after each host has its own fixture, launcher, lifecycle, and uninstall proof.

## What will stay true

- Local-first storage and zero required extra model API keys.
- Explicit user-selected source scope; no background reading of chats, accounts, or nearby files.
- Complete profiles and prompts are delivered or rejected visibly; they are never silently truncated.
- Host support is earned by reproducible setup, restart, five-tool, capacity, and uninstall checks.
- Independent feature branches remain reviewable and the default published Skill line stays untouched by Preview work.

Have a host you can test? Open a focused issue or contribution against [`codex/distilly-plugin`](https://github.com/titanwings/distilly/tree/codex/distilly-plugin). I will review it.
