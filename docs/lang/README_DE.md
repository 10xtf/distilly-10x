# Distilly — Developer Preview

Diese Seite fasst die aktuelle Vorschau zusammen. Die vollständige, kanonische Anleitung steht im [Root-README](../../README.md).

Distilly verwandelt ausdrücklich bereitgestelltes Material in versionierte **Person Profiles for Agents**. Die aufrufbare Oberfläche bleibt ein Skill; Speicherung, Laufzeit, Review und Host-Lifecycle werden als lokales Plugin geliefert.

## Installation

Die Vorschau liegt im Branch `distilly-plugin` und ist derzeit für Briefings mit Codex verifiziert. Benötigt werden Node.js `22.19+` oder `24`, pnpm `10.32+` und eine lokale Codex-CLI:

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

Für OpenClaw und Hermes gibt es jetzt lokale Kompatibilitäts-Bindings. OpenClaw installiert und entdeckt das Claude-kompatible Bundle; Hermes installiert den verwalteten Skill und registriert denselben MCP-Server über Wrapper und Konfiguration. Beide Bindings führen Smoke-Checks für Installation, Discovery und die fünf Tools aus. Für diese beiden Hosts gibt es in dieser Version noch kein exaktes Briefing-Kapazitäts-Fixture; deshalb bricht das Setup vor dem Briefing sicher ab und behauptet keine vollständige Destillation.

Der Modellvertrag besteht aus genau fünf MCP-Tools: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` und `distilly_correct`.

## Kompatibilität mit dem Legacy Skill

Die oben genannten Node.js-, pnpm- und Codex-Voraussetzungen gelten nur für das native Codex-Plugin; der Legacy-Modus benötigt Codex, Node.js und pnpm nicht, setzt für den vollständigen alten Ablauf aber die normale Skill-Unterstützung des Hosts sowie Zugriff auf Dateisystem, Bash und Python voraus.

Codex ist derzeit der einzige Host mit verifizierter Briefing-Kapazität für das `distilly-plugin`-Plugin. OpenClaw und Hermes besitzen Kompatibilitäts-Bindings, aber noch kein exaktes Kapazitäts-Fixture. Für einen lokalen Skill-Host ohne verifiziertes Plugin-Binding kann der Nutzer ausdrücklich den gepflegten Legacy Skill aus dem Branch `dot-skill` installieren:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

Das ist eine getrennte Implementierung ohne unterstütztes gemeinsames Datenmodell. Legacy-Collector können den Namensraum `~/.distilly` verwenden; solange diese Überschneidung nicht isoliert und geprüft ist, dürfen Legacy- und Plugin-Pfad nicht gemeinsam verwendet werden. Die Kompatibilität deckt derzeit nur lokale Dateien und eingefügten Text ab. Sie bietet weder die SQLite-Autorität, die fünf MCP-Tools, das Panel noch den Plugin-Lifecycle der Preview. Nach einem fehlgeschlagenen Plugin-Setup oder Preflight erfolgt kein automatischer Wechsel. Im selben Discovery-Bereich eines Hosts darf nur eine aktive Installation namens `distilly` vorhanden sein; andere Kopien müssen vor dem Neustart deaktiviert oder entfernt werden. Der Import eines lokalen Skill-Repositorys für Grok Bot ist noch nicht verifiziert; derzeit wird dort nur ein manuell gespeicherter/privater Skill empfohlen.

## Aktueller Umfang

Die Vorschau akzeptiert ausgewählte TXT-, Markdown-, JSON- und SRT/VTT-Dateien, eingefügten Text und vom Nutzer ausgewählte öffentliche URLs. Codex ist für Briefings verifiziert. OpenClaw und Hermes bestehen lokale Kompatibilitäts-Smoke-Checks für Installation, Discovery und fünf Tools, benötigen aber noch exakte Kapazitäts-Fixtures, bevor ein Briefing-Setup erfolgreich sein kann. Für Claude Code, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode und Grok Bot fehlen noch Community-Fixtures; für Grok Bot ist außerdem kein lokaler Repository-Import verifiziert.

Siehe [Roadmap](../../ROADMAP.md) und [Update 2026-09](../../UPDATES.md).
