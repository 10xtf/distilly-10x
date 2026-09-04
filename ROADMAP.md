<div align="center">

# Distilly Roadmap

### From Colleague Skill (`colleague.skill`) to Distilly — Distill people into reusable Skills for AI agents and compatible bots

<br>

We started with a simple idea: **when a colleague leaves, their knowledge walks out the door. Can we keep it?**

In two weeks, 13,000+ people gave us the answer.

But the community showed us this goes far beyond colleagues —
you distilled professors, exes, yourselves, even fictional characters.

**So we decided to evolve Colleague Skill (`colleague.skill`) into Distilly.**

Anyone can become a reusable `.skill` for AI agents and compatible bots.

<br>

*Last updated: 2026-08-23*

[**Chinese**](docs/lang/ROADMAP_ZH.md) · [**Spanish**](docs/lang/ROADMAP_ES.md) · [**German**](docs/lang/ROADMAP_DE.md) · [**Japanese**](docs/lang/ROADMAP_JA.md) · [**Russian**](docs/lang/ROADMAP_RU.md) · [**Portuguese**](docs/lang/ROADMAP_PT.md) · [**Korean**](docs/lang/ROADMAP_KO.md)

</div>

---

## What's Done (v1.0)

| Capability | Status |
|------------|:------:|
| `/distilly` creation workflow with family selection | Done |
| Email / PDF / image / Markdown import | Done |
| Work Skill + Persona dual-model architecture | Done |
| Conversation corrections & incremental evolution | Done |
| Version control & rollback | Done |

> **Removed in this fork.** Slack auto-collection and WeChat chat-history import
> are no longer part of the product. Both depended on external-call collectors
> that were deleted during the security review, together with the WeCom and
> iMessage auto-read plans. Source material now arrives only through file upload
> and pasted text.

---

## Current and Next

### Phase 1 — Community Building

> 13k stars shouldn't just be a number. We want everyone to be part of this.

**What you'll see:**

- **GitHub Discussions** — no more chatting in Issues, we'll have dedicated discussion spaces
- **`CONTRIBUTING.md`** — clear contribution guide, beginner-friendly
- **`good-first-issue` labels** — starter tasks for new contributors
- **v1.0.0 official release** — first versioned Release, no more "just pull from main"
- **Public roadmap board** — you're reading it now, but we'll also have a live GitHub Projects version

**You can help:** translate docs, submit your .skill, test on Windows, help triage Issues

---

### Phase 2 — Distilly: Beyond Colleagues (core shipped)

> Colleague Skill (`colleague.skill`) was the beginning. Distilly is the future.

**Shipped:**

- **`/distilly` universal entry** — choose `colleague`, `relationship`, or `celebrity`, then distill anyone
- **Portable generated Skills** — canonical `{character}-{slug}` names for supported agent hosts

**Next additions:**

- **Gallery category upgrade** — Colleague / Celebrity / Relationship / Character / Self / Meta-Skill, browse by type
- **More data sources**
  - Windows compatibility fix

**You can help:** submit person-type requests, build new data source collectors, join Gallery design discussions

---

### Phase 3 — Skill Ecosystem

> When one person becomes a skill, can a group of people become a team?

**We're exploring:**

- **Multi-skill collaboration** — `/meeting @hong-gil-dong @gim-cheol-su @bak-yeong-hui`, three personas discuss a topic together
- **Relationship graph** — define persona dynamics: who partners with whom, where the tension lies
- **One-click install** — install community skills like plugins
- **Active evolution** — skills periodically absorb new data sources, staying up to date

**You can help:** propose your ideal skill composition scenarios, join distribution mechanism design discussions

---

### Phase 4 — Multimodal: Bring Them to Life

> Right now, .skills can only talk. We want them to send photos, stickers, speak in their voice, and eventually make videos.

**Step 1: Visual expression**
- Auto-send persona-style stickers and memes in conversation
- Generate "life photos" in their style — what would they post today?
- Each skill gets its own sticker pack and image assets

**Step 2: Voice**
- Speak in their voice — clone from meeting recordings, voice messages
- Send voice replies directly in chat

**Step 3: Video (exploratory)**
- Short-form "a day in their life" generation
- Digital human / animated avatar

**You can help:** share multimodal use case ideas, contribute sticker assets, test voice cloning

---

## Get Involved

| How | Where |
|-----|-------|
| Discuss & propose | [GitHub Discussions](https://github.com/10xtf/distilly-10x/discussions) (coming soon) |
| Report bugs | [Issue](https://github.com/10xtf/distilly-10x/issues/new) |
| Contribute code | Look for `good-first-issue` labels, or just open a PR |

**We especially need:**
- Windows users — help us test and fix compatibility issues
- Multilingual speakers — help translate documentation
- Data source developers — build new collectors (Notion, Google Docs...)
- Designers — the Gallery and website need your eye

---

<div align="center">

**This roadmap belongs to the community. Priorities shift based on your feedback.**

Have ideas? Come to or start a Discussion.

Every `.skill` is a relationship continued.

</div>
