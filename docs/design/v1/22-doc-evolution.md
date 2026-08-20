> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 22. 文档怎么演进

- 改接口先改本文，再改代码。
- 只编辑父文件；`python3 scripts/sync_design_chapters.py` 生成 24 个 topic 章节，`verify_docs.py` 拒绝漂移。
- 实现开始后仓库写现在时 `docs/architecture.md`，决策进 Agent Note。
- 开放项关闭时把 4.2 状态改成 `closed YYYY-MM-DD`，把最终规则落到 §4.1 或所属章节，并链接同一变更中的 Agent Note。
- 旧 skill 测试随迁移改断言：产物路径、当前 schema → `PROFILE_SCHEMA_VERSION`。
- 仓库外的会话、canvas、clone 或未提交 prototype 不是规范来源；缺失事实先写回设计或 Agent Note。

---
