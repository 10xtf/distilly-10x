> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 26. 落地顺序、验收、本文怎么演进

### 26.1 顺序

1. **TS 骨架与门禁**：workspaces、编译配置、Lint、测试运行器、`pnpm run gates`、CI 加 job。没有产品代码，只让 §24 的命令真实通过。
2. **协议与存储**：`@distilly/protocol` 全部值类型与错误码；`Layout`、`MaterialStore`、`MaterialHasher`、`SubjectStore`。
3. **零 key 主路径**：队列、`pending`、`DraftValidator`、`CommitService`、版本快照、血缘、`get` / `prompt`。同时做 `EngineClient.watch` 的进程内实现——它和 `CommitService` 同源，事后补要动所有脸共用的缝（§16.2）。
4. **修正与置信度闸**：`correct`（§5.3 冻结二）、`promote` / `reject`、集合哈希跳过。
5. **模型与宿主**：`distilly mcp` 五个工具；Claude 与 Codex 注入器；产品技能禁令。
6. **关系**：关系日志、`link` / `invalidate` / `neighbors`、待对齐提及、图投影。
7. **迁移器**：旧技能产物 → `subjects/`，带 fixture。
8. **一个 bot 绑定**（§5.2 项 D）。
9. **插件包**：两个宿主的市场包，本机工具服务器。
10. **守护进程执行者**：有 key 时的后台蒸馏，走同一个 `commit`。
11. **TUI 四屏**（§16.4）：只读，靠 `watch` 重画。它是第一个证明「浏览类聚合已经够用」的调用方。
12. **面板**（§16.3）：回环服务器加静态资源，`EngineClient` 的 HTTP 实现在这一步出现。
13. **相似边、市场、直采适配器。**

第一版明确不做：常驻定时轮询、必填多模态或 embedding key、向量库、显著度裁剪、相似边、在门面包里写死宿主路径。

### 26.2 验收

主路径六步，全程无 key：

```
create(person, space)
  → 宿主扒网 / 用户喂文件 / 委托计划加回收
  → ingest（落盘、哈希、去重、过边界）
  → pending
  → 宿主蒸 → commit（校验、出版本、写血缘）
  → get / prompt（下一次对话加载这一版）
  → correct（进 corrections/，立刻再出一版）
```

1. 用户指定一个人。
2. agent 浏览或截图采到材料，或用户丢进导出文件。
3. `ingest` 去重落盘。
4. 宿主蒸馏并 `commit`。
5. 下次对话 `get` 能加载这一版。
6. 用户 `correct` 一处，再 `get` 能看到，且 `corrections/` 里有记录。

这六步过了，第一版成立。其余产品面往这些方法后面加，**不改 `MaterialIn` 和 `commit` 的形状**。

插件另加 §15.4 四条。总验收第一刀：不登录、不给 key，对一个公开网页人物走完全程，并 `get` 到带例句的声音和带证据的 claim。

治理侧的验收：一个没读过任何历史对话的 agent，靠根 `AGENTS.md`、[docs/README.md](../../README.md) 和本文，能在十分钟内说出它要改什么、事实在哪、跑哪条命令、需不需要写 Note。

### 26.3 本文怎么演进

- **改接口先改本文，再改代码。**
- 只编辑本文；`python3 scripts/sync_design_chapters.py` 生成 [v2/](.) 的章节投影，文档门禁拒绝漂移。治理脚本换成 TypeScript 后命令改名，规则不变。
- 实现开始后，现在时的已发布事实写进 [architecture.md](../../architecture.md)，决策进 Agent Note，本文只在**目标机制**改变时更新（§20.1）。
- §5.2 的开放项关闭时改那张表并注日期；§5.1 的锁定项与 §5.3 的冻结项要改，必须有新 Agent Note 写明被打败的方案。
- **上一版设计**（[system-v1.md](../system-v1.md) 与 [v1/](../v1)）已 deprecated。它用 Python 写同一个产品；语言无关的结论已全部在本文重述，所以读它只有一个正当理由：想知道某条结论当初打败了什么。不要为了「保持一致」去改它，也不要在实现里引用它。两版章节号不对应，按主题找。
- 仓库外的会话、画布和未提交草稿**不是规范来源**；缺失的事实先写回本文或 Note。

---
