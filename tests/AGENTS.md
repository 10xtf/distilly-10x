# AGENTS.md — Tests

Use standard-library `unittest`. Read [docs/testing.md](../docs/testing.md) before changing test strategy.

- Test public CLIs and installers through their real entry path when users invoke a process.
- Keep stores, renderers, and files real under a temporary root; mock only network, clock, LLM, or another expensive nondeterministic edge.
- Assert external state and refusal behavior, not an agent summary or a helper call that bypasses argument parsing.
- Never hit live APIs or user directories. A command that discovers zero tests is not a passing test.
