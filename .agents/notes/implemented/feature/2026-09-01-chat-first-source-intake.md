# Agent Note: Chat-first source intake

Status: implemented

## Problem

The five-tool Preview could ingest text from host research and readable local sources, but its canonical Skill described capabilities and provenance without making user-supplied handles the default interaction. A model could respond to attached files, a selected directory, or public URLs by asking the user to classify the person, choose a source lane, or repeat information already present. Larger selections also lacked an explicit rule to finish collection before briefing, creating a risk of committing an intermediate generation.

## Decision

Make supplied sources the chat-first intake plan after subject resolution. Pasted text, explicitly selected readable files/directories, and public URLs need no connector setup or intake form. The host reads only that scope with capabilities visible in the current session, preserves one MaterialInput per traceable source, submits repeated selected handles only once per intake, uses `enqueue: auto` for intermediate batches and `enqueue: now` for the final batch at the existing 32-material tool limit, and briefs only the final pending generation.

Because real-host directory testing exposed hand-counted 30- and 31-character RequestId suffixes, the same orchestration now requires a safe host-local UUID or 16-byte random-hex value when that facility is available, followed by explicit lowercase, de-hyphenation, and 32-character validation. The generator is used only for an identifier and cannot read source data or mutate Distilly.

Real-host public-URL testing also exposed a partial publication month sent through the exact-time `publishedAt` field. A month or year visible on a page remains useful source text, but the structured field is now omitted unless the source supplies a complete timestamp; the workflow never invents a day to make partial metadata validate.

Directly supplied private material plus an explicit distillation request authorizes only that content. It does not authorize adjacent paths, conversations, accounts, contacts, or public identity expansion. Directory traversal does not follow symlinks and skips credentials, tool state, dependency/VCS trees, binaries, and unrelated files. The model-facing path continues to ingest text; it does not claim the Runtime's separate raw-file path stored an attachment.

## Alternatives considered

- Add a sixth MCP source or file tool. Rejected because the five-tool contract is locked and host source acquisition already precedes text ingest.
- Have the Skill invoke `distilly ingest` or future `source collect` through shell. Rejected because model shell access must not bypass the user-bound CLI/adapter authorization surface or write Distilly state outside the five tools.
- Start with Lark, Slack, or another connector. Rejected because user-selected files, pasted text, and public URLs cover the zero-configuration path and do not require a secret or provider account.
- Scan nearby files or signed-in browser state automatically. Rejected because low interaction cannot mean hidden scope expansion.

## Consequences

A user can start with a person plus files, a directory, URLs, or pasted text and reach distillation without preliminary classification. Ambiguous identity, unclear directory scope, unreadable material, missing private authority, and oversized individual sources still pause visibly. Deterministic raw-file parsing and provider adapters remain separate user-side surfaces; this slice changes the installed orchestration, not Protocol, Engine storage, or the exact MCP tool set. Local text without a stable URI or artifact locator can become a distinct MaterialId in a later RequestId even when its body is unchanged; source grouping conservatively collapses exact republication for quality, so this feature does not claim cross-run physical deduplication.

## Verification

- `quick_validate.py plugins/shared/skills/distilly` validates the canonical Skill, and plugin assembly tests/check mode prove the Codex and Claude Code mirrors are byte-identical to it.
- The real Codex 0.146.0 capacity probe binds the final canonical digest to exact 65,536-byte tool-result and 16,384-byte briefing observations with both unseen tail markers preserved.
- Focused capacity-fixture, docs, Agent Note, build, and self-contained Codex package checks cover the release evidence and fresh installation surface.
- An isolated real Codex home completed four fresh model runs without an intake form: one Markdown file produced a current seven-claim profile; a directory preserved three Markdown/JSON/VTT sources while leaving `.env`, dependency content, and an outside-target symlink unread; one supplied public page produced a current profile with the exact URL and no linked-page crawl; and one pasted observation plus one local file remained two materials and produced a current profile.
