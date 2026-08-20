> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 24. Profile Catalog、bundle 与发布边界

### 24.1 三个安全域

| 名称 | 内容 | 网络 |
|---|---|---:|
| Plugin Source | manifest、skill、launcher metadata | 安装时可能访问代码分发源 |
| Local Library | 本机 subjects 与 rebuildable index | 不需要 |
| Profile Catalog | 用户明确发布的公开 profile bundles | 第二版可选 |

任何代码、文档和 UI 不得把三者都叫 marketplace。

### 24.2 首版只做本地 bundle import / export

为了备份、手工分享和将来 Catalog，先定义 bundle：

~~~text
<name>.distilly-profile/
├── manifest.json
├── subject.json
├── version.json
├── claims.jsonl
├── evidence/
│   └── <bundle-evidence-id>/
│       ├── evidence.json               # 公开 provenance、原 MaterialId、digest
│       └── excerpt.txt                 # 仅 claims 实际引用的可分享原文片段
├── profile/
│   ├── identity.md
│   ├── ...
│   └── domains/
├── provenance.json
├── license.txt
└── signature.json          # 可选；Catalog 发布时必填
~~~

manifest 包含 bundleSchemaVersion、profileSchemaVersion、subject display metadata、versionId、contentDigest、createdAt、publisher、license、includedProvenancePolicy。

默认**不包含完整原始 materials、private paths、corrections、operations、events、其它主体或 installation metadata**。但每个导出的 EvidenceRef 必须有一份最小 shareable excerpt fact，使 quote 可离线验证；用户不允许分享的 evidence 对应 claim 必须在预览中删除或改为不导出，不能留下悬空 MaterialId。provenance 只包含发布者明确允许公开的 URI、标题和 quote 映射。

### 24.3 Import

导入 bundle 是不可信输入：

1. 校验结构、checksum、schema、签名（若有）与路径穿越；
2. 展示将创建的主体、claims、许可和来源缺口；
3. 把每个 excerpt 作为 kind=derived_text、sensitivity=shareable 的本地 imported material 落盘，重新派生 MaterialId，并原子重写全部 EvidenceRef；quote 必须仍是 excerpt 的精确子串；
4. 新建或 fork 到本地 SubjectId，不复用外部目录 id；
5. 首次版本状态为 suspended，ReviewReason = imported_profile；
6. 用户在本地 Panel 审核后 promote；
7. 后续 correction 与 research 留在本地，除非用户再次明确 publish。

Catalog 上的 current 不是用户本地 current。

### 24.4 Publish

未来 publish 必须是显式向导：

choose local version → exact outbound preview → redact → license / consent → sign immutable bundle → upload。

硬规则：

- private materials 与 correction 默认排除；
- 真人画像需要产品政策定义的许可、申诉、删除和 impersonation 处理；
- profile bundle 只含数据，不含 executable scripts、skills、hooks 或 MCP config；
- 新版本发布新 immutable release，不覆盖旧 digest；
- 用户取消或撤回时 Catalog 下架 listing，但签名历史与本地副本的处置按政策透明说明；
- publish 是 open-world write，不能成为五个常用模型工具之一。

### 24.5 未来 RegistryClient

达到进入条件后另建 @distilly/registry：

~~~ts
export interface RegistryRef {
  readonly profileId: string;
  readonly releaseId: string;
  readonly contentDigest: ContentDigest;
}

export interface RegistryQuery {
  readonly text?: string;
  readonly publisher?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface RegistryPage {
  readonly items: readonly RegistryRef[];
  readonly nextCursor?: string;
}

export interface ProfileBundle {
  readonly bytes: Uint8Array;
  readonly contentDigest: ContentDigest;
}

export interface SignedProfileBundle extends ProfileBundle {
  readonly signatureAlgorithm: string;
  readonly signer: string;
}

export interface RegistryRelease extends RegistryRef {
  readonly publishedAt: IsoDateTime;
}

export interface RegistryClient {
  browse(query: RegistryQuery): Promise<RegistryPage>;
  pull(ref: RegistryRef): Promise<ProfileBundle>;
  publish(bundle: SignedProfileBundle): Promise<RegistryRelease>;
  deprecate(ref: RegistryRef, reason: string): Promise<void>;
}
~~~

RegistryClient 不实现本地 import / commit，不 import engine stores。Panel 的 Discover 页面调用 registry，pull 后仍走 BundleImporter 和 suspended review。

### 24.6 Catalog 进入条件

以下全部满足前，不创建远程服务、不在 SDK / MCP / Panel 留假按钮：

- 本地 Profile 与 bundle schema 已有真实兼容窗口；
- import / export 在用户场景中验证；
- provenance redaction 与签名完成安全 review；
- 真人许可、copyright、takedown、impersonation 和删除政策明确；
- moderation 与 abuse reporting 有 owner；
- 本地产品完全不登录仍可用；
- pull 后默认 suspended 的端到端测试通过。

---
