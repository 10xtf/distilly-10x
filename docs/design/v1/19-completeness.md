> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 19. 完成度的事实归属

本合同不保存实时 schema 号、测试数量、CI 历史或“已落地”清单；这些数据会随实现变化，写在设计父文和 24 个投影里会形成第二事实源。

- [architecture.md](../../architecture.md) 说明当前树实际发布什么，以及目标包是否已经出现。
- `tools/skill_schema.py`、测试发现结果和 CI workflow 是当前 schema、测试数和门禁的机械证据。
- 本节以及仓外 prototype 的历史描述都不能证明 `Distilly`、`Person`、claims、lineage、telemetry、MCP、HostInjector、Bot、面板或 marketplace 已发布。
- 每个产品 slice 落地时，同一 PR 更新 architecture、测试与 proposed/implemented Agent Note；设计合同只在目标机制改变时更新。

在 Distilly 产品代码出现前，当前 dot-skill 蒸馏和安装链只能作为迁移输入。目标中间产物仍是 `claims.jsonl` 加内核/域 Markdown，再投影 `SKILL.md`。

---
