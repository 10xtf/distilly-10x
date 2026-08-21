> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 20. Correction、演化、审核与回滚

### 20.1 CorrectionService

~~~ts
export declare class CorrectionService {
  correct(
    input: CorrectInput,
    actor: ActorContext,
    requestId: RequestId,
  ): Promise<CommitResult>;
}
~~~

这是有状态 concrete service，因为它编排 material write、claim patch、quality gate 与 version transaction；解析 facet、派生 material 和生成 patch 的部分仍是纯函数。

步骤：

1. 把原文写成 kind=correction、sensitivity=private 的材料，并按 client actor 派生 direct_user 或 relayed provenance；
2. facet 缺省 corrections.unassigned；
3. 生成 user_asserted add claim，或对 supersedes 做 supersede + replacement；
4. 用同一 renderer / QualityGate / transaction 提交版本；
5. 改变 generation，排一个后续增量 job，让宿主以后可把自然语言 correction 重组进更精确 facets；
6. 不在 correct 内调用模型；actor 不是 user 时总带 ReviewReason=relayed_correction(actorKind)，因此 SDK / MCP / executor 不能让 correction 自动 current。

已有 active suspended 时，CorrectInput.correction.baseCandidateVersionId 必须精确指向它；否则 review_conflict。针对 candidate 的 correction 以 candidate claims 为内容基线，但新版本 parentId 仍取锁内 state.currentVersionId，并设置 derivedFromCandidateVersionId。事务先把旧 target 转为 rejected 并写 candidate_replaced，再原子提交替代版本；该 event 的 versionId 是旧 candidate、relatedVersionId 是替代版本。没有 suspended 时不得随便提供 baseCandidateVersionId。这样替代 candidate 仍满足 promote 的 current-parent CAS，不会把内容派生边伪装成 current lineage。

### 20.2 ReviewService

~~~ts
export declare class ReviewService {
  promote(
    input: ReviewActionInput,
    actor: ActorContext,
    context: MutationContext,
  ): Promise<VersionSummary>;
  reject(
    input: ReviewActionInput,
    actor: ActorContext,
    context: MutationContext,
  ): Promise<VersionSummary>;
  rollback(
    input: RollbackInput,
    actor: ActorContext,
    context: MutationContext,
  ): Promise<VersionSummary>;
}
~~~

三种 mutation 都使用 context.requestId 进入 §6 的全局 idempotency、prepared journal 与 recovery；actor 由 trusted client session 注入，不能来自 Panel params。服务先做同 RequestId replay/conflict，再按 request → subject 取锁并在锁内重读 verified state。promote/reject 要求 candidateVersionId 仍精确等于 current suspended target，candidate.parentId 仍精确等于锁内 currentVersionId；并发 review 恰有一个跨过 state commit point，另一个 review_conflict。promote/reject 的 reason optional，出现时 trim 后必须非空并只进 content-light EventRecord；reject 不修改 candidate immutable facts。reject 删除 suspended pointer、保留 current，并把原 pending marker（包括 JobId、queuedAt 与 lease）逐字段原样带入 target state。

promote 会改变 pending 的 base identity。若 previous state 没有 pending，target 也没有；若有，则对 authoritative state.materialManifest 减去新 current version manifest，按 MaterialId 计算 delta。delta=0 时清除 pending；delta>0 时必须生成**新 JobId**，令 generation/materialSetHash/totalMaterialCount 取 unchanged authoritative state，baseVersionId=新 current id，addedMaterialCount=delta，queuedAt=本次 mutation time，且 lease 缺失；不得沿用旧 JobId、queuedAt 或 lease。JobId 的 identity 包含 base，所以即使新 marker 的其它数值碰巧相同也要换 id。pending 改变时 journal 才附加一条 job.changed EventRecord 并同步 queue；reject 从不发 job.changed。

rollback reason 必填且 trim 后非空。服务先拒绝 active suspended target 为 review_conflict，要求用户先 promote、reject 或 correct；随后若 pending 带 `expiresAt > mutation time` 的 active lease，返回 lease_conflict，零写入。已过期 lease 不阻止 rollback。targetVersionId 必须解析到同一 subject 的完整、eligible historical version，不能是 current、suspended 或由 reject/candidate-replaced event 派生的 rejected；不存在返回 not_found，存在但状态不 eligible 返回 invalid_input。

rollback 不删除或改写后续历史，而是创建一个新的 current version：claims array、VersionMaterialManifest items、quality、rendererVersion 和 version-time subjectDisplayName 精确复制 target；parentId 取锁内 current；derivedFromCandidateVersionId/reviewReasons 缺失；creation=`{ kind: "rollback", targetVersionId }`；actor 取 caller；createdDisposition=current；按 §6 VersionId preimage 生成新的 VersionId。VersionClaimsSnapshot 与 Profile 都使用新 id，Profile/rendered/prompt 从 copied content重建而不沿用 source wrapper 的旧 id。新 VersionRecord.generation/materialSetHash/materialCount 与 target 一致；与此同时 authoritative target SubjectStateRecord 的 generation、materialSetHash 与完整 current-generation materialManifest 逐字段保持不变。新 version 的 event.versionId 是新 id，EventRecord.relatedVersionId 是 source target，reason 是 caller reason。

rollback 对 previous pending 使用与 promote 相同的 delta rebase：以新 rollback version manifest 为 base，从 unchanged authoritative state manifest 计算；delta=0 清除，delta>0 生成新 JobId、mutation-time queuedAt、无 lease并重算 count。即使旧 lease已过期也不沿用。没有 previous pending 时不因版本 manifest 与 current generation 不同而隐式创建 job；排队只能由已有 pending 或显式 redistill/ingest 产生。所有 promote/reject/rollback 的 target state、operation、events 与 rollback version bytes 在 state replace 前写进 typed journal；state.json atomic replace 是 commit point，之后的 status summary replay 返回 journal 保存的 exact result。

### 20.3 显式 redistill

默认同 MaterialSetHash 不重跑。Panel / CLI 可请求：

~~~ts
export interface RedistillInput {
  readonly subjectId: SubjectId;
  readonly mode: "incremental" | "full";
  readonly reason: string;
}
~~~

full 受 briefing 上限；它不是修复 invalid evidence 的捷径。Version 记录 executor、model（宿主愿意报告时）、promptVersion 与原 current，便于 diff 外部模型变化。

### 20.4 编辑与删除

首版 Panel 不直接改版本目录中的 claims.json：

- 改人物事实 → correction；
- 认为 claim 已过时 → correction + supersedes；
- 接受/拒绝候选 → review；
- 回到历史 → rollback；
- 隐藏人物 → archive；
- 彻底删除 → purge。

以后增加结构化 claim editor，也必须生成一个 user-authored patch 和 version，不原地改历史文件。

### 20.5 材料撤回

用户可以因隐私撤回某份材料。撤回写 tombstone 并创建新 generation；包含该材料的 claim 必须变 contested / superseded 或 candidate suspended。历史版本在普通 archive 模式仍可追溯；用户选择 privacy purge 时，包含内容的历史也被物理删除，并生成不含内容的 purge audit。

这条与“血缘永不删”相比，优先满足用户对自己本地私人数据的删除权。

撤销 private UI capture grant 只会立即停止未来截图和转录，不等于删除已经提交的 transcript。删除已入库私人内容必须走 material withdrawal 或 privacy purge；purge 可以保留不含正文、thread 名和账号名的最小 capture audit / tombstone，用来证明系统停止与删除动作发生过。

---
