> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 15. CLI 与插件包

### 15.1 CLI

`@distilly/cli` 提供 `distilly` 可执行文件，既是「人和 CI 的那张脸」，也是插件里工具服务器的启动入口：

```
distilly mcp                          # 标准输入输出的工具服务器，插件配置指向这里
distilly ingest <subject> <path...>
distilly pending [--subject <id>]
distilly commit <job> --draft <file>
distilly get <subject> [--version vN]
distilly install <subject> --host claude-code
distilly migrate --from <legacy-skill-dir>
distilly status <subject>
```

CLI 只做参数解析、输出格式化和退出码，业务全在引擎。**测试测真实入口**，不测内部帮助函数。

### 15.2 插件包：本机引擎，不做托管后端

```
plugin/marketplace.json                                 # 这个 git 仓库本身就是市场
plugin/codex/.codex-plugin/plugin.json + .mcp.json + skills/
plugin/claude/.claude-plugin/plugin.json + skills/      # 规范技能 symlink，同一份内容
```

`.mcp.json` 指向本机的 `distilly mcp`（§15.1）。六条打包规则：

1. **一个 git 仓库当市场。** 用户加一次仓库地址就能装，不需要我们运营一个注册服务。
2. **两个宿主各一个包目录**，因为两家的清单文件名和字段不同。共用内容靠 symlink，不靠复制。
3. **规范技能只有一份内容。** 两个包目录里的技能是同一份文件的软链，避免两边行为漂移。
4. **`plugin.json` 填满宿主提供的展示位**（名称、说明、品牌标识），否则用户在插件列表里看不出这是什么。
5. **装完必须提醒用户新开对话。** 宿主在会话启动时读取工具清单，当前会话看不到新装的工具，不提醒就会被当成装失败。
6. **插件包里不复制引擎。** 包只有清单与技能，业务全在本机的 `distilly` 可执行文件里。

明确不做的三件事：

- **不做远程服务器 + 登录换 token。** 那等于把画像放到我们的云上，与 §3.1 直接冲突。画像只在 `~/.distilly`，装插件不需要注册账号（§15.4 第 4 条）。
- **第一版不做内嵌大面板**（§3.5：地基不压在会腐烂的接口上）。
- **不让模型去点编辑器 DOM。** 需要让用户看图形界面时，工具返回一个 URL，由宿主的内嵌浏览器打开；模型的职责到「给出地址」为止。

产品技能写死流程：先 `get`，再按当前宿主注入器投放，**禁止改仓库里的全局指令文件**。

### 15.3 面板从这里进来

工具或 CLI 返回一个本机回环地址，宿主的内嵌浏览器打开它。服务器、令牌与端口规则见 §16.3；第一版可以完全没有面板。

`install` 的实现必须是「宿主 id → 安装器」，每多一个宿主加一个安装器，和采集适配器同一道缝。

### 15.4 插件验收四条

1. 装完新开对话，模型能列出五个工具。
2. 「蒸馏公开人物 X」走完：浏览 → `ingest` → `commit` → 本地出现 `subjects/`。
3. 下一句「你是 X」能 `get` 到声音和例句。
4. **不登录任何云账号**也能完成。

---
