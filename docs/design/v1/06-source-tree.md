> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 6. 仓库文件树（源码，按角色切包）

切包的依据是角色而不是传输协议：`protocol` / `client` / `server` 三层；产品面一个文件、协议面一个文件；根只导出消费者接口。Python 落法：`api.py` / `client.py` / `models.py` / `errors.py`。

只有一个产品动词的 SDK 可以瘦到只剩一个 `run`，因为车在 runtime 里。我们的 Client 同样瘦，但不会瘦到那个程度——产品动词是「人」上的几个动作。

```
distilly/
├── README.md
├── AGENTS.md
├── pyproject.toml
├── src/
│   ├── distilly/                       # 根只导出 Distilly, Person, 错误
│   │   ├── __init__.py
│   │   ├── api.py                      # 产品面
│   │   ├── client.py                   # 连进程内引擎；以后换 daemon 传输
│   │   ├── models.py
│   │   └── errors.py
│   ├── distilly_protocol/              # MCP / JSON-RPC / 以后 TS 共用形状
│   │   ├── types.py
│   │   └── mcp.py
│   ├── distilly_engine/                # 「车」。Client 不长业务
│   │   ├── store/                      # layout, subject, material, index
│   │   ├── queue/                      # schema, service（LSN、守卫）
│   │   ├── distill/                    # hasher, runner, commit, prompts
│   │   ├── profile/                    # schema, render, migrate
│   │   ├── graph/                      # relations, mentions
│   │   ├── version/                    # snapshot, lineage
│   │   └── project/                    # SKILL.md, host export
│   ├── distilly_adapters/              # 采集。entry point: distilly.adapters
│   │   ├── base.py                     # 目标适配器抽象
│   │   ├── registry.py
│   │   └── builtin/                    # 第一版最多一个 web 样板
│   └── distilly_bindings/              # 注入 + bot。第一版就要注入
│       ├── protocol.py                 # HostInjector
│       ├── claude.py
│       ├── codex.py
│       ├── langgraph.py
│       ├── openai_agents.py
│       ├── hermes.py
│       └── telegram.py
├── plugin/                             # 可独立小仓。每个宿主一个包目录
│   ├── marketplace.json
│   ├── codex/
│   │   ├── .codex-plugin/plugin.json
│   │   ├── .mcp.json                   # python -m distilly.mcp，本地 stdio
│   │   └── skills/
│   │       ├── distilly-usage/         # 产品 skill：怎么蒸
│   │       ├── collect-web/            # 委托扒公开页
│   │       └── widget-ask/             # 仅 Codex：问「蒸哪个人」
│   └── claude/
│       ├── .claude-plugin/plugin.json
│       └── skills/                     # usage/collect symlink 同一份
├── tests/
└── examples/
    ├── headless_ingest.py
    └── spawn_ten_subagents.py
```

`plan_collect`、`promote`、适配器 registry **不准**从 `distilly` 根再 export。要深用去 `distilly.engine` / `distilly.adapters`。

各包承担的角色：

| 角色 | distilly |
|---|---|
| 共享词汇（值类型、方法名、错误码） | `distilly_protocol` |
| 产品面（用户第一眼看到的两个类） | `api.py`（`Distilly`+`Person`） |
| 协议面（可换传输的那一层） | `client.py` |
| 引擎与服务端 | `distilly_engine` |
| 扩展点 | `SourceAdapter` + entry point |
| 框架胶水 | `distilly_bindings` |

扩展点的位置很关键：**它在 engine 上，不在 Client 上。** 但 `SourceAdapter` 不是一整套插件运行时——entry point 只负责发现并实例化一次，`SourceAdapter` 只解决 Material 从哪来。

早期讨论引用过仓外 adapter、lineage 和 telemetry prototype；它们不属于本仓已发布事实。迁移只能从当前 [architecture.md](../../architecture.md)、源码和测试确认可复用能力。

---
