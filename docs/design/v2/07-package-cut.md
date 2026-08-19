> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 7. 包切分与依赖方向

pnpm workspaces，九个包。最后三个（`tui` / `panel` / `governance`）都是叶子：删掉任何一个，其余包照样编译、照样测试。

```
distilly/
├── package.json                    私有根：workspaces + 全部门禁脚本
├── pnpm-workspace.yaml
├── tsconfig.base.json              严格编译选项的唯一来源
├── tsconfig.json                   solution 文件，只列 references
├── eslint.config.js  vitest.config.ts  knip.json
├── packages/
│   ├── protocol/                   @distilly/protocol —— 共享词汇
│   │   └── src/
│   │       ├── ids.ts              Branded 工具与全部 id 类型
│   │       ├── values.ts           §10 的全部值类型
│   │       ├── methods.ts          方法名常量：subjects.* materials.* distill.* profile.* graph.* hosts.*
│   │       ├── errors.ts           错误码闭集与 DistillyError
│   │       ├── schemas.ts          跨边界输入的校验 schema（§11.5）
│   │       └── mcp.ts              五个工具的名字与入参 schema
│   ├── engine/                     @distilly/engine —— 车
│   │   └── src/
│   │       ├── store/              layout, subject, material, catalog
│   │       ├── queue/              schema, service（LSN、认领守卫）
│   │       ├── distill/            hasher, runner, validator, commit, prompts
│   │       ├── profile/            schema, render, migrate
│   │       ├── graph/              relations, mentions
│   │       ├── version/            snapshot, lineage
│   │       ├── project/            skill, host
│   │       ├── telemetry.ts
│   │       └── inProcess.ts        实现 EngineClient 的进程内派发
│   ├── adapters/                   @distilly/adapters
│   │   └── src/                    base.ts, registry.ts, builtin/web.ts
│   ├── bindings/                   @distilly/bindings
│   │   └── src/                    protocol.ts, claude.ts, codex.ts, langgraph.ts,
│   │                               openaiAgents.ts, hermes.ts, telegram.ts, registry.ts
│   ├── cli/                        @distilly/cli
│   │   └── src/                    bin.ts（distilly …）, mcp.ts（stdio 服务器）,
│   │                               panel.ts（回环 HTTP + SSE，§16.3）
│   ├── tui/                        @distilly/tui —— 可删的终端界面（§16.4）
│   │   └── src/                    app.ts 与四个屏；只用门面，不碰引擎内部
│   ├── panel/                      @distilly/panel —— 可删的面板静态资源
│   │   └── src/                    浏览器侧；只通过 /rpc 与 /events 说话
│   ├── governance/                 @distilly/governance
│   │   └── src/                    verifyDocs, verifyNotes, syncDesign, runGates
│   └── distilly/                   distilly —— 用户实际安装的门面包
│       └── src/
│           ├── index.ts            只导出 Distilly, Person, 错误, 值类型
│           ├── api.ts              Distilly / Person 的产品面
│           └── client.ts           EngineClient 接口与 openInProcess
├── plugin/
│   ├── marketplace.json
│   ├── codex/                      .codex-plugin/plugin.json + .mcp.json + skills/
│   └── claude/                     .claude-plugin/plugin.json + skills/
├── examples/
├── docs/  .agents/  .github/  .githooks/
└── tools/ prompts/ skills/ tests/  ← 冻结的 Python 遗产（§25）
```

### 7.1 依赖方向是单向的

```
protocol  ←  engine  ←  distilly  ←  bindings
    ↑           ↑           ↑   ↖
 adapters      cli   ────────┘    tui
governance 只依赖 protocol 与运行时内置模块
panel 只依赖 protocol 的类型，运行时只认 HTTP
```

六条规则：

- **`@distilly/protocol` 是共享词汇的唯一家。** 值类型放在客户端包里会逼引擎向上依赖自己的消费者，那是反的。
- **`distilly` 是门面包，不是第二套 API。** 它拥有 `Distilly` / `Person` 的实现和 `openInProcess`；换成守护进程传输时只换 `client.ts`。
- **深用要显式依赖。** 采集计划、`promote`、适配器注册表不从门面根导出，要用就依赖 `@distilly/engine` 或 `@distilly/adapters`。
- **界面包在最外层，没有包指回它们。** `tui` 依赖门面，`panel` 只依赖 `protocol` 的类型（运行时通过 HTTP 说话），`cli` 提供面板服务器但**不依赖** `panel` 的构建产物：资源缺失时 `distilly panel` 报错并说明怎么装，不服务一个空白页。
- **界面不许 import `@distilly/engine`。** 绕过门面就绕过了 §11.5 的校验和 §16.5 的聚合归属。这一条由未声明依赖门禁机械拦住。
- **每个包一个编译配置**，只 reference 它真正依赖的包。仓库级程序（门禁、脚本）用单独的配置，不挂在 solution 上。

未用导出和未声明依赖由门禁检查（§24.2），所以依赖回环会变成一条机械报错，而不是评审意见。

---
