> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 5. 总体架构、进程与状态机

### 5.1 六层

~~~text
用户意图     “调研并蒸馏 X” / “使用 X” / “纠正这条”
   │
宿主编排     canonical skill + HostBinding + HostCapabilities
   │           ├── 宿主 search / browser / files / text extraction
   │           ├── 经一次性授权的 private UI capture（可选）
   │           └── 五个 distilly_* MCP tools
   │
产品门面     Distilly + Person + typed EngineClient
   │
确定性引擎   subject / ingest / jobs / briefing / commit / review / projection
   │
本地事实     materials / immutable versions / state / events / corrections
   │
交互投影     current profile / host skill / local panel / rebuildable indexes
~~~

未来 background executor 与宿主 LLM 是同一层的两个 DraftProducer；它们都只能领取 briefing、提交 patch，不能调用 CommitService 私有入口。

### 5.2 进程拓扑

首发必须支持同时存在的两个本机进程：

- 宿主启动的 distilly mcp stdio 进程；
- 用户打开的 distilly panel 回环 HTTP 进程。

CLI 命令还可能成为第三个短进程。因此“第一版只有一个 writer”不成立。所有 subject 写入通过跨进程 FileSubjectLock；job lease 通过 SQLite 条件更新；事实提交仍以文件 state commit point 为准。

不要求常驻 daemon。Panel 生命周期属于 panel 命令；MCP 生命周期属于宿主；CLI 每次独立启动 composition root。

### 5.3 主路径

~~~text
resolve or ingest(create)
        │
host research ──► ingest materials ──► generation pending
                                           │
                                   pending(action=brief)
                                           │ lease
                                  HostDistillBriefing
                                           │
                                  host LLM claim patch
                                           │
                                        commit
                         ┌─────────────────┴─────────────────┐
                    hard reject                         valid candidate
                                                          │
                                             ┌────────────┴────────────┐
                                         clean/current          risk/suspended
                                                                    │
                                                         panel promote/reject
~~~

### 5.4 状态机

**Subject**

~~~text
absent → active(empty or with first materials) → archived
   └────────────────────────────────────────────→ purged
~~~

**Job**

~~~text
collecting → pending → leased → committed
                 │        ├── lease expired → pending
                 │        ├── new generation → stale
                 │        └── retryable failure → pending
                 └── terminal failure
~~~

**Version**

~~~text
prepared → current → historical
       └→ suspended → current(promoted)
                    └→ rejected
~~~

prepared 不是公开状态：state.json 原子切换前，外部看不到该版本。suspended 已经是完整不可变事实，只是没有成为 Recall 默认值。

### 5.5 新材料与旧 lease

lease 锁定 job generation，而不是锁住主体不让继续 ingest。新材料可以落盘并产生 generation + 1；旧 lease 仍可读，但 commit 必须返回 stale_job，不能发布只看见旧材料的 candidate。新 generation 保持 pending，避免材料丢失。

### 5.6 事件与 watch

EngineEvent 是“请重读”的定位信号，不承载可信 profile 内容：

~~~ts
export interface EngineEvent {
  readonly kind:
    | "subject.created" | "subject.archived" | "subject.purged"
    | "material.ingested" | "job.changed"
    | "version.current" | "version.suspended"
    | "version.promoted" | "version.rejected" | "version.rolled_back"
    | "relation.changed";
  readonly subjectId?: SubjectId;
  readonly versionId?: VersionId;
  readonly at: IsoDateTime;
}
~~~

事件只在事实提交后发。EngineEvent runtime schema 只产生上述已知 union；transport decoder 遇到未知 kind 时返回 schema_unsupported，不把未解析对象传给 watch handler，并触发消费者对其可见库的全量重读；未知事件不能安全假设有 subjectId，所以不只刷新一个 subject。已知事件可以按 subject 合并短时间内的重复信号。其它 public discriminant 仍在边界直接拒绝 unknown value，不复用这个 event-only reread 策略。

---
