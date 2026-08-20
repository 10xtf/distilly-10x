> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 14. Commit、证据校验、质量门与版本

### 14.1 CommitService 顺序

1. 校验 wire schema、canonical patch bytes 与 trusted input checksum；先返回 exact completed/terminal replay，checksum 不同返回 idempotency_conflict。
2. 从 active queue row 解析 job 的 subject；若成功 commit 已清除 row，则保留的 distill-commit journal 只作为该 job 的 durable subject locator，以便读取 active suspended 并返回 review_conflict，或在没有 suspended 时返回 stale_job。相同 JobId 若在 retained journals 指向多个 subject 是 storage_corrupt；不能把 SQLite 或目录扫描升级为替代事实。随后按 request → subject 取锁，读取 verified subject/state；active suspended 先返回 review_conflict。
3. 依 §7.6 precedence 校验 job/generation/base/material set、active lease id/session owner/expiry 与 echoed/pinned BriefContract。
4. 从 verified state/base/material facts 按 pinned algorithms 重建 EvidenceContext，不查询 brief OperationRecord。
5. 校验每个 operation target 唯一、date range、patch shape 与 evidence ref，读取真实 content 验证 quote 及 `0 <= start < end <= scalarLength` locator。
6. canonicalize accepted patch/resolved drafts，applyClaimPatch 并派生 ClaimId/strength/quality。
7. QualityGate 产生 canonical ReviewReason tuple；据其为空/非空决定 current/suspended，构造 version-time displayName、literal renderer Profile 与 prompt。
8. 构造完整 DistillCommitTransactionRecord；prepared 之前再次验证其 targetState/version/profile/operation/two-event 交叉关系。
9. 依 §6.4 发布不可变 version 与 target state commit point，幂等物化 operation/events/current projection/queue。
10. journal terminal、释放锁、按 tuple 顺序 publish 两事件并返回 journal 内 exact CommitResult。

前七步任何失败以及第八步的 journal 自校验失败都不能写 journal/version/state/operation/event/projection，pending/lease 原样保留。suspended 是合法成功，不是 error；两种成功都原子删除 pending/lease。

### 14.2 Hard reject

以下情况 hard reject：

- lease 不存在、过期、owner 不符；
- generation、baseVersion、materialSetHash 或回显的 briefContractDigest 与 lease 不匹配；
- 已有 active suspended；
- operation 指向不存在或不属于 base 的 claim，或同一个 base claim 被操作多次；
- facet 语法非法；
- EvidenceDraft 空、ref 不属于 briefing、MaterialId 跨主体；
- quote 不是真实 content 子串，locator 不满足 start<end / scalar bounds 或 slice 不匹配；
- validFrom 晚于 validTo，patch 产生重复 active ClaimId、supersede 环或无证据 active claim；
- accepted patch canonical UTF-8 bytes 大于 65,536，或出现首版 schema 没有的 relationOperations；
- 同 requestId 换了输入；
- storage checksum 或 schema 损坏。

回显 digest 不匹配按 stale_job 处理；digest 匹配但当前 binary 已不能执行 lease 固定的 source-grouping 或 draft schema 时按 schema_unsupported 处理。两种情况都不能尝试用当前默认算法提交。

模型可以根据 fieldPath 修正 invalid_input / evidence_invalid 后用新 requestId 重试；stale_job 必须重新 brief。所有 hard reject 都零写入并保留 pending/lease；不能以“释放锁方便重试”为由改 state。

### 14.3 QualitySummary

~~~ts
export type Maturity = "sparse" | "forming" | "stable";

export interface QualitySummary {
  readonly sourceGroupingVersion: string;
  readonly activeClaimCount: number;
  readonly contestedClaimCount: number;
  readonly userAssertedClaimCount: number;
  readonly corroboratedClaimCount: number;
  readonly sourceGroupCount: number;
  readonly diversityEligibleSourceGroupCount: number;
  readonly unknownSourceGroupCount: number;
  readonly coveredCoreFacets: readonly CoreFacetName[];
  readonly uncoveredCoreFacets: readonly CoreFacetName[];
  readonly maturity: Maturity;
}
~~~

不提供一个看似精确的 0..1 总分。计数、来源和冲突更容易解释，也不会把模型意见伪装成测量。activeClaimCount/status=active、contestedClaimCount/status=contested、userAssertedClaimCount=active 且 strength=user_asserted、corroboratedClaimCount=active 且 evidence 跨至少两个 distinct eligible source groups。三个 source-group count 只对 candidate 的 active / contested claims **实际引用**的 MaterialId 去重计数；未引用材料、只被 superseded claim 引用的材料和 raw 不提高 maturity。sourceGroupCount 是全部被引用组；diversityEligibleSourceGroupCount 是其中 status=eligible 的子集；unknownSourceGroupCount 是其中 status=unknown 的子集，status=ineligible 的数量可由总数减去两者得到。这三个集合定义互斥且完整；同一视频的多种文本表示不增加 eligible count。

strength 也不接受宿主输入：沿用的 active user_asserted/imported_unverified 保留其来源语义，status=contested 固定 strength=contested；其它 active claim 用 candidate grouping 重算，至少两个 eligible groups 才是 corroborated，否则 single_source。superseded 保留其已有 strength 作为历史字段但不进入任何 quality count。coveredCoreFacets 是至少有一个 active claim 的 facet first segment，按七 core 固定顺序；uncoveredCoreFacets 是同一顺序的补集。domain、contested-only 或 superseded-only facet 不算 covered。

成熟度算法在 protocol schema major 内版本化：

- sparse：identity 或 voice 未覆盖，或覆盖少于三个 core facets；
- forming：identity 与 voice 已覆盖，覆盖至少三个 core facets，但未满足 stable；
- stable：identity 与 voice 已覆盖、至少五个 core facets、有至少两个 diversity-eligible source groups、contestedClaimCount=0。

correction 的 user_asserted 单独显示，不把它算成两个独立公开来源。来源 role 只解释 coverage，不参与 maturity；私人联系人不会因为“没有三家媒体”而 hard reject，只会诚实保持 sparse / forming 或来源集中。

### 14.4 ReviewReason 与自动 current

~~~ts
export type ReviewReason =
  | { readonly code: "identity_changed"; readonly claimIds: readonly ClaimId[] }
  | { readonly code: "coverage_decreased"; readonly facets: readonly FacetPath[] }
  | { readonly code: "voice_examples_removed"; readonly claimIds: readonly ClaimId[] }
  | { readonly code: "new_contested_claims"; readonly claimIds: readonly ClaimId[] }
  | { readonly code: "correction_conflict"; readonly claimIds: readonly ClaimId[] }
  | { readonly code: "source_diversity_decreased" }
  | { readonly code: "suspicious_source"; readonly materialIds: readonly MaterialId[] }
  | {
      readonly code: "relayed_correction";
      readonly actorKind: "host" | "sdk" | "executor" | "system";
    }
  | { readonly code: "imported_profile" }
  | { readonly code: "manual_review_requested"; readonly note?: string };
~~~

candidate 在没有任何 ReviewReason 时自动 current。第一版 QualityGate 只使用上述机械信号，不做第二次 LLM judge。reason tuple 按 union 中的 code 顺序固定为 identity_changed、coverage_decreased、voice_examples_removed、new_contested_claims、correction_conflict、source_diversity_decreased、suspicious_source、relayed_correction、imported_profile、manual_review_requested；每个 reason 最多一次，内部 claimIds/facets/materialIds exact 去重后按 UTF-8 bytes 升序。

host commit 有 base 时，identity_changed 是 before 中 first segment=identity 的 active ClaimId 在 after 不再 active；coverage_decreased 是 before.coveredCoreFacets 减 after；voice_examples_removed 是 before 中 first segment=voice 的 active ClaimId 在 after 不再 active；new_contested_claims 是 after contested ClaimId 减 before contested；source_diversity_decreased 当且仅当 after.diversityEligibleSourceGroupCount < before。suspicious_source 是 after active/contested 新引用、而 before active/contested 未引用且 MaterialRecord.flags 含 suspicious_source 的 MaterialId。manual_review_requested 当且仅当 accepted patch 带 reviewRequest，并保留其 canonical note。首个版本没有 base，跳过上述 identity/coverage/voice/contested/source-diversity delta reasons，但仍计算 suspicious_source 与 manual_review_requested；因此首版并非自动 clean。

correction_conflict 只对 CorrectionService 的显式 supersedes 与现有 claim/evidence 结构冲突触发；imported_profile 只由 BundleImporter 设置；relayed_correction 只由 CorrectionService 根据可信 session actor 设置。它们不是 Step 7 host commit 的推断项，确定性代码不假装理解自由文本的语义冲突。current VersionRecord 不得有 reviewReasons；suspended VersionRecord 必须有与 CommitResult.reasons 逐字段相同的非空 tuple。该 tuple 进入 VersionId preimage，也由 terminal journal原样恢复。

出现 reason 时 candidate suspended，旧 current 保持。用户可以 promote 接受风险、reject 保留历史但不使用、correct 后产生新候选。Panel 与 CLI 都调用同一 ReviewService。

每个 subject **最多一个 active suspended target**。存在 suspended 时，新的 brief / ordinary commit / rollback 返回 review_conflict；ingest 仍可继续并排队，但不覆盖待审目标。promote / reject 必须同时校验 candidate 仍是 state.suspended 且 candidate.parentId === state.currentVersionId。针对待审版本的 correction 必须显式传 baseCandidateVersionId：新版本仍以当前版本作为 parent / CAS 基线，以旧 candidate claims 作为内容派生基线，并在 derivedFromCandidateVersionId 记录这条边；同一事务把旧 candidate 转为已定义的 rejected 状态、写 candidate_replaced event，再产生新的 current 或 suspended。省略 target 时若已有 suspended，同样返回 review_conflict。

### 14.5 新证据可以降低质量

V2 的“材料只增加，所以置信只能增加”不成立：新来源可能直接反驳旧结论，或暴露原材料是转载。V3 把冲突表示为 contested claim 与 review reason；它不是蒸馏失败的同义词。

同一 material set 默认不自动重跑，因此外部模型随机性不会持续制造版本。用户显式 redistill 时，结果可不同；系统记录 executor、model、promptVersion、draft hash，并用 diff / gate 管理差异。

### 14.6 Version

~~~ts
export type VersionStatus =
  | "current" | "suspended" | "historical" | "rejected";

export type CreatedDisposition = "current" | "suspended";

export type VersionCreation =
  | {
      readonly kind: "host_distill";
      readonly briefContractDigest: BriefContractDigest;
      readonly promptVersion: string;
      readonly draftSchemaVersion: number;
    }
  | { readonly kind: "correction"; readonly correctionMaterialId: MaterialId }
  | { readonly kind: "rollback"; readonly targetVersionId: VersionId }
  | { readonly kind: "bundle_import"; readonly bundleDigest: ContentDigest }
  | { readonly kind: "renderer_only"; readonly sourceVersionId: VersionId };

export interface VersionRecord extends FactEnvelope<1> {
  readonly id: VersionId;
  readonly subjectId: SubjectId;
  readonly subjectDisplayName: string;
  readonly parentId?: VersionId;
  readonly derivedFromCandidateVersionId?: VersionId;
  readonly generation: number;
  readonly materialSetHash: MaterialSetHash;
  readonly materialCount: number;
  readonly creation: VersionCreation;
  readonly createdDisposition: CreatedDisposition;
  readonly actor: ActorContext;
  readonly quality: QualitySummary;
  readonly rendererVersion: string;
  readonly reviewReasons?: readonly [ReviewReason, ...ReviewReason[]];
  readonly createdAt: IsoDateTime;
}

export interface VersionSummary {
  readonly id: VersionId;
  readonly subjectId: SubjectId;
  readonly parentId?: VersionId;
  readonly derivedFromCandidateVersionId?: VersionId;
  readonly generation: number;
  readonly materialSetHash: MaterialSetHash;
  readonly creation: VersionCreation;
  readonly status: VersionStatus;
  readonly actor: ActorContext;
  readonly quality: QualitySummary;
  readonly createdAt: IsoDateTime;
}

export interface ReviewRef {
  readonly subjectId: SubjectId;
  readonly candidateVersionId: VersionId;
}

export interface ReviewLaunch {
  readonly ref: ReviewRef;
  readonly url: string;
}

export interface VersionMaterialManifest extends FactEnvelope<1> {
  readonly items: readonly VersionMaterialEntry[];
}

export interface VersionClaimsSnapshot extends FactEnvelope<1> {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly claims: readonly Claim[];
}
~~~

VersionId 由引擎生成，调用方不可指定。VersionCreation 是互斥来源合同：只有 distill.commit 产生 host_distill 并必须带 lease 固定的 digest / prompt / draft schema；correction、rollback、bundle import 与 renderer-only 记录各自真实来源，不能伪造 sentinel briefing。parentId 始终是创建时的 current / CAS 基线；derivedFromCandidateVersionId 只在 correction 替代 suspended candidate 时存在，说明 claims 的内容派生边，不改变 promote 的 parent 校验。promote 把原 current 变 historical，candidate 变 current；reject 不删除 version。rollback 创建新的 current version / event 指向选定历史内容，不把历史指针静默倒回。

version.json 保存不可变 VersionRecord，只记录创建时的 createdDisposition，不随 promote / reject 改写。subjectDisplayName 是 version-time SubjectRecord.displayName；它必须等于同 version Profile.displayName 并进入 VersionId，历史 Profile/prompt 不读取以后可变的 SubjectRecord。reviewReasons 当且仅当 createdDisposition=suspended 时存在且非空，current 时必须缺失。VersionSummary.status 是读取 state.json 与 review events 后得到的派生状态；current、suspended、historical、rejected 的转移只写 state/event。这样“不可变版本”与“可审核状态”不是两个互相冲突的真相。

每个 version 同事务写 VersionMaterialManifest 到 materials.json，items 按 MaterialId canonical UTF-8 bytes 严格升序且不得重复；按 hashMaterialSet 规则重算必须等于 VersionRecord.materialSetHash，items.length 必须等于 materialCount，每项摘要还必须与对应不可变 MaterialRecord 一致。它是历史 material membership 的事实 manifest，不复制正文。Panel 的 atVersionId、历史 source grouping、bundle evidence 与恢复都从该 manifest 取集合，不能试图从不可逆 hash 或当前目录猜历史 generation。

同事务还把**一个**完整 VersionClaimsSnapshot 写到 `versions/<version-id>/claims.json`；不是 jsonl，不允许每 claim 一个 envelope，也不允许“文件存在但尾部被截断”仍被当成部分版本。snapshot.subjectId/versionId 必须分别等于 VersionRecord.subjectId/id，claims 按 ClaimId canonical UTF-8 bytes 严格升序且不得重复。verified version reader 必须一起读取并验证 version.json、materials.json、claims.json、profile/profile.md、七个 core、全部排序 domain、prompt.md、manifest 引用的每个 MaterialRecord 与 content.txt：文件存在、FactEnvelope/path/id、material content digest、manifest 摘要、claim evidence membership、精确 quote/Unicode-scalar locator、rendererVersion、subjectDisplayName/Profile.displayName、rendered/prompt bytes 都成立后才返回。上述必需文件任一缺失、claim 引用 manifest 外 material、正文或 quote/locator 不匹配、重复、乱序或 renderer/prompt mismatch 都返回 storage_corrupt，不返回 partial profile；未知 schemaVersion 或 pinned grouping/renderer implementation 不可用按 schema_unsupported。privacy purge 可按 §20.5 删除受影响历史、manifest 与 snapshot，并留下无内容 tombstone。

---
