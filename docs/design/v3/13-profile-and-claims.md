> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 13. Claim、Profile、Patch 与确定性渲染

### 13.1 七个内核面

~~~ts
export type CoreFacetName =
  | "identity"
  | "voice"
  | "psyche"
  | "relations"
  | "boundaries"
  | "texture"
  | "timeline";
~~~

| 内核面 | 内容 |
|---|---|
| identity | 名字、别名、复数角色、公开与私下身份 |
| voice | 口头禅、节奏、标点、真实对话例；没有例句就不能声称声音已成形 |
| psyche | 价值排序、矛盾、决策与回避方式 |
| relations | 对亲密、陌生、权威与群体的模式 |
| boundaries | 雷区、拒绝方式、不会做的事 |
| texture | 身体习惯、物件、口味、时间感与具体小事 |
| timeline | 有证据的变化与时间点 |

工作、亲密、技艺、家庭、公众表达等属于开放 domain。domainPack 只决定创建时建议哪些 domain，不制造新的 Person 子类。

### 13.2 Evidence 与 Claim

~~~ts
export interface EvidenceRef {
  readonly materialId: MaterialId;
  readonly quote: string;
  readonly locator?: {
    readonly start: number;
    readonly end: number;
  };
}

export type ClaimStatus =
  | "active" | "contested" | "superseded";

export type EvidenceStrength =
  | "user_asserted"
  | "single_source"
  | "corroborated"
  | "contested"
  | "imported_unverified";

export interface Claim {
  readonly id: ClaimId;
  readonly facet: FacetPath;
  readonly text: string;
  readonly evidence: readonly EvidenceRef[];
  readonly status: ClaimStatus;
  readonly strength: EvidenceStrength;
  readonly observedIn: readonly string[];
  readonly validFrom?: IsoDateTime;
  readonly validTo?: IsoDateTime;
  readonly createdIn: VersionId;
  readonly supersededBy?: ClaimId;
}
~~~

quote 必填且必须是规范化 content 的精确子串；locator 存在时必须正好指向 quote。允许同一 claim 引用旧版本材料与本 generation 新材料，但新增引用必须通过当前 material set membership。

### 13.3 Draft 不带 engine-owned 字段

~~~ts
export interface BriefEvidenceDraft {
  readonly kind: "brief_material";
  readonly materialRef: BriefMaterialRef;
  readonly quote: string;
  readonly locator?: { readonly start: number; readonly end: number };
}

export interface BaselineEvidenceDraft {
  readonly kind: "baseline_evidence";
  readonly claimId: ClaimId;
  readonly evidenceIndex: number;
}

export type EvidenceDraft = BriefEvidenceDraft | BaselineEvidenceDraft;

export interface ClaimDraft {
  readonly facet: FacetPath;
  readonly text: string;
  readonly evidence: readonly EvidenceDraft[];
  readonly observedIn?: readonly string[];
  readonly validFrom?: IsoDateTime;
  readonly validTo?: IsoDateTime;
}

export type ClaimOperation =
  | { readonly op: "add"; readonly claim: ClaimDraft }
  | {
      readonly op: "revise";
      readonly claimId: ClaimId;
      readonly replacement: ClaimDraft;
      readonly reason: string;
    }
  | {
      readonly op: "supersede";
      readonly claimId: ClaimId;
      readonly reason: string;
      readonly evidence: readonly EvidenceDraft[];
    }
  | {
      readonly op: "contest";
      readonly claimId: ClaimId;
      readonly reason: string;
      readonly evidence: readonly EvidenceDraft[];
    };

export interface DistillPatch {
  readonly operations: readonly ClaimOperation[];
  readonly relationOperations?: readonly RelationOperationDraft[];
  readonly reviewRequest?: { readonly note?: string };
  readonly notes?: string;
}
~~~

revise 产生新 ClaimId 并把旧 claim 标 superseded；不会原地改历史。contest 保留旧文本但改变候选版本中的状态与 strength。无 remove 操作，删除语义必须通过 supersede 并留下理由与证据。

brief_material 只能引用本 generation briefing 的新材料。baseline_evidence 只能引用 baseline 中已有 claim 的某条 EvidenceRef；引擎从 base version 重新读取并校验，宿主不能修改旧 quote。这样 revise 可以保留旧佐证并增加新材料，不需要把全部历史正文重新发给模型。reviewRequest 只能增加人工审核，不能绕过任何 hard reject 或降低风险等级。

宿主 patch 先解析成只在 engine 内部存在的 resolved 形状：

~~~ts
interface ResolvedClaimDraft extends Omit<ClaimDraft, "evidence"> {
  readonly evidence: readonly EvidenceRef[];
}

type ResolvedClaimOperation =
  | { readonly op: "add"; readonly claim: ResolvedClaimDraft }
  | {
      readonly op: "revise";
      readonly claimId: ClaimId;
      readonly replacement: ResolvedClaimDraft;
      readonly reason: string;
    }
  | {
      readonly op: "supersede" | "contest";
      readonly claimId: ClaimId;
      readonly reason: string;
      readonly evidence: readonly EvidenceRef[];
    };

interface ResolvedPatch {
  readonly operations: readonly ResolvedClaimOperation[];
  readonly relationOperations?: readonly ResolvedRelationOperation[];
  readonly reviewRequest?: { readonly note?: string };
}
~~~

ResolvedPatch 不从 protocol 根导出，MCP / SDK 也不能构造。CorrectionService 写入 correction material 后，用 MaterialId + 已验证 quote 构造 ResolvedPatch；host patch 则由 EvidenceResolver 从 briefing 构造。两条路径随后进入同一个 apply → quality → transaction core，不伪造 BriefMaterialRef，也不存在 trusted commit 捷径。

### 13.4 Engine-owned 纯函数

~~~ts
export interface MaterialEvidenceFacts {
  readonly materialId: MaterialId;
  readonly sourceGroup: SourceGroup;
  readonly sourceRole?: SourceRole;
  readonly derivation: TextDerivation;
  readonly kind: MaterialRecord["kind"];
  readonly flags: readonly "suspicious_source"[];
}

export interface MaterialEvidenceIndex {
  readonly sourceGroupingVersion: string;
  readonly byMaterial: ReadonlyMap<MaterialId, MaterialEvidenceFacts>;
}

export interface ProfileData {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly claims: readonly Claim[];
  readonly quality: QualitySummary;
}

export interface RenderedProfile {
  readonly core: Readonly<Record<CoreFacetName, string>>;
  readonly domains: Readonly<Record<string, string>>;
  readonly markdown: string;
}

export interface ProfileDiff {
  readonly added: readonly Claim[];
  readonly removed: readonly Claim[];
  readonly changedFacets: readonly FacetPath[];
  readonly beforeQuality: QualitySummary;
  readonly afterQuality: QualitySummary;
}

export declare function validateFacetPath(path: string): FacetPath;
export declare function resolveEvidence(
  draft: EvidenceDraft,
  brief: HostDistillBriefing,
): EvidenceRef;
declare function resolveHostPatch(
  patch: DistillPatch,
  brief: HostDistillBriefing,
): ResolvedPatch;
declare function deriveClaimId(
  subjectId: SubjectId,
  draft: ResolvedClaimDraft,
): ClaimId;
declare function applyClaimPatch(
  base: readonly Claim[],
  patch: ResolvedPatch,
): readonly Claim[];
declare function buildMaterialEvidenceIndex(
  records: readonly MaterialRecord[],
  grouping: SourceGroupingSnapshot,
): MaterialEvidenceIndex;
export declare function deriveEvidenceStrength(
  claim: Claim,
  materials: MaterialEvidenceIndex,
): EvidenceStrength;
export declare function summarizeQuality(
  claims: readonly Claim[],
  materials: MaterialEvidenceIndex,
): QualitySummary;
export declare function renderFacet(
  facet: FacetPath,
  claims: readonly Claim[],
): string;
export declare function renderProfile(profile: ProfileData): RenderedProfile;
export declare function renderPrompt(profile: Profile): string;
export declare function diffProfiles(before: Profile, after: Profile): ProfileDiff;
~~~

这些函数不读文件、不调用模型、不持有 clock。MaterialEvidenceIndex 必须从同一个 SourceGroupingSnapshot 构建，summarizeQuality 把 index.sourceGroupingVersion 原样写入结果；缺少版本或 group snapshot / index 版本不等时 hard reject，不能使用进程当前默认值。相同输入必须字节稳定；排序键、换行与标题固定。DraftValidator、MaterialHasher、ProfileRenderer 不做无状态 class。

### 13.5 Profile 与单真相

~~~ts
export interface Profile {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly claims: readonly Claim[];
  readonly core: Readonly<Record<CoreFacetName, string>>;
  readonly domains: Readonly<Record<string, string>>;
  readonly rendered: string;
  readonly quality: QualitySummary;
}
~~~

Markdown 中每个事实性 bullet 都由一个或多个 claim 生成。Renderer 可以加固定标题、连接句和“未评估”标识，不能新造人物判断。voice 的例句直接来自 active claims / quote，并明确区分“观察到的原话”和“行为指引”。

首版 prompt 注入整份 rendered，不按 strength 或所谓 salience 丢内容。contested claims 放在明确的“仍有冲突”区，不伪装成确定事实。

---
