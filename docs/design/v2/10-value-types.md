> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 10. 值类型

全部住在 `@distilly/protocol`。落盘用同一套字段名，不做第二种命名。

### 10.1 品牌 id 与枚举

```ts
declare const brand: unique symbol;
/** 让不同用途的字符串 id 在编译期不可互换。 */
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type SubjectId      = Branded<string, "SubjectId">;
export type VersionId      = Branded<string, "VersionId">;
export type JobId          = Branded<string, "JobId">;
export type RelationId     = Branded<string, "RelationId">;
export type MentionId      = Branded<string, "MentionId">;
export type SpaceId        = Branded<string, "SpaceId">;
/** 材料内容标识，格式 `src_` + 八位十六进制。 */
export type MaterialDigest = Branded<string, "MaterialDigest">;

export type HostName =
  | "claude-code" | "codex" | "langgraph"
  | "openai-agents" | "hermes" | "telegram";

export type Actor         = "host" | "daemon" | "user";
export type Maturity      = "sparse" | "forming" | "stable";
export type VersionStatus = "current" | "suspended" | "rejected" | "historical";
export type QueueKind     = "ingest" | "distill" | "index";
/** 对外状态机；`processing` 是引擎内部状态，不出现在这里（§12.2）。 */
export type QueueState    = "pending" | "done" | "failed";

export type CoreFacetName =
  | "identity" | "voice" | "psyche"
  | "relations" | "boundaries" | "texture" | "timeline";
```

### 10.2 证据与 claim

```ts
export interface EvidenceRef {
  readonly materialDigest: MaterialDigest;
  readonly quote?: string;
  readonly path?: string;
}

export interface Claim {
  readonly id: string;
  /** 开放点分路径，如 voice.opener / texture.hands。新细节不升 schema。 */
  readonly facet: string;
  readonly text: string;
  /** 空证据是无效 claim（§3.7 推论 3）。 */
  readonly evidence: readonly EvidenceRef[];
  /** 材料支撑度 0..1，不是文笔自评。 */
  readonly confidence: number;
  /** 第一版写入但不据此裁剪。 */
  readonly salience: number;
  readonly domain?: string;
  readonly observedIn: readonly string[];
  readonly validFrom?: string;   // ISO 8601
  readonly validTo?: string;
}
```

`claims.jsonl` 每行就是一条 `Claim`。一条真实 claim 长这样：

```json
{"id":"clm_8f3a","facet":"voice.opener",
 "text":"语音开场几乎总是「喂——你听得到吗」，从不用「在吗」",
 "evidence":[{"materialDigest":"src_a1b2"},{"materialDigest":"src_c3d4"}],
 "confidence":0.86,"salience":0.9,"observedIn":["voice-note","late-night"]}
```

### 10.3 画像

```ts
export interface CoreFacet   { readonly name: CoreFacetName; readonly markdown: string }
export interface DomainFacet { readonly name: string;        readonly markdown: string }

export interface Profile {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly core: readonly CoreFacet[];
  readonly domains: readonly DomainFacet[];
  readonly claims: readonly Claim[];
  readonly confidence: number;
  readonly maturity: Maturity;
  /** 整份中性 Markdown，注入用的就是它。 */
  readonly rendered: string;
}

export interface FacetDiff {
  readonly facet: string;
  readonly added: readonly Claim[];
  readonly removed: readonly Claim[];
  readonly changed: readonly { readonly before: Claim; readonly after: Claim }[];
}

export interface ProfileDiff {
  readonly from: VersionId;
  readonly to: VersionId;
  readonly facets: readonly FacetDiff[];
  readonly confidenceDelta: number;
}
```

### 10.4 材料与摄入

```ts
export interface MaterialIn {
  readonly kind: string;        // message / email / document / web / transcript / correction
  readonly content: string;     // 进蒸馏必须已经是文本
  readonly sourceId?: string;
  readonly occurredAt?: string;
  readonly participants?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Material extends MaterialIn {
  readonly digest: MaterialDigest;
  readonly subjectId: SubjectId;
  readonly storedAt: string;
  /** raw/ 下尚未转成文本的材料为 false，它不参与蒸馏。 */
  readonly distillable: boolean;
}

export interface IngestResult {
  readonly kind: "ingested";
  readonly accepted: readonly MaterialDigest[];
  readonly duplicates: readonly MaterialDigest[];
  readonly unparsed: readonly MaterialDigest[];
  readonly materialSetHash: string;
  /** 过了边界就带上新排的作业。 */
  readonly job?: PendingJob;
}
```

### 10.5 蒸馏与版本

```ts
export interface RelationDraft {
  readonly other: SubjectId | { readonly rawName: string };
  readonly type: string;
  readonly evidence: readonly EvidenceRef[];
  readonly confidence?: number;
  readonly role?: Readonly<Record<string, string>>;
}

export interface DistillDraft {
  /** 必须等于引擎当前算出的集合哈希，否则拒绝提交。 */
  readonly materialSetHash: string;
  readonly claims: readonly Claim[];
  readonly coreMarkdown: Readonly<Partial<Record<CoreFacetName, string>>>;
  readonly domainMarkdown: Readonly<Record<string, string>>;
  /** 不带这个，批量蒸完图是空的（§21.2）。 */
  readonly relations?: readonly RelationDraft[];
  readonly notes?: string;
}

export interface PendingJob {
  readonly id: JobId;
  readonly subjectId: SubjectId;
  readonly kind: QueueKind;
  readonly materialSetHash: string;
  readonly materialCount: number;
  readonly queuedAt: string;
  readonly lsn: number;
}

export interface Version {
  readonly id: VersionId;
  readonly subjectId: SubjectId;
  readonly parentId?: VersionId;
  readonly actor: Actor;
  readonly materialSetHash: string;
  readonly confidence: number;
  readonly status: VersionStatus;
  readonly createdAt: string;
}

export type LineageEventKind =
  | "ingested" | "distilled" | "committed" | "corrected"
  | "promoted" | "rejected" | "rolled_back";

export interface LineageEvent {
  readonly kind: LineageEventKind;
  readonly at: string;
  readonly actor: Actor;
  readonly versionId?: VersionId;
  readonly materials: readonly MaterialDigest[];
  readonly note?: string;
}

export interface SubjectStatus {
  readonly subjectId: SubjectId;
  readonly materialCount: number;
  readonly materialSetHash: string;
  readonly queue: QueueState;
  readonly currentVersion?: VersionId;
  readonly awaitingVersion?: VersionId;
  readonly confidence: number;
  readonly maturity: Maturity;
  /** 七个内核面里有 claim 支撑的那些（§20.2）。 */
  readonly coveredFacets: readonly CoreFacetName[];
}
```

### 10.6 主体与关系

```ts
export interface CreateSubjectInput {
  readonly subjectId: string;
  readonly space: string;
  readonly displayName: string;
  readonly domainPack?: string;        // 默认 "person"
  readonly aliases?: readonly string[];
}

export interface CommitInput {
  readonly jobId: JobId;
  readonly draft: DistillDraft;
  readonly actor?: Actor;              // 默认 "host"
}

export interface SubjectSummary {
  readonly subjectId: SubjectId;
  readonly space: SpaceId;
  readonly displayName: string;
  readonly domainPack: string;
  readonly maturity: Maturity;
  readonly currentVersion?: VersionId;
}

export interface Relation {
  readonly id: RelationId;
  readonly space: SpaceId;
  readonly a: SubjectId;
  readonly b: SubjectId;
  /** 开放点分：work.invested / canon.rival / fanon.* */
  readonly type: string;
  /** 方向性用角色表达，例如 { src: "invested", dst: "founded" }。 */
  readonly role?: Readonly<Record<string, string>>;
  readonly evidence: readonly EvidenceRef[];
  readonly confidence: number;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly extractedFrom?: VersionId;
}

export interface RelationGraph {
  readonly nodes: readonly SubjectSummary[];
  readonly edges: readonly Relation[];
  readonly truncated: boolean;
}

export interface PendingMention {
  readonly id: MentionId;
  readonly rawName: string;
  readonly context: string;
  readonly subjectHint?: SubjectId;
}
```

### 10.7 适配器与宿主

```ts
export interface AdapterCapabilities {
  readonly kinds: readonly string[];
  readonly needsCredentials: boolean;
  readonly canResolveSubject: boolean;
  readonly incremental: boolean;
}

export interface AdapterConfig {
  /** 名字以 token / secret / key 结尾的字段按秘密处理，不落日志。 */
  readonly fields: Readonly<Record<string, string>>;
}

export interface PreflightResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly remediation?: string;
}

export interface SubjectRef {
  readonly adapterId: string;
  readonly externalId: string;
  readonly displayName: string;
  readonly confidence: number;
}

export interface CollectRequest {
  readonly since?: string;
  readonly until?: string;
  readonly kinds?: readonly string[];
  readonly limit?: number;
}

export interface AgentPlan {
  readonly kind: "plan";
  readonly adapterId: string;
  readonly subject: SubjectRef;
  /** 交给宿主模型执行的步骤，纯文本。 */
  readonly steps: readonly string[];
  readonly expectedArtifacts: readonly string[];
}

export interface Injection {
  readonly instructions: string;
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly displayName: string;
}

export interface HostSpawnRequest {
  readonly instructions?: string;
  readonly tools?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InstallRef {
  readonly host: HostName;
  readonly path: string;
  readonly versionId: VersionId;
}
```

---
