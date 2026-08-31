# Agent Note: Full Codex and Claude Code host bindings

Status: implemented

## Problem

The Developer Preview has verified host capabilities and a real five-tool runtime, but neither supported host has a production `HostBinding`. A setup command therefore cannot install a launchable plugin, validate its launcher, create a host-scoped injector, or remove only the host integration while retaining the Distilly data root.

## Decision

Concrete Codex and Claude Code full-binding factories now coexist with the unchanged capability-only factories. Each full binding reuses the existing fail-closed preflight, creates a host-tagged form renderer over a trusted outer presenter, provides prompt-only subrun injection and self-contained person-Skill projections, installs a rendered plugin tree with a real absolute-launcher `.mcp.json`, reports narrow on-disk doctor state, and removes only exact digest-verified owned files.

Codex uses the official personal marketplace source at `~/plugins/distilly`, preserves unrelated marketplace entries, validates the Distilly entry before any destructive command, and invokes the trusted absolute Codex executable to add or remove `distilly@<marketplace>`. The default runner binds `HOME`, `USERPROFILE`, and `CODEX_HOME` to the explicit home. Claude Code uses the official auto-discovered skills-directory plugin at `~/.claude/skills/distilly`. Both paths are rooted by an explicit factory option so fresh-HOME tests do not mutate the developer's real home.

Plugin replacement is staged outside host discovery under `~/.distilly/host-install`; an exact owned old tree remains as a backup until host registration succeeds. Failure restores the old tree and Codex marketplace bytes. Person-Skill staging uses the same non-discovered transaction root. Person replay and uninstall share an exact verified reader that rejects root or owned-file symlinks, validates the complete install reference and deterministic id, binds the manifest path to its root, and checks manifest plus actual content digests before returning or deleting anything.

## Alternatives considered

- A placeholder `kind: "full"` object with unsupported injector or lifecycle methods was rejected because the in-force host contract explicitly forbids placeholder full bindings.
- Writing Codex private cache/config records directly was rejected because the supported `codex plugin add/remove` commands own those records.
- Installing Claude Code directly into its marketplace cache was rejected because the cache is host-owned; the documented skills-directory plugin path is persistent, local, and auto-discovered.
- Copying `.mcp.json.template` into an installed plugin was rejected because installable output must contain a real launcher path and no sentinel.
- Deleting a whole shared marketplace or modified plugin tree during uninstall was rejected because ownership is narrower than either target.
- Writing staging or backup directories beside an auto-discovered plugin/Skill was rejected because a live host could transiently discover an incomplete duplicate.
- Replacing the active plugin before the new tree and host registration succeeded was rejected because a recoverable setup failure would disable an existing installation.

## Consequences

- Both factories are real and independently callable, while Runtime and CLI still do not compose them. The next lifecycle feature can depend on these factories without weakening the capability-only leaf.
- Installed plugin trees contain the platform manifest, canonical Skill bytes, a real `.mcp.json`, and no source template or launcher sentinel. Setup requires a restart because both hosts discover integrations at session startup.
- Plugin uninstall leaves `~/.distilly/` and separately installed person Skills intact. Person uninstall removes only its exact unmodified `SKILL.md` and ownership manifest; an unowned neighbor prevents directory removal but is never deleted.
- Codex setup intentionally uses the supported host command rather than writing host caches. Its process edge is isolated to the explicit home, but a complete packaged CLI still has to locate and validate the executable before constructing this binding.
- The narrow doctor checks owned bytes, launcher reachability, host, and release version. Deep diagnostics, cross-filesystem replacement, crash-orphan cleanup, and packaged fresh-session verification remain later Preview work.

## Verification

- `pnpm exec vitest run packages/bindings/src`
- `pnpm run gates:fast`
- `pnpm run build`
- `pnpm run typecheck`
- `pnpm --filter @distilly/bindings run snapshots`
- `pnpm run hygiene`
- `python3 -B scripts/verify_docs.py`
- `python3 -B scripts/verify_agent_notes.py`
- A temporary-home smoke used the installed Codex and Claude Code executables: Codex add/list/remove succeeded; Claude Code strict validation and list succeeded; both integrations were removed without touching the real home.
- Full `pnpm run snapshots` remains red only on the pre-existing stale `packages/panel/web/app.js` bundle and reproduces from clean base `d43f2ef`; the bindings snapshot is green.
