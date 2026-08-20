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
│       │   └── <version-id>/
│       │       ├── version.json           # parent、generation、actor、quality、createdDisposition
│       │       ├── materials.json         # 当时排序的 MaterialId+ContentDigest+ProvenanceDigest manifest
│       │       ├── claims.jsonl           # 该版本全部 claim 快照
│       │       ├── profile/
│       │       │   ├── identity.md
│       │       │   ├── voice.md
│       │       │   ├── psyche.md
│       │       │   ├── relations.md
│       │       │   ├── boundaries.md
│       │       │   ├── texture.md
│       │       │   ├── timeline.md
│       │       │   └── domains/
│       │       └── prompt.md               # 同一 renderer 的完整注入投影
│       ├── profile/                         # current version 的可重建便捷投影
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
    └── library.json
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

schema 强制六种随机 id 与 RequestId 的后缀恰好 32 位小写十六进制，四种内容派生 id 与上述九种摘要型 id 的后缀恰好 64 位。除 §9.2 的保留 people space 外，SubjectId、SpaceId、JobId、LeaseId、EventId 与 CaptureAuditRef 由受信 crypto id generator 使用 128-bit randomness 生成，generator 不得产生该保留 SpaceId；RawId 对已落盘原始 bytes 计算完整 SHA-256，VersionId、ClaimId 与 RelationId 分别对其已定义的 canonical semantic preimage 计算完整 SHA-256。CaptureAuditRef 不从聊天正文或 scope label 派生。CaptureScopeDigest 与 ConversationSourceKey 由 engine 使用**安装级而非进程级** audit HMAC key 对 canonical scope、或 Controller 提供的稳定 opaque application/account/one-to-one-thread locator 计算；locator 不可用时，ConversationSourceKey 在 subject 创建/解析后按 SubjectId 保守合一。key 优先放 OS keychain 并在 instance.json 留 reference，不可用时原子创建 0600 的 secrets/audit-hmac.key。多进程用 create-exclusive + fsync + reopen 取得同一 key，永不把 key 写进日志、bundle 或诊断导出。这样重启和 MCP/Panel/CLI 仍能归并同一会话，又不落明文或可离线枚举的裸 thread hash。

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

export interface PendingJobMarker {
  readonly jobId: JobId;
  readonly generation: number;
  readonly baseVersionId?: VersionId;
  readonly materialSetHash: MaterialSetHash;
  readonly addedMaterialCount: number;
  readonly totalMaterialCount: number;
  readonly queuedAt: IsoDateTime;
}

export interface SubjectStateRecord extends FactEnvelope<1> {
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

export type TransactionRecord = IngestTransactionRecord;
~~~

SpaceRecord.id、SubjectRecord.id、SubjectStateRecord.subjectId、MaterialRecord.id、VersionRecord.id、EventRecord.eventId、OperationFact.requestId 必须分别匹配其路径段；TransactionRecord.requestId 必须匹配 root `transactions/<request-id>.json`，SubjectRecord.spaceId 必须指向存在的 SpaceRecord。EventRecord.event.at 是该事件的 canonical time，所有 subject-scoped kind 必须带同一 subjectId，所有 version kind 必须带 versionId；watch 只在对应 EventRecord 已落盘后发布 `event` 字段。恢复生成的非请求事件使用 actor=system 且可省略 requestId，其余 mutation event 必须带 operation 的 requestId/actor。

`materialManifest` 是当前 generation 的事实 membership，不是从 materials 目录猜出的缓存；它和 VersionMaterialManifest 使用完全相同的 entry 结构，按 MaterialId canonical bytes 严格升序且不得重复。空主体固定 generation=0、manifest 为空且没有 materialSetHash；每次改变 committed material set 的 ingest 只把 generation 增一。非空 manifest 按 hashMaterialSet 重算必须等于 materialSetHash。`pending` 保存从事实重建 job 所需的稳定字段；leased/failed、attempt、owner、expiry 与 LSN 仍只在 queue projection，重建后回到 pending。

OperationRecord 只记录已经跨过事实 commit point 的成功 mutation。`inputChecksum` 对 method、canonical params 与 session-bound ActorContext 的 canonical bytes 计算；RequestId 不进入 preimage。每个 mutation 在任何 method / space 锁之前取 root `operations/.locks/<request-id>.lock`，因此 RequestId 在整个 engine 中全局唯一。当前 20 个 MutationMethodName 中只有 `library.rebuild` 使用 `{ kind: "global" }`，其余都由 engine 解析出唯一 subjectId 并使用 subject scope；未来真正的多主体 mutation 必须升 operation schemaVersion，不得挤进 global 或挑一个 subject 代表。同一 requestId、同一 checksum 返回 completed record 的 result，不再次写事实；同一 requestId 配不同 input 或 actor 返回 idempotency_conflict。IngestTransactionRecord.operation 固定为 materials.ingest，其 requestId 必须等于 journal.requestId，scope 必须为 `{ kind: "subject", subjectId: journal.subjectId }`；journal.spaceId 必须等于该 SubjectRecord 的 spaceId。events 按 subject.created、material.ingested、job.changed 的适用子集与该顺序保存完整 EventRecord。事务在 operation/event 文件之前崩溃时，recovery 从 journal 原样补写，因此重试不能从原来的 ingested 变成 unchanged，也不能生成第二组 event ids。

### 6.4 写入事务

文件系统与 SQLite 没有共同事务。state 的 target checksum 是事实提交判据：已有主体以 state.json 的 atomic rename 发布；create + first ingest 先在 `subjects/.staging/<request-id>.<subject-id>/` 写完整 SubjectRecord、材料与 target state，而 prepared journal 写在 root `transactions/<request-id>.json`，再以同文件系统目录 atomic rename 发布。后者的物理 commit point 是目录 rename，但逻辑上仍是 target SubjectStateRecord 与 target SubjectRecord 第一次可见；失败前不存在可解析的主体。

每次 ingest 按下面顺序：

1. 参数规范化并算出 inputChecksum 后，在取本 request lock 前先 reconcile root prepared journals；再按 §9.4 的顺序取 root request lock 与所需 space catalog / identity / subject lock，在锁内重新读取并校验 space/subject/state 以及同 space/subject 的其它 prepared journals；create 在固定 staging 目录内工作。命中其它 request 时释放全部当前 locks 并 retryable busy，不反向取另一 request lock。
2. 写 root IngestTransactionRecord=prepared，固定 space/subject、create 的 target subject checksum 或 existing 的 previous state checksum、target state checksum、newMaterials、完整 operation/events、input checksum 与成功 result；逐文件 flush。
3. 写每份新 material 临时目录并原子 rename；读路径只接受 state.materialManifest 中的 entry，因此这些目录在 state commit 前不可见。
4. 已有主体用 write-temp + fsync + atomic rename 替换 state.json；create fsync 完整 staging 目录后 atomic rename 到 subjects/<subject-id>。**这是 ingest commit point。**
5. 从 journal 幂等写 `recordKind="completed"` 的 OperationRecord 与 EventRecord，再更新 queue 与已配置的其它投影；只有已配置 projection 的 apply 失败才标该 projection dirty，未安装的 library 等后续 projection 不制造虚假 dirty，任何投影失败都不回滚事实。Step 5 只配置 queue。
6. journal 标 committed，按逆序释放 lock，最后发送与已落盘 EventRecord.event 一致的 EngineEvent。

每次版本提交按下面顺序：

1. 取得 root request lock，再取 subject lock，重新读取 state、job generation、lease 与 base version。
2. 以 TransactionRecord 的对应 discriminant 写 root transactions/<request-id>.json，状态 prepared，列出目标 version、previous/target state FactChecksum、draft hash，以及 commit 后要物化的 OperationRecord/EventRecord。首版联合只落 IngestTransactionRecord，commit 成员在 §29 的对应切片加入，不改路径。
3. 在同一文件系统下写临时 version 目录，包括按 MaterialId 排序的 materials.json manifest；逐文件 flush，复算 manifest 的 materialSetHash / materialCount 后原子 rename 到 versions/<id>。
4. 用 write-temp + fsync + atomic rename 替换 state.json。**这一步是 commit point。**
5. 从 version.json 幂等物化 event 文件与 current profile 投影。
6. 更新 queue / library 等索引；失败只标 projection dirty，不回滚事实。
7. journal 标 committed，释放锁，最后发送 EngineEvent。

VersionId 对不可变 version preimage 的 canonical bytes 计算摘要：subjectId、generation、materialSetHash、parent / derived edge、creation contract、actor、createdDisposition、rendererVersion、canonical claims 与 QualitySummary；id 本身、FactEnvelope、createdAt 不进入 preimage。同一有效事务重试命中已有版本并返回相同结果，不重复生成；相同 patch 在不同 BriefContract 下会得到不同 id。

### 6.5 崩溃恢复

启动可写 composition root 时先 reconcile。对 prepared ingest 必须 **target-first**，不得先用 previous 命中把 duplicate-only 事务判成 abort：

- target state checksum 已可见，且 create 时 target SubjectRecord checksum 也已可见：即使 previousStateChecksum 与 targetStateChecksum 相同，也先校验 SubjectRecord、manifest 与所有新 MaterialRecord/content，补齐 OperationRecord、EventRecord 和 queue 与其它已配置投影，再标 committed；
- target 不可见，但 existing 主体仍是 previous state checksum，或 create 的最终 subjects/<subject-id> 完全不存在：target 未提交，只删除 journal.newMaterials 精确命名的新 material 目录或该 journal 的固定 staging 目录，并标 aborted；不产生 subject/event/operation，不扫描删除其它 orphan；
- 除上述两态之外，state/subject 既不满足 target 也不满足合法 previous/absent，或 target manifest 的 entry/hash/count 与 material facts 不符：storage_corrupt，不能猜测采用哪一边；
- journal = prepared 且 state 已指向目标 version：先校验 version 与 materials manifest，再补齐 event / projection，标 committed；
- journal = prepared 且 state 仍是旧值：目标 version 不对外可见，journal 标 aborted；
- state 指向不存在或 hash 不匹配的 version：storage_corrupt，拒绝继续写；
- material 目录不在 state.materialManifest、任何历史 VersionMaterialManifest 或 active prepared journal 中时是 orphan corruption；recovery 不把它静默收编，也不在没有 journal 证明时删除；
- queue.db 缺失/corrupt、queue.dirty 存在或 marker bytes 异常：都是 dirty，不得当作空队列；从所有已验证 state.pending 重建，active lease 可以回到 pending，但人物事实与 job identity 不变；其它 .index 投影同样从各自事实显式 rebuild，不回退全文扫描；
- stale request / space catalog / space identity / subject lock：只有超过固定内部 TTL 且 owner heartbeat 不再前进时才能回收。

aborted ingest 对同一 requestId + inputChecksum 可在 root request lock 内重新进入 prepared；create 必须复用 journal 原 candidate SubjectId，按当前事实重算 target checksums。该 requestId 不同 input 或 actor 永久 idempotency_conflict。committed journal 及 completed operation 只能 immutable replay，不得重进 prepared。首版不对 completed operation 或 terminal journal 做时间型自动 GC，prepared 也永不依赖墙钟超时删除；所有清理只能由 recovery 或 purge 的可证明路径驱动。

privacy purge 用 TransactionRecord 未来的 purge discriminant 先写一份 prepared purge journal，其中列出所有关联该 subject 的 root subject-scoped operations 与 transaction journals。多个 root files 不被伪称为同时原子：purge 在该 prepared journal 下可恢复地逐个 atomic replace completed operation 为 OperationTombstoneRecord、逐个删除相关 root journal，最后用 purge state/commit point 发布完成；recovery 保证中途崩溃后继续到全部完成。若某 request 只有关联 journal 而还没有 completed operation，purge 仍从 journal.operation 写入 tombstone 后再删该 journal。tombstone 不保留 actor、result 或主体内容；同 RequestId 与相同 inputChecksum 后续返回 not_found，不同 input 或 actor 返回 idempotency_conflict，不得把被 purge 的请求当新请求复用。

恢复过程幂等；测试必须在每个步骤后模拟崩溃。

### 6.6 Schema 与权限

- instance、space、subject、material、version、state、event、operation、transaction、queue 与 bundle 各有独立单调 schemaVersion；所有 JSON 事实实现 FactEnvelope，jsonl 每行是独立 envelope。
- 不认识的 major 格式直接 schema_unsupported；不会边读边猜。
- 新建目录默认仅当前用户可读写；导出到用户指定路径时保留显式提示。
- 事实读取拒绝符号链接越界；插件投影可以是普通文件，但不把用户目录 symlink 当事实。
- purge 是唯一物理删除路径，必须显式确认并记录非内容型 tombstone；archive 不删除事实。

---
