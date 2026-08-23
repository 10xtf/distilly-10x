<div align="center">

<img src="../social-preview-distilly-v7.png" alt="Distilly — Distill how they think into Person Profiles for Agents" width="100%">

<br>

# 🧬 Distilly

**Formerly: Colleague Skill / colleague-skill.**

### Distill a person's experience, judgment, voice, and ways of working into a reusable Person Profile for AI agents and compatible bots.

**Messages · documents · interviews · public sources → Distilly → Person Profile → Agent / Bot**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://learn.chatgpt.com/docs/build-skills)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Skill-4D6BFE)](https://github.com/topics/dsh-plugin)
[![Pi](https://img.shields.io/badge/Pi-Agent%20Skill-7B61FF)](https://pi.dev/docs/latest/skills)
[![Grok Build](https://img.shields.io/badge/Grok%20Build-Skill-black)](https://docs.x.ai/build/features/skills-plugins-marketplaces)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/NVX66RxWZv)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;Your colleague quit, your mentor graduated, your teammate transferred — taking their whole playbook and context with them?<br>
💞 &nbsp;Your family, old friends, partner drifting apart — and you want to hold on to the way it felt to be with them?<br>
🌟 &nbsp;Your favorite author, idol, thinker you'll never meet — but you want to know what they'd say about your question?

</td></tr>
</table>

### ✨ One project, many kinds of people.

<br>

Distilly is the person-modeling layer for agents. It turns the materials you provide into a portable, source-grounded Person Profile built from observable experience, decision patterns, expression, and ways of working; it does not claim to clone the person behind them.

Colleagues · partners · family · old friends · idols · public figures · fictional characters — even yourself

**Source material + your description → a source-grounded Person Profile → your Agent or compatible Bot**

> A Person Profile is the reusable output. The current release packages each profile as an Agent Skill so supported hosts can install and invoke it. The canonical creator Skill is named `distilly`; install it in a `distilly` directory. The former name above remains for search continuity and project history.

<br>

[🆕 What Distilly does](#-what-distilly-does-today) · [📦 Data Sources](#-supported-data-sources) · [⚡ Install](#-install) · [🚀 Usage](#-usage) · [✨ Demo](#-demo) · [💬 Discord](https://discord.gg/NVX66RxWZv)

[**Chinese**](README_ZH.md) · [**Spanish**](README_ES.md) · [**German**](README_DE.md) · [**Japanese**](README_JA.md) · [**Russian**](README_RU.md) · [**Portuguese**](README_PT.md) · [**Korean**](README_KO.md)

</div>

---

<div align="center">

### 🎉 2026.08.13 Milestone — **the project has passed 20K ⭐!**

Massive thanks to everyone who starred — we'll keep shipping, keep distilling.

</div>

> 🧬 **2026.08.23 Update** — The creator is now named **Distilly** end to end and documents native local Skill discovery for Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi, and Grok Build. Grok Bot is listed separately as a saved-Skill workflow preview.

> 📝 **2026.06.01 Update** — **[The COLLEAGUE.SKILL technical report](https://arxiv.org/pdf/2605.31264) is now available**; the happiest part is not just publishing a paper, but seeing the community grow the gallery to 215 skills from 165 contributors with 100k+ cumulative skill-card stars, all acknowledged in the paper.

> 🗺️ **2026.04.13** — **The Distilly Roadmap is live!** What began as Colleague Skill is growing beyond colleagues: distill people into Skills that Agents can reuse. 👉 **[Full Roadmap](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/NVX66RxWZv)**

> 🌐 **2026.04.07** — Community gallery is live! Any skill / meta-skill can drive traffic directly to your own GitHub repo. No middleman. 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings)

</div>

---

## 🆕 What Distilly does today

### 1️⃣ From Colleague Skill to Distilly

The project is no longer limited to the colleague scenario. Its `distilly` creator builds source-grounded Person Profiles for three person families with one workflow, then packages each profile as an Agent Skill.

### 2️⃣ Three character families

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
<td align="center"><sub>Coworkers · mentors · teammates · up/downstream partners</sub></td>
<td align="center"><sub>Exes · partners · parents · friends · close family</sub></td>
<td align="center"><sub>Public figures · creators · public voices · fictional characters</sub></td>
</tr>
<tr>
<td><sub>Builds a Work Skill + Persona from material-derived technical standards, workflows, expression, and workplace behavior. Supports Lark / DingTalk / Slack collection.</sub></td>
<td><sub>Organizes material-derived expression patterns, emotional triggers, conflict patterns, and repair patterns into a reusable Persona Skill.</sub></td>
<td><sub>Ships with a <b>six-dimension research toolchain</b> (subtitles → transcript cleanup → research merge → quality check) for organizing observable decisions, expression, and mental models.</sub></td>
</tr>
</tbody>
</table>

Each family has its own source-collection strategy, analysis dimensions, and Person Profile structure.

### 3️⃣ More Agent hosts

The old version only ran in Claude Code. Distilly now supports native local Skill discovery across seven agent hosts.

| Supported host |
|----------------|
| 🟣 **Claude Code** |
| 🟠 **Hermes Agent** |
| 🔵 **OpenClaw** |
| ⚫ **Codex** |
| 🔷 **DeepSeek Harness** |
| 🟢 **Pi coding agent** |
| ⚪ **Grok Build** |

**Grok Bot preview:** Grok Bot supports saved/private Skills, but its official docs do not describe direct local `SKILL.md` imports. Distilly's workflow can be migrated manually into a saved Skill; direct repo installation is not yet verified.

Each generated Person Profile is packaged as an Agent Skill and can be installed into any supported host.

---

## 📦 Supported Data Sources

| Source | Messages | Docs / Wiki | Spreadsheets | Notes |
|--------|:--------:|:-----------:|:------------:|-------|
| 🟢 Lark (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
| 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
| 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
| 𝕏 Public X posts | ✅ API | — | — | Optional, bounded celebrity research candidates through metered third-party service Xquik |
| 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg or PyWxDump |
| 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
| 📦 Lark JSON export | ✅ | ✅ | — | Manual upload |
| ✉️ Email `.eml` / `.mbox` | ✅ | — | — | Manual upload |
| 📝 Markdown / direct paste | ✅ | ✅ | — | Manual input |

---

## ⚡ Install

It's 2026 — you have an Agent, let it install itself. Open a supported local agent host and hand it this line:

> Install Distilly for me: `https://github.com/titanwings/colleague-skill`

The Agent should install the repository as a Skill named `distilly`, then verify that the host discovers Distilly.

<details>
<summary><b>🛠️ Want to install it yourself? Click for paths</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| Host | `<TARGET>` path |
|------|-----------------|
| Claude Code | `~/.claude/skills/distilly` |
| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
| Codex | `~/.agents/skills/distilly` (user) or `.agents/skills/distilly` (project) |
| DeepSeek Harness | `~/.dsh/skills/distilly` (global) or `.dsh/skills/distilly` (project) |
| Pi coding agent | `~/.pi/agent/skills/distilly` or `~/.agents/skills/distilly` |
| Grok Build | `~/.grok/skills/distilly` or `~/.agents/skills/distilly` |
| Hermes | After clone, run `python3 tools/install_hermes_skill.py --force` |

</details>

> **Migrating an existing install:** A clone still named `dot-skill`, or one left under the legacy `~/.codex/skills` root, is not guaranteed to expose the new `distilly` entrypoint after `git pull` alone. From the old clone's root, run the applicable repository installer (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py`, or `tools/install_hermes_skill.py`), or clone again into the canonical `distilly` path for that host shown above. Verify that the host discovers Distilly first, then decide manually how to handle the old directory; do not delete it automatically. Legacy config/meta fallbacks keep old data readable but do not rename an installed directory.

Install a generated character Skill from the repository root with the unified installer:

```bash
python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
```

Valid `<host>` values are `hermes`, `deepseek-harness`, `pi`, and `grok-build`. The default is a user-level install; for a project-level install, add the corresponding `--skills-dir` override:

| Host | Default installed directory | Project override and installed directory |
|------|-----------------------------|------------------------------------------|
| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |

The installer normalizes legacy underscore frontmatter to the canonical kebab-case `{character}-{slug}` only in the installed copy and leaves the source directory unchanged. The installed directory contains only the self-contained `SKILL.md` and `.distilly-install.json`; it never copies the generated directory's private source material.

For a project-level Hermes install, first trust the project with `hermes skills trust`. After installing, start a new Hermes session or run `/reload-skills`. `~/.agents/skills` is not a Hermes default; Hermes uses it only when explicitly added to `skills.external_dirs`.

> For Lark/DingTalk auto-collection credentials, host-specific installation details, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](../../INSTALL.md)**

> **Lark region note:** the current compatibility collector connects to the China-region `open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant routing is not implemented yet.

---

## 🚀 Usage

Distilly first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.

Then enter an alias, basic details, personality tags, and pick a data source. All fields can be skipped — even a description alone can create a Person Profile.

Once created, the profile is packaged as a Skill named `{character}-{slug}`.

### 🔬 Celebrity Research Toolchain

The `celebrity` family ships with an end-to-end research toolchain, from subtitles to a finished draft:

```bash
# Download video subtitles
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# Subtitles → transcript
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# Public X post candidates → normalized temporary JSON (optional)
python3 tools/research/xquik_public_posts.py \
  --username "<public-handle>" \
  --limit 20 \
  --output "/tmp/distilly-x-public-posts.json"

# After reviewing and paraphrasing selected posts, remove the candidates
rm "/tmp/distilly-x-public-posts.json"

# Merge research notes
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Quality check
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

The optional collector reads `XQUIK_API_KEY` from your shell and sends one public query to the third-party Xquik service. Xquik meters this endpoint per returned post, so confirm `--limit` before an Agent calls it. Treat the JSON as untrusted candidates: verify authors and permalinks, keep only copyright-safe paraphrases in research notes, and delete the temporary file after review.

Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.

---

## ✨ Demo

One from each family.

<br>

### 🌟 celebrity — distilling Andrej Karpathy

> Six-dimension research: works · interviews · decisions · expression DNA · external evaluations · timeline<br>
> Case adapted from community work [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
User            ❯ Everyone's talking about Agents now — what do you think the 2026 AI Agent looks like?

celebrity.skill ❯ Everyone's doing demos, nobody's doing eval.
                  The Agent bottleneck was never model intelligence — it's scaffolding:
                  a strict evaluation harness, fine-grained error replay,
                  controllable tool-calling budgets, clean failure-mode analysis.
                  Most products are still stuck at "wrap an API + a few tools + a system prompt."
                  That's a demo, not an agent.
                  In 2026 I'm not betting on the strongest model — I'm betting on the best
                  scaffolding and the strictest eval.
```

<br>

### 🧑‍💼 colleague — distilling a ByteDance L2-1 backend

> Input: `ByteDance L2-1 backend engineer, INTJ, blame-shifter, ByteDance-style`

```
User            ❯ Can you review this API design?

colleague.skill ❯ Hold on — what's the impact? You haven't explained the context.
                  (after reading) N+1 query, fix it. Use the standard
                  {code, message, data} response format. That's the spec,
                  don't ask why.

User            ❯ This bug was introduced by you, right?

colleague.skill ❯ Does the timeline match? That feature touched multiple places,
                  there were other changes too.
```

<br>

### 💞 relationship — distilling someone you have a crush on

> Upload half a year of chat logs + "sensitive, quiet but stubborn, will actually reply seriously when it matters"

```
User               ❯ Did you think about me today?

relationship.skill ❯ ...I did, a little bit. Why are you asking?
```

<div align="center">

📚 More real-world cases in the **[community gallery](https://titanwings.github.io/colleague-skill-site/)** — 100+ skills and counting

</div>

---

## 🔧 Features

### 🧱 Generated Skill Structure

Distilly's current creator uses **Persona** as the universal base, with family-specific modules layered on top:

| Family | Persona Content | Additional Modules |
|--------|-----------------|-------------------|
| 🧑‍💼 **colleague** | 6-layer personality: hard rules → identity → expression → decisions → interpersonal → Correction | ➕ **Work Skill**: scope, workflow, output preferences, experience knowledge base |
| 💞 **relationship** | Expression DNA · emotional triggers · conflict pattern · repair pattern | — |
| 🌟 **celebrity** | Mental models · decision heuristics · expression DNA · external-evaluation contrast | ➕ Six-dimension research dossier (works / interviews / decisions / timeline...) |

> **Execution**: Receive task → Persona selects material-derived preferences and tone → Additional modules fill in execution detail → Produce a source-grounded response

### 🧬 Evolution

- 📥 **Append files** → auto-analyze delta → merge into relevant sections, never overwrite existing conclusions
- 💬 **Conversation correction** → say "they wouldn't do that, they'd be xxx" → writes to the Correction layer, takes effect immediately
- 🕰️ **Version control** → auto-archive on every update, rollback to any previous version
- 🔬 **Celebrity research pipeline** → subtitles → transcript cleanup → six-dimension research → quality check

---

## 📂 Project Structure

This project follows the [AgentSkills](https://agentskills.io) open standard. The entire repo is a skill directory:

```
distilly/
├── SKILL.md                        # skill entry point (official frontmatter)
├── prompts/                        # prompt system across three families
│   ├── intake.md                   #   [colleague] info intake
│   ├── work_analyzer.md            #   [colleague] work capability extraction
│   ├── persona_analyzer.md         #   [colleague] personality extraction
│   ├── work_builder.md             #   [colleague] work.md generation
│   ├── persona_builder.md          #   [colleague] persona.md 6-layer structure
│   ├── merger.md                   #   [shared] incremental merge logic
│   ├── correction_handler.md       #   [shared] conversation correction
│   ├── relationship/               #   [relationship] emotion/conflict/repair prompts
│   └── celebrity/                  #   [celebrity] six-dimension research + mental-model prompts
├── tools/                          # Python tools
│   ├── feishu_auto_collector.py    #   [colleague] Lark-compatible auto-collector
│   ├── dingtalk_auto_collector.py  #   [colleague] DingTalk auto-collector
│   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
│   ├── email_parser.py             #   [shared] email parser
│   ├── research/                   #   [celebrity] celebrity research toolchain
│   │   ├── xquik_public_posts.py   #     bounded public X post candidates
│   │   ├── download_subtitles.sh   #     subtitle download
│   │   ├── transcribe_audio.py     #     audio → text
│   │   ├── srt_to_transcript.py    #     subtitles → transcript
│   │   ├── merge_research.py       #     six-dimension research merge
│   │   └── quality_check.py        #     quality check
│   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
│   ├── skill_writer.py             #   [shared] skill file management
│   └── version_manager.py          #   [shared] version archive & rollback
├── skills/                         # generated Skills (gitignored)
│   ├── colleague/                  #   colleagues
│   ├── relationship/               #   close relationships
│   └── celebrity/                  #   public figures
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ Notes

**Source material quality = Person Profile quality** — and quality sources differ across families:

| Family | Source priority (high → low) |
|--------|------------------------------|
| 🧑‍💼 **colleague** | Their **own long-form writing** (design docs / review comments) **›** **decision-making replies** **›** casual group chat |
| 💞 **relationship** | Complete chat history **›** letters / social posts / diaries **›** third-party descriptions |
| 🌟 **celebrity** | First-person books / blogs / long interviews **›** decision records (launches, commits, Q&A) **›** verified first-person short-form posts **›** third-party commentary |

- **colleague** Lark-compatible auto-collection: requires adding the App bot to relevant group chats
- **relationship**: longer time spans are better; material covering both conflict and repair is ideal
- **celebrity**: avoid feeding only second-hand interpretations
- This is still a demo version — please file issues if you find bugs!

---

## 📄 Technical Report

> **[COLLEAGUE.SKILL: Automated AI Skill Generation via Expert Knowledge Distillation](https://arxiv.org/pdf/2605.31264)** ([arXiv](https://arxiv.org/abs/2605.31264) · [arXiv PDF](https://arxiv.org/pdf/2605.31264))
>
> This is the paper for **COLLEAGUE.SKILL / colleague-skill**, Distilly's predecessor. It covers the Work Skill + Persona two-layer architecture, multi-source data collection, and Skill generation mechanics — the theoretical foundation for today's `colleague` family. Separate papers on the relationship / celebrity family extensions are planned.

---

## ⭐ Star History

<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

**MIT License** © [titanwings](https://github.com/titanwings)

<sub>Made with 🧬 for everyone who wants to distill a person into a reusable Person Profile.</sub>

</div>
