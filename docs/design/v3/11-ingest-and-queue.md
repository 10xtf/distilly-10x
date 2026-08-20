> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 11. Ingest、去重、generation 与队列

### 11.1 IngestService 的步骤

1. 解析并规范化全部输入，但还不写事实；create target 预分配本事务成功时必须使用的 candidate SubjectId。
2. 绑定可信 capture context：stable locator 直接派生 ConversationSourceKey；subject_fallback 对 existing 使用现有 SubjectId、对 create 使用预分配 id。随后对每项计算 ContentDigest、ProvenanceDigest、仅用于材料身份的 source identity 与 MaterialId，并校验 derivation。
3. existing 取得 subject lock；create 按 §9.4 取得 space identity lock 再取得 candidate subject lock，并从 facts 重做身份检查；随后重新读取 subject 与 state。
4. 对已存在 MaterialId 校验 ContentDigest + ProvenanceDigest；两者相同为 duplicate 且不改不可变 MaterialRecord，任一不同为 storage_corrupt。
5. 从 previous state.materialManifest 与 accepted records 计算排序后的 target manifest、完整 MaterialSetHash、generation 与 PendingJobMarker，并在写任何新 material 前持久化包含完整 OperationRecord/EventRecord 的 prepared ingest journal。
6. 按 §6.4 写新 material 并用 target state swap 或 create directory rename 提交；state commit 前新目录不属于可读 material set。
7. commit 后从 journal 幂等写 operation/event、更新 queue projection，标 committed，最后发送 material.ingested / job.changed。

create target 把预分配的 subject 创建插在第 3 步之后；锁内重复/歧义或整批失败都丢弃该 id，不留下主体。

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

规范化只统一换行、Unicode normalization 与明确允许的结尾空白；不改写词句、不总结网页、不删除“看起来像模板”的内容。算法带版本前缀，升级时改变 hash namespace。

deriveSourceIdentity 只服务 MaterialId 幂等，不能拿来计算来源多样性。deriveSourceGroups 必须显式接收 lease 或历史 version 固定的 sourceGroupingVersion，对本次 material set 做 O(n) proof-key map / union，再返回带同一版本的 snapshot；禁止读取进程全局“最新规则”。算法版本与 QualitySummary 一同写进 version。历史 version 不因以后升级 grouping 规则而静默重算。

### 11.3 enqueue 语义

| 值 | 行为 |
|---|---|
| auto | 达到内部材料数 / 时间边界时建 job；边界是版本化常量，不是用户调参 |
| now | 只要集合相对最后 committed generation 有变化，就立即 upsert job 并返回；duplicate-only 批次也能领取先前 auto 留下的未蒸馏集合 |

同一集合不会产生第二个自动 job。用户在 Panel / CLI 显式 redistill 是另一种有原因、有 executor 记录的操作，不伪装成 ingest。

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

queue.db 内部可以有 processing、attempt、owner 和 LSN；这些不是稳定公开状态。state.json 的 PendingJobMarker 保存稳定 job identity、generation、hash、base、counts 与 queuedAt；删除 queue.db 后由它重建为 pending，不从目录或旧 SQLite 行猜测。

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
