# Defensive patterns

Python-sized bug classes for this repository, drawn from what has actually broken in this tree.

## Credentials

- Never commit tokens, cookies, or personal dumps.
- Adapter secret field names end in `_token`, `_secret`, or `_key`. The framework stores them; adapters do not print them.
- Config that holds secrets goes under the user home (planned `~/.distilly/adapters.toml`) with mode `0600`.
- Interactive telemetry may ask once. Non-interactive runs refuse and do not write a preference file.

## Adapters and I/O

- `SourceAdapter` constructors do no network and no credential I/O.
- Adapters do not write SQLite, blobs, or projections. Yield `Material`; the Engine normalizes, hashes, dedupes, and records lineage.
- `DirectAdapter.collect` is a generator: yield partial success before raising.
- Parse failure on delegated artifacts is `AdapterUnavailable` and not retryable.

## Subprocess and teardown

- Own every process, temp directory, database connection, and Engine service you start. Close on success, failure, and timeout; closing one client must not stop a root service still borrowed by another client.
- An empty `except` names what it swallows and why nothing else can reach it. Keep the `try` to one statement.
- A business mutation uses one short SQLite write transaction and rechecks generation, lease, current/candidate revision, and RequestId inside it. Do not hold that transaction across host research, model work, user editing, or network I/O.
- Blob bytes are durably put before a database reference. An abort may leave an unreferenced blob; generic GC owns that cleanup instead of the mutation path.

## Publication

- Do not make a profile version visible until `commit` accepts the draft and its one SQLite transaction commits. A host briefing and an unreferenced blob are not versions.
- A risky candidate becomes `suspended` in the same transaction without moving `current`.
- Projection builders consume a consistent authority snapshot, publish a source generation/LSN, and never decide whether a mutation committed. Missing or stale projection output is rebuilt or reported unavailable.
- Ordinary reads validate only the rows and blobs they return. Exhaustive lineage, evidence, renderer, and reachability checks belong to doctor, restore, and import.
