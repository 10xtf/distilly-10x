# Distilly Install Guide

> Distilly was formerly known as **Colleague Skill / colleague-skill**. The creator
> name and canonical install directory are now `distilly`.

## Install Distilly

Clone the repository into a Skills directory discovered by your host, keeping
the destination directory name `distilly`:

```bash
git clone https://github.com/titanwings/distilly <TARGET>
```

Create the parent directory first when it does not already exist.

| Host | User-level `<TARGET>` | Project-level `<TARGET>` |
|------|-------------------------|--------------------------|
| Claude Code | `~/.claude/skills/distilly` | `.claude/skills/distilly` |
| OpenClaw | `~/.openclaw/workspace/skills/distilly` | — |
| Hermes | `~/.hermes/skills/openclaw-imports/distilly` | `.hermes/skills/distilly` after `hermes skills trust` |
| Codex | `~/.agents/skills/distilly` | `.agents/skills/distilly` |
| DeepSeek Harness | `~/.dsh/skills/distilly` or `$DSH_HOME/skills/distilly` | `.dsh/skills/distilly` |
| Pi coding agent | `~/.pi/agent/skills/distilly` or `~/.agents/skills/distilly` | — |
| Grok Build | `~/.grok/skills/distilly` or `~/.agents/skills/distilly` | — |
| OpenCode | `~/.config/opencode/skills/distilly` | `.opencode/skills/distilly` |

From an existing clone, these host-specific installers can copy Distilly into
the canonical OpenClaw, Hermes, or Codex user directory:

```bash
python3 tools/install_openclaw_skill.py --force
python3 tools/install_hermes_skill.py --force
python3 tools/install_codex_skill.py --force
```

Use `--dry-run` first to inspect the destination without writing files.

## Existing-install migration

A clone still named `dot-skill` is not renamed by `git pull`. The legacy Codex
root `~/.codex/skills/` is also not migrated to `~/.agents/skills/`
automatically.

1. Keep the old copy as a fallback.
2. Install a new canonical copy at the `distilly` target listed above, or run
   the applicable repository installer.
3. Verify that the host discovers the new copy.
4. Decide manually whether to keep or remove the old directory. Distilly never
   deletes it automatically.

Read-only fallbacks for `~/.colleague-skill/` configuration and legacy profile
metadata keep old data accessible; they do not rename a host install directory.

## Install a generated Person Profile

From the Distilly repository root, install a generated profile with:

```bash
python3 tools/install_generated_skill.py \
  --skill-dir "skills/{character}/{slug}" \
  --host <host> \
  --force
```

| Host | `<host>` | Default Skills root |
|------|----------|---------------------|
| Claude Code | `claude-code` | `~/.claude/skills` |
| OpenClaw | `openclaw` | `~/.openclaw/workspace/skills` |
| Hermes | `hermes` | `~/.hermes/skills/distilly-generated` |
| Codex | `codex` | `~/.agents/skills` |
| DeepSeek Harness | `deepseek-harness` | `~/.dsh/skills` or `$DSH_HOME/skills` |
| Pi coding agent | `pi` | `~/.pi/agent/skills` |
| Grok Build | `grok-build` | `~/.grok/skills` |
| OpenCode | `opencode` | `~/.config/opencode/skills` |

Pass `--skills-dir <PATH>` to override the root for a project-level install.
The installer writes only the self-contained `SKILL.md` and
`.distilly-install.json`. It does not copy private source material from the
generated directory, and it normalizes legacy underscore frontmatter only in
the installed copy.

On Windows, use the dedicated Claude Code installer when a command shim is
needed:

```bash
python3 tools/install_claude_generated_skill.py \
  --skill-dir "skills/{character}/{slug}" \
  --install-command-shim \
  --force
```

## Collector setup

The collectors store new configuration under `~/.distilly/`. When no new
configuration exists, they can read legacy configuration from
`~/.colleague-skill/` without moving it.

```bash
# Install the declared Python dependencies
pip3 install -r requirements.txt
```

This Skill calls no external service. Source material arrives only through file
upload and pasted text, so there is no credential to configure. Never commit
secrets, OAuth tokens, or API keys to the repository.

## Celebrity research pipeline

The `celebrity` family includes an optional note-processing pipeline. Collection
itself is done by the user; this Skill only merges and verifies local notes:

```bash
# Merge reviewed research notes
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Run the quality check
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

Both tools read and write local files only; neither touches the network. Do not
store full transcripts, subtitles, or long verbatim passages in the skill
directory — keep only short paraphrased notes with source metadata.
