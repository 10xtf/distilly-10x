# AGENTS.md — Model-visible prompts

Prompts are shipped behavior for the current dot-skill path. They are not Distilly profile facts or a place to prototype target APIs.

- Read the matching family prompt and its caller before changing shared wording.
- Preserve input/output markers consumed by tools. Update every affected family deliberately instead of assuming inheritance.
- Add or update a keyless fixture/test for stable rendered text, and semantically review exactly what the model sees.
- Keep instructions evidence-bound; never embed credentials, personal exports, repository-only rationale, or hidden implementation state.
