> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 15. 本地审核面板

### 15.1 产品职责

Panel 首版只做四件事：看本地人物、看一份画像、看证据、处理风险。它不自己浏览网页、不调用 LLM、不直接发布 Profile Catalog，也不成为第二个事实编辑器。

Chat 是发起 research 的主入口；Panel 的“继续调研”按钮只生成或复制一条宿主 prompt，不偷偷启动模型。

### 15.2 四个一级页面

**Library**

- 本地主体列表、搜索和空间筛选；
- displayName、privacy、maturity、active / contested claim 数、新材料数、current version；
- 进入主体、复制“继续调研”提示、临时使用、安装、archive；
- 不显示一个前端自己计算的百分比。

**Subject**

- Profile：七个 core facets 与已存在 domains；
- Claims：active / contested / superseded，按 facet 过滤；
- Evidence：claim、quote、来源 URI、capture time、source group / basis / diversity caution 与材料正文并排；
- Materials：载体、source role、artifact / representation、文本派生方法、raw 是否可用、capture audit、sensitivity、source group / caution 与是否参与当前 generation；
- Versions：current / suspended / historical / rejected、diff、lineage。

**Review**

- 所有主体当前的 active suspended target 与 ReviewReason；
- current vs candidate 的 facet / claim diff；
- promote、reject、correct、rollback；
- 任何危险或不可逆操作使用显式确认，不预勾。

**Settings & Doctor**

- DISTILLY_ROOT、runtime / plugin / protocol 版本；
- HostBinding capability 与 MCP handshake；
- Panel 监听地址和安全状态；
- adapter / parser / optional executor preflight；
- telemetry 明确 off / on，不显示虚假使用量。

Discover 不出现在首版导航。Profile Catalog 没达到 §24 进入条件前，空 tab 只会制造“是不是要登录”的误解。

### 15.3 面板读模型

界面所需聚合由引擎返回：

~~~ts
export interface LibraryEntry {
  readonly subject: SubjectSummary;
  readonly status: SubjectStatus;
  readonly pendingJobs: number;
  readonly suspendedVersions: number;
  readonly lastChangedAt: IsoDateTime;
}

export interface ReviewItem {
  readonly candidate: VersionSummary;
  readonly current?: VersionSummary;
  readonly reasons: readonly ReviewReason[];
  readonly diff: ProfileDiff;
}

export interface MaterialQuery extends SubjectRef {
  readonly kind?: MaterialRecord["kind"];
  readonly atVersionId?: VersionId;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface MaterialSummary {
  readonly record: MaterialRecord;
  readonly contentCharacters: number;
  readonly sourceGroup: SourceGroup;
  readonly grouping: SourceGroupingContext;
}

export interface SourceGroupingContext {
  readonly algorithmVersion: string;
  readonly generation: number;
  readonly versionId?: VersionId;
}

export interface MaterialPage {
  readonly items: readonly MaterialSummary[];
  readonly nextCursor?: string;
}

export interface GetMaterialInput {
  readonly subjectId: SubjectId;
  readonly materialId: MaterialId;
  readonly atVersionId?: VersionId;
}

export interface MaterialView {
  readonly record: MaterialRecord;
  readonly content: string;
  readonly sourceGroup: SourceGroup;
  readonly grouping: SourceGroupingContext;
}

export interface ExtensionStatus {
  readonly id: string;
  readonly kind: "host" | "adapter" | "parser";
  readonly ok: boolean;
  readonly version?: string;
  readonly warnings: readonly string[];
}

export interface DoctorInput {
  readonly host?: HostName;
}

export interface DoctorSnapshot {
  readonly runtime: {
    readonly productVersion: string;
    readonly wireVersion: string;
    readonly promptVersion: string;
  };
  readonly storage: {
    readonly rootLabel: string;
    readonly writable: boolean;
    readonly schemaSupported: boolean;
    readonly projectionsDirty: boolean;
  };
  readonly panel: {
    readonly loopbackOnly: boolean;
    readonly authentication: "enabled" | "unavailable";
  };
  readonly extensions: readonly ExtensionStatus[];
}
~~~

LibraryEntry、ReviewItem、ProfileDiff 都住 protocol。Panel 不从多个接口拼接后自算 maturity、pending 或 review reason。新增屏幕聚合时先加入 EngineMethodMap，再由 SDK 与 UI 使用。

MaterialQuery / GetMaterialInput 未给 atVersionId 时按当前 generation 派生分组；给定 atVersionId 时，引擎从该 version 的 materials.json manifest 取得精确集合，并按 VersionRecord.quality.sourceGroupingVersion 重建当时的 group。不存在于该 manifest 的 MaterialId 返回 not_found，binary 已不支持该历史 grouping version 时返回 schema_unsupported。Panel 只展示返回的 SourceGroupingContext，不拿当前材料目录或当前算法猜历史结果。

suspendedVersions 在 V3 首版只能是 0 或 1；字段保留 number 是为了列表聚合显示，不表示允许多个 active targets。历史上曾 suspended 后被 reject / promote 的版本通过 versions.list 查看，不计入该数。

### 15.4 Transport

~~~text
distilly panel --port <n>
  GET  /                  静态资源
  GET  /health            不含人物数据的版本与 readiness
  POST /rpc               EngineMethodMap 的类型化 JSON 调用
  GET  /events            watch 的 SSE 字节流
~~~

~~~ts
export interface PanelServerOptions {
  readonly client: EngineClient;
  readonly assetsDir: string;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly tokenFactory: () => string;
  readonly allowedOrigins: readonly string[];
}

export interface PanelHandle {
  readonly url: string;
  readonly close: () => Promise<void>;
}

export declare function startPanelServer(
  options: PanelServerOptions,
): Promise<PanelHandle>;
~~~

PanelServerOptions.client 必须由 LocalRuntime 为本次 Panel 会话单独绑定 kind=user；即使 Panel 是由 MCP 的 ReviewPresenter 启动，也不能复用 host client。HTTP handler 只把已校验的 MethodMap params 与 mutation requestId 转给这个 client。

URL 形如 http://127.0.0.1:PORT/#TOKEN。Fragment 不发给服务器；前端读出后立刻从地址栏移除，并在 fetch Authorization header 中使用。事件流用支持 header 的 fetch streaming，不使用不能设置 Authorization 的原生 EventSource。

### 15.5 安全不变量

1. 只绑定 127.0.0.1；不接受 0.0.0.0、局域网地址或 hostname 自动解析。
2. 每次启动新建高熵 token；RPC、events 都必须验证。
3. 校验 Origin 与 Host；拒绝 null、跨站和未知 origin。
4. 明确端口被占就失败；不在已经给用户 URL 后静默换端口。
5. 静态资源全部本地，CSP 禁止远程脚本、frame 与任意 connect-src。
6. RPC body、响应与日志有大小上限；日志不写材料正文、token 或 secret。
7. Panel 只持 EngineClient，不 import engine store，不读取 DISTILLY_ROOT。
8. purge、publish 等危险动作需要二次确认和短期 action nonce。

无 token、错 token、跨站 Origin、错误 Host、超大 body、端口占用与路径穿越各有拒绝测试。

### 15.6 生命周期与宿主打开方式

~~~ts
export interface ReviewPresenter {
  present(review: ReviewRef): Promise<ReviewLaunch>;
}

export interface PanelLauncherOptions {
  readonly start: () => Promise<PanelHandle>;
}

export declare class PanelLauncher implements ReviewPresenter {
  constructor(options: PanelLauncherOptions);
  present(review: ReviewRef): Promise<ReviewLaunch>;
  close(): Promise<void>;
}
~~~

distilly panel 在前台运行并打印 URL。MCP / CLI presenter 得到 suspended CommitResult 时，通过注入的 ReviewPresenter 启动或复用本次会话的 PanelServer，再把 ReviewLaunch 作为工具 structured value 返回；CommitService / CommitResult 只知道 ReviewRef，不知道 HTTP 或 URL。ReviewPresenter 接口由 mcp 导出，PanelLauncher 由 panel/server 实现，所以 mcp 不静态依赖 panel。

宿主能打开本机链接就展示；不能时让用户复制到系统浏览器。模型职责到“提供地址与说明”结束，不点击 DOM，也不把 Panel 操作当工具执行。

---
