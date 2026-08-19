# Design

This folder is the approved target contract. It describes what the product must become; it is not evidence that an API is shipped.

[system-v2.md](system-v2.md) is the **in-force** contract and is **self-contained**: it defines its own vocabulary in §0 and every value type in §10, so no reader needs any other document, including the previous design. [v2/](v2/) contains generated topic projections so an agent can load one section.

[system-v1.md](system-v1.md) and [v1/](v1/) are **deprecated**. v1 specified the same product in Python. Every language-neutral conclusion was restated in v2, so v1 is read only to recover which alternative lost an argument. Do not edit it to keep it consistent, and do not cite it as a requirement.

Edit only a `system-v*.md` parent, then run `python3 scripts/sync_design_chapters.py`. `python3 -B scripts/verify_docs.py` fails if a generated chapter drifts. A new corpus is a `Corpus` entry in that script, never a hand-written folder.

`docs/architecture.md` is the shipped-state map. It is not a substitute for this folder, and this folder is not a substitute for checking current code.

## Reading order

First read, understanding the product: [00 how to read](v2/00-how-to-read.md) (glossary) → [01 intent](v2/01-intent.md) → [02 storage](v2/02-storage-choice.md) → [03 philosophy](v2/03-philosophy.md) → [05 locked](v2/05-locked-and-open.md) → [06 architecture](v2/06-architecture.md).

Implementing the first slice (no key, public figure, `get` with voice examples):

1. [05 locked](v2/05-locked-and-open.md) — do not reopen without a new Agent Note; §5.3 froze the three items that blocked implementation
2. [07 packages](v2/07-package-cut.md) — workspaces and the one-way dependency direction
3. [08 home tree](v2/08-home-tree.md) — `~/.distilly/`, language-neutral
4. [10 types](v2/10-value-types.md) — every field name that reaches disk or the wire
5. [11 public API](v2/11-public-api.md) — `Distilly`, `Person`, error codes, the six validation boundaries
6. [12 engine](v2/12-engine.md) — queue claim guards, the single commit path
7. [19 profile](v2/19-profile-layer.md) — core / domain / claim
8. [14 inject](v2/14-host-injection.md) — three load paths and the seven host pitfalls
9. [24 governance](v2/24-governance-toolchain.md) and [26 order](v2/26-landing-and-evolution.md)

Then load the section that owns the change (adapters, CLI, interactive faces, forms, bot, relations, index, telemetry).

## Sections

| File | Section |
|---|---|
| [00-how-to-read.md](v2/00-how-to-read.md) | 0 三条读法、词汇表、一句话架构 |
| [01-intent.md](v2/01-intent.md) | 1 产品意图、五条产品面、记谁 |
| [02-storage-choice.md](v2/02-storage-choice.md) | 2 存储形态：为什么事实层是 Markdown |
| [03-philosophy.md](v2/03-philosophy.md) | 3 十一条哲学，每条带拒绝 |
| [04-language-runtime.md](v2/04-language-runtime.md) | 4 为什么 TypeScript，代价与被拒方案 |
| [05-locked-and-open.md](v2/05-locked-and-open.md) | 5 已锁定 / 仍开放 / 本版冻结 |
| [06-architecture.md](v2/06-architecture.md) | 6 五层、四张脸、队列、框架钩子 |
| [07-package-cut.md](v2/07-package-cut.md) | 7 包切分与依赖方向 |
| [08-home-tree.md](v2/08-home-tree.md) | 8 `~/.distilly/` 与磁盘约束 |
| [09-capabilities.md](v2/09-capabilities.md) | 9 七组内部动词全清单 |
| [10-value-types.md](v2/10-value-types.md) | 10 品牌 id、claim、画像、材料、关系 |
| [11-public-api.md](v2/11-public-api.md) | 11 `Distilly` / `Person` / 错误 / 校验边界 / 五个工具 |
| [12-engine.md](v2/12-engine.md) | 12 引擎内部类与队列语义 |
| [13-source-adapters.md](v2/13-source-adapters.md) | 13 `SourceAdapter` 三模式与错误树 |
| [14-host-injection.md](v2/14-host-injection.md) | 14 `HostInjector`、三种装法、七坑 |
| [15-cli-and-plugins.md](v2/15-cli-and-plugins.md) | 15 CLI、插件包、验收四条 |
| [16-interactive-faces.md](v2/16-interactive-faces.md) | 16 TUI 与面板、`watch` 缝、回环服务器规矩 |
| [17-host-forms.md](v2/17-host-forms.md) | 17 问人表单的中性语义字段 |
| [18-bot.md](v2/18-bot.md) | 18 Bot 是 `Person` 的又一种装法 |
| [19-profile-layer.md](v2/19-profile-layer.md) | 19 内核七面 / 域 / claim |
| [20-completeness.md](v2/20-completeness.md) | 20 完成度事实归属、置信度与成熟度 |
| [21-relations.md](v2/21-relations.md) | 21 关系图、空间、复杂度 |
| [22-index.md](v2/22-index.md) | 22 索引现在做什么、以后怎么做 |
| [23-telemetry.md](v2/23-telemetry.md) | 23 遥测约束 |
| [24-governance-toolchain.md](v2/24-governance-toolchain.md) | 24 全周期治理工具链与 CI |
| [25-python-migration.md](v2/25-python-migration.md) | 25 从 Python 迁移与退役条件 |
| [26-landing-and-evolution.md](v2/26-landing-and-evolution.md) | 26 落地顺序、验收、本文怎么演进 |

Changing a locked item in §5.1 requires a new Agent Note that states the alternative that lost. Closing an item in §5.2 updates that table and dates it. Reopening an item frozen in §5.3 requires the same note, because those three were closed to unblock implementation.

## Deprecated corpus

[v1/](v1/) keeps the same chapter mechanism over [system-v1.md](system-v1.md). Its sections do not line up one-to-one with v2, because v2 added a glossary chapter and split the SDK spec into types and API. Match by subject, not by number.
