> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 6. 事实层、家目录、提交原子性与恢复

### 6.1 家目录

~~~text
~/.distilly/
├── distilly.toml
├── instance.json
├── secrets/
│   └── audit-hmac.key                   # 无 OS keychain 时的 0600 安装级 fallback
├── runtime/
│   └── <engine-version>/                 # setup 安装的本机 runtime，不是人物事实
├── spaces/
│   ├── .catalog.lock                       # inline space kind+label 的全局串行化
│   ├── <space-id>.identity.lock            # 该空间的主体唯一性锁
│   └── <space-id>.json
├── operations/
│   ├── .locks/
│   │   └── <request-id>.lock            # 跨 method / space 的 RequestId 锁
│   └── <request-id>.json                    # completed OperationRecord 或 purge tombstone
├── transactions/
│   └── <request-id>.json                    # TransactionRecord 判别联合
├── subjects/
│   ├── .locks/
│   │   └── <subject-id>.lock
│   ├── .staging/
│   │   └── <request-id>.<subject-id>/   # create + first ingest 的同盘临时主体
│   └── <subject-id>/
│       ├── subject.json                  # 身份、别名、域包、空间、生命周期
│       ├── state.json                    # generation、current manifest/hash、pending、current/suspended
│       ├── knowledge/
│       │   ├── materials/
│       │   │   └── <material-id>/
│       │   │       ├── material.json     # provenance、contentDigest、sensitivity、派生链
│       │   │       └── content.txt       # 规范化后文本
│       │   └── raw/
│       │       └── <raw-id>/             # 原文件与 raw.json；未解析不进 briefing
│       ├── corrections/
│       │   └── <material-id>/             # 与材料同结构；带 direct_user / relayed provenance
│       ├── versions/
│       │   ├── .staging/
│       │   │   └── <request-id>.<version-id>/ # commit journal 唯一命名的完整临时版本
│       │   └── <version-id>/
│       │       ├── version.json           # parent、generation、actor、quality、createdDisposition
│       │       ├── materials.json         # 当时排序的 MaterialId+ContentDigest+ProvenanceDigest manifest
│       │       ├── claims.json            # 单一 VersionClaimsSnapshot 事实
│       │       ├── profile/
│       │       │   ├── profile.md          # 七 core + domains 的完整合并投影
│       │       │   ├── identity.md
│       │       │   ├── voice.md
│       │       │   ├── psyche.md
│       │       │   ├── relations.md
│       │       │   ├── boundaries.md
│       │       │   ├── texture.md
│       │       │   ├── timeline.md
│       │       │   └── domains/
│       │       │       └── <safe-root>.md
│       │       └── prompt.md               # 同一 renderer 的完整注入投影
│       ├── profile/                         # current version 的原子可重建镜像
│       │   ├── profile.md
│       │   ├── identity.md
│       │   ├── voice.md
│       │   ├── psyche.md
│       │   ├── relations.md
│       │   ├── boundaries.md
│       │   ├── texture.md
│       │   ├── timeline.md
│       │   ├── domains/
│       │   │   └── <safe-root>.md
│       │   └── prompt.md
│       └── events/
│           └── <event-id>.json              # 不可变、可排序的血缘事件
├── graph/
│   └── relations.jsonl
├── audit/
│   └── private-capture/
│       └── <capture-audit-ref>.jsonl     # 无正文的授权、停止与越界拒绝事件
└── .index/
    ├── queue.db
    ├── queue.dirty                       # queue projection 的 fixed-byte dirty marker
    ├── graph.db
    ├── library.json
    ├── library.dirty                     # Library rebuild/apply 的 fixed-byte dirty marker
    ├── library.intent                    # fact writer 与 recovery 的 durable coordination marker
    └── library.lock/                     # Library query/rebuild/writer 的跨进程锁
~~~

DISTILLY_ROOT 可以覆盖根目录。所有 id 都经过 schema 验证后再拼路径；路径参数不得包含斜杠、点段或平台分隔符。

### 6.2 什么是事实，什么是投影

**事实：** space/subject/state records、material.json + content.txt、raw、corrections、immutable versions、events、completed operation 及其 content-free purge tombstone、private-capture content-free audit 与有效 transaction journal。

**投影：** subject/profile 当前副本、宿主 SKILL / identity 文件、.index、Panel 缓存和搜索结果。删掉投影只能影响性能或可用性，不能丢人物记忆。

版本目录中的 claims 是语义事实；同目录 Markdown 是该 rendererVersion 对 claims 的确定性、可验证表示。若 renderer 升级，不能原地改历史版本：重建 current 投影，或显式创建 renderer-only 版本。

private UI capture 的 screenshot、录屏与 clipboard 只是在宿主中完成转录的传输载体，不是 Distilly RawMaterial，也不能因“以后也许有用”落盘。只有规范化 transcript、其 MaterialRecord.captureAuditRef 与不含内容的 audit 属于本地事实。

### 6.3 Fact envelope、MaterialId 与完整摘要

~~~text
SubjectId wire form    = subject_<32 lowercase hex>
SpaceId wire form      = space_<32 lowercase hex>
JobId wire form        = job_<32 lowercase hex>
LeaseId wire form      = lease_<32 lowercase hex>
LeaseOwnerId wire form = lease_owner_<32 lowercase hex>
EventId wire form      = event_<32 lowercase hex>
CaptureAuditRef wire form = capture_<32 lowercase hex>
RequestId wire form    = req_<32 lowercase hex>
RawId wire form        = raw_<64 lowercase hex>
VersionId wire form    = version_<64 lowercase hex>
ClaimId wire form      = claim_<64 lowercase hex>
RelationId wire form   = relation_<64 lowercase hex>
FactChecksum wire form = fact_sha256_<64 lowercase hex>
ContentDigest wire form = sha256_<64 lowercase hex>
ProvenanceDigest wire form = provenance_sha256_<64 lowercase hex>
MaterialId wire form    = mat_<64 lowercase hex>
MaterialSetHash wire form = set_sha256_<64 lowercase hex>
SourceGroupKey wire form = sg_<64 lowercase hex>
CaptureScopeDigest wire form = capture_scope_<64 lowercase hex>
ConversationSourceKey wire form = conversation_<64 lowercase hex>
BriefContractDigest wire form = brief_contract_<64 lowercase hex>
~~~

schema 强制七种随机 id 与 RequestId 的后缀恰好 32 位小写十六进制，四种内容派生 id 与上述九种摘要型 id 的后缀恰好 64 位。除 §9.2 的保留 people space 外，SubjectId、SpaceId、JobId、LeaseId、LeaseOwnerId、EventId 与 CaptureAuditRef 由受信 crypto id generator 使用 128-bit randomness 生成，generator 不得产生该保留 SpaceId；每个 EngineClient session 都由 engine 生成新的 LeaseOwnerId，caller 和模型不能提交或复用它。RawId 对已落盘原始 bytes 计算完整 SHA-256，VersionId、ClaimId 与 RelationId 分别对其已定义的 canonical semantic preimage 计算完整 SHA-256。CaptureAuditRef 不从聊天正文或 scope label 派生。CaptureScopeDigest 与 ConversationSourceKey 由 engine 使用**安装级而非进程级** audit HMAC key 对 canonical scope、或 Controller 提供的稳定 opaque application/account/one-to-one-thread locator 计算；locator 不可用时，ConversationSourceKey 在 subject 创建/解析后按 SubjectId 保守合一。key 优先放 OS keychain 并在 instance.json 留 reference，不可用时原子创建 0600 的 secrets/audit-hmac.key。多进程用 create-exclusive + fsync + reopen 取得同一 key，永不把 key 写进日志、bundle 或诊断导出。这样重启和 MCP/Panel/CLI 仍能归并同一会话，又不落明文或可离线枚举的裸 thread hash。

audit key 不自动轮换。丢失或 reference 不可读时，已有事实仍可读，但 private capture 返回 storage_corrupt 并要求恢复原 key或先 privacy-purge 全部 private capture lineage 后显式 reset；系统不能静默生成新 key 让同一 thread 变成新来源。测试必须用两个 runtime 与进程重启证明同一 canonical conversation 产生相同 ConversationSourceKey。

ProvenanceDigest 对所有会改变 grouping、eligibility、安全或导出语义的规范化字段计算完整 SHA-256：material kind、source.medium/access/role、artifact/representation proof keys、publishedAt/occurredAt/language/authors、TextDerivation（含 RawId）、participants、sensitivity、flags、CorrectionProvenance，以及 engine-owned capture/conversation stamp。capturedAt 和纯展示 title 不参与；首次接受的 MaterialRecord 保持不可变，后来的同 id duplicate 不原地合并这些展示字段。若以后需要保存多次观察，必须新增 append-only observation fact / event，而不是无 generation 变更地改历史材料。

MaterialId = SHA-256(canonical source identity + NUL + ProvenanceDigest + NUL + ContentDigest)，使用完整摘要并加 mat_ 前缀：

- 同一 canonical source identity、正文与 provenance 重复 ingest 得到同一 MaterialId；仅 capturedAt / title 不同仍是 duplicate，并保留首次接受的不可变记录；
- 同一 URL/正文若 access、artifact、representation、derivation 或 privacy provenance 不同，得到不同 MaterialId，再由 source-group algorithm 保守合组；最终结果不依赖哪一份先到；
- 同一正文来自两个不同 URL 也得到两个 MaterialId；是否同组由 source-group algorithm 另算，不在身份阶段误删；
- 没有 URI 的消息或文件优先使用 artifact 的 provider + externalId；没有 artifact locator 时使用 kind + clientRef，clientRef 只在该请求的来源命名空间内稳定。

MaterialSetHash 对排序后的 MaterialId + ContentDigest 计算完整 SHA-256，并包含算法版本前缀，防止未来规范化规则变化后静默复用。

每个 JSON 事实使用同一个扁平 envelope；`schemaVersion` 属于具体 record kind，不是全局版本，`checksum` 对删除 checksum 字段后的整个 record 做 canonical JSON + UTF-8 + SHA-256。canonical JSON 固定对象 key 排序、数组顺序与无多余空白；因此 schemaVersion、所有 payload 字段和显式数组顺序都受保护。`content.txt` 不再套 JSON envelope，而由 MaterialRecord.contentDigest 验证。文件名中的 id 必须等于 record 内 id；FactChecksum 只验证文件完整性，不参与 MaterialId、VersionId 或业务去重。

~~~ts
export interface FactEnvelope<V extends number = number> {
  readonly schemaVersion: V;
  readonly checksum: FactChecksum;
}

export interface SpaceRecord extends FactEnvelope<1> {
  readonly id: SpaceId;
  readonly displayName: string;
  readonly kind: "people" | "fictional" | "custom";
}

export interface SubjectRecord extends FactEnvelope<1> {
  readonly id: SubjectId;
  readonly spaceId: SpaceId;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly identityHints: readonly IdentityHint[];
  readonly domainPack?: string;
  readonly lifecycle: SubjectLifecycle;
}

export interface VersionMaterialEntry {
  readonly materialId: MaterialId;
  readonly contentDigest: ContentDigest;
  readonly provenanceDigest: ProvenanceDigest;
}

export interface PendingLeaseMarker {
  readonly id: LeaseId;
  readonly owner: LeaseOwnerId;
  readonly acquiredAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly contract: BriefContract;
}

export interface PendingJobMarker {
  readonly jobId: JobId;
  readonly generation: number;
  readonly baseVersionId?: VersionId;
  readonly materialSetHash: MaterialSetHash;
  readonly addedMaterialCount: number;
  readonly totalMaterialCount: number;
  readonly queuedAt: IsoDateTime;
  readonly lease?: PendingLeaseMarker;
}

export interface SubjectStateRecord extends FactEnvelope<2> {
  readonly subjectId: SubjectId;
  readonly generation: number;
  readonly materialSetHash?: MaterialSetHash;
  readonly materialManifest: readonly VersionMaterialEntry[];
  readonly currentVersionId?: VersionId;
  readonly suspendedVersionId?: VersionId;
  readonly pending?: PendingJobMarker;
}

export interface EventRecord extends FactEnvelope<1> {
  readonly eventId: EventId;
  readonly event: EngineEvent;
  readonly actor: ActorContext;
  readonly requestId?: RequestId;
  readonly reason?: string;
  readonly relatedVersionId?: VersionId;
}

export type StoredOperationResult<M extends MutationMethodName> =
  EngineMethodMap[M]["result"];

export type OperationScope =
  | { readonly kind: "global" }
  | { readonly kind: "subject"; readonly subjectId: SubjectId };

export type OperationRecord<
  M extends MutationMethodName = MutationMethodName,
> = {
  [K in M]: FactEnvelope<1> & {
    readonly recordKind: "completed";
    readonly requestId: RequestId;
    readonly method: K;
    readonly scope: OperationScope;
    readonly actor: ActorContext;
    readonly inputChecksum: FactChecksum;
    readonly result: StoredOperationResult<K>;
    readonly completedAt: IsoDateTime;
  };
}[M];

export interface OperationTombstoneRecord extends FactEnvelope<1> {
  readonly recordKind: "tombstone";
  readonly requestId: RequestId;
  readonly method: MutationMethodName;
  readonly scope: OperationScope;
  readonly inputChecksum: FactChecksum;
  readonly removedAt: IsoDateTime;
  readonly reason: "subject_purged";
}

export type OperationFact =
  | OperationRecord
  | OperationTombstoneRecord;

interface IngestTransactionBase extends FactEnvelope<1> {
  readonly transactionKind: "ingest";
  readonly requestId: RequestId;
  readonly spaceId: SpaceId;
  readonly subjectId: SubjectId;
  readonly targetStateChecksum: FactChecksum;
  readonly newMaterials: readonly VersionMaterialEntry[];
  readonly operation: OperationRecord<"materials.ingest">;
  readonly events: readonly EventRecord[];
  readonly preparedAt: IsoDateTime;
}

type IngestTransactionTarget =
  | {
      readonly createdSubject: true;
      readonly previousStateChecksum?: never;
      readonly targetSubjectChecksum: FactChecksum;
    }
  | {
      readonly createdSubject: false;
      readonly previousStateChecksum: FactChecksum;
      readonly targetSubjectChecksum?: never;
    };

type TransactionLifecycle =
  | { readonly state: "prepared" }
  | {
      readonly state: "committed" | "aborted";
      readonly finishedAt: IsoDateTime;
    };

export type IngestTransactionRecord =
  IngestTransactionBase & IngestTransactionTarget & TransactionLifecycle;

export type DistillLeaseTransactionMethod =
  | "brief"
  | "renew"
  | "release";

type DistillLeaseEngineMethod<
  M extends DistillLeaseTransactionMethod,
> = `distill.${M}`;

export type DistillLeaseTransactionRecord = {
  [M in DistillLeaseTransactionMethod]: FactEnvelope<1> & {
    readonly transactionKind: "distill_lease";
    readonly method: M;
    readonly requestId: RequestId;
    readonly subjectId: SubjectId;
    readonly jobId: JobId;
    readonly previousStateChecksum: FactChecksum;
    readonly targetStateChecksum: FactChecksum;
    readonly previousPending: PendingJobMarker;
    readonly targetPending: PendingJobMarker;
    readonly operation: OperationRecord<DistillLeaseEngineMethod<M>>;
    readonly event: EventRecord;
    readonly preparedAt: IsoDateTime;
  };
}[DistillLeaseTransactionMethod] & TransactionLifecycle;

export interface DistillCommitTransactionBase extends FactEnvelope<1> {
  readonly transactionKind: "distill_commit";
  readonly requestId: RequestId;
  readonly subjectId: SubjectId;
  readonly jobId: JobId;
  readonly leaseId: LeaseId;
  readonly leaseOwner: LeaseOwnerId;
  readonly previousStateChecksum: FactChecksum;
  readonly previousPending: PendingJobMarker;
  readonly targetState: SubjectStateRecord;
  readonly acceptedPatch: DistillPatch;
  readonly patchDigest: ContentDigest;
  readonly version: VersionRecord;
  readonly materialManifest: VersionMaterialManifest;
  readonly claims: VersionClaimsSnapshot;
  readonly profile: Profile;
  readonly prompt: string;
  readonly operation: OperationRecord<"distill.commit">;
  readonly events: readonly [EventRecord, EventRecord];
  readonly preparedAt: IsoDateTime;
}

export type DistillCommitTransactionRecord =
  DistillCommitTransactionBase & TransactionLifecycle;

export type ReviewDecisionTransactionMethod = "promote" | "reject";

type ReviewDecisionEngineMethod<
  M extends ReviewDecisionTransactionMethod,
> = `versions.${M}`;

export type ReviewDecisionTransactionRecord = {
  [M in ReviewDecisionTransactionMethod]: FactEnvelope<1> & {
    readonly transactionKind: "review_decision";
    readonly method: M;
    readonly requestId: RequestId;
    readonly subjectId: SubjectId;
    readonly candidateVersionId: VersionId;
    readonly previousStateChecksum: FactChecksum;
    readonly previousCurrentVersionId?: VersionId;
    readonly previousSuspendedVersionId: VersionId;
    readonly previousPending?: PendingJobMarker;
    readonly targetState: SubjectStateRecord;
    readonly operation: OperationRecord<ReviewDecisionEngineMethod<M>>;
    readonly events:
      | readonly [EventRecord]
      | readonly [EventRecord, EventRecord];
    readonly preparedAt: IsoDateTime;
  };
}[ReviewDecisionTransactionMethod] & TransactionLifecycle;

export interface RollbackTransactionBase extends FactEnvelope<1> {
  readonly transactionKind: "rollback";
  readonly requestId: RequestId;
  readonly subjectId: SubjectId;
  readonly targetVersionId: VersionId;
  readonly previousStateChecksum: FactChecksum;
  readonly previousCurrentVersionId: VersionId;
  readonly previousPending?: PendingJobMarker;
  readonly targetState: SubjectStateRecord;
  readonly version: VersionRecord;
  readonly materialManifest: VersionMaterialManifest;
  readonly claims: VersionClaimsSnapshot;
  readonly profile: Profile;
  readonly prompt: string;
  readonly operation: OperationRecord<"versions.rollback">;
  readonly events:
    | readonly [EventRecord]
    | readonly [EventRecord, EventRecord];
  readonly preparedAt: IsoDateTime;
}

export type RollbackTransactionRecord =
  RollbackTransactionBase & TransactionLifecycle;

export type TransactionRecord =
  | IngestTransactionRecord
  | DistillLeaseTransactionRecord
  | DistillCommitTransactionRecord
  | ReviewDecisionTransactionRecord
  | RollbackTransactionRecord;
~~~

SpaceRecord.id、SubjectRecord.id、SubjectStateRecord.subjectId、MaterialRecord.id、VersionRecord.id、EventRecord.eventId、OperationFact.requestId 必须分别匹配其路径段；TransactionRecord.requestId 必须匹配 root `transactions/<request-id>.json`，SubjectRecord.spaceId 必须指向存在的 SpaceRecord。EventRecord.event.at 是该事件的 canonical time，所有 subject-scoped kind 必须带同一 subjectId，所有 version kind 必须带 versionId；watch 只在对应 EventRecord 已落盘后发布 content-light 的 `event` 字段，不把 reason 或 relatedVersionId 扩进 EngineEvent。恢复生成的非请求事件使用 actor=system 且可省略 requestId，其余 mutation event 必须带 operation 的 requestId/actor。

EventRecord 的 reason/relatedVersionId 是 lineage 专用的非正文元数据。直接 promote/reject 可带非空、trim 后的 reason；promote 禁止 relatedVersionId，直接 reject 也禁止 relatedVersionId。correction 替代 candidate 时用 `version.rejected` 记录旧 candidate，并令 relatedVersionId=替代 version、reason 缺失，由 lineage 投影为 candidate_replaced。rollback 的 `version.rolled_back` 必须同时带调用方必填的非空 reason 与作为内容来源的 targetVersionId；event.versionId 是新 rollback version。其它 event kind 禁止这两个字段。EventRecord reader 对不符合该判别规则的组合返回 storage_corrupt；watch 始终只发送现有 EngineEvent，不泄漏 reason。

`materialManifest` 是当前 generation 的事实 membership，不是从 materials 目录猜出的缓存；它和 VersionMaterialManifest 使用完全相同的 entry 结构，按 MaterialId canonical bytes 严格升序且不得重复。空主体固定 generation=0、manifest 为空且没有 materialSetHash；每次改变 committed material set 的 ingest 只把 generation 增一。非空 manifest 按 hashMaterialSet 重算必须等于 materialSetHash。`pending` 保存从事实重建 job 所需的稳定字段，`pending.lease` 是 lease 唯一事实权威；attempt、failure 与 projection LSN 仍只在 queue.db。pending 存在时，其 generation/materialSetHash/totalMaterialCount 必须分别等于 state.generation/materialSetHash/materialManifest.length，baseVersionId 当且仅当 state.currentVersionId 存在并与它相等；addedMaterialCount 必须等于当前 manifest 相对 verified base version manifest 的差集大小。lease transition 不能改变这些字段。

SubjectStateRecord 直接使用 schemaVersion=2，因为 V1 尚未发布，不制造兼容读取或迁移。verified reader 要求 PendingLeaseMarker.expiresAt 严格晚于 acquiredAt，contract.digest 与其三个版本字段匹配 §12.4 的公式。TransactionLifecycle 的 prepared 分支不能有 finishedAt，committed/aborted 必须有不早于 preparedAt 的 finishedAt。

OperationRecord 只记录已经跨过事实 commit point 的成功 mutation。普通 `inputChecksum` 对 method、canonical params 与 session-bound ActorContext 的 canonical bytes 计算；RequestId 不进入 preimage。distill.brief / renew / release / commit 的 trusted preimage 还必须包含 session-bound LeaseOwnerId，brief 再包含 canonical BriefCapacity；因此同一 RequestId 改 owner 或 capacity 一律 idempotency_conflict。每个 mutation 在任何 method / space 锁之前取 root `operations/.locks/<request-id>.lock`，因此 RequestId 在整个 engine 中全局唯一。当前 20 个 MutationMethodName 中只有 `library.rebuild` 使用 `{ kind: "global" }`，其余都由 engine 解析出唯一 subjectId 并使用 subject scope；未来真正的多主体 mutation 必须升 operation schemaVersion，不得挤进 global 或挑一个 subject 代表。同一 requestId、同一 checksum 返回 completed record 的 result，不再次写事实；同一 requestId 配不同 input、actor、lease owner 或 brief capacity 返回 idempotency_conflict。

IngestTransactionRecord.operation 固定为 materials.ingest，其 requestId 必须等于 journal.requestId，scope 必须为 `{ kind: "subject", subjectId: journal.subjectId }`；journal.spaceId 必须等于该 SubjectRecord 的 spaceId。events 按 subject.created、material.ingested、job.changed 的适用子集与该顺序保存完整 EventRecord。DistillLeaseTransactionRecord 的 short method `M`、operation.method=`distill.${M}` 与 result 必须逐 method 相关，operation scope 固定为同一 subject，event 必须是 request/actor/subject 都与 operation 相同的**恰好一条** `job.changed` EventRecord。previousPending/targetPending 必须分别逐字段等于 previous/target SubjectStateRecord.pending，两个 state 除 checksum 与 pending.lease 外的 payload 完全相同；两 marker 的稳定 job 字段也必须逐字段相同，并与 journal.jobId 以及 journal.subjectId 所在 state 一致。只允许三种 lease transition：brief 从无 lease 或已过期 lease变为本 session 的 active lease；renew 保留 id、owner、acquiredAt、generation、digest 与完整 contract，只改变 expiresAt；release 从本 session 的 active lease变为没有 lease。事务在 operation/event 文件之前崩溃时，recovery 从 journal 原样补写，因此重试不能生成第二份 briefing、lease 或 event id。brief 的 OperationRecord 有意保存完整 HostDistillBriefing 以保证同 RequestId 精确重放；它受 4 MiB 内部 briefing 上限约束，并在 subject privacy purge 时由 tombstone 清除。

DistillCommitTransactionRecord 是一次成功 commit 的完整恢复权威。`previousPending` 必须逐字段等于 previous state 的 pending，且 job/id/generation/base/materialSetHash、active lease id/owner/digest 都分别匹配 journal、trusted session 与 CommitInput；`targetState` 除 checksum、version pointers 与删除 pending 外保留 previous state 的 subjectId、generation、materialSetHash 和完整 materialManifest。current disposition 固定 `targetState.currentVersionId=version.id` 且没有 suspended，suspended disposition 固定保留 previous current 并令 `targetState.suspendedVersionId=version.id`；两者都不得有 pending。存在 active suspended 时不能准备该 journal。

`acceptedPatch` 是通过 wire、target、evidence 与时间校验后的 exact DistillPatch，empty operations 也合法；`patchDigest = "sha256_" + SHA-256("distill-patch-v1\0" + canonicalJson(acceptedPatch))`。journal 内 version/materialManifest/claims/profile/prompt 必须逐字节等于要发布的五类事实与投影，profile.displayName 必须等于 version.subjectDisplayName，prompt 必须等于 `renderPrompt(profile)`。operation 的 request/scope/actor/result 必须匹配 journal 与 disposition；events 固定为恰好 `[version.current | version.suspended, job.changed]`，两条的 requestId/actor/subjectId 与 operation 相同，第一条 versionId=version.id，第二条不得带 versionId，eventId 不得重复。成功 CommitResult 的 reasons 与 version.reviewReasons 相同；current 时两者都为空/不存在，suspended 时两者都是同一个非空 canonical tuple。preparedAt、version.createdAt、operation.completedAt 与两条 `event.at` 使用本次 mutation 的同一个 canonical time，terminal finishedAt 不早于它。任何交叉关系不成立都是 storage_corrupt，不能据某一份嵌套 payload 猜测。

ReviewDecisionTransactionRecord 固定一次 promote 或 reject 的完整 previous/target 边界。previousStateChecksum 保护整个 previous state；previousCurrentVersionId、previousSuspendedVersionId 与 previousPending 必须和该 verified previous state 逐字段相等，candidateVersionId 必须等于 previousSuspendedVersionId。targetState 保留 subjectId、generation、materialSetHash 与完整 materialManifest。promote 令 candidate 成为 current 并删除 suspended；reject 保留 current 并删除 suspended。reject 必须逐字段保留 previous pending；promote 若存在 previous pending，则按 §20.2 对新 current 重新派生 pending。events 第一条分别是 `version.promoted` 或 `version.rejected`；第二条当且仅当 pending 发生改变时存在并为 `job.changed`。operation、events、journal 必须共享 requestId、actor、subjectId 与本次 mutation time；promote/reject 的 OperationRecord result 是跨 commit point 当时的 exact VersionSummary，之后 status 再变化也不改 replay bytes。

RollbackTransactionRecord 是 rollback 的完整恢复权威。previousStateChecksum、previousCurrentVersionId 与 previousPending 必须精确匹配 verified previous state；targetVersionId 必须指向同 subject、在该 previous state/事件视图中为 historical 且不是 current、suspended 或 rejected 的完整版本。journal 的新 VersionRecord 逐字段复制 target 的 generation、materialSetHash、materialCount、quality、rendererVersion 与 version-time subjectDisplayName，claims array 与 manifest items 也逐字段复制；parentId=previousCurrentVersionId，derivedFromCandidateVersionId/reviewReasons 缺失，creation=`{ kind: "rollback", targetVersionId }`，actor=operation actor，createdDisposition=current，id 是新算出的 VersionId。新的 VersionClaimsSnapshot/Profile wrapper 使用新 version id；Profile 的 displayName/claims/quality 来自 target并用 pinned renderer重建，prompt=`renderPrompt(profile)`，不能把 target wrapper 内的旧 versionId 原样复制。新 version 的 createdAt、operation.completedAt、events at 与 queuedAt 使用同一次 mutation time。targetState 只把 current 指向新 id、保持无 suspended，并保持 previous 的 generation、materialSetHash 与完整 authoritative materialManifest 不变；pending 按 §20.2 重派生。events 第一条固定 `version.rolled_back`，带必填 reason 与 relatedVersionId=targetVersionId；第二条当且仅当 pending 发生改变时为 `job.changed`。所有嵌套事实、operation 与 event 的交叉关系不成立都是 storage_corrupt。

### 6.4 写入事务

文件系统与 SQLite 没有共同事务。state 的 target checksum 是事实提交判据：已有主体以 state.json 的 atomic rename 发布；create + first ingest 先在 `subjects/.staging/<request-id>.<subject-id>/` 写完整 SubjectRecord、材料与 target state，而 prepared journal 写在 root `transactions/<request-id>.json`，再以同文件系统目录 atomic rename 发布。后者的物理 commit point 是目录 rename，但逻辑上仍是 target SubjectStateRecord 与 target SubjectRecord 第一次可见；失败前不存在可解析的主体。

每次 ingest 按下面顺序：

1. 参数规范化并算出 inputChecksum 后，在取本 request lock 前先 reconcile root prepared journals；再按 §9.4 的顺序取 root request lock 与所需 space catalog / identity / subject lock，在锁内重新读取并校验 space/subject/state 以及同 space/subject 的其它 prepared journals；create 在固定 staging 目录内工作。若同一 subject 有另一个 prepared distill-lease journal，ingest 必须停止并释放当前 locks，让顶层先按全局顺序 reconcile 它，再从头重试，不能越过未决 lease state 或反向取另一 request lock。
2. 写 root IngestTransactionRecord=prepared，固定 space/subject、create 的 target subject checksum 或 existing 的 previous state checksum、target state checksum、newMaterials、完整 operation/events、input checksum 与成功 result；逐文件 flush。
3. 写每份新 material 临时目录并原子 rename；读路径只接受 state.materialManifest 中的 entry，因此这些目录在 state commit 前不可见。
4. 已有主体用 write-temp + fsync + atomic rename 替换 state.json；create fsync 完整 staging 目录后 atomic rename 到 subjects/<subject-id>。**这是 ingest commit point。**
5. 从 journal 幂等写 `recordKind="completed"` 的 OperationRecord 与 EventRecord，再更新 queue 与已配置的其它投影；只有已配置 projection 的 apply 失败才标该 projection dirty，未安装的 library 等后续 projection 不制造虚假 dirty，任何投影失败都不回滚事实。Step 5 只配置 queue。
6. journal 标 committed，按逆序释放 lock，最后发送与已落盘 EventRecord.event 一致的 EngineEvent。

每次版本提交按下面顺序：

1. 参数与 patch canonical bytes 通过 wire limit 后，在取本 request lock 前先 reconcile；再按 request → subject 取锁，先做同 RequestId completed/terminal replay 或 conflict，再读取 verified subject/state/base/materials。存在 active suspended 返回 review_conflict；job/generation/base/set/digest 不符返回 stale_job；matching job 的 lease 缺失或 id/owner 不符分别返回 lease_conflict，恰好或晚于 expiry 返回 lease_expired；pinned algorithm 不可执行返回 schema_unsupported。所有这些 hard reject 都发生在 journal、version、state、operation、event 与 projection 写入前，并保留原 pending/lease。
2. 从 verified state、base VersionRecord/VersionClaimsSnapshot/VersionMaterialManifest 与当前 MaterialRecord/content 按 lease 固定的 source-grouping/draft version 重建 EvidenceContext；验证 patch target、evidence、quote/locator 与时间，生成 exact accepted patch、patchDigest、claims、quality、canonical reasons、VersionId、VersionRecord、manifest、Profile、prompt、成功 OperationRecord、两条 EventRecord 和无 pending 的完整 targetState，然后把完整 DistillCommitTransactionRecord 写成 prepared 并 flush。
3. 在固定 `versions/.staging/<request-id>.<version-id>/` 写 version.json、materials.json、claims.json、profile/profile.md、七个 core 文件、排序后的 `profile/domains/<safe-root>.md` 与 prompt.md；逐文件校验/flush 并 fsync 目录，再 atomic rename 为 `versions/<version-id>/`。只接受 journal 内 exact payload，已存在同 id 目录必须逐字节相同。
4. 用 write-temp + fsync + atomic rename 把 state.json 替换为 journal.targetState。**这是 commit point。** current target 指向新 version 且无 suspended；suspended target 保留旧 current 并指向新 suspended；两者都删除 pending/lease。
5. 从 journal 幂等物化 completed OperationRecord 与固定两条 EventRecord。current 时把同一 version 内 profile 全套文件与 prompt.md 在 sibling staging 中校验后原子重建 `subjects/<subject>/profile/`；suspended 不改变 current 投影。
6. 清除 queue projection，并只更新已经配置的其它投影；失败标对应 projection dirty，不回滚事实，也不为未安装的 library 制造 dirty。
7. journal 标 committed，按逆序释放锁，最后依 tuple 顺序发送已落盘的两个 EngineEvent。硬拒绝不走本流程；成功后 pending/lease 已由事实 commit 一并消耗。

每次 promote / reject 按同一事务边界执行：先按全局 request reconciliation → request lock → subject lock，处理 completed/terminal replay 或 idempotency_conflict，再读取 verified state 与 candidate version。candidate 必须仍精确等于 state.suspendedVersionId，且 candidate.parentId 必须等于锁内 currentVersionId；否则在零写入下返回 review_conflict。服务在锁内生成完整 targetState、成功 OperationRecord 与固定 events，写 ReviewDecisionTransactionRecord=prepared 并 flush，再以 write-temp + fsync + atomic rename 替换 state.json；**这个 atomic replace 是 review decision 唯一 commit point**。跨过后才从 journal 幂等补 operation/events、current profile projection（仅 promote）和 queue/其它已配置投影，标 committed，释放锁后发布已落盘 EngineEvent。reject 不改 current projection，pending 逐字段原样保留；promote 的 pending rebase 使用 §20.2 的新 JobId 规则。

rollback 使用相同 lock、replay 与 prepared-journal 纪律，但在准备前先拒绝 active suspended，再拒绝未过期 active lease，校验 target 是同 subject 的 eligible historical version。它在固定 `versions/.staging/<request-id>.<new-version-id>/` 写 journal 固定的新 version 全套文件，逐文件校验/flush/fsync 后 atomic rename 为 published version，再 atomic replace state.json；**state atomic replace 是 rollback 唯一 commit point**。随后才物化 operation、固定 events、current profile 与 queue/其它已配置投影并标 committed。staging、published-abort 与 `.deleting` 的校验、引用检查、rename、fsync 和可重入清理逐条复用 distill-commit 协议，不允许另造较弱的 rollback cleanup。

VersionId 固定为 `"version_" + SHA-256(canonicalJson(preimage))`，不加额外 namespace；preimage 的 exact key set 是 subjectId、**version-time subjectDisplayName**、generation、materialSetHash、parent / derived edge、creation contract、actor、createdDisposition、rendererVersion、canonical reviewReasons、**删除每个 Claim.createdIn 后**的 canonical claims 与 QualitySummary。id 本身、FactEnvelope、createdAt 不进入 preimage。引擎先对该 preimage 计算 VersionId，再把本次新增或 revise 产生的 claim 的 createdIn 填为该 id；沿用或改变状态的旧 claim 保留最初的 createdIn。Profile.displayName 与 VersionRecord.subjectDisplayName 必须相等，历史 prompt 只从该不可变 Profile 重放，不能从以后可变的 SubjectRecord.displayName 重建。这样 createdIn 仍可追溯而不与 VersionId 循环，名称、审核 disposition 与 prompt 历史也不会脱离 id。相同有效事务重试命中已有版本并返回相同结果，不重复生成；相同 patch 在不同 BriefContract 下会得到不同 id。

### 6.5 崩溃恢复

启动可写 composition root 时先 reconcile。对 prepared ingest 必须 **target-first**，不得先用 previous 命中把 duplicate-only 事务判成 abort：

- target state checksum 已可见，且 create 时 target SubjectRecord checksum 也已可见：即使 previousStateChecksum 与 targetStateChecksum 相同，也先校验 SubjectRecord、manifest 与所有新 MaterialRecord/content，补齐 OperationRecord、EventRecord 和 queue 与其它已配置投影，再标 committed；
- target 不可见，但 existing 主体仍是 previous state checksum，或 create 的最终 subjects/<subject-id> 完全不存在：target 未提交，只删除 journal.newMaterials 精确命名的新 material 目录或该 journal 的固定 staging 目录，并标 aborted；不产生 subject/event/operation，不扫描删除其它 orphan；
- 除上述两态之外，state/subject 既不满足 target 也不满足合法 previous/absent，或 target manifest 的 entry/hash/count 与 material facts 不符：storage_corrupt，不能猜测采用哪一边；
- prepared distill-lease journal 的 target state checksum 已可见：在 subject lock 内校验 previous/target marker 的 method-specific transition、完整 OperationRecord、唯一 job.changed EventRecord 与目标 PendingLeaseMarker，再补 operation/event/queue 并标 committed；
- prepared distill-lease journal 的 target 不可见而 current state checksum 仍精确等于 previous：事实 commit point 未跨过，标 aborted，不写 operation/event/queue；若 state 既非 target 也非 previous，或 marker / operation / event 任一交叉关系失败，返回 storage_corrupt；
- prepared distill-commit journal 的 targetState checksum 已可见：先校验 version 目录逐字节匹配 journal 内 VersionRecord/material manifest/claims/Profile/prompt，target 没有 pending 且 pointer/disposition、operation、固定两事件及所有交叉关系成立，再补 operation/event/current projection/queue 并标 committed；
- prepared distill-commit journal 的 target 不可见而 current state checksum 仍精确等于 previousStateChecksum、pending 逐字段等于 previousPending：事实 commit point 未跨过。只可删除该 journal 固定 `versions/.staging/<request>.<version>/`，以及内容逐字节匹配 journal、未被任何 verified state current/suspended、历史 parent/derived edge、terminal journal 或 operation 引用的已发布 `versions/<version>/`；后者在两次 exact/read-reference 验证后必须先 atomic rename 到固定 journal-owned `versions/.staging/<request>.<version>.deleting/` 并 fsync parent，再只对该 deleting path 做可重入 recursive cleanup，避免崩溃把 published path 留成不可验证的半目录。否则保留现场并报 storage_corrupt。完成可证明清理后标 aborted，不写 operation/event/projection，原 pending/lease 原样保留；
- prepared distill-commit 的 state 既非完整 target 也非完整 previous，目标 version 内容与 journal 不同，或删除候选仍被引用：storage_corrupt，不能猜测 finish/abort，也不能按目录名宽泛清理；
- prepared review-decision journal 的 targetState checksum 已可见：在 subject lock 内校验 target pointer、candidate/current、pending、operation 与一或两条 fixed events 的全部交叉关系，再补 operation/events/current projection/queue 并标 committed；target 不可见而 current state checksum 精确等于 previousStateChecksum，且 current/suspended/pending 逐字段等于 journal 的 previous fields 时标 aborted，不写 operation/event/projection；state 是任何第三态或任一交叉字段不符都返回 storage_corrupt；
- prepared rollback journal 的 targetState checksum 已可见：逐字节校验新 version 全套事实、target copied content、current pointer、operation/events 与 pending rebase 后补齐 projection 并标 committed；target 不可见而 current state checksum 精确等于 previousStateChecksum、current/pending 与 journal 精确相等时，按 distill-commit 相同的固定 staging、published reference checks 与 `.deleting` 协议安全清理并标 aborted；第三态、内容不同或仍有引用一律 storage_corrupt；
- 没有 active commit journal 时，verified state reader 仍必须验证 currentVersionId 与 suspendedVersionId 各自指向一份完整 version；suspended 的 parentId 必须等于 currentVersionId。state 指向不存在、摘要/renderer/prompt 不匹配的 version 一律 storage_corrupt；
- 公开 material/profile/version/review 读在解析边界后先完成 root journal reconciliation，再取得对应 subject lock，并在该锁内读取完整 state/material/version/event snapshot；不能在释放 lock 后再按 manifest 补读正文。物理 `versions/<version-id>/` 只有在同 subject EventRecord 中存在恰好一条匹配 createdDisposition/creation source 与 createdAt 的 `version.current`、`version.suspended` 或 `version.rolled_back` creation event 才进入 committed visible set。每个 version/relatedVersionId、parentId、derivedFromCandidateVersionId、rollback target 与 renderer-only source 都必须指向同一 visible set；inactive suspended 必须恰有一次 promote/reject，active suspended 不得已有 terminal decision，created-current 不得有 review decision，candidate_replaced/rollback event 必须精确匹配版本中的 derived/source edge。无 journal 的完整 orphan version、重复/矛盾 decision 或任一外键缺失都是 storage_corrupt，不得静默过滤或标成 historical；
- material 目录不在 state.materialManifest、任何历史 VersionMaterialManifest 或 active prepared journal 中时是 orphan corruption；recovery 不把它静默收编，也不在没有 journal 证明时删除；
- queue.db 缺失/corrupt、schema 不是 user_version=2、queue.dirty 存在或 marker bytes 异常：都是 index_unavailable，不得当作空队列；从所有已验证 schemaVersion=2 state.pending 重建，未过期 lease 原样保留，过期 lease 按时间派生为 pending；其它 .index 投影同样从各自事实显式 rebuild，不回退全文扫描；
- stale request / space catalog / space identity / subject lock：只有超过固定内部 TTL 且 owner heartbeat 不再前进时才能回收。

aborted ingest 对同一 requestId + inputChecksum 可在 root request lock 内重新进入 prepared；create 必须复用 journal 原 candidate SubjectId，按当前事实重算 target checksums。aborted distill-commit 也只可由同一 request/input/actor/LeaseOwnerId 在 previousStateChecksum、previousPending 与 active lease 仍逐字段相同时重进 prepared，并复用 journal 已接受的 patch/digest、VersionId、operation/event ids 与 canonical reasons；lease 已过期或 state 已变则返回相应 exact error，不重解释 patch。aborted review-decision / rollback 只可由相同 method、canonical params、actor 与 inputChecksum 在 exact previous state 仍成立时重进 prepared，并复用 journal 中所有 ids、time、operation、events 与 rollback version bytes；state 已变则返回 review_conflict 或相应 exact stale/conflict error，不按新 state 改写旧 journal。该 requestId 不同 input、actor 或 owner 永久 idempotency_conflict。committed journal 及 completed operation 只能 immutable replay，不得重进 prepared。首版不对 completed operation 或 terminal journal 做时间型自动 GC，prepared 也永不依赖墙钟超时删除；所有清理只能由 recovery 或 purge 的可证明路径驱动。

privacy purge 用 TransactionRecord 未来的 purge discriminant 先写一份 prepared purge journal，其中列出所有关联该 subject 的 root subject-scoped operations 与 transaction journals。多个 root files 不被伪称为同时原子：purge 在该 prepared journal 下可恢复地逐个 atomic replace completed operation 为 OperationTombstoneRecord、逐个删除相关 root journal，最后用 purge state/commit point 发布完成；recovery 保证中途崩溃后继续到全部完成。若某 request 只有关联 journal 而还没有 completed operation，purge 仍从 journal.operation 写入 tombstone 后再删该 journal；这也清除 brief OperationRecord 中为精确重放保留的完整 briefing。tombstone 不保留 actor、result 或主体内容；同 RequestId 与相同 inputChecksum 后续返回 not_found，不同 input、actor、lease owner 或 brief capacity 返回 idempotency_conflict，不得把被 purge 的请求当新请求复用。

恢复过程幂等；测试必须在每个步骤后模拟崩溃。

### 6.6 Schema 与权限

- instance、space、subject、material、version、state、event、operation、transaction、queue 与 bundle 各有独立单调 schemaVersion；所有 JSON 事实实现 FactEnvelope，jsonl 每行是独立 envelope。
- 不认识的 major 格式直接 schema_unsupported；不会边读边猜。
- 新建目录默认仅当前用户可读写；导出到用户指定路径时保留显式提示。
- 事实读取拒绝符号链接越界；插件投影可以是普通文件，但不把用户目录 symlink 当事实。
- 已跨 commit point、对用户可见的事实只可由显式确认并记录非内容型 tombstone 的 privacy purge 物理删除；archive 不删除事实。Recovery 只可清理尚未跨 commit point、由 prepared journal 精确命名、逐字节匹配且无引用的 staging 或 abort 产物，并须遵守 §6.5 的固定 `.deleting` 路径协议。

---
