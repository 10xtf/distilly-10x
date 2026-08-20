> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 25. 包、文件架构、依赖方向与抽象

### 25.1 Workspace

~~~text
distilly/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── knip.json
├── packages/
│   ├── protocol/
│   │   └── src/
│   │       ├── ids.ts
│   │       ├── values/
│   │       │   ├── subjects.ts
│   │       │   ├── materials.ts
│   │       │   ├── claims.ts
│   │       │   ├── profiles.ts
│   │       │   ├── jobs.ts
│   │       │   ├── versions.ts
│   │       │   ├── hosts.ts
│   │       │   └── relations.ts
│   │       ├── methods.ts
│   │       ├── engine-client.ts
│   │       ├── events.ts
│   │       ├── errors.ts
│   │       ├── schemas/
│   │       ├── mcp.ts
│   │       └── index.ts
│   ├── engine/
│   │   ├── prompts/
│   │   │   └── host-distill-v1.md
│   │   └── src/
│   │       ├── create-engine.ts
│   │       ├── engine.ts
│   │       ├── layout.ts
│   │       ├── context.ts
│   │       ├── ports/
│   │       │   ├── clock.ts
│   │       │   ├── id-generator.ts
│   │       │   ├── audit-key-port.ts
│   │       │   ├── material-parser-port.ts
│   │       │   └── event-bus.ts
│   │       ├── defaults/
│   │       │   ├── system-clock.ts
│   │       │   ├── crypto-id-generator.ts
│   │       │   ├── local-audit-key.ts
│   │       │   ├── text-parser-port.ts
│   │       │   └── in-process-event-bus.ts
│   │       ├── facts/
│   │       │   ├── atomic-write.ts
│   │       │   ├── space-store.ts
│   │       │   ├── subject-store.ts
│   │       │   ├── material-store.ts
│   │       │   ├── raw-store.ts
│   │       │   ├── capture-audit-store.ts
│   │       │   ├── version-store.ts
│   │       │   ├── state-store.ts
│   │       │   ├── event-store.ts
│   │       │   └── operation-store.ts
│   │       ├── transaction/
│   │       │   ├── space-identity-lock.ts
│   │       │   ├── subject-lock.ts
│   │       │   ├── ingest-journal.ts
│   │       │   ├── commit-journal.ts
│   │       │   └── recovery.ts
│   │       ├── subject/
│   │       │   ├── service.ts
│   │       │   └── identity.ts
│   │       ├── ingest/
│   │       │   ├── service.ts
│   │       │   ├── file-service.ts
│   │       │   ├── normalize.ts
│   │       │   ├── source-groups.ts
│   │       │   └── hash.ts
│   │       ├── capture/session-service.ts
│   │       ├── queue/
│   │       │   ├── repository.ts
│   │       │   ├── sqlite-repository.ts
│   │       │   └── service.ts
│   │       ├── distill/
│   │       │   ├── briefing-service.ts
│   │       │   ├── prompt-catalog.ts
│   │       │   ├── validate-patch.ts
│   │       │   ├── resolve-evidence.ts
│   │       │   └── commit-service.ts
│   │       ├── profile/
│   │       │   ├── apply-patch.ts
│   │       │   ├── claim-id.ts
│   │       │   ├── quality.ts
│   │       │   ├── render.ts
│   │       │   └── diff.ts
│   │       ├── correction/service.ts
│   │       ├── review/service.ts
│   │       ├── version/service.ts
│   │       ├── relation/
│   │       ├── bundle/
│   │       │   ├── importer.ts
│   │       │   ├── exporter.ts
│   │       │   └── canonicalize.ts
│   │       ├── projection/
│   │       │   ├── library-projection.ts
│   │       │   ├── json-library-projection.ts
│   │       │   ├── projection-service.ts
│   │       │   ├── graph-projection.ts
│   │       │   └── skill-projector.ts
│   │       └── client/in-process-client.ts
│   ├── runtime/
│   │   └── src/
│   │       ├── create-local-runtime.ts
│   │       ├── dispatcher.ts
│   │       ├── trusted-clients.ts
│   │       ├── private-ui-capture.ts
│   │       ├── extension-status.ts
│   │       └── parser-port-adapter.ts
│   ├── distilly/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── distilly.ts
│   │       ├── person.ts
│   │       └── node.ts
│   ├── mcp/
│   │   └── src/
│   │       ├── create-server.ts
│   │       ├── stdio.ts
│   │       ├── presenter.ts
│   │       ├── review-presenter.ts
│   │       └── handlers/
│   │           ├── get.ts
│   │           ├── ingest.ts
│   │           ├── pending.ts
│   │           ├── commit.ts
│   │           └── correct.ts
│   ├── bindings/
│   │   └── src/
│   │       ├── protocol.ts
│   │       ├── registry.ts
│   │       ├── codex/
│   │       └── claude-code/
│   ├── adapters/
│   │   └── src/
│   │       ├── protocol.ts
│   │       ├── registry.ts
│   │       └── delegated/
│   ├── panel/
│   │   ├── server/
│   │   │   ├── server.ts
│   │   │   ├── auth.ts
│   │   │   ├── origin.ts
│   │   │   └── rpc.ts
│   │   └── web/
│   │       ├── client/
│   │       │   ├── http-engine-client.ts
│   │       │   └── event-stream.ts
│   │       └── app/
│   ├── cli/
│   │   └── src/
│   │       ├── bin.ts
│   │       ├── composition.ts
│   │       ├── io.ts
│   │       ├── commands/
│   │       └── setup/
├── plugins/
│   ├── shared/
│   ├── codex/
│   ├── claude-code/
│   └── fixtures/
├── examples/
├── docs/
├── .agents/
└── tools/ prompts/ skills/ tests/       # 冻结 Python 遗产，见 §28
~~~

远程 Catalog 没进入实现前不创建 registry package。TUI、Bot 同理：目标没有真实 slice 就不留空 package。

### 25.2 依赖方向

~~~text
protocol
├── engine
├── bindings
├── adapters
├── distilly (browser-safe root)
├── mcp
└── panel/web

runtime → protocol + engine + bindings + adapters
distilly/node → runtime
panel/server → protocol + mcp（只服务 panel/web 的构建产物，不 import panel/web TypeScript）
cli → runtime + distilly/node + mcp + panel/server
plugins → CLI launcher（进程边界，不是 TS import）
~~~

精确规则：

- protocol 零内部依赖；
- engine 只依赖 protocol 与明确运行时库，不依赖 facade、MCP、Panel、CLI 或具体 binding；
- bindings 与 adapters 只依赖 protocol，不能反向 import distilly facade；
- runtime 是唯一库级 composition root：core methods（包括 ingestFiles）委托 engine，hosts / doctor 等叶子 methods 委托对应扩展；
- distilly 根只依赖 protocol；distilly/node subpath 依赖 runtime，但根 barrel 不触达 node.ts；
- mcp 只依赖 protocol；panel/web 只依赖 protocol / browser-safe facade；panel/server 额外依赖 mcp 的窄 ReviewPresenter type，但不 import engine internals；
- cli 组合 runtime、MCP 与 Panel，但不能拥有业务规则；
- adapters 不 import engine store；SourceAdapter 在 runtime 外产出 MaterialInput，ParserRegistry 由 runtime 适配成 engine 的 MaterialParserPort。engine 的 file ingest 负责读文件、写 raw 与按 §9.4/§11 的 lock 顺序提交派生材料；parser 只返回 ParsedMaterial；
- bindings 的 PrivateUiCaptureController / GrantHandle 只负责原生授权、frame gate 与 transcript；runtime coordinator 编排 action，engine 独占 capture audit、短命 ingest session 与 MaterialRecord stamp，任何 binding/runtime 都不直写 fact files；
- Panel web runtime 只通过 HTTP EngineClient；
- package exports、未声明依赖和循环由 build / knip 门禁。

公开入口固定如下：

| 入口 | 公开内容 | 环境 |
|---|---|---|
| distilly | Distilly、Person、EngineClient、DistillyError、常用 protocol types | browser-safe |
| distilly/node | openInProcess | Node only |
| @distilly/protocol | ids、values、MethodMap、runtime schemas、五工具 draft-2020-12 descriptor registry | universal |
| @distilly/engine | createEngine、EngineCoreOptions、EngineRuntime | Node only |
| @distilly/engine/ports | QueueRepository、LibraryProjection、Clock、IdGenerator、EngineEventBus、MaterialParserPort、AuditKeyPort、CaptureLivenessPort | Node only |
| @distilly/runtime | createLocalRuntime、extension registries；不从 distilly 根转导 | Node only |
| @distilly/mcp | createMcpServer、ReviewPresenter | universal server API |
| @distilly/mcp/stdio | stdio runner | Node only |
| @distilly/panel/server | startPanelServer、PanelLauncher | Node only |
| @distilly/panel/web | HttpEngineClient 与 UI bootstrap | browser only |
| @distilly/bindings | interfaces、registry、builtin factories | Node only |
| @distilly/adapters | adapter / parser contracts 与 registry | Node only |
| @distilly/cli | 只有 executable，不承诺 library barrel | Node only |

panel/server 与 panel/web 使用独立 tsconfig / exports，不提供把两边一起打进 bundle 的总 barrel。mcp 根不 re-export stdio。构建矩阵对每个入口单独 bundle，浏览器入口出现 node:fs、node:sqlite 或 runtime 依赖就失败。

### 25.3 哪些是 interface

| Interface | 为什么有真实多实现 |
|---|---|
| EngineClient | in-process、Panel HTTP、以后 daemon |
| QueueRepository | SQLite、测试 fake、以后 worker coordination |
| SourceAdapter | 多来源与社区包 |
| MaterialParser | OCR、转写、文档解析 |
| HostBinding / HostInjector / HostFormRenderer / PrivateUiCaptureController | 每个宿主的能力、授权 UI、frame gate 与隔离机制真实不同 |
| DraftProducer | 宿主模型、可选后台 provider |
| LibraryProjection | JSON/SQLite、测试 fake、以后本地全文 |
| Clock / IdGenerator / EngineEventBus | 生产与确定性测试边界 |

Fact stores 不定义通用 StorageProvider。Markdown/text/JSON 的本地布局是 locked 产品格式，不需要“以后换 Postgres”抽象。

### 25.4 哪些是纯函数

- material normalize、source identity、source grouping、SHA-256 与集合 hash；
- id / claim id 派生；
- facet path parse；
- EvidenceRef resolve 与 quote / locator 校验；
- claim patch apply、strength、quality、maturity；
- Markdown / prompt render；
- profile diff；
- relation event reduce；
- bundle canonicalization / digest；
- path segment validation；
- wire schema parse。

纯函数文件不导出 class，不依赖 clock / fs / network。

### 25.5 哪些是 concrete service

- SubjectService、IngestService、BriefingService、CommitService；
- CorrectionService、ReviewService、VersionService；
- FileSpaceIdentityLock、FileSubjectLock、IngestJournal、CommitJournal、RecoveryService；
- FileSpaceStore、FileSubjectStore、FileMaterialStore、FileVersionStore、FileStateStore、FileEventStore、FileOperationStore；
- SqliteQueueRepository；
- ProjectionService、PanelServer、McpServer、SetupService。

Service 有状态或编排多个 store；同类只有一个生产实现时直接 concrete，不先造 interface。

### 25.6 为什么没有 public abstract class

TypeScript 的扩展方需要结构契约，不需要继承我们的状态、构造器与 protected helper。V3 第一版导出 **零个 abstract class**：

- SourceAdapter / HostBinding 用 interface；
- Distilly / Person / DistillyError 是 concrete public classes；
- Store / service 是 package-internal concrete；
- 两个实现真正共享算法时提取纯函数；
- 只有出现无法用组合表达的真实共享状态机，并有至少两个实现后，才允许 package-private base class；不得成为 wire 或根导出。

这让未来扩展通过注册与组合发生，不把一次实现细节冻结成继承 ABI。

### 25.7 Composition

~~~ts
export interface Clock {
  now(): IsoDateTime;
}

export interface IdGenerator {
  subjectId(): SubjectId;
  spaceId(): SpaceId;
  jobId(): JobId;
  leaseId(): LeaseId;
  requestId(): RequestId;
  eventId(): EventId;
  captureAuditRef(): CaptureAuditRef;
}

export interface EngineEventBus {
  publish(event: EngineEvent): Promise<void>;
  subscribe(handler: (event: EngineEvent) => void): Unsubscribe;
}

export interface MaterialParserPort {
  parse(input: RawMaterial, context: ParseContext): Promise<ParsedMaterial>;
}

export interface AuditKeyPort {
  loadOrCreate(): Promise<Uint8Array>;
}

export interface CaptureLivenessPort {
  status(): Promise<PrivateUiCaptureGrantStatus>;
  watch(
    listener: (status: PrivateUiCaptureGrantStatus) => void,
  ): Unsubscribe;
}

export type RuntimeOwnedMethodName =
  | "hosts.install" | "hosts.uninstall" | "hosts.export"
  | "system.doctor";

export type CoreMethodName =
  Exclude<keyof EngineMethodMap, RuntimeOwnedMethodName>;

export interface CoreEngineClient {
  call<M extends Extract<CoreMethodName, QueryMethodName>>(
    method: M,
    params: EngineMethodMap[M]["params"],
  ): Promise<EngineMethodMap[M]["result"]>;
  call<M extends Extract<CoreMethodName, MutationMethodName>>(
    method: M,
    params: EngineMethodMap[M]["params"],
    context: MutationContext,
  ): Promise<EngineMethodMap[M]["result"]>;
  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}

export interface EngineCoreOptions {
  readonly root: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly queue?: QueueRepository;
  readonly library?: LibraryProjection;
  readonly events?: EngineEventBus;
  readonly parser?: MaterialParserPort;
  readonly auditKey?: AuditKeyPort;
}

export interface EngineRuntime {
  connect(session: ClientSessionContext): CoreEngineClient;
  openPrivateUiCapture(input: {
    readonly actor: ActorContext;
    readonly scope: PrivateUiCaptureScope;
    readonly authorization: PrivateUiCaptureAuthorization;
    readonly liveness: CaptureLivenessPort;
  }): Promise<CorePrivateUiCaptureSession>;
  recover(): Promise<void>;
  close(): Promise<void>;
}

export declare function createEngine(
  options: EngineCoreOptions,
): Promise<EngineRuntime>;

export interface LocalRuntime {
  connectTrusted(session: ClientSessionContext): EngineClient;
  registerPrivateUiCapture(input: {
    readonly host: HostName;
    readonly hostContext: HostContext;
  }): Promise<
    | { readonly kind: "registered"; readonly action: HostActionRegistration }
    | { readonly kind: "unavailable"; readonly remediation: string }
  >;
  close(): Promise<void>;
}

interface PrivateUiCaptureIngestInput
  extends Omit<IngestInput, "enqueue"> {
  readonly enqueue: "now";
}

export interface CorePrivateUiCaptureSession {
  readonly auditRef: CaptureAuditRef;
  ingest(
    input: PrivateUiCaptureIngestInput,
    context: MutationContext,
  ): Promise<IngestResult>;
  complete(): Promise<void>;
  abort(): Promise<PrivateUiCaptureActionAbortReason>;
}

export interface ExtensionStatusProvider {
  inspect(): Promise<readonly ExtensionStatus[]>;
}

export interface LocalRuntimeOptions {
  readonly root: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly hosts?: HostRegistry;
  readonly adapters?: AdapterRegistry;
  readonly parsers?: ParserRegistry;
  readonly extensionStatus?: ExtensionStatusProvider;
}

export declare function createLocalRuntime(
  options: LocalRuntimeOptions,
): Promise<LocalRuntime>;
~~~

engine 不知道 AdapterRegistry、HostRegistry、Panel 或具体 parser registry，但拥有文件摄取事务和窄 MaterialParserPort。materials.ingestFiles 是 core method：engine 校验路径、读取 bytes、先把原始输入写 RawStore，再调用 port；无 parser、解析失败或没有 material 时返回 unparsed RawId，只有解析出的 MaterialInput 才按 §9.4/§11 的同一 create-or-existing transaction 进入 material / generation / queue 流程。parser 永远不能写 store 或伪造 rawStored。

createEngine({root}) 本身就是可实例化的 production factory：缺省使用 SystemClock、CryptoIdGenerator、LocalAuditKeyPort、SqliteQueueRepository、JsonLibraryProjection、InProcessEngineEventBus 与只支持纯文本 / Markdown 的 TextMaterialParserPort。LocalAuditKeyPort 按 §6.3 做 keychain/file 原子初始化；可选 port 只用于确定性测试或真实替代实现。factory 在返回前完成 recovery，不要求调用者从内部目录 new concrete class。

LocalRuntimeOptions 属于 @distilly/runtime。createLocalRuntime({root}) 缺省构造带 Codex / Claude Code builtins 的 HostRegistry、空 AdapterRegistry、带 text / Markdown builtins 的 ParserRegistry，以及聚合这些 registry 与 runtime 状态的 ExtensionStatusProvider；传入的 registry 是整个替换，不做隐式 merge。runtime 用 ParserRegistryPortAdapter 实现 engine 的 MaterialParserPort，dispatcher 只接管 RuntimeOwnedMethodName 的 host / doctor handlers；任何 method 缺 handler 都在 startup fail，不到运行时返回“暂不支持”。这些 concrete registry 永远不进入 engine 包。

connectTrusted 与 registerPrivateUiCapture 只供 CLI/MCP/Panel/Binding composition 使用，不从 distilly 或 distilly/node 转导；普通 SDK 只能走 openInProcess 的固定 sdk actor。actor 绑定在 client session，不绑定整个 engine，因此同一 runtime 可同时给 MCP host client 与 Panel user client。

registerPrivateUiCapture 使用同一个 HostContext 创建 Controller 和 host action，并在 runtime 内构造实现 PrivateUiCaptureActionPort 的 coordinator。每次 action invocation 执行 authorize → grant.bindOnce → EngineRuntime.openPrivateUiCapture → Controller.capture → session.ingest → session.complete；open 后、ingest 前异常必须先调用无参数 session.abort，并把它返回的 guard reason 或 coordinator_aborted 放进 action result，ingest 自身拒绝则已由 engine 关闭 session并返回 failed。任一步拒绝/撤销都返回 typed result并释放 grant。invocationId 在该 host session 内稳定映射 RequestId，重试只命中同一幂等 ingest。CaptureLivenessPort 是 runtime 对 GrantHandle 的窄 adapter；engine 订阅 revoke 并在同一 session mutex 下于 ingest commit 前重新 status，拒绝 revoked/expired/consumed。CorePrivateUiCaptureSession 与 PrivateUiCaptureContext 不从 engine root exports、protocol、facade 或 MCP 暴露；低层 engine composition 也不能经普通 connect 获得它。

audit 的 materialCount 由一次成功 IngestResult 中 engine 接受的 private transcript items 推导；boundaryRefusalCount 和异常 stop reason 来自 liveness port；data policy / retention refs 来自 authorization。complete 无参数且只在成功 ingest 后可调用。process crash 由 recovery 写 process_terminated；没有 caller-supplied string/count 的审计入口。该 session 只复用固定 enqueue=now 的 PrivateUiCaptureIngestInput、IngestResult 与 IngestService，不开放 pending、commit 或新的第六工具。

openInProcess 使用上述 production defaults，并独占它创建的 LocalRuntime；测试显式传 fake clock / ids，但使用真实 temp fact stores。createEngine / createLocalRuntime 先 recover 再接收 client；构造器不做隐式网络、secret 或插件安装。CoreEngineClient / EngineClient 的 close 只解绑 session，EngineRuntime / LocalRuntime 的 close 才由 composition owner 关闭共享 queue、event bus 与 stores。

---
