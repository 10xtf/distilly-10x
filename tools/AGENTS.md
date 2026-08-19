# AGENTS.md — Current tool tree

This tree is the shipped dot-skill implementation, not the target Distilly package root. Do not add target `Distilly`, `Person`, profile-store, queue, or binding code here; follow [docs/architecture.md](../docs/architecture.md) and wait for the planned `src/` cut.

- Keep user entry points runnable as standalone CLIs and test their real argument parsing and exit behavior.
- Constructors and imports do not perform network, credential, or filesystem mutation. Follow [defensive patterns](../docs/process/defensive-patterns.md) for secrets, retries, subprocesses, and teardown.
- Preserve user-visible output unless the change owns that behavior. Add the narrow unittest that proves filesystem and process outcomes.
- Run compile, Ruff, and the owning test listed in [development.md](../docs/development.md).
