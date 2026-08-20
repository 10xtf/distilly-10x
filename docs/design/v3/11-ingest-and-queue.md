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
  sourceGroupingVersion: "source-groups-v1",
): SourceGroupingSnapshot;
~~~

normalizeMaterial 只接公开 MaterialInput，因此只能产生 native_text / host_extract；bindParsedMaterial 是 engine package-private 的窄入口，在 RawStore 成功后把 parser extraction 与 RawId 绑定成 raw_extract。normalizeCorrectionMaterial 则由 CorrectionService 用可信 actor 构造固定 private/native-text 来源，并把 direct_user 或 relayed(actorKind/actorId) 纳入 ProvenanceDigest；模型不能直接造 correction provenance。三者随后进入同一 hash / MaterialRecord 路径，parser 和模型都不能直接提交 raw_extract。

correction 的 source identity 使用固定 correction namespace + RequestId；同一 mutation 重试稳定命中，新的 correction request 不因文字相同而覆盖旧事实。actor 语义由 ProvenanceDigest 区分，不能让 host-relayed correction 与 direct-user correction 碰成同一 MaterialId。

`material-text-v1` 唯一定义 normalizeMaterial 的正文 bytes：先将 CRLF 与单独 CR 改为 LF，再做 Unicode NFC，然后只移除每行末尾的 U+0020 / U+0009；保留行数和原本是否有最终 LF。结果按 Unicode White_Space 定义没有任何非 whitespace code point 时 invalid_input。它不改写词句、不总结网页、不删除“看起来像模板”的内容。source.uri 与 artifact.canonicalUri 使用 §9.3 的 http(s) canonicalization；authors / participants / flags 缺省为 `[]`，sensitivity 缺省为 `private`，字符串数组经 NFC 与精确去重后按 canonical UTF-8 bytes 排序，flags 按固定 enum bytes 去重排序。这些规则都带版本前缀，升级时改变 hash namespace。

deriveSourceIdentity 拒绝任何 preimage 组件中的 U+0000，且只能取第一个可用 namespace：`source-uri-v1\0<canonical source.uri>` → `artifact-external-v1\0<normalized provider>\0<NFC externalId>` → `artifact-uri-v1\0<canonical artifact.canonicalUri>` → `client-ref-v1\0<requestId>\0<kind>\0<NFC clientRef>`。这个优先级只定义 MaterialId 的 request-stable 身份；source grouping 仍独立使用 artifact / representation proof。

deriveSourceIdentity 只服务 MaterialId 幂等，不能拿来计算来源多样性。deriveSourceGroups 必须显式接收 lease 或历史 version 固定的 sourceGroupingVersion，对本次 material set 做 O(n) proof-key map / union，再返回带同一版本的 snapshot；禁止读取进程全局“最新规则”。首版唯一合法值是 source-groups-v1；新增算法要先扩判别版本与历史实现，不能让同名版本改变。算法版本与 QualitySummary 一同写进 version。历史 version 不因以后升级 grouping 规则而静默重算。

### 11.3 enqueue 语义

| 值 | 行为 |
|---|---|
| auto | 未提交到 current version 的材料数 `>= 3`，或其最早 MaterialRecord.storedAt 距本次 ingest 的 clock `>= 30 分钟`时建 job；这是 `auto-v1` 版本化常量，不是用户调参 |
| now | 只要当前 material set 与 current version manifest 不同，或 state.pending 已存在，就立即创建/复用 job 并返回；当前集合已等于 current 且没有 pending 才不建 job |

baseline 不存 state 或 queue：state.currentVersionId 存在时，engine 通过最小 read-only FileVersionManifestStore 读取并验证对应 VersionRecord + VersionMaterialManifest，用 current state.materialManifest 减该 version manifest 计算累计 uncommitted set、addedMaterialCount 与 oldest storedAt；没有 current version 时 baseline 为空，所有当前材料都是 uncommitted。manifest 或对应 facts 校验失败是 storage_corrupt，不回退扫描猜测。

auto-v1 只在每次 ingest attempt 的 subject lock 内评估，duplicate-only 也评估，没有 timer 或后台唤醒。已有 state.pending 且仍是当前 generation/materialSetHash 时，auto 与 now 都复用其 JobId；一旦 ingest 产生新 generation，即使旧 pending 存在且 auto 未达阈值，也必须以新 JobId/generation 替换 state.pending，并 post-commit apply 新 verified seed，使旧 lease 失效。同一 generation/set 不会产生第二个自动 job。用户在 Panel / CLI 显式 redistill 是另一种有原因、有 executor 记录的操作，不伪装成 ingest。

### 11.4 Job 类型

~~~ts
export type PublicJobState =
  | "pending" | "leased" | "failed";

interface PendingJobBase {
  readonly id: JobId;
  readonly subjectId: SubjectId;
  readonly generation: number;
  readonly baseVersionId?: VersionId;
  readonly materialSetHash: MaterialSetHash;
  readonly addedMaterialCount: number;
  readonly totalMaterialCount: number;
  readonly queuedAt: IsoDateTime;
}

export interface PendingJobFailure {
  readonly code: DistillyErrorCode;
  readonly retryable: boolean;
  readonly remediation?: string;
}

export type PendingJob =
  | (PendingJobBase & {
      readonly state: "pending";
      readonly leaseExpiresAt?: never;
      readonly failure?: never;
    })
  | (PendingJobBase & {
      readonly state: "leased";
      readonly leaseExpiresAt: IsoDateTime;
      readonly failure?: never;
    })
  | (PendingJobBase & {
      readonly state: "failed";
      readonly leaseExpiresAt?: never;
      readonly failure: PendingJobFailure;
    });
~~~

PendingJob 是状态判别联合：leased 必须带 leaseExpiresAt，failed 必须带 failure，另两个分支不能泄漏这些字段。state.json 的 PendingJobMarker 是 authoritative，保存稳定 job identity、generation、hash、base、counts 与 queuedAt；其可选 lease 保存事实 owner、expiry 与完整 contract。public state 在读取时派生：`now < expiresAt` 才是 leased，已过期 marker 显示 pending；queue projection 中的 failure 可显示 failed。attempt、failure 与 projection LSN 不是人物事实，rebuild 可以清零；lease 不能从 SQLite 猜测或丢失。queue projection 写失败只标 dirty，绝不回滚已提交事实。Step 5 只实现 ingest 需要的内部窄 apply/rebuild 投影；PendingFilter、public list 与事实 lease service 属于 Step 6。

`.index/queue.dirty` 是 projection marker，不是人物事实；其 canonical bytes 固定为 `{"projection":"queue","schemaVersion":2}\n`。每次 post-commit SQLite apply 前先 atomic write + fsync 该 marker，SQLite transaction 成功且 DB durable 后才 unlink marker 并 fsync `.index`。queue.db 的 exact schema 是 `PRAGMA user_version=2`。DB 缺失/corrupt、user_version 不等于 2、marker 存在或 marker 内容不是上述 exact bytes，一律先视为 index_unavailable，不得查询、更不能伪装成空。特别是 Step 5 的 user_version=1 只触发从全部 verified SubjectStateRecord schemaVersion=2 自动重建：不 ALTER、不逐行升级、不把旧 lease 列补默认值。rebuild 从 state seeds 写同目录 sibling DB，close + fsync 后 atomic replace queue.db 并 fsync parent，最后按同样的 durable 顺序清 marker；成功后才开放读，失败继续返回 index_unavailable。

### 11.5 QueueRepository

~~~ts
export interface PendingFilter {
  readonly subjectId?: SubjectId;
  readonly state?: PublicJobState;
  readonly limit?: number;
}

export interface VerifiedQueueStateSeed {
  readonly subjectId: SubjectId;
  readonly stateChecksum: FactChecksum;
  readonly pending?: PendingJobMarker;
}

export interface PendingJobRecord {
  readonly job: PendingJob;
  readonly attempt: number;
  readonly leaseOwner?: LeaseOwnerId;
  readonly lastSequence: number;
}

export interface QueueRepository {
  apply(seed: VerifiedQueueStateSeed): Promise<void>;
  read(jobId: JobId, now: IsoDateTime): Promise<PendingJobRecord | undefined>;
  list(
    filter: PendingFilter,
    now: IsoDateTime,
  ): Promise<readonly PendingJobRecord[]>;
  rebuild(
    seeds: () => AsyncIterable<VerifiedQueueStateSeed>,
    now: IsoDateTime,
  ): Promise<void>;
}
~~~

VerifiedQueueStateSeed 只能由 verified state reader 在 checksum、schemaVersion=2、pending/job/lease 交叉约束全部通过后构造。apply 以 subject 为替换单位：没有 pending 时删除该 subject 的旧 public row，有 pending 时投影当前 marker；read/list 的 now 只派生 expired→pending，不写 state。list 的 limit 缺省与最大值都是 200，结果固定按 queuedAt ASC、JobId canonical UTF-8 ASC；subjectId/state 过滤先于 limit。

rebuild 必须先取得 queue projection lock，**然后**才调用 seed supplier 并在该锁内完整迭代 verified states、构造 sibling DB、durable replace、清 dirty marker；禁止在锁外预物化数组或 snapshot。与之并发的 writer 可以先提交 state，但它的 queue apply 会等待同一 projection lock，并在 rebuild 释放后覆盖自己的 subject row，因此最终不能出现 clean-but-stale。rebuild 保留未过期 lease 的 owner/expiry/contract，过期 marker 投影为 pending，并把 attempt=0、failure absent、lastSequence=0。QueueRepository 不接收 acquire/renew/release 的 owner 或 outcome，也不拥有 lease mutation；它仍是 interface，因为 SQLite 与测试 fake 是真实两种实现。

### 11.6 新 generation

同一 subject 在 leased 时继续 ingest：

- 新材料写事实；
- state generation 增一；
- state.pending 以新 job 整体替换并投影到 queue；
- 旧 lease 不再能 commit；
- 旧 projection row 可删除或标为 stale，但不能恢复为事实；
- 新 job 不因旧 worker finish 而被标 done。

这条用 generation 条件更新证明，不靠“通常不会并发”。

---
