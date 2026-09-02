# Distilly — Developer Preview

Diese Seite fasst die aktuelle Vorschau zusammen. Die vollständige, kanonische Anleitung steht im [Root-README](../../README.md).

Distilly verwandelt ausdrücklich bereitgestelltes Material in versionierte **Person Profiles for Agents**. Die aufrufbare Oberfläche bleibt ein Skill; Speicherung, Laufzeit, Review und Host-Lifecycle werden als lokales Plugin geliefert.

## Installation

Die Vorschau liegt im Branch `distilly-plugin` und ist derzeit für Codex verifiziert. Benötigt werden Node.js `22.19+` oder `24`, pnpm `10.32+` und eine lokale Codex-CLI:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Codex nach der Installation neu starten. Die Host-Integration lässt sich entfernen, ohne Personen, Profile oder Quellen zu löschen:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

Der Modellvertrag besteht aus genau fünf MCP-Tools: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` und `distilly_correct`.

## Aktueller Umfang

Die Vorschau akzeptiert ausgewählte TXT-, Markdown-, JSON- und SRT/VTT-Dateien, eingefügten Text und vom Nutzer ausgewählte öffentliche URLs. Codex ist verifiziert; Claude Code, Grok Bot, OpenCode, Pi agent und DeepSeek Harness (DSH) benötigen noch Community-Bindings und Fixtures.

Siehe [Roadmap](../../ROADMAP.md) und [Update 2026-09](../../UPDATES.md).
