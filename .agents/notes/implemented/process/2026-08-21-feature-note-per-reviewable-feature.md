# Agent Note: One dedicated Note per reviewable feature

Status: implemented

## Problem

The governed-diff gate accepted any modified Agent Note. A new feature could therefore append implementation decisions to a long-running aggregate Note, turning “one home” into one giant document and preventing the feature from being reviewed or moved through its lifecycle independently.

## Decision

Every reviewable feature commit owns one concise dedicated Note. Aggregate Notes retain overall direction and link to feature Notes rather than repeating their rationale. A governed range is satisfied only by an added Note or by renaming the same Note from `proposed` to `implemented` or `rejected`; modifying an existing Note or renaming it within one lifecycle is insufficient. Semantic review still rejects multiple features hidden behind one Note because path inspection cannot infer product scope. Existing historical Notes are not reorganized by this rule.

## Alternatives considered

- **Ban only the two current aggregate Notes** — rejected because the same failure would recur under a new filename.
- **Require exactly one changed Note per PR range** — rejected because one push or PR may contain several already-separated feature commits.
- **Infer feature count from packages or directories** — rejected because one vertical slice legitimately crosses implementation, tests, generated files, and documentation.

## Consequences

Follow-on bug fixes and governance changes create their own Note instead of rewriting an earlier owner. A proposal may still be written before implementation and then lifecycle-renamed in its feature commit. The gate proves fresh path ownership, not Note quality or exact feature count, so semantic review remains required.

## Verification

Verifier fixtures reject a governed diff accompanied only by a modified Note or same-lifecycle rename and accept an added Note plus both allowed proposal lifecycle transitions. The focused 24-test suite, Ruff, compile, Markdown formatting, documentation links, Note structure, and whitespace checks pass.
