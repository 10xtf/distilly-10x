<div align="center">

# 🧬 Distilly

**Früher: Colleague Skill / colleague-skill.**

![Distilly — Distill how they think into Person Profiles for Agents](../social-preview-distilly-v7.png)

### **Distill how they think.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;Dein Kollege hat gekündigt, dein Mentor hat seinen Abschluss gemacht, dein Teamkamerad wurde versetzt — und das ganze Playbook samt Kontext ist mit ihnen verschwunden?<br>
💞 &nbsp;Deine Familie, alte Freunde, dein Partner entfernen sich — und du willst das Gefühl festhalten, mit ihnen zusammen zu sein?<br>
🌟 &nbsp;Dein Lieblingsautor, dein Idol, ein Denker, dem du nie begegnen wirst — aber du willst wissen, was sie zu deiner Frage sagen würden?

</td></tr>
</table>

### ✨ Distilly macht aus Menschen wiederverwendbare Person Profiles.

<br>

Distilly destilliert die durch Quellen belegte Erfahrung, das Urteilsvermögen, die Stimme und die Arbeitsweisen einer Person zu einem wiederverwendbaren Person Profile für KI-Agenten und kompatible Bots.

Kollegen · Partner · Familie · alte Freunde · Idole · Personen des öffentlichen Lebens · fiktive Figuren — sogar du selbst

**Quellmaterial + deine Beschreibung → ein quellengestütztes Person Profile → dein Agent oder kompatibler Bot**

<br>

[🆕 Was ist neu](#-was-ist-neu-in-diesem-major-release) · [📦 Datenquellen](#-unterstützte-datenquellen) · [⚡ Installation](#-installation) · [🚀 Nutzung](#-nutzung) · [✨ Demo](#-demo)

[**Englisch**](../../README.md) · [**Chinesisch**](README_ZH.md) · [**Spanisch**](README_ES.md) · [**Japanisch**](README_JA.md) · [**Russisch**](README_RU.md) · [**Portugiesisch**](README_PT.md) · [**Koreanisch**](README_KO.md)

</div>

---

<div align="center">

### 🎉 Meilenstein 2026.08.13 — **Distilly hat 20K ⭐ überschritten!**

Riesigen Dank an alle, die einen Stern dagelassen haben — wir liefern weiter aus, destillieren weiter.

</div>

> 🧬 **Update 2026.08.24** — Der Creator heißt jetzt durchgängig **Distilly**. Lokale Skill-Erkennung wird für Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi, Grok Build und OpenCode unterstützt; Grok Bot bleibt ein separater Preview-Ablauf für gespeicherte Skills.

> 📝 **Update 2026.06.01** — **[Der technische Bericht zu COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) ist jetzt verfügbar**; am meisten freut uns nicht nur das Paper selbst, sondern dass die Community die Galerie auf 215 Skills von 165 Mitwirkenden und 100k+ kumulative Skill-Card-Stars gebracht hat, mit allen Community-Beiträgern in den Acknowledgements.

> 🗺️ **2026.04.13** — **Die Distilly-Roadmap ist da!** Das als colleague.skill gestartete Projekt heißt heute **Distilly** — destilliere jede Person, nicht nur Kollegen. 👉 **[Vollständige Roadmap](../../ROADMAP.md)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings)

</div>

---

## 🆕 Was ist neu in diesem Major-Release?

### 1️⃣ Von Colleague Skill zu Distilly

Distilly ist nicht mehr nur auf das „Kollegen“-Szenario ausgerichtet. Der `distilly`-Creator erstellt mit einem gemeinsamen Workflow quellengestützte Person Profiles für drei Personenfamilien und verpackt jedes Profil als Agent Skill. Der kanonische Name des Creator-Skills und seines Einstiegspunkts ist `distilly`.

### 2️⃣ Drei Charakter-Familien

<table>
<thead>
<tr>
<th width="33%" align="center">🧑‍💼 colleague</th>
<th width="33%" align="center">💞 relationship</th>
<th width="33%" align="center">🌟 celebrity</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><sub>Kollegen · Mentoren · Teamkameraden · vor- und nachgelagerte Partner</sub></td>
<td align="center"><sub>Ex-Partner · Partner · Eltern · Freunde · enge Familie</sub></td>
<td align="center"><sub>Personen des öffentlichen Lebens · Creator · öffentliche Stimmen · fiktive Figuren</sub></td>
</tr>
<tr>
<td><sub>Zwei-Schichten-Architektur Work Skill + Persona — lernt sowohl technische Standards und Workflows als auch Sprechweise und Haltung am Arbeitsplatz. Unterstützt automatische Erfassung über Slack.</sub></td>
<td><sub>🆕 <b>Foto-Sharing-Funktion kommt bald</b> — deine destillierte Beziehung beantwortet nicht nur Nachrichten; sie verschickt Fotos und teilt Ausschnitte aus ihrem Tag, so wie es eine echte Person tun würde.</sub></td>
<td><sub>Wird mit einer vollständigen <b>Recherche-Toolchain über sechs Dimensionen</b> ausgeliefert (Untertitel → Transkript-Bereinigung → Recherche-Merge → Qualitätsprüfung). Nicht bloß Tonimitation, sondern eine quellengestützte Rekonstruktion beobachtbarer Denk- und Entscheidungsmuster.</sub></td>
</tr>
</tbody>
</table>

Jede Familie hat ihre eigene Quellsammelstrategie, eigene Analysedimensionen und eine eigene Person-Profile-Struktur.

### 3️⃣ Mehr Agent-Hosts

Distilly unterstützt die lokale, native Skill-Erkennung auf acht Agent-Hosts:

- [Claude Code](https://claude.ai/code)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent)
- [OpenClaw](https://github.com/openclaw/openclaw)
- [Codex](https://github.com/openai/codex)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [Pi coding agent](https://pi.dev/docs/latest/skills)
- [Grok Build](https://docs.x.ai/build/features/skills-plugins-marketplaces)
- [OpenCode](https://opencode.ai/docs/skills)

Jedes generierte Person Profile wird als Agent Skill verpackt und kann in das Skill-Verzeichnis eines unterstützten Hosts gelegt werden.

**Grok Bot (Preview):** manuelle Migration als gespeicherter privater Skill. Die direkte Installation der `SKILL.md` dieses Repositories in Grok Bot ist weder offiziell dokumentiert noch verifiziert.

---

## 📦 Unterstützte Datenquellen

| Logo | Quelle | Nachrichten | Docs / Wiki | Hinweise |
|:----:|--------|:-----------:|:-----------:|----------|
| 📄 | PDF / Bilder / Screenshots | — | ✅ | Manueller Upload |
| ✉️ | E-Mail `.eml` / `.mbox` | ✅ | — | Manueller Upload |
| 📝 | Markdown / direkt einfügen | ✅ | ✅ | Manuelle Eingabe |

---

## ⚡ Installation

### 🤖 Für Agents

Öffne einen unterstützten lokalen Agent-Host und sende ihm:

> Installiere Distilly von https://github.com/10xtf/distilly-10x und prüfe anschließend, ob dieser Host Distilly erkennen kann.

Der Agent installiert das Repository im richtigen Skills-Verzeichnis des Hosts als Skill namens `distilly`.

### 👤 Für Menschen

```bash
git clone https://github.com/10xtf/distilly-10x <DISTILLY_SKILL_DIR>
```

Host-spezifische Pfade, Migration, Windows-Hinweise, die Installation erzeugter Profiles und Zugangsdaten findest du in der **[ausführlichen Installationsanleitung (INSTALL_EN.md)](../../INSTALL_EN.md)**.

---

## 🚀 Nutzung

> Verwende Distilly, um ein Person Profile für `<person>` zu erstellen.

1. Wähle `colleague`, `relationship` oder `celebrity`.
2. Beschreibe die Person oder stelle Materialien bereit; alle Felder sind optional.
3. Prüfe das Person Profile und bestätige anschließend die Erzeugung.

Das Ergebnis wird als Agent Skill namens `{character}-{slug}` verpackt.

Details zur Recherche mit `celebrity` und zu fortgeschrittenen Werkzeugen findest du in der **[ausführlichen Installationsanleitung (INSTALL_EN.md)](../../INSTALL_EN.md)**.

---

## ✨ Demo

Eines aus jeder Familie.

<br>

### 🌟 celebrity — Andrej Karpathy destillieren

> Recherche über sechs Dimensionen: Werke · Interviews · Entscheidungen · Ausdrucks-DNA · externe Bewertungen · Zeitstrahl<br>
> Fallbeispiel adaptiert aus der Community-Arbeit [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
User            ❯ Alle reden jetzt über Agents — wie sieht deiner Meinung nach der AI Agent von 2026 aus?

celebrity.skill ❯ Alle machen Demos, niemand macht Eval.
                  Der Flaschenhals bei Agents war nie die Modellintelligenz — es ist das Scaffolding:
                  ein striktes Evaluations-Harness, fein granularer Error-Replay,
                  kontrollierbare Tool-Call-Budgets, saubere Failure-Mode-Analyse.
                  Die meisten Produkte hängen immer noch bei „eine API + ein paar Tools + ein System-Prompt" fest.
                  Das ist eine Demo, kein Agent.
                  In 2026 setze ich nicht auf das stärkste Modell — ich setze auf das beste
                  Scaffolding und die strengste Eval.
```

<br>

### 🧑‍💼 colleague — einen ByteDance L2-1 Backend destillieren

> Input: `ByteDance L2-1 Backend-Engineer, INTJ, Schuldabwälzer, ByteDance-Stil`

```
User            ❯ Kannst du dieses API-Design reviewen?

colleague.skill ❯ Moment — was ist der Impact? Du hast den Kontext nicht erklärt.
                  (nach dem Lesen) N+1-Query, beheben. Verwende das Standard-
                  Response-Format {code, message, data}. Das ist die Spec,
                  frag nicht warum.

User            ❯ Dieser Bug wurde von dir eingeführt, oder?

colleague.skill ❯ Passt der Zeitstrahl? Das Feature hat mehrere Stellen berührt,
                  es gab auch andere Änderungen.
```

<br>

### 💞 relationship — jemanden destillieren, in den du verknallt bist

> Lade ein halbes Jahr Chatverlauf hoch + „sensibel, still aber stur, antwortet aber wirklich ernsthaft, wenn es darauf ankommt"

```
User               ❯ Hast du heute an mich gedacht?

relationship.skill ❯ ...ja, ein bisschen. Warum fragst du?
```

---

## 🔧 Funktionen

### 🧱 Struktur des generierten Skills

Distilly verwendet **Persona** als universelle Basis, mit familienspezifischen Modulen darüber:

| Familie | Persona-Inhalt | Zusätzliche Module |
|---------|----------------|--------------------|
| 🧑‍💼 **colleague** | 6-Schichten-Persönlichkeit: harte Regeln → Identität → Ausdruck → Entscheidungen → Zwischenmenschliches → Korrektur | ➕ **Work Skill**: Zuständigkeitsbereich, Workflow, Output-Präferenzen, Erfahrungswissensbasis |
| 💞 **relationship** | Ausdrucks-DNA · emotionale Auslöser · Konfliktmuster · Versöhnungsmuster | — |
| 🌟 **celebrity** | Mentale Modelle · Entscheidungsheuristiken · Ausdrucks-DNA · Kontrast zur externen Bewertung | ➕ Recherche-Dossier über sechs Dimensionen (Werke / Interviews / Entscheidungen / Zeitstrahl...) |

> **Ausführung**: Aufgabe empfangen → Persona bestimmt Haltung & Ton → zusätzliche Module liefern Ausführungsdetails → Ausgabe in ihrer Stimme

### 🧬 Evolution

- 📥 **Dateien anfügen** → automatische Delta-Analyse → Merge in die relevanten Abschnitte, überschreibt nie bestehende Schlussfolgerungen
- 💬 **Gesprächskorrektur** → sage „so würden sie das nicht tun, sie wären xxx" → wird in die Korrekturschicht geschrieben, wirkt sofort
- 🕰️ **Versionskontrolle** → automatische Archivierung bei jedem Update, Rollback zu jeder früheren Version
- 🔬 **Celebrity-Recherche-Pipeline** → Untertitel → Transkript-Bereinigung → Recherche über sechs Dimensionen → Qualitätsprüfung

---

## ⚠️ Hinweise

**Qualität des Quellmaterials = Qualität des Person Profiles** — und gute Quellen unterscheiden sich zwischen den Familien:

| Familie | Quellen-Priorität (hoch → niedrig) |
|---------|------------------------------------|
| 🧑‍💼 **colleague** | **Selbst verfasste Langtexte** (Design-Docs / Review-Kommentare) **›** **Entscheidungsantworten** **›** beiläufiger Gruppenchat |
| 💞 **relationship** | Vollständiger Chatverlauf **›** Briefe / Social-Posts / Tagebücher **›** Beschreibungen durch Dritte |
| 🌟 **celebrity** | Ausführliche Primärquellen (Bücher / Blogs / lange Interviews in der ersten Person) **›** Entscheidungsaufzeichnungen (Launches, Commits, Q&A) **›** verifizierte kurze Posts der Zielperson **›** Kommentare Dritter |

- **relationship**: längere Zeiträume sind besser; Material, das sowohl Konflikt als auch Versöhnung abdeckt, ist ideal
- **celebrity**: füttere nicht nur mit Sekundärinterpretationen
- Dies ist noch eine Demo-Version — bitte erstelle Issues, wenn du Bugs findest!

---

## 📄 Technischer Bericht

> **[COLLEAGUE.SKILL: Automated AI Skill Generation via Expert Knowledge Distillation](https://arxiv.org/pdf/2605.31264)** ([arXiv](https://arxiv.org/abs/2605.31264) · [arXiv PDF](https://arxiv.org/pdf/2605.31264))
>
> Dies ist das Paper für **colleague.skill**, den Vorgänger von Distilly. Es behandelt die Zwei-Schichten-Architektur Work Skill + Persona, die Multi-Source-Datenerfassung und die Mechanik der Skill-Generierung — die theoretische Grundlage für die heutige `colleague`-Familie. Separate Papers zu den Erweiterungen der relationship- / celebrity-Familien sind geplant.

---

<div align="center">

**MIT License** © [titanwings](https://github.com/titanwings)

<sub>Made with 🧬 for everyone who wants to distill a person into a reusable Person Profile.</sub>

</div>
