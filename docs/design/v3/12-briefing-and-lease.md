> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 12. HostDistillBriefing、lease 与上下文上限

### 12.1 Briefing 类型

~~~ts
export interface BriefContract {
  readonly digest: BriefContractDigest;
  readonly sourceGroupingVersion: string;
  readonly promptVersion: string;
  readonly draftSchemaVersion: number;
}

export interface JobLease {
  readonly id: LeaseId;
  readonly jobId: JobId;
  readonly generation: number;
  readonly briefContractDigest: BriefContractDigest;
  readonly owner: string;
  readonly acquiredAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

export interface BriefCapacity {
  readonly maximumInputTokens: number;
  readonly maximumToolResultBytes: number;
  readonly source: "host_handshake" | "binding_fixture" | "sdk_explicit";
}

export type BriefMaterialRef = Branded<`m${string}`, "BriefMaterialRef">;

export interface BriefMaterial {
  readonly ref: BriefMaterialRef;
  readonly materialId: MaterialId;
  readonly contentDigest: ContentDigest;
  readonly kind: MaterialRecord["kind"];
  readonly content: string;
  readonly source: MaterialSource;
  readonly derivation: TextDerivation;
  readonly sourceGroup: SourceGroup;
  readonly sensitivity: MaterialRecord["sensitivity"];
}

export interface BriefEvidenceFact {
  readonly materialId: MaterialId;
  readonly source: MaterialSource;
  readonly derivation: TextDerivation;
  readonly sourceGroup: SourceGroup;
  readonly sensitivity: MaterialRecord["sensitivity"];
  readonly flags: MaterialRecord["flags"];
}

export interface HostDistillContract extends BriefContract {
  readonly instructions: string;
  readonly evidenceRules: readonly string[];
}

export interface HostDistillBriefing {
  readonly job: PendingJob;
  readonly lease: JobLease;
  readonly subject: SubjectSummary;
  readonly baseline?: {
    readonly versionId: VersionId;
    readonly claims: readonly Claim[];
    readonly quality: QualitySummary;
    readonly evidenceFacts: readonly BriefEvidenceFact[];
  };
  readonly materials: readonly BriefMaterial[];
  readonly contract: HostDistillContract;
  readonly limits: {
    readonly estimatedInputTokens: number;
    readonly maximumInputTokens: number;
    readonly maximumOutputBytes: number;
  };
}
~~~

### 12.2 增量而不是每次重读全部历史

普通 job 的 materials 只包含 baseVersion 之后新增的有效材料，baseline 带 current claims。evidenceFacts 按 MaterialId 去重，只覆盖这些 claims 可引用的旧 evidence，不重发旧正文或本地路径；它让宿主能判断新增材料与旧 evidence 是否被当前 generation 合到同一 source group。宿主返回 patch，未触及 claims 自动保留。

首个版本没有 baseline，materials 是主体全部材料。显式 full redistill 才重新发送全量；它必须记录 reason、promptVersion、executor 与 model metadata，并可能因体积拒绝。

这让人物持续增长时 briefing 大小跟“本次新增”相关，而不是跟一生全部材料线性增长。

BriefingService 对该 job 的**当前完整 material set**用 contract.sourceGroupingVersion 重算一次 group map，再同时填充新增 BriefMaterial 与 baseline evidenceFacts；不能沿用历史 Version 中旧的 group key，因为新到的 representation/bridge material 可能把两个旧组确定性合并。历史 QualitySummary 保持创建时快照，briefing group facts 是本 generation 的派生视图。

### 12.3 证据短句柄

materials 按 materialId 稳定排序，依次分配 m001..m999 BriefMaterialRef；wire grammar 固定为 `m` 加恰好三位十进制数字，m000 非法。一次 briefing 需要超过 999 个句柄时在发放 lease 之前返回 briefing_too_large，不分页也不截断。模型 draft 引用短 ref；引擎在 commit 时解析回 MaterialId。

短句柄只在该 job generation 有效，不能跨 job 复制。存入 Claim 的 EvidenceRef 使用 MaterialId，不保存 m001。

briefing 不包含 raw bytes、本地绝对路径或私人 capture 的屏幕帧。固定 instructions 明确：OCR、字幕与转写是派生文本；相同 sourceGroup 的材料不能写成互相佐证；没有可靠 speaker attribution 时，不把采访者、弹幕或其它参与者的话写成主体原话。

### 12.4 Lease

- brief 先从当前可用的 source-grouping、prompt 与 draft validator 形成 canonical BriefContract；digest 对这三个版本字段计算完整 SHA-256，再随 lease 原子 acquire。HostDistillBriefing.contract.digest 必须等于 lease.briefContractDigest。
- 默认期限是内部版本化常量并在返回值明确展示；首实现采用 30 分钟。
- 宿主预计超时可用 pending(action=renew) 续租；renew 延长时间但返回同一个 briefContractDigest，不能借续租升级规则。
- 每个 generation 同时只有一个有效 lease。
- release 不完成 job，只把它交还 pending。
- MCP 进程异常退出后，过期 lease 由下一次启动 recoverExpired。
- commit 成功或 hard reject 的处置由 CommitService 决定：可修正字段错误保留 lease，stale / expired 释放。

QueueRepository 在 lease record 中保存完整 BriefContract，不只保存 digest。commit 回显 digest 后，CommitService 从受信 lease record 选择被固定的 grouping 与 draft validator，并把 promptVersion 记入版本；不能从进程当前默认值重新读取。binary 升级后若仍支持该 snapshot，旧 lease 可正常完成；若所需算法或 schema 已不可用，返回 schema_unsupported、释放 lease 并要求重新 brief，绝不静默按新规则算 quality。

### 12.5 不静默裁剪

BriefingService 使用 ClientSessionContext 中经过握手的 BriefCapacity，先估算序列化后的字节与 token 上限，再返回内容。MCP initialize / binding fixture 建立 capacity；模型不能在 pending 输入里自报一个更大上限。宿主能力 unknown 时只可使用该宿主经过端到端截断测试的保守 fixture；没有 fixture 就 host_unsupported。普通 SDK 必须在打开 client 时显式给 capacity。任何一项超过宿主或内部上限，返回 briefing_too_large：

- 报出新增材料数、字符数和估算 token；
- 建议缩小研究批次、先处理文件或使用支持更大上下文的宿主；
- 不返回 complete=false 的半份材料；
- 不允许 commit 声称对应完整 materialSetHash。

以后加入分页或 map-reduce，必须新增判别 action / schemaVersion，且有“所有 page 已消费”的可验证 proof；不能改变现有 brief 的全量语义。

### 12.6 Prompt 资产

canonical distill instructions 放在 packages/engine/prompts/host-distill-v1.md，不放冻结的根 prompts/，也不硬编码进 TypeScript 字符串。

PromptCatalog 读取打包资产、计算内容 hash，并将 promptVersion 与 instructions 放进 briefing。每次变更有无 key snapshot、Agent Note（若语义改变）与旧 fixture；host-distill 历史 Version 在 creation contract 中记录使用的 promptVersion。

---
