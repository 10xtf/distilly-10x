> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 19. CLI、setup、插件包与分发

### 19.1 CLI

~~~text
distilly setup --host codex|claude-code
distilly doctor [--host <host>]
distilly upgrade [--version <version>]
distilly uninstall --host <host>

distilly mcp
distilly panel [--port <n>]

distilly create --name <name> [--space <space>]
distilly ingest <subject> <path...> [--enqueue auto|now]
distilly pending [--subject <id>]
distilly pending --brief <job>
distilly commit <job> --draft <file> --lease <lease>
distilly get <subject> [--format profile|prompt|status]
distilly correct <subject> --text <text> [--facet <facet>]

distilly review [--version <id>]
distilly promote <version>
distilly reject <version> --reason <text>
distilly rollback <subject> <version>

distilly install <subject> --host <host>
distilly export <subject> --host <host> --dest <path>
distilly migrate --from <legacy-skill-dir>
~~~

CLI 只解析、组合 EngineClient、格式化结果和退出码。测试调用真实 binary entry，不直接测 private command helper 代替。

distilly pending --brief 把完整 lease snapshot 写到仅当前用户可读的临时 draft envelope；distilly commit --draft 读取其中的 generation、briefContractDigest、materialSetHash 与 baseVersionId，并与 --lease / 当前 job 重新匹配后构造 CommitInput。CLI 不因 flags 较少而跳过 MCP 路径拥有的 stale 校验；用户手写的裸 DistillPatch 文件若没有对应 envelope 会被拒绝。

### 19.2 Setup 不能依赖 PATH 运气

npx distilly@VERSION setup 是 bootstrap 入口。setup：

1. 检查 Node、平台、目标宿主与写权限；
2. 把精确版本 runtime 安装到 ~/.distilly/runtime/<version>/；
3. 生成 ~/.distilly/bin/distilly launcher，记录 Node executable 与 package entry 的绝对路径；
4. 调用 HostBinding.installPlugin，生成指向 launcher 的 MCP 配置；
5. 安装由 release assembler 生成的 manifest、canonical skill copy 与支持的 hook；
6. 运行真实 MCP initialize + tools/list +只读 health smoke；
7. 写安装 manifest，显示是否需重开宿主会话；
8. 运行 doctor 并给出逐项结果。

禁止把 .mcp.json 写成裸 distilly mcp 后假设全局 npm bin 已进 PATH；也禁止每次启动静默 npx latest。

### 19.3 版本握手

PluginInstallManifest 记录 pluginVersion、engineVersion、wireMajor、promptVersion 与 launcher digest。MCP initialize 暴露 server version；canonical skill 的 minimum / maximum wire major 与 engine 握手。

- major 不兼容：拒绝工具调用并给 upgrade / rollback 命令；
- plugin patch 落后但 wire 兼容：doctor 警告，不阻塞；
- runtime digest 变化：doctor 报安装损坏，不静默重装；
- upgrade 先安装新 version、smoke 通过后原子切 launcher；旧 runtime 保留一个 rollback window。

### 19.4 插件文件树

MCP 包只接收已经绑定 host actor、engine-owned LeaseOwnerId 与 capacity 的 EngineClient；它不 import engine、store 或 Panel：

~~~ts
export interface McpServerOptions {
  readonly client: EngineClient;
  readonly reviewPresenter: ReviewPresenter;
}

export interface McpServer {
  close(): Promise<void>;
}

export declare function createMcpServer(options: McpServerOptions): McpServer;
~~~

McpServerOptions 故意没有 capture client/token：普通 handler 不能提权。受支持 binding 在同一 host session 旁路注册 §17.2 的 user-gesture private capture action；action 由 runtime coordinator 持有 engine core capture session，完成后只把 PrivateUiCaptureActionResult 送回当前 task。它不改变 MCP initialize、tools/list 或五个 handler，普通 distilly_ingest 也不会根据模型字段“升级”为 capture session。

@distilly/mcp 根只定义 transport-neutral server；Node stdio 只从 @distilly/mcp/stdio 导出：

~~~ts
export declare function runStdio(server: McpServer): Promise<void>;
~~~

handler 把 WireRequest.requestId 原样作为 MutationContext 传入 client；SDK facade 自己生成 requestId 时，在同一次网络重试中复用。commit handler 还必须把 CommitToolInput.briefContractDigest 原样放进 CommitInput，不能丢弃或以 server 当前默认合同替代。commit 得到 suspended CommitResult 后调用 reviewPresenter；correct 的 engine result 按 actor 合同必为 suspended。presenter 对两者都只把 ReviewRef 变成 ReviewLaunch 并放进 ToolValue，不设置 reason、不改变 current / suspended。没有 presenter 的 development server 不得声称完成首发插件闭环。

~~~text
plugins/
├── shared/
│   ├── skills/
│   │   └── distilly/
│   │       ├── SKILL.md                 # 唯一 canonical orchestration
│   │       └── references/
│   └── assets/
├── codex/
│   ├── .codex-plugin/plugin.json
│   ├── .mcp.json.template
│   ├── hooks/
│   └── skills/                          # release assembler 生成 copy
├── claude-code/
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json.template
│   ├── hooks/
│   └── skills/                          # release assembler 生成 copy
└── fixtures/
~~~

源仓不靠 symlink 作为发行契约：zip、npm 与 Windows 对 symlink 支持不一致。release assembler 从 shared 复制，写 content digest；门禁重新生成并 diff，防止两家漂移。

### 19.5 三种分发概念

1. **npm / release runtime**：安装本机 engine 与 CLI。
2. **local / repo plugin source**：开发、测试或团队分发 manifests 与 skill。
3. **公共插件目录**：平台支持本机 MCP 时可增加的发现渠道。

这三者都不是 Profile Catalog。

截至 2026-08-20，OpenAI 官方文档把 public plugin directory 与 local/repo marketplaces 区分，并说明只有本地 stdio MCP 的插件不能按公共 remote-MCP 路径提交；V3 因此把 local/repo source 当首发分发渠道，而不是把本机资料搬到远程服务器。[Package your plugin](https://developers.openai.com/plugins/build/plugins)；[Submit a Claude Code plugin](https://developers.openai.com/plugins/guides/submit-claude-plugin)。

平台以后支持本机 MCP 公共分发时，只新增 HostInstaller / release target；不改变 EngineClient、家目录或数据归属。

### 19.6 Hooks

插件可以携带平台支持的 lifecycle hooks，但 core workflow 不依赖所有表面都有 hook。Hook 只能：

- 检查 pending / suspended 并提醒；
- 在明确的 session boundary flush 已被用户标为材料的 Capture buffer；
- 打开 doctor 或 Panel。

Hook 不读对话私自 ingest、不直写文件、不在无 consent 时后台 research。每个 HostBinding 的 hook matrix 用真实宿主 fixture 验证。

### 19.7 Fresh-install 验收

在没有全局 distilly、没有 Distilly 账号、没有额外 LLM key的临时用户目录：

1. 一条 setup 安装 runtime 与插件；
2. doctor 通过；
3. 重开宿主后恰好看到五工具；
4. 对公开人物完成主路径；
5. 本地事实与 Panel 可见；
6. 下一次 get 成功；
7. uninstall 只移除插件投影与 launcher，不删除人物数据。

---
