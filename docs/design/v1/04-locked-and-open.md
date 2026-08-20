> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 4. 已锁定 / 仍开放

### 4.1 已锁定

1. 独立产品与存储边界。当前产品路径在本仓 `distilly` 分支；skill 只是分发形态。最终仓库命名仍由 4.2 的开放项 F 决定。
2. Markdown / jsonl 是事实。SQLite 是派生索引 + 同步状态机，可删可重建。
3. 蒸馏客观。集合哈希没变跳过。输出漂是缺陷。
4. 默认零 key。执行者可切换：无 key 时只标 pending，宿主 `commit`；有 key 时 daemon 也走同一 `commit`。
5. 要处理多模态，**不要必填 multimodal key**。未解析成文本的不进蒸馏。
6. 采集：留 `SourceAdapter` 抽象，社区写实现。第一版主路径是宿主 `ingest`。仓库里不写飞书官方 API。
7. 接入点只有 **Recall / Capture** 两个动词。框架绑定去对钩子。不要指望模型记得调 MCP。
8. self-correct 必须变成证据：`corrections/` + 立刻新版本 + 参与下次蒸馏。置信度下降挂起，`promote`/`reject`。
9. Client 只有两个类：`Distilly` + `Person`。七组是内部模块，不是用户背的 30 个方法。但 **七组清单要留着**，否则面板一做就缺动词。
10. 一个引擎、**四张脸**：模型 MCP / 宿主插件 / 面板市场 / Bot。
11. 临时人格：父 `get`/`prompt`，完整 profile 塞进**这一次子运行**。禁止写全局 `AGENTS.md`。
12. 完整 profile 整段塞。第一版不做 salience 裁剪。适配器塞不下只报错，不准偷偷裁引擎。
13. Profile = 闭内核 + 开域 + 带证据 claim。不要顶层 `work.md`+`persona.md`。
14. `colleague`/`celebrity` 降级为默认域包。默认入口 `person`。
15. 图第一版只做**关系**（曾用名「陈述边」，已废）。不做「相似」。加节点 O(1)，接关系 O(k)，禁止每次 commit 全图 O(n²)。
16. Bot 是 binding，不准自建人格文件。一个 bot 第一版钉一个 subject+version。
17. 插件只装清单与 skill，不做云端 MCP 与登录。验收：不登录也能蒸公开人物并 `get`。
18. 第一版默认进程内引擎。`client.py` 先同进程门面。
19. 协议冻名字。MCP 工具名、`Material` 字段只加不改。skill 声明 `distilly >= x`。

### 4.2 开放项跟踪

| # | 问题 | 倾向 | 状态 / 关闭日期 |
|---|---|---|---|
| A | `create` 时材料必须属于谁 | 必须指明。归属推断第二版 | open |
| B | marketplace 形态 | 第二版。引擎先留 `export` / 版本标识 | open |
| C | celebrity 肖像 / 同意 | 产品政策，不进第一版引擎 | open |
| D | Bot 先 Hermes 还是 Telegram | Hermes 更便宜（已有 profile 目录）；Telegram UI 现成 | open |
| E | 面板 loopback | Codex IAB 能开 127.0.0.1（已查）；Claude 未实测。第一版可以无面板 | open |
| F | 仓库与包改名 | CI 已覆盖现有分支；产品命名落地时统一 `DOT_SKILL_*` → `DISTILLY_*` | open |
| G | per-claim 血缘实现粒度 | 方向已锁（必须有），落地格式见 Claim | open |
| H | `create` / `commit` 的唯一签名 | §8 能力表与 §9 public API 目前形状不同；实现前先在本文冻结一套，不做兼容重载 | open |
| I | `correct(text, facet)` 的模型边界 | 自然语言解析可用宿主模型，但证据落盘、claim 变更和版本提交必须由确定性引擎验证 | open |
| J | 无 SQLite 时 `neighbors` 的最小索引 | 第一版必须定义可重建的按 subject 关系投影，不能在查询或 commit 时扫描全图 | open |

关闭一项时，把状态写成 `closed YYYY-MM-DD`，将最终规则落到 §4.1 或所属章节，并链接同一变更中的 Agent Note；不要只删掉这一行。

---
