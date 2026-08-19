> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，只作历史记录；生效合同是 [system-v2.md](../system-v2.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 18. 遥测（你问过能不能记次数上传服务器）

遥测是目标能力，不是当前仓库已发布模块。早期讨论曾用仓外 prototype 验证 opt-in 与无端点惰性；实现时必须在本仓重新落地、测试，并使用 `DISTILLY_*` 命名，不能把 prototype 当依赖。

约束（哲学 2.3 / 2.4）：

- 没配端点就不问、不发
- 交互式问一次并记住；非交互拒绝且不落盘
- 数的是创作（蒸了、装了），承认数不到「被模型读了 SKILL.md」
- 禁止为了指标在投影里塞必调工具

---
