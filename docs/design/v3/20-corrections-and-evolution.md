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
  promote(input: ReviewActionInput, actor: ActorContext): Promise<VersionSummary>;
  reject(input: ReviewActionInput, actor: ActorContext): Promise<VersionSummary>;
  rollback(input: RollbackInput, actor: ActorContext): Promise<VersionSummary>;
}
~~~

promote/reject 要检查 candidate 仍是当前 suspended target；并发 review 只有一个成功，另一个 review_conflict。理由进入事件，但 reject reason 不改 candidate 内容。

rollback 在存在 active suspended target 时返回 review_conflict，要求用户先 promote、reject 或 correct；它不能偷偷改变 current 后留下永远无法 promote 的 candidate。没有 suspended 时，rollback 不删除后续历史，而是创建一个新 version，内容等同目标历史版本、parent 指向当前、actor=可信 session actor、event=rolled_back；event.versionId 是新版本，relatedVersionId 是内容来源的历史版本。

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
