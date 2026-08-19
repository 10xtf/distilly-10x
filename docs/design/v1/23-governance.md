> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，只作历史记录；生效合同是 [system-v2.md](../system-v2.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 23. 仓库治理（先立形状，不上全套门禁）

这个仓库的默认开发者是 **coding agent**。「文档先行」在这里不是先写博客，而是四件事：

1. **决策有家**（`.agents/notes/{proposed,implemented,rejected}/`，强制写打败了什么）
2. **现状有家**（`docs/architecture.md` 只写现在时；一事实一归属）
3. **流程有家**（Skill 教怎么走，合同仍在 docs）
4. **能机器查的承诺写成 gate**（Note 格式、链接、预算……）；人只审语义

理由很直接：agent 听门禁比听散文可靠。而「写这些工作量大」不是理由，因为活是 agent 干的。

distilly 的最小治理闭环：

| 机制 | 做什么 |
|---|---|
| 根与局部 `AGENTS.md` | 常设规则和按路径加载的额外约束；`CLAUDE.md` symlink 暴露同一内容 |
| Agent Note 三态 | 大功能先由 [proposed product Note](../../../.agents/notes/proposed/architecture/2026-08-19-distilly-product.md) 持有；落地同 PR 改成现在时 `implemented/` |
| 文档单一来源 | 父设计生成章节；本地链接、portable syntax 和末尾换行由 `verify_docs.py` 检查 |
| cookbook | 只记录已发布且有真实失败命令的步骤；目标 API 留在设计里 |
| 窄 hook | `.githooks/pre-push` 跑便宜的治理、lint 和空白检查；测试按 diff 选择 |
| CI | governance 单跑一次；Python 3.9/3.11；缺失测试、Ruff、文档和 Note gate 都会报红；只有仓外 branch protection 才能把红灯变成合并/直推阻断 |
| Handoff | 暂停、换 Agent、开 PR 时记录基线、证据、未验证项、工作树和精确下一步，不复制决策理由 |

不第一天上：双语配对、逐文件 100% 覆盖、二十个 verify 脚本、Issue 政策全套。

本文是**已批准的目标合同**，不是 shipped-state 报告。调研与否决过的方案以后应拆进 Agent Note，避免和 `Person.get` 签名永远长在同一篇里。

---
