> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 11. Ingest、去重、generation 与队列

### 11.1 IngestService 的步骤

1. 解析并规范化全部输入，但还不写事实；create target 预分配本事务成功时必须使用的 candidate SubjectId。在取本请求的 root request lock 前，先 reconcile 当前可见的全部 root prepared journals。
2. 绑定可信 capture context：stable locator 直接派生 ConversationSourceKey；subject_fallback 对 existing 使用现有 SubjectId、对 create 使用预分配 id。随后对每项计算 ContentDigest、ProvenanceDigest、仅用于材料身份的 source identity 与 MaterialId，并校验 derivation。
3. 取本 request lock 后，existing 取得 subject lock；create 按 §9.4 在需要时取 space catalog lock，再取 space identity lock 与 candidate subject lock，并从 facts 重做空间/身份检查；随后重新读取 subject 与 state。
4. 对已存在 MaterialId 校验 ContentDigest + ProvenanceDigest；两者相同为 duplicate 且不改不可变 MaterialRecord，任一不同为 storage_corrupt。
5. 从 previous state.materialManifest 与 accepted records 计算排序后的 target manifest、完整 MaterialSetHash、generation 与 PendingJobMarker，并在写任何新 material 前持久化包含完整 OperationRecord/EventRecord 的 prepared ingest journal。
6. 按 §6.4 写新 material 并用 target state swap 或 create directory rename 提交；state commit 前新目录不属于可读 material set。
7. commit 后从 journal 幂等写 operation/event、更新 queue projection，标 committed，最后发送 material.ingested / job.changed。

create target 把预分配的 subject 创建插在第 3 步之后；锁内重复/歧义或整批失败都不发布该 id，不留下主体。

第 3 步取得 space identity / subject lock 后，必须按 journal.spaceId / subjectId 重查是否出现其它 RequestId 的 prepared journal；create 还要在同一 space identity lock 内对该 space 的其它 prepared create 保守阻断。一旦命中，释放当前 subject / space / catalog / request locks 并返回 retryable busy，由顶层重新从 reconcile 开始；绝不在持有当前 request lock 时反向 acquire 另一个 request lock。这个二次检查防止两个进程都越过 preflight 后，新 writer 绕过已崩溃 writer 刚留下的 prepared 事务。

### 11.2 必须是纯函数的算法

~~~ts
export interface NormalizedMaterial
  extends Omit<MaterialInput, "source" | "derivation"> {
  readonly content: string;
  readonly source: MaterialSource;
  readonly derivation: TextDerivation;
  readonly participants: readonly string[];
  readonly sensitivity: "private" | "shareable";
  readonly flags: readonly "suspicious_source"[];
}

interface NormalizedCorrectionMaterial {
  readonly kind: "correction";
  readonly content: string;
  readonly source: MaterialSource;
  readonly derivation: Extract<TextDerivation, { readonly kind: "native_text" }>;
  readonly participants: readonly string[];
  readonly sensitivity: "private";
  readonly flags: readonly "suspicious_source"[];
  readonly correctionProvenance: CorrectionProvenance;
}

declare function canonicalizeIngestSubjectTarget(
  target: IngestSubjectTarget,
): Uint8Array;
export declare function normalizeMaterial(input: MaterialInput): NormalizedMaterial;
declare function bindParsedMaterial(
  rawId: RawId,
  draft: ParsedMaterialDraft,
): NormalizedMaterial;
declare function normalizeCorrectionMaterial(
  input: CorrectionDraft,
  actor: ActorContext,
  capturedAt: IsoDateTime,
): NormalizedCorrectionMaterial;
export declare function digestContent(content: string): ContentDigest;
export declare function digestProvenance(
  input: NormalizedMaterial | NormalizedCorrectionMaterial,
  engineOwned?: {
    readonly captureAuditRef?: CaptureAuditRef;
    readonly conversationSourceKey?: ConversationSourceKey;
  },
): ProvenanceDigest;
export declare function deriveSourceIdentity(
  input: NormalizedMaterial | NormalizedCorrectionMaterial,
  requestId: RequestId,
): string;
export declare function deriveMaterialId(
  sourceIdentity: string,
  provenance: ProvenanceDigest,
  content: ContentDigest,
): MaterialId;
export declare function hashMaterialSet(
  records: readonly MaterialRecord[],
): MaterialSetHash;
export declare function deriveSourceGroups(
  records: readonly MaterialRecord[],
  sourceGroupingVersion: string,
): SourceGroupingSnapshot;
~~~

normalizeMaterial 只接公开 MaterialInput，因此只能产生 native_text / host_extract；bindParsedMaterial 是 engine package-private 的窄入口，在 RawStore 成功后把 parser extraction 与 RawId 绑定成 raw_extract。normalizeCorrectionMaterial 则由 CorrectionService 用可信 actor 构造固定 private/native-text 来源，并把 direct_user 或 relayed(actorKind/actorId) 纳入 ProvenanceDigest；模型不能直接造 correction provenance。三者随后进入同一 hash / MaterialRecord 路径，parser 和模型都不能直接提交 raw_extract。

correction 的 source identity 使用固定 correction namespace + RequestId；同一 mutation 重试稳定命中，新的 correction request 不因文字相同而覆盖旧事实。actor 语义由 ProvenanceDigest 区分，不能让 host-relayed correction 与 direct-user correction 碰成同一 MaterialId。

`material-text-v1` 唯一定义 normalizeMaterial 的正文 bytes：先将 CRLF 与单独 CR 改为 LF，再做 Unicode NFC，然后只移除每行末尾的 U+0020 / U+0009；保留行数和原本是否有最终 LF。结果按 Unicode White_Space 定义没有任何非 whitespace code point 时 invalid_input。它不改写词句、不总结网页、不删除“看起来像模板”的内容。source.uri 与 artifact.canonicalUri 使用 §9.3 的 http(s) canonicalization；authors / participants / flags 缺省为 `[]`，sensitivity 缺省为 `private`，字符串数组经 NFC 与精确去重后按 canonical UTF-8 bytes 排序，flags 按固定 enum bytes 去重排序。这些规则都带版本前缀，升级时改变 hash namespace。

deriveSourceIdentity 拒绝任何 preimage 组件中的 U+0000，且只能取第一个可用 namespace：`source-uri-v1\0<canonical source.uri>` → `artifact-external-v1\0<normalized provider>\0<NFC externalId>` → `artifact-uri-v1\0<canonical artifact.canonicalUri>` → `client-ref-v1\0<requestId>\0<kind>\0<NFC clientRef>`。这个优先级只定义 MaterialId 的 request-stable 身份；source grouping 仍独立使用 artifact / representation proof。

deriveSourceIdentity 只服务 MaterialId 幂等，不能拿来计算来源多样性。deriveSourceGroups 必须显式接收 lease 或历史 version 固定的 sourceGroupingVersion，对本次 material set 做 O(n) proof-key map / union，再返回带同一版本的 snapshot；禁止读取进程全局“最新规则”。算法版本与 QualitySummary 一同写进 version。历史 version 不因以后升级 grouping 规则而静默重算。

### 11.3 enqueue 语义

| 值 | 行为 |
|---|---|
| auto | 未提交到 current version 的材料数 `>= 3`，或其最早 MaterialRecord.storedAt 距本次 ingest 的 clock `>= 30 分钟`时建 job；这是 `auto-v1` 版本化常量，不是用户调参 |
| now | 只要当前 material set 与 current version manifest 不同，或 state.pending 已存在，就立即创建/复用 job 并返回；当前集合已等于 current 且没有 pending 才不建 job |

baseline 不存 state 或 queue：state.currentVersionId 存在时，engine 通过最小 read-only FileVersionManifestStore 读取并验证对应 VersionRecord + VersionMaterialManifest，用 current state.materialManifest 减该 version manifest 计算累计 uncommitted set、addedMaterialCount 与 oldest storedAt；没有 current version 时 baseline 为空，所有当前材料都是 uncommitted。manifest 或对应 facts 校验失败是 storage_corrupt，不回退扫描猜测。

auto-v1 只在每次 ingest attempt 的 subject lock 内评估，duplicate-only 也评估，没有 timer 或后台唤醒。已有 state.pending 且仍是当前 generation/materialSetHash 时，auto 与 now 都复用其 JobId；一旦 ingest 产生新 generation，即使旧 pending 存在且 auto 未达阈值，也必须以新 JobId/generation 替换 state.pending 并 upsert 新 job，使旧 lease 失效。同一 generation/set 不会产生第二个自动 job。用户在 Panel / CLI 显式 redistill 是另一种有原因、有 executor 记录的操作，不伪装成 ingest。

### 11.4 Job 类型

~~~ts
export type PublicJobState =
  | "pending" | "leased" | "failed";

export interface PendingJob {
  readonly id: JobId;
  readonly subjectId: SubjectId;
  readonly generation: number;
  readonly baseVersionId?: VersionId;
  readonly materialSetHash: MaterialSetHash;
  readonly addedMaterialCount: number;
  readonly totalMaterialCount: number;
  readonly state: PublicJobState;
  readonly queuedAt: IsoDateTime;
  readonly leaseExpiresAt?: IsoDateTime;
  readonly failure?: {
    readonly code: DistillyErrorCode;
    readonly retryable: boolean;
    readonly remediation?: string;
  };
}
~~~

queue.db 内部可以有 processing、attempt、owner 和 LSN；这些不是稳定公开状态。state.json 的 PendingJobMarker 是 authoritative，保存稳定 job identity、generation、hash、base、counts 与 queuedAt；删除 queue.db 后遍历全部 state.pending 重建为 pending，不从目录或旧 SQLite 行猜测。queue projection 写失败只标 dirty，绝不回滚已提交事实。Step 5 只实现 ingest 需要的内部窄 upsert/rebuild 投影；PendingFilter、list/acquire/renew/release 等 public pending / lease service 属于 Step 6。

`.index/queue.dirty` 是 projection marker，不是人物事实；其 canonical bytes 固定为 `{"projection":"queue","schemaVersion":1}\n`。每次 post-commit SQLite apply 前先 atomic write + fsync 该 marker，SQLite transaction 成功且 DB durable 后才 unlink marker 并 fsync `.index`。queue.db 的 `PRAGMA user_version=1`；DB 缺失/corrupt、marker 存在或 marker 内容不是上述 exact bytes 一律视为 dirty，不得对外伪装成空。rebuild 从所有 verified state.pending 写同目录 sibling DB，close + fsync 后 atomic replace queue.db 并 fsync parent，最后按同样的 durable 顺序清 marker。

### 11.5 QueueRepository

~~~ts
export interface PendingFilter {
  readonly subjectId?: SubjectId;
  readonly state?: PublicJobState;
  readonly limit?: number;
}

export interface PendingJobRecord extends PendingJob {
  readonly attempt: number;
  readonly leaseOwner?: string;
  readonly lastSequence: number;
}

export interface JobLeaseRecord extends JobLease {
  readonly attempt: number;
  readonly contract: BriefContract;
}

export type LeaseOutcome =
  | { readonly kind: "released"; readonly reason?: string }
  | { readonly kind: "committed"; readonly versionId: VersionId }
  | { readonly kind: "failed"; readonly failure: PendingJob["failure"] }
  | { readonly kind: "stale" };

export interface QueueRepository {
  upsert(job: PendingJobRecord): Promise<void>;
  list(filter: PendingFilter): Promise<readonly PendingJobRecord[]>;
  acquire(
    jobId: JobId,
    owner: string,
    now: IsoDateTime,
    contract: BriefContract,
  ): Promise<JobLeaseRecord>;
  renew(leaseId: LeaseId, now: IsoDateTime): Promise<JobLeaseRecord>;
  release(leaseId: LeaseId, outcome: LeaseOutcome): Promise<void>;
  recoverExpired(now: IsoDateTime): Promise<number>;
}
~~~

这是 interface，因为 SQLite、测试 fake 和以后远程 worker 会有真实第二实现。生产实现使用 node:sqlite 的条件 UPDATE；acquire 受影响行数为 0 就是 lease_conflict。

### 11.6 新 generation

同一 subject 在 leased 时继续 ingest：

- 新材料写事实；
- state generation 增一；
- queue UPSERT 新 job；
- 旧 lease 不再能 commit；
- 旧 job 可在 lease 释放后归档为 stale；
- 新 job 不因旧 worker finish 而被标 done。

这条用 generation 条件更新证明，不靠“通常不会并发”。

---
