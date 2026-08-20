# docs

Documentation is split by job. Do not dump a second copy of a fact into another folder.

| Folder / file | Job | Read when |
|---|---|---|
| [AGENTS.md](AGENTS.md) | How docs are placed and written | Writing or moving any doc |
| [architecture.md](architecture.md) | What the live tree is *now* | Every session that touches product code |
| [design/](design/README.md) | Approved target design; it does not prove implementation | Implementing or changing product behavior |
| [design/system-v3.md](design/system-v3.md) | The in-force productized host-LLM contract, uncut | First product session; any change to packages, protocol, profile, Panel, plugins, or gates |
| [design/v3/](design/v3/) | Generated topic projections of the in-force contract | Loading one topic without the whole file |
| [design/system-v2.md](design/system-v2.md), [design/v2/](design/v2/), [design/system-v1.md](design/system-v1.md), [design/v1/](design/v1/) | Deprecated contracts, kept as history | Recovering why an earlier alternative lost |
| [cookbook/](cookbook/README.md) | Procedures for APIs that are already shipped | Performing a supported maintenance task |
| [development.md](development.md) | Clone, branch, which checks to run | Setup and push |
| [testing.md](testing.md) | What a green test must prove | Writing or reviewing tests |
| [process/](process/README.md) | Review contract and bug classes to look for | Reviewing a PR |
| `lang/` | Published user translations of the skill README | User-facing skill docs only |
| `PRD.md`, `SKILL_TYPE_ABSTRACTION_DESIGN.md` | Historical colleague-skill product notes | Do not treat as distilly contract |

Product work reads **design first**, then architecture to learn what already exists. Use a cookbook only when the referenced API is shipped. Agent Notes record why a change departed from a locked item or closed an open item in design §3.
