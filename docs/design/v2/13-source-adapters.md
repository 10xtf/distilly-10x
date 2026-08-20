> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 13. 采集适配器

三种模式：直连 API、直连浏览器、委托宿主。只许实现直采或委托两种接口。**构造函数不做网络和凭据 I/O；适配器写事实层即越权。**

主路径第一版是**模型采完 `ingest`**。适配器是降摩擦，不是开关：没有任何适配器，蒸馏照样能跑。直连 API 第一版只留接口，仓库里不写任何厂商的官方 API，最多带一两个委托样板证明社区能扩。

材料类型留在抽象里，不绑厂商能力：文本、图片（附可选 OCR）、文档、音频（附可选转写）。

```ts
export interface SourceAdapter {
  readonly adapterId: string;
  readonly displayName: string;
  capabilities(): AdapterCapabilities;
  /** 返回字段名到说明的映射；名字以 token/secret/key 结尾的按秘密处理。 */
  configFields(): Record<string, string>;
  preflight(config: AdapterConfig): Promise<PreflightResult>;
  resolveSubject(query: string, config: AdapterConfig): Promise<SubjectRef[]>;
}

export interface DirectAdapter extends SourceAdapter {
  readonly mode: "direct_api" | "direct_browser";
  /** 异步生成器：部分成功先产出，再抛错。 */
  collect(subject: SubjectRef, request: CollectRequest, config: AdapterConfig): AsyncIterable<Material>;
}

export interface DelegatedAdapter extends SourceAdapter {
  readonly mode: "agent_delegated";
  plan(subject: SubjectRef, request: CollectRequest): Promise<AgentPlan>;
  accept(plan: AgentPlan, artifacts: readonly string[]): AsyncIterable<Material>;
}
```

### 13.1 错误树

`AdapterError` 是基类，带 `retryable` 和 `remediation`。子类：认证失败、权限不足、服务不可用、被限流（带可重试秒数）、瞬时故障。**解析失败归入服务不可用且不可重试**——重试一个坏 PDF 不会变好。

### 13.2 注册表

`register` / `loadAdapters` / `getAdapter` 住在 `@distilly/adapters`。第三方发现走显式注册或包字段约定；**加载失败只警告并跳过**，不让一个坏适配器拖垮引擎。

---
