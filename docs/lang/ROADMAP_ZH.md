# Distilly 路线图

*最后更新：2026-09-02*

完整路线图请看 [ROADMAP.md](../../ROADMAP.md)。本页只概括 `codex/distilly-plugin` 分支的 Developer Preview。

## 当前

Codex 的本地 TypeScript/SQLite 主流程已经端到端核验：导入本地材料、生成版本、纠正、审核、恰好五个 MCP 工具、安装 Plugin，以及安全卸载并保留人物数据。

## 社区优先事项

我们需要社区一起补齐并核验 **Grok Bot、Claude Code、OpenCode、Pi agent 和 DeepSeek Harness（DSH）** 的 Plugin binding。每个宿主都应有独立 launcher、setup/doctor/重启发现/卸载测试，以及准确的宿主版本和容量证据。我会积极 review 这些贡献。

## 后续

Preview 稳定后，再推进 Panel marketplace、更多本地 parser 和授权 adapter、迁移、backup/restore、深度 doctor 与其他宿主 binding。
