# Agent Note: Real Codex use blockers

Status: implemented

## Problem

A fresh real Codex run could complete the Preview workflow only after several invalid calls and direct inspection of the bundled runtime schema. The Protocol already exposed strict MCP input schemas, but the canonical Skill gave a complete example only for subject resolution. The model consequently confused the different subject selectors, invented ingest provenance fields, supplied a non-canonical timestamp, mis-shaped an id-based profile read, and later inspected packaged code to discover the first-version claim operation.

The rebuilt package then exposed a separate fresh-host startup failure. Codex removes `CODEX_HOME` from the environment it gives an MCP child. Distilly's strict installed-host version recheck restored only `HOME` and `USERPROFILE`, so the nested Codex version command emitted a temporary-directory warning on stderr and the MCP correctly failed closed before initialize.

## Decision

Keep the Protocol unchanged and add only the model-facing redundancies proven necessary by the real run: exact selector boundaries, one complete local-text ingest template, canonical UTC-millisecond timestamp guidance, direct briefing-to-commit field mappings, one complete first-version `add` template, the evidence-reference shape, an id-based read template, and the correction envelope. The canonical shared Skill remains the source; release assembly mirrors it byte-for-byte into both host plugins.

Keep strict host-version parsing unchanged. Every Codex version probe now explicitly restores the installed home as `CODEX_HOME`, including setup, doctor, and host-spawned MCP composition. It also places the manifest-verified Distilly Node directory first on `PATH`, so a script launcher with `#!/usr/bin/env node` cannot select Codex's temporary arg-zero helper path. The manifest's already verified absolute executable and stored version remain authoritative inputs; no ambient Codex home is trusted.

## Alternatives considered

- Relaxing the strict Protocol schemas was rejected because the rejected fields and timestamps were genuinely ambiguous or non-canonical, and accepting them would weaken the wire contract.
- Copying every MCP schema into the Skill was rejected because it would duplicate the Protocol and obscure the workflow. Only mistakes observed during a real model run and cross-call mappings that JSON Schema cannot express are repeated.
- Treating eventual recovery after runtime-source inspection as successful usability was rejected because a packaged user flow must work from the published Skill and tool schemas alone.
- Allowing arbitrary version-probe stderr was rejected because it would weaken fail-closed host identity checks for warnings unrelated to this known environment omission.
- Skipping the host version recheck inside MCP was rejected because the installed executable can change after setup and the release-bound capacity evidence is exact-version only.

## Consequences

The canonical Skill is slightly longer, but a fresh host model has concrete valid shapes at each previously failing boundary. Changing the Skill bytes also changes the canonical release digest, so host-capacity evidence must be regenerated and rebound before the package can install fail-closed. Codex-spawned MCP startup no longer depends on whether the host preserves `CODEX_HOME`, while unexpected version stderr still stops startup.

## Verification

- Assemble and validate byte-identical Codex and Claude Code Skill mirrors.
- Run the narrow Skill/release, host-capacity, CLI build, and packaged verifier checks.
- Install the rebuilt package into an empty isolated home and complete resolve, ingest, brief, commit, verified profile, prompt read, and correction without `invalid_input` or runtime-source inspection.
- Exercise Panel review, long-term person-Skill discovery in a fresh Codex process, and Plugin uninstall while preserving person data.
