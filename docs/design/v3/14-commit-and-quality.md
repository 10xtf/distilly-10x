> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 14. Commit、证据校验、质量门与版本

### 14.1 CommitService 顺序

1. 校验 wire schema 与 requestId 幂等。
2. 取得 subject lock，重新读取 state。
3. 校验 job、generation、lease、briefContractDigest、materialSetHash 与 baseVersionId；从 lease record 取得 pinned BriefContract。
4. 校验 patch operation 与目标 ClaimId。
5. 解析每个 BriefMaterialRef，验证 MaterialId 属于主体与当前集合。
6. 读取真实 content，验证 quote / locator。
7. applyClaimPatch，派生 ClaimId、strength、quality 与 Markdown。
8. QualityGate 比较 current / candidate，决定 current 或 suspended。
9. 通过 §6 journal 提交不可变 version 与 state。
10. 幂等完成 job、更新投影、发事件并返回。

前七步任何失败都不能写 version。第八步的 suspended 是合法成功，不是 error。

### 14.2 Hard reject

以下情况 hard reject：

- lease 不存在、过期、owner 不符；
- generation、baseVersion、materialSetHash 或回显的 briefContractDigest 与 lease 不匹配；
- operation 指向不存在或不属于 base 的 claim；
- facet 语法非法；
- EvidenceDraft 空、ref 不属于 briefing、MaterialId 跨主体；
- quote 不是真实 content 子串或 locator 不匹配；
- patch 产生重复 active ClaimId、supersede 环或无证据 active claim；
- relation 引用非法；
- 同 requestId 换了输入；
- storage checksum 或 schema 损坏。

回显 digest 不匹配按 stale_job 处理；digest 匹配但当前 binary 已不能执行 lease 固定的 source-grouping 或 draft schema 时按 schema_unsupported 处理。两种情况都不能尝试用当前默认算法提交。

模型可以根据 fieldPath 修正 invalid_input / evidence_invalid 后用新 requestId 重试；stale_job 必须重新 brief。

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

不提供一个看似精确的 0..1 总分。计数、来源和冲突更容易解释，也不会把模型意见伪装成测量。三个 source-group count 只对 candidate 的 active / contested claims **实际引用**的 MaterialId 去重计数；未引用材料、只被 superseded claim 引用的材料和 raw 不提高 maturity。sourceGroupCount 是全部被引用组；diversityEligibleSourceGroupCount 是其中 status=eligible 的子集；unknownSourceGroupCount 是其中 status=unknown 的子集，status=ineligible 的数量可由总数减去两者得到。这三个集合定义互斥且完整。corroboratedClaimCount 只统计 active claim 中 evidence 跨至少两个 status=eligible source groups 的 claim；同一视频的多种文本表示不增加它。

成熟度算法在 protocol schema major 内版本化：

- sparse：identity 或 voice 未覆盖，或覆盖少于三个 core facets；
- forming：identity 与 voice 已覆盖，覆盖至少三个 core facets，但未满足 stable；
- stable：identity 与 voice 已覆盖、至少五个 core facets、有至少两个 diversity-eligible source groups、没有 contested active claims。

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

candidate 在没有任何 ReviewReason 时自动 current。第一版 QualityGate 只使用上述机械信号，不做第二次 LLM judge。

每个 reason 都有可测试触发器：source diversity 只比较 before-after 的 diversityEligibleSourceGroupCount；coverage / identity / voice / contested 从其它结构 diff 得到；suspicious_source 来自被引用 MaterialRecord 的显式 caution flag；manual_review_requested 来自 DistillPatch.reviewRequest；imported_profile 只由 BundleImporter 设置；relayed_correction 只由 CorrectionService 根据可信 session actor 设置。correction_conflict 只对显式 supersedes 与现有 claim/evidence 的结构冲突触发，确定性代码不假装理解一段自由文本的语义冲突。

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
~~~

VersionId 由引擎生成，调用方不可指定。VersionCreation 是互斥来源合同：只有 distill.commit 产生 host_distill 并必须带 lease 固定的 digest / prompt / draft schema；correction、rollback、bundle import 与 renderer-only 记录各自真实来源，不能伪造 sentinel briefing。parentId 始终是创建时的 current / CAS 基线；derivedFromCandidateVersionId 只在 correction 替代 suspended candidate 时存在，说明 claims 的内容派生边，不改变 promote 的 parent 校验。promote 把原 current 变 historical，candidate 变 current；reject 不删除 version。rollback 创建新的 current version / event 指向选定历史内容，不把历史指针静默倒回。

version.json 保存不可变 VersionRecord，只记录创建时的 createdDisposition，不随 promote / reject 改写。VersionSummary.status 是读取 state.json 与 review events 后得到的派生状态；current、suspended、historical、rejected 的转移只写 state/event。这样“不可变版本”与“可审核状态”不是两个互相冲突的真相。

每个 version 同事务写 VersionMaterialManifest 到 materials.json，items 按 MaterialId canonical bytes 严格升序且不得重复；按 hashMaterialSet 规则重算必须等于 VersionRecord.materialSetHash，items.length 必须等于 materialCount，每项摘要还必须与对应不可变 MaterialRecord 一致。它是历史 material membership 的事实 manifest，不复制正文。Panel 的 atVersionId、历史 source grouping、bundle evidence 与恢复都从该 manifest 取集合，不能试图从不可逆 hash 或当前目录猜历史 generation。privacy purge 仍可按 §20.5 删除受影响历史与 manifest，并留下无内容 tombstone。

---
