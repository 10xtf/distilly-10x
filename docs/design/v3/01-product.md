> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 1. 产品承诺、产品面与非目标

### 1.1 产品定义

**distilly 是一个 chat-first、local-first 的人物画像工作台。** 它利用用户已经在用的宿主 LLM 做语义工作，用本机确定性引擎保存可追溯事实，并让人通过面板审核高风险变化。

它不是“自带一个模型的记忆 API”，也不是“生成一次 Persona Markdown 的脚本”。真正的产品对象是主体、材料、claim、版本、修正和血缘。

### 1.2 首个可用版本的六个承诺

1. **零额外 LLM key。** 调研与蒸馏默认使用 Codex / Claude Code 等宿主已有模型；Distilly 引擎本身不调用模型。
2. **本地事实。** 材料、画像、证据、版本与 correction 默认只在用户明确选择的 DISTILLY_ROOT。
3. **聊天发起。** 用户只需说“调研并蒸馏 X”；不先学习队列、哈希或 schema。
4. **证据可见。** 每条人物判断都能从面板回到确切材料和原文 quote。
5. **风险可审。** clean candidate 自动成为 current；身份、冲突或质量退化等风险进入 suspended，旧 current 不动。
6. **下一次可用。** commit 之后，下一次聊天可以 get / prompt 这份画像，或显式 install 到宿主。

### 1.3 产品面

| 产品面 | 第一版 | 以后 |
|---|---|---|
| 宿主聊天插件 | 必须；发起 research、ingest、briefing、commit 与 Recall | 更多宿主与更丰富的原生卡片 |
| 本地审核面板 | 必须；Library、Subject、Review、Settings | 关系图与本地高级搜索 |
| TypeScript SDK 与 CLI | 必须；自动化、诊断、面板与真实入口测试 | 守护进程客户端 |
| Profile Catalog | 不做；本地产品不登录 | 明确 publish / pull 的公开画像 |
| Bot 与 TUI | 不阻塞首发 | 共用同一 EngineClient 的额外脸 |

面板是首个可用版本的组成部分，但**不是每次 commit 的人工批准门**。把所有 clean 更新都变成点击确认，会破坏 chat-first；把所有风险都自动覆盖，又会破坏信任。

### 1.4 记谁

所有人：同事、朋友、亲人、公众人物、虚构角色和 self。差异通过空间、域和材料体现，不通过硬编码 PersonType 分叉。

### 1.5 明确非目标

- 不托管用户的私人画像数据库，不要求 Distilly 账号才能使用本地产品。
- 不在首版实现远程 Profile Catalog、关注流、社交关系或交易。
- 不把任意整段对话、思维过程或系统提示默认当人物材料。
- 不在引擎里绑定一家网页、消息或邮件厂商的官方采集 API。
- 不要求 embedding、rerank、OCR 或多模态云 key。
- 不把无法溯源的角色扮演文本伪装成客观画像。
- 不为未来数据库替换设计通用 StorageProvider；本地事实格式就是产品合同。
- 不让模型、面板或插件直接写 DISTILLY_ROOT 下的事实文件。

### 1.6 首发成立的定义

在干净机器上，不登录 Distilly、不给额外 LLM key，用户通过一个受支持宿主对一个公开人物完成：

research → ingest(enqueue now) → pending brief → host distill → commit → panel evidence review → next-chat get。

缺少 create、briefing、证据 validator、fresh-install runtime 或 panel 中任意一项，都不叫首个可用版本。

---
