> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 28. Python、V2、磁盘与协议迁移

### 28.1 当前 Python 遗产

根 tools/、prompts/、skills/ 与 tests/ 服务已发布 dot-skill。distilly 产品分支上：

- 只接受已发布技能缺陷修复，不增加 V3 新行为；
- 根 prompts/ 冻结；V3 prompt 资产在 packages/engine/prompts；
- Python 门禁在最后一个遗产产品文件删除前保留；
- 新 TypeScript 产品不能 import 或 shell 调旧 writer 作为核心实现。

### 28.2 LegacySkillMigrator

~~~ts
export interface MigrationProbe {
  readonly sourcePath: string;
}

export interface MigrationInput extends MigrationProbe {
  readonly targetSpaceId?: SpaceId;
}

export interface MigrationPlan {
  readonly planId: string;
  readonly sourceFormat: string;
  readonly subjects: readonly {
    readonly displayName: string;
    readonly materialCount: number;
    readonly claimCount: number;
  }[];
  readonly warnings: readonly string[];
  readonly unknownFields: readonly string[];
  readonly digest: ContentDigest;
}

export interface MigrationApplyInput {
  readonly plan: MigrationPlan;
  readonly confirmation: string;
}

export interface MigrationResult {
  readonly subjects: readonly SubjectSummary[];
  readonly reviews: readonly ReviewRef[];
}

export interface LegacyMigrator {
  readonly sourceFormat: string;
  canRead(input: MigrationProbe): Promise<boolean>;
  migrate(input: MigrationInput): Promise<MigrationPlan>;
  apply(input: MigrationApplyInput): Promise<MigrationResult>;
}

export declare class LegacySkillMigrator implements LegacyMigrator {
  readonly sourceFormat: string;
  canRead(input: MigrationProbe): Promise<boolean>;
  migrate(input: MigrationInput): Promise<MigrationPlan>;
  apply(input: MigrationApplyInput): Promise<MigrationResult>;
}
~~~

迁移两阶段：

1. plan：读取真实 fixture，列主体、来源、目标 facets、未知字段与将写文件；
2. apply：用户确认后走 SubjectService / IngestService / CommitService，不私写目标格式。

只支持 fixture 覆盖的 schema；没有 schema 或未知版本按明确 migration profile 处理或拒绝，不猜。work.md 职责进入 vocation domain，persona voice / texture / psyche 拆成有“legacy import”证据的 claims；无法恢复逐句来源时 strength 标 imported_unverified 并 suspended。

### 28.3 V2 设计不是磁盘迁移输入

V2 TypeScript 产品和 ~/.distilly V2 格式从未发布，因此 V3 不背一个虚构的 V2 runtime compatibility layer。若工作区实验代码产生本地 fixture，只有在测试明确纳入后才增加 migrator。

V2 文档保留用于理解哪些替代曾经成立，不再作为实现要求。

### 28.4 四种独立版本

| 版本 | 控制什么 | 兼容策略 |
|---|---|---|
| wireVersion | MCP / RPC 字段与判别语义 | major 不兼容直接拒绝 |
| schemaVersion | 每类磁盘事实 | 显式 migrator，未知拒绝 |
| promptVersion | host distill instructions | 历史记录；变更 snapshot |
| bundleSchemaVersion | import / export / Catalog | 验签前先校验；独立升级 |

engineVersion、pluginVersion 是发布版本，不能替代上面四个兼容维度。

### 28.5 Additive 与 breaking

wire major 3 内允许：

- 新的可选输入字段；
- 新的结果字段；
- 明确可安全 default 的新 event kind；
- 新 engine method（不改变旧 method）。

必须升 major：

- 改字段含义或默认副作用；
- 删除 / 重命名工具、method、错误码；
- 把完整 briefing 改成分页但沿用同一判别形状；
- 改 EvidenceRef 引用对象；
- 允许调用方传 actor / id 等 engine-owned 字段。

Disk migrator 只前向、显式、可 dry-run；不在打开文件时自动就地升级。升级前保留备份与恢复说明。

### 28.6 Python 退役条件

同时满足才删：

- CLI / plugin 覆盖已发布用户入口；
- migrator 对真实 legacy fixtures 全绿；
- fresh-install 与升级文档发布；
- 用户有至少一个版本周期的迁移窗口；
- dot-skill 默认分支与 distilly 产品发布策略已明确。

删除遗产时同一 change 删除对应 job、依赖、文档和冻结说明，不留永久 disabled lane。

---
