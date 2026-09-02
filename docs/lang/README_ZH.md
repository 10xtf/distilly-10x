# Distilly —— Developer Preview

这是当前预览版的中文说明。完整且唯一有效的安装步骤请看[根目录 README](../../README.md)。

Distilly 把用户明确提供的材料蒸馏成可供 Agent 使用的 **Person Profile**。调用层仍然是 Skill，但产品本身包含本地存储、运行时、审核和宿主生命周期，因此以 Plugin 形式交付。

## 安装

预览版位于 `codex/distilly-plugin` 分支，目前已经核验 Codex。需要 Node.js `22.19+` 或 `24`、pnpm `10.32+` 和本机 Codex CLI：

```bash
git clone --branch codex/distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

安装后重启 Codex。卸载宿主集成不会删除人物、Profile 或材料：

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

面向模型的 MCP 合同固定为五个工具：`distilly_get`、`distilly_ingest`、`distilly_pending`、`distilly_commit`、`distilly_correct`。

## 当前范围

预览版支持用户明确选择的 TXT、Markdown、JSON、SRT/VTT 文件、粘贴文本和公开 URL。它可以创建人物、生成完整临时 prompt、接收纠正、审核版本，并在确认后安装长期人物 Skill。Codex 已核验；Claude Code、Grok Bot、OpenCode、Pi agent 和 DeepSeek Harness（DSH）需要社区补充宿主 binding 与 fixture。

请查看[路线图](../../ROADMAP.md)和[2026-09 更新](../../UPDATES.md)。
