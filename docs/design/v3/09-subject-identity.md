> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 9. 主体、空间与身份解析

### 9.1 主体 id 由引擎生成

~~~ts
export interface CreateSubjectInput {
  readonly displayName: string;
  readonly spaceId?: SpaceId;
  readonly space?: {
    readonly displayName: string;
    readonly kind: "people" | "fictional" | "custom";
  };
  readonly aliases?: readonly string[];
  readonly domainPack?: string;
  readonly identityHints?: readonly IdentityHint[];
}
~~~

调用方不提供 subjectId，也不决定文件夹 slug。引擎生成不可变 id；displayName、别名和 slug 可变。目录路径永远使用 id，改名不会使 EvidenceRef、关系或安装记录失效。

### 9.2 空间规则

- 真实人物缺省进入内置 people 空间。
- fictional 必须明确作品或世界空间；不能默认和真实人物混在一起。
- custom 空间由 SDK / Panel 创建，MCP create target 可以在同一次请求创建空间。
- 同名只在同一空间内构成歧义；跨空间查询必须显式允许。
- 关系默认不跨空间，跨空间 link 需要用户明确操作。

### 9.3 解析流程

normalize query → 精确 id / 别名 → provider-scoped identityHint → 同空间名称 → 候选列表。

结果只能是 found / not_found / ambiguous。候选排序可以使用精确命中、别名和身份 hint，但**阈值不能把多个候选压成一个**。模型看到 ambiguous 必须展示至少 displayName、space、identity hints。description 只用于展示与候选排序，永不参与唯一命中、already_exists 或合并；材料 URI 也不会因为“看起来像主页”就自动升级为身份 hint，只有显式创建、用户确认或受信 adapter resolve 才能写入。

identity locator 的 normalization 是版本化纯函数：URL 必须是绝对 http(s)，按 WHATWG 规则小写 scheme/host、移除 default port、fragment 和 dot segments，但不猜测 tracking query；provider id 统一 ASCII lowercase；externalId 做 Unicode NFC 后保持 opaque exact；handle trim + NFC，只有内置 provider table 明确声明 case-insensitive 时才 case-fold，未知 provider 保留大小写。URL/account/external_id 分别按 canonical 值判等，不跨 kind 猜关联。

### 9.4 原子创建与重复

模型路径只有 ingest(create)。引擎先规范化 create target，并在锁内重新搜索 locator identity hints：

- requestId 已成功：返回原主体；
- 唯一相同 url/account/external_id hint：already_exists，并在 typed subjectResolution 返回该 subject；description 命中不走此分支；
- 名字相同但身份不确定：ambiguous_subject，并在 typed subjectResolution 返回至少两个 candidates；
- 无冲突：创建 subject + 第一批材料，再发布 subject.created。

create 不能只锁预分配的 candidate SubjectId：两个并发请求会得到不同 id，仍可能同时通过重复检查。引擎先解析或创建 SpaceRecord，再取得 `spaces/<space-id>.identity.lock`，在锁内从 subject facts 重做该空间的 identity/name 检查；`.index` 只能加速候选，不能决定唯一性。确认 candidate 后再取得 subject lock，直到 §6.4 的 create commit point 才释放两把锁。全局顺序固定为 space identity lock → subject lock → 文件提交 → SQLite projection；已有主体的 ingest 从 subject lock 开始，任何路径都不得在持有 SQLite transaction 时反向等待 filesystem lock。stale identity lock 与 subject lock 使用同一 owner heartbeat/TTL 规则。

create target 在任何材料 hash 之前预分配一个 candidate SubjectId，但不写最终目录或索引；锁内确认无冲突后必须使用该 id，already_exists / ambiguous / 整批失败则丢弃。这样 private capture 的 subject_fallback 可以在首批 MaterialId 计算前用最终 SubjectId 派生 ConversationSourceKey，同时仍保持“主体 + 第一批材料”原子，不产生空主体。

SDK 的 Distilly.create 可以创建空主体，供 Panel、迁移器和人工管理使用；这个能力不额外暴露成 MCP 工具。

`canonicalizeIngestSubjectTarget` 还负责把省略的 space 解释为内置 people、对 aliases / identityHints 去重并按 canonical bytes 排序，再生成授权 session 内存中的 target snapshot。capture grant 后 displayName、space、aliases、domainPack 或任一 locator 的语义变化都必须重新授权；数组顺序变化不算变化。

### 9.5 生命周期

archive 从默认列表、搜索和 Recall 中隐藏主体，但保留事实与血缘。purge 物理删除主体内容，只能由 Panel / CLI 的显式危险动作触发，不给模型工具。

self 只是在首次 setup 时可选创建的普通主体；不能用它绕过空间、证据或隐私规则。

---
