> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 12. 插件怎么做（本机引擎，不做云端）

```
codex/.codex-plugin/plugin.json + .mcp.json + skills/
claude/.claude-plugin/plugin.json + skills/   # 规范 skill symlink
```

用户侧路径：加一次 marketplace 仓库 → `plugin add` → **必须新开对话**（宿主在会话启动时读工具清单）。表单走宿主原生能力。要给用户看编辑器时返回一个 URL 让宿主内嵌浏览器打开，**模型不能去点编辑器 DOM**。

该做：一个 git 当 marketplace；`codex/`+`claude/` 两包；规范 skill symlink；`plugin.json` 里填满宿主的展示位；装完提醒新开对话；表单走宿主原生能力。

不该做：远程 MCP + 登录换 token（等于项目状态在云上）；人的数据放云；第一版就做内嵌大面板；在插件包里复制引擎。**我们的内容不需要加载到云端**，profile 只在 `~/.distilly`。

验收（Codex 插件成立的四条）：

1. `plugin add` 之后新开对话，模型能列出五个工具
2. 「蒸馏公开人物 X」走完：浏览 → ingest → commit → 本地出现 `subjects/`
3. 下一句「你是 X」能 `get` 到声音和例句
4. **不登录任何云账号**也能完成

面板以后：MCP 返回 `http://127.0.0.1:<固定端口>`，Codex IAB 能开 loopback（已查）。Claude 侧可行性未验证。第一版可以没有面板。

`install` 实现必须是安装器插件，每多一个宿主加一个安装器，和适配器同一道缝。

---
