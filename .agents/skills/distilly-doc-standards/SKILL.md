---
name: distilly-doc-standards
description: Use when writing, moving, or reviewing documentation on the distilly branch — choosing which file owns a fact, generating design chapters, adding Agent Notes, or responding to verify_docs failures.
---

# distilly documentation workflow

Contracts live in [docs/AGENTS.md](../../../docs/AGENTS.md). This skill is the walk, not a second standard.

1. Name the document's subject and its direct children. Keep full detail only for the subject.
2. Choose the folder: product contract → `docs/design/`; live tree → `architecture.md`; steps → `cookbook/`; review rules → `docs/process/`; why → Agent Note.
3. Do not compress [system-v2.md](../../../docs/design/system-v2.md) into architecture.md. Edit only the in-force parent design file, then run `python3 scripts/sync_design_chapters.py`; generated chapters are not hand-edited, and the deprecated v1 parent is left alone.
4. Search `.agents/notes/` before adding a note. Update the owner or cross-link.
5. Run `python3 -B scripts/verify_docs.py` after Markdown edits. Run `python3 -B scripts/verify_agent_notes.py` when Notes changed.
6. Standing docs stay present tense. The design corpus may keep conversation density.
