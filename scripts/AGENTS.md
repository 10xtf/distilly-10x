# AGENTS.md — Repository gates

Scripts in this tree enforce repository contracts. Keep them deterministic, Python 3.9 compatible, standard-library only, and callable both as CLIs and from unittest through a `verify(root)`-style function.

- Fail closed on missing inputs, invalid bases, parse errors, and absent required paths.
- Diagnostics name the repository-relative path and the violated contract.
- Every accepted and rejected case needs a focused test under `tests/`.
- Do not make a verifier score prose quality or call a network service; semantic review remains in [code-review.md](../docs/process/code-review.md).
