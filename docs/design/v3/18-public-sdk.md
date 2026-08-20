> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 18. TypeScript 公共 SDK 与 EngineClient

### 18.1 EngineMethodMap

~~~ts
export type Method<P, R> = {
  readonly params: P;
  readonly result: R;
};

export type EmptyResult = null;

export interface IngestInput {
  readonly subject: IngestSubjectTarget;
  readonly materials: readonly MaterialInput[];
  readonly enqueue: "auto" | "now";
}

export interface IngestFilesInput {
  readonly subject: IngestSubjectTarget;
  readonly paths: readonly string[];
  readonly enqueue: "auto" | "now";
  readonly sensitivity?: "private" | "shareable";
}

export type FileIngestItemResult =
  | {
      readonly kind: "parsed";
      readonly pathLabel: string;
      readonly material: IngestItemResult;
    }
  | {
      readonly kind: "unparsed";
      readonly pathLabel: string;
      readonly rawId: RawId;
      readonly mediaType: string;
      readonly warnings: readonly string[];
    };

export interface IngestFilesResult {
  readonly subject: SubjectSummary;
  readonly created: boolean;
  readonly items: readonly FileIngestItemResult[];
  readonly generation: number;
  readonly materialSetHash?: MaterialSetHash;
  readonly job?: PendingJob;
}

export interface BriefInput {
  readonly jobId: JobId;
}

export interface RenewLeaseInput {
  readonly jobId: JobId;
  readonly leaseId: LeaseId;
}

export interface ReleaseLeaseInput extends RenewLeaseInput {
  readonly reason?: string;
}

export interface CommitInput {
  readonly jobId: JobId;
  readonly generation: number;
  readonly leaseId: LeaseId;
  readonly briefContractDigest: BriefContractDigest;
  readonly materialSetHash: MaterialSetHash;
  readonly baseVersionId?: VersionId;
  readonly patch: DistillPatch;
}

export type CommitResult =
  | {
      readonly kind: "current";
      readonly version: VersionSummary;
      readonly profile: Profile;
    }
  | {
      readonly kind: "suspended";
      readonly candidate: VersionSummary;
      readonly currentVersionId?: VersionId;
      readonly reasons: readonly ReviewReason[];
      readonly review: ReviewRef;
    };

export interface GetProfileInput extends SubjectRef {
  readonly versionId?: VersionId;
}

export interface CorrectionDraft {
  readonly text: string;
  readonly facet?: FacetPath;
  readonly supersedes?: readonly ClaimId[];
  readonly baseCandidateVersionId?: VersionId;
}

export interface CorrectInput extends SubjectRef {
  readonly correction: CorrectionDraft;
}

export interface DiffInput extends SubjectRef {
  readonly before: VersionId;
  readonly after: VersionId;
}

export interface ReviewActionInput extends SubjectRef {
  readonly candidateVersionId: VersionId;
  readonly reason?: string;
}

export interface RollbackInput extends SubjectRef {
  readonly targetVersionId: VersionId;
  readonly reason: string;
}

export interface LineageInput extends SubjectRef {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface LineageEvent {
  readonly eventId: EventId;
  readonly kind:
    | "created" | "committed" | "suspended" | "promoted"
    | "rejected" | "candidate_replaced" | "rolled_back"
    | "corrected" | "imported";
  readonly versionId?: VersionId;
  readonly relatedVersionId?: VersionId;
  readonly actor: ActorContext;
  readonly at: IsoDateTime;
  readonly reason?: string;
}

// LineageEvent is a read model projected from EventRecord plus immutable
// VersionRecord; it is not a second on-disk event shape.

export interface InstallOptions {
  readonly versionId?: VersionId;
  readonly destination?: string;
}

export interface InstallInput extends SubjectRef {
  readonly host: HostName;
  readonly options?: InstallOptions;
}

export interface UninstallInput {
  readonly install: InstallRef;
}

export interface ExportOptions {
  readonly destination: string;
  readonly versionId?: VersionId;
  readonly overwrite?: boolean;
}

export interface HostExportInput extends SubjectRef {
  readonly host: HostName;
  readonly options: ExportOptions;
}

export interface ExportRef {
  readonly host: HostName;
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly path: string;
  readonly contentDigest: ContentDigest;
}

export interface LibraryQuery {
  readonly text?: string;
  readonly spaceId?: SpaceId;
  readonly lifecycle?: SubjectLifecycle;
  readonly hasPending?: boolean;
  readonly hasSuspended?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface LibraryPage {
  readonly items: readonly LibraryEntry[];
  readonly nextCursor?: string;
}

export interface RebuildResult {
  readonly subjects: number;
  readonly jobs: number;
  readonly relations: number;
  readonly rebuiltAt: IsoDateTime;
}

export interface ReviewQuery {
  readonly subjectId?: SubjectId;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface BundleInspectInput {
  readonly path: string;
}

export interface BundleInspection {
  readonly displayName: string;
  readonly claimCount: number;
  readonly evidenceExcerptCount: number;
  readonly license: string;
  readonly signature: "valid" | "missing" | "invalid";
  readonly warnings: readonly string[];
}

export interface BundleImportInput extends BundleInspectInput {
  readonly spaceId?: SpaceId;
  readonly confirmation: string;
}

export interface BundleImportResult {
  readonly subject: SubjectSummary;
  readonly candidate: VersionSummary;
  readonly review: ReviewRef;
}

export interface BundleExportInput extends SubjectRef {
  readonly versionId?: VersionId;
  readonly destination: string;
  readonly provenancePolicy: "none" | "citations_and_quotes";
}

export interface BundleExportResult {
  readonly path: string;
  readonly contentDigest: ContentDigest;
}

export type EngineMethodMap = Readonly<{
  readonly "subjects.create": Method<CreateSubjectInput, SubjectSummary>;
  readonly "subjects.list": Method<SubjectQuery, SubjectPage>;
  readonly "subjects.resolve": Method<ResolveSubjectInput, ResolveSubjectResult>;
  readonly "subjects.archive": Method<SubjectRef, EmptyResult>;
  readonly "subjects.purge": Method<PurgeSubjectInput, EmptyResult>;

  readonly "materials.ingest": Method<IngestInput, IngestResult>;
  readonly "materials.ingestFiles": Method<IngestFilesInput, IngestFilesResult>;
  readonly "materials.list": Method<MaterialQuery, MaterialPage>;
  readonly "materials.get": Method<GetMaterialInput, MaterialView>;

  readonly "distill.pending": Method<PendingFilter, readonly PendingJob[]>;
  readonly "distill.brief": Method<BriefInput, HostDistillBriefing>;
  readonly "distill.renew": Method<RenewLeaseInput, JobLease>;
  readonly "distill.release": Method<ReleaseLeaseInput, EmptyResult>;
  readonly "distill.commit": Method<CommitInput, CommitResult>;
  readonly "distill.redistill": Method<RedistillInput, PendingJob>;

  readonly "profiles.get": Method<GetProfileInput, Profile>;
  readonly "profiles.prompt": Method<GetProfileInput, string>;
  readonly "profiles.status": Method<SubjectRef, SubjectStatus>;
  readonly "profiles.correct": Method<CorrectInput, CommitResult>;

  readonly "versions.list": Method<SubjectRef, readonly VersionSummary[]>;
  readonly "versions.diff": Method<DiffInput, ProfileDiff>;
  readonly "versions.promote": Method<ReviewActionInput, VersionSummary>;
  readonly "versions.reject": Method<ReviewActionInput, VersionSummary>;
  readonly "versions.rollback": Method<RollbackInput, VersionSummary>;
  readonly "versions.lineage": Method<LineageInput, readonly LineageEvent[]>;

  readonly "hosts.install": Method<InstallInput, InstallRef>;
  readonly "hosts.uninstall": Method<UninstallInput, EmptyResult>;
  readonly "hosts.export": Method<HostExportInput, ExportRef>;

  readonly "library.list": Method<LibraryQuery, LibraryPage>;
  readonly "library.rebuild": Method<Record<string, never>, RebuildResult>;
  readonly "reviews.list": Method<ReviewQuery, readonly ReviewItem[]>;

  readonly "bundles.inspect": Method<BundleInspectInput, BundleInspection>;
  readonly "bundles.import": Method<BundleImportInput, BundleImportResult>;
  readonly "bundles.export": Method<BundleExportInput, BundleExportResult>;

  readonly "system.doctor": Method<DoctorInput, DoctorSnapshot>;
}>;

export type MutationMethodName =
  | "subjects.create" | "subjects.archive" | "subjects.purge"
  | "materials.ingest" | "materials.ingestFiles"
  | "distill.brief" | "distill.renew" | "distill.release"
  | "distill.commit" | "distill.redistill"
  | "profiles.correct"
  | "versions.promote" | "versions.reject" | "versions.rollback"
  | "hosts.install" | "hosts.uninstall" | "hosts.export"
  | "library.rebuild" | "bundles.import" | "bundles.export";

export type QueryMethodName =
  Exclude<keyof EngineMethodMap, MutationMethodName>;

export interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export type MethodSchemas<M extends Method<unknown, unknown>> = {
  readonly params: RuntimeSchema<M["params"]>;
  readonly result: RuntimeSchema<M["result"]>;
};

export declare const engineMethodSchemas: {
  readonly [M in keyof EngineMethodMap]: MethodSchemas<EngineMethodMap[M]>;
};
~~~

MCP 五工具是这个更大方法表的受限 presenter，不是一对一等同于五个 engine methods。materials.ingest 本身接收 IngestSubjectTarget，所以 create + first ingest 是一个 IngestService 事务；handler 禁止先 subjects.create 再 materials.ingest。

关系 slice 未进入首发 MethodMap；§22 固定其未来 additive 类型与复杂度，但在实现落地前不发布永远 unsupported 的 wire 方法。engineMethodSchemas 用 satisfies / mapped type 锁定完整 key 集；CI 的 protocol contract fixture import 五个 ToolOutput、实例化每个 MethodMap params/result，并对每个 key 做 schema round-trip，防止 types.ts 与 schemas/ 漂移。EngineMethodMap 作为 JSON/RPC 合同不使用 undefined/void；无 payload 的成功结果统一为 EmptyResult=null，facade 若承诺 Promise<void> 可在最外层丢弃 null，但 transport、schema 与 OperationRecord 不可各造一种空值。

### 18.2 强类型 EngineClient

~~~ts
export interface EngineClient {
  call<M extends QueryMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
  ): Promise<EngineMethodMap[M]["result"]>;

  call<M extends MutationMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
    context: MutationContext,
  ): Promise<EngineMethodMap[M]["result"]>;

  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}

export type Unsubscribe = () => void;

export declare class DistillyError extends Error {
  readonly code: DistillyErrorCode;
  readonly retryable: boolean;
  readonly fieldPath?: string;
  readonly remediation?: string;
  readonly details?: JsonObject;
  readonly subjectResolution?: DistillyWireError["subjectResolution"];

  constructor(error: DistillyWireError, options?: ErrorOptions);
}
~~~

EngineClient.close() 只取消该 client 的 watch、lease heartbeat 与 session 绑定，不关闭 SQLite、事实 store 或同一 runtime 的其它 client。EngineRuntime / LocalRuntime.close() 才关闭共享资源，只能由创建它的 composition owner 在停止接收调用后执行；它会先关闭仍连接的 child clients，并且幂等。MCP server 与 Panel handle 关闭各自 transport/client，不拥有传入的共享 runtime。openInProcess 是例外：它创建私有 runtime，所以返回的 Distilly.close() 先关 sdk client、再关该私有 runtime。直接 new Distilly({client}) 时，close 仍只委托 client.close()。

不用 call<T>(method: string)：它允许拼错 method、错配 params / result 而编译照过。mutation overload 在类型层强制 requestId；MCP presenter 透传 WireRequest.requestId，facade 为一次顶层调用生成并在底层重试中复用。相同业务动作在调用者主动发起的新顶层调用里可以拿新 requestId，内容寻址的 VersionId 与 stale checks 仍防止重复事实。以后的 HTTP / daemon transport 只能实现这张表，不能改 facade。

### 18.3 Distilly

~~~ts
export interface DistillyOptions {
  readonly client: EngineClient;
}

export interface MutationOptions {
  readonly requestId?: RequestId;
}

export declare class Distilly {
  constructor(options: DistillyOptions);

  person(subjectId: SubjectId): Person;
  create(input: CreateSubjectInput, mutation?: MutationOptions): Promise<Person>;
  list(query?: SubjectQuery): Promise<SubjectPage>;
  resolve(input: ResolveSubjectInput): Promise<ResolveSubjectResult>;

  pending(filter?: PendingFilter): Promise<readonly PendingJob[]>;
  brief(input: BriefInput, mutation?: MutationOptions): Promise<HostDistillBriefing>;
  renew(input: RenewLeaseInput, mutation?: MutationOptions): Promise<JobLease>;
  release(input: ReleaseLeaseInput, mutation?: MutationOptions): Promise<void>;
  commit(input: CommitInput, mutation?: MutationOptions): Promise<CommitResult>;

  reviews(query?: ReviewQuery): Promise<readonly ReviewItem[]>;
  promote(input: ReviewActionInput, mutation?: MutationOptions): Promise<VersionSummary>;
  reject(input: ReviewActionInput, mutation?: MutationOptions): Promise<VersionSummary>;

  close(): Promise<void>;
}
~~~

### 18.4 Person

~~~ts
export declare class Person {
  readonly id: SubjectId;

  get(options?: { readonly versionId?: VersionId }): Promise<Profile>;
  prompt(options?: { readonly versionId?: VersionId }): Promise<string>;
  status(): Promise<SubjectStatus>;

  ingest(
    materials: readonly MaterialInput[],
    options: { readonly enqueue: "auto" | "now" },
    mutation?: MutationOptions,
  ): Promise<IngestResult>;
  ingestFiles(
    paths: readonly string[],
    options: Omit<IngestFilesInput, "subject" | "paths">,
    mutation?: MutationOptions,
  ): Promise<IngestFilesResult>;
  correct(input: CorrectionDraft, mutation?: MutationOptions): Promise<CommitResult>;
  redistill(
    input: Omit<RedistillInput, "subjectId">,
    mutation?: MutationOptions,
  ): Promise<PendingJob>;

  versions(): Promise<readonly VersionSummary[]>;
  diff(a: VersionId, b: VersionId): Promise<ProfileDiff>;
  rollback(
    input: { readonly versionId: VersionId; readonly reason: string },
    mutation?: MutationOptions,
  ): Promise<VersionSummary>;
  lineage(
    options?: Omit<LineageInput, "subjectId">,
  ): Promise<readonly LineageEvent[]>;

  install(
    host: HostName,
    options?: InstallOptions,
    mutation?: MutationOptions,
  ): Promise<InstallRef>;
  uninstall(ref: InstallRef, mutation?: MutationOptions): Promise<void>;
  export(
    host: HostName,
    options: ExportOptions,
    mutation?: MutationOptions,
  ): Promise<ExportRef>;

  archive(mutation?: MutationOptions): Promise<void>;
}
~~~

purge 不放 Person 第一屏；它留在 Distilly 管理 API / Panel / CLI 的显式危险入口。关系方法可以在关系 slice 后 additive 加到 Person，不阻塞首发。

### 18.5 Composition root

distilly 包根只依赖 protocol，能在浏览器和非 Node transport 使用。Node 进程内接线走独立 subpath：

~~~ts
import { openInProcess } from "distilly/node";

export interface OpenInProcessOptions {
  readonly root?: string;
  readonly capacity: BriefCapacity;
  readonly callerLabel?: string;
}

export declare function openInProcess(
  options: OpenInProcessOptions,
): Promise<Distilly>;
~~~

distilly/node 依赖 @distilly/runtime；runtime 再组合 engine、内置 parsers 与 bindings。openInProcess 固定创建 kind=sdk 的 client，callerLabel 只是审计 label，不能选择 user / host actor。需要 host、Panel 或 CLI actor 的入口由各自 composition 调用 runtime.connectTrusted；该函数不从 distilly 根或 node convenience API 导出。根 index.ts 不 import / re-export node.ts。Distilly 构造器不偷偷创建引擎或读 HOME；只有名字明确的 openInProcess 做本机 I/O。

### 18.6 API 稳定性

- 所有跨 EngineClient 或执行 I/O 的公开操作返回 Promise；纯 handle 构造 person() 同步。
- wire major 3 内，方法名与字段含义不改；新可选字段 / 新判别分支必须让旧消费者 fail visibly 或安全 default。
- 根包只导出 Distilly、Person、EngineClient、errors 与常用 protocol types。
- adapter、host、queue repository、engine services 从各自包导出，不从 facade 根“方便地”全部 re-export。
- 不把 unimplemented Catalog 方法预先放入 MethodMap。

---
