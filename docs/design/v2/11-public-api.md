> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 11. 公开 API

### 11.1 异步模型

**公开方法全部返回 `Promise`，没有同步孪生。** 引擎在启动时可以做一次性同步读取，但任何会被宿主事件循环等到的操作都是异步的：同步文件 I/O 会卡住插件宿主。

### 11.2 `Distilly`

```ts
export interface DistillyOptions {
  readonly root?: string;        // 默认 ~/.distilly，或 DISTILLY_ROOT
  readonly client: EngineClient; // 显式传入，不在构造器里偷偷造一个引擎
}

export class Distilly {
  constructor(options: DistillyOptions);

  person(subjectId: string, options?: { readonly space?: string }): Person;
  create(input: CreateSubjectInput): Promise<Person>;
  list(filter?: { readonly space?: string; readonly domainPack?: string }): Promise<SubjectSummary[]>;
  search(query: string): Promise<SubjectSummary[]>;
  delete(subjectId: string): Promise<void>;

  pending(filter?: { readonly subjectId?: string }): Promise<PendingJob[]>;
  commit(input: CommitInput): Promise<Version>;
  promote(versionId: VersionId): Promise<Version>;
  reject(versionId: VersionId, options?: { readonly reason?: string }): Promise<void>;

  subgraph(seed: readonly SubjectId[], options?: { readonly hops?: number }): Promise<RelationGraph>;
  listAdapters(): Promise<AdapterCapabilities[]>;
  close(): Promise<void>;
}
```

进程内接线由引擎提供，门面只薄封装一层：

```ts
export function openInProcess(root?: string): Promise<Distilly>;
```

`EngineClient` 是唯一的传输缝：

```ts
export interface EngineClient {
  call<T>(method: string, params: unknown): Promise<T>;
  /** 订阅引擎写入；语义与事件类型见 §16.2。 */
  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}
```

换成守护进程或回环 HTTP 时换掉它的实现，`Distilly` / `Person` 一行不改（§5.1 项 18）。`watch` 是必填的：长驻界面靠它重画，一问一答的调用方不订阅就是了（§16.2）。市场方法第二版再挂，不要为了做市场养肥 `Person`。

### 11.3 `Person`

```ts
export class Person {
  readonly id: SubjectId;
  readonly space: SpaceId;

  get(options?: { readonly version?: VersionId }): Promise<Profile>;
  /** 完整中性 Markdown。第一版等于渲染 get() 的结果，不裁剪。 */
  prompt(options?: { readonly version?: VersionId }): Promise<string>;
  status(): Promise<SubjectStatus>;

  ingest(materials: readonly MaterialIn[], options: { readonly source: string }): Promise<IngestResult>;
  ingestFiles(paths: readonly string[], options?: { readonly kind?: string }): Promise<IngestResult>;
  /** 委托型返回计划；直采型自己采完返回结果。判别字段是 kind。 */
  collect(adapterId: string, request: CollectRequest): Promise<AgentPlan | IngestResult>;
  acceptCollect(plan: AgentPlan, artifacts: readonly string[]): Promise<IngestResult>;

  correct(input: { readonly text: string; readonly facet?: string }): Promise<Version>;
  flush(): Promise<PendingJob>;

  versions(): Promise<Version[]>;
  diff(a: VersionId, b: VersionId): Promise<ProfileDiff>;
  rollback(version: VersionId): Promise<Version>;
  lineage(options?: { readonly version?: VersionId }): Promise<LineageEvent[]>;

  install(host: HostName): Promise<InstallRef>;
  uninstall(host: HostName): Promise<void>;
  export(host: HostName, dest: string): Promise<string>;

  link(other: string | Person, input: {
    readonly type: string;
    readonly evidence: readonly EvidenceRef[];
    readonly confidence?: number;
    readonly role?: Readonly<Record<string, string>>;
  }): Promise<Relation>;
  invalidate(relationId: RelationId, input: { readonly reason: string }): Promise<void>;
  neighbors(filter?: { readonly type?: string }): Promise<Relation[]>;
  path(other: string | Person, options?: { readonly maxHops?: number }): Promise<Relation[]>;
  mentions(): Promise<PendingMention[]>;
  resolveMention(mentionId: MentionId, subjectId: SubjectId): Promise<Relation>;
}
```

`collect` 的返回是判别联合，调用方必须按 `kind` 分辨，**不许用「有没有某个字段」来猜**。

### 11.4 错误

错误码是**冻结的闭集**，也是跨进程契约：只传 `code`，不传类名。

```ts
export type DistillyErrorCode =
  | "not_found" | "already_exists" | "stale_version" | "pending_commit"
  | "confidence_gate" | "ambiguous_mention" | "host_unsupported"
  | "invalid_input" | "adapter_failed";

export class DistillyError extends Error {
  readonly code: DistillyErrorCode;
  readonly retryable: boolean;
  readonly remediation?: string;
}
```

| 码 | 什么时候 |
|---|---|
| `not_found` | 主体、版本、作业、关系不存在 |
| `already_exists` | 重复建同一个主体 id |
| `stale_version` | 提交或回滚时基准版本已经不是当前 |
| `pending_commit` | 已有挂起版本未处理，又来一次提交 |
| `confidence_gate` | 新版本置信度低于当前，已挂起等 `promote` |
| `ambiguous_mention` | 名字对上多个候选，拒绝猜 |
| `host_unsupported` | 这个宿主没有被请求的装载方式 |
| `invalid_input` | 六道边界上的校验失败 |
| `adapter_failed` | 采集适配器出错，`retryable` 与 `remediation` 透传 |

`switch (error.code)` 必须以穷尽检查收尾，新增一个码就必须处理每一处分支。

### 11.5 运行时校验只发生在这六道边界

「类型已知就信类型」的边界要写死，否则运行时校验会到处长。schema 用 `zod` 写，全部住在 `@distilly/protocol/schemas.ts`。

| 边界 | 校验什么 | 失败 |
|---|---|---|
| 模型 / 工具入参 | 模型生成的 JSON | `invalid_input`，把出错字段路径写进 `remediation` |
| `commit` 的 draft | 集合哈希一致、facet 语法、claim 证据非空、置信度区间 | `invalid_input`；**空内核合法** |
| 磁盘读入 | `meta.json` / `state.json` / `claims.jsonl` / `relations.jsonl` 的 schema 版本与字段 | 拒绝加载，不静默修 |
| 配置 | `distilly.toml` / `adapters.toml` | 加载即失败，指出字段 |
| 适配器产出 | 第三方给的材料 | `adapter_failed` |
| 以后的守护进程 / worker | 进程间 JSON | 同模型入参 |

**其他地方不校验。** 同进程、类型已知的调用不加防御分支，也不为「类型上不可能」的输入写测试。

### 11.6 模型那张脸：五个工具

| 工具 | 对应 |
|---|---|
| `distilly_get` | `Person.get` / `prompt` |
| `distilly_ingest` | `Person.ingest`（必须带主体 id） |
| `distilly_pending` | `Distilly.pending` |
| `distilly_commit` | `Distilly.commit` |
| `distilly_correct` | `Person.correct` |

只这五个。一千个人不能 `get` 一遍，模型只应对当前这个人 `get`。`link` 第二版再给模型，避免它乱连；市场浏览永远不做成模型的常用工具。工具名和入参字段只加不改（§5.1 项 19）。

---
