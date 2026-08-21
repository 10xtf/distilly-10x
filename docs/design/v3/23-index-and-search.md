> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 23. 本地索引、Library 与以后检索

### 23.1 索引职责

.index 首版只做三件事：

1. queue.db：job/lease 的公开 read projection、attempt、failure 与 projection LSN；
2. graph.db：relation / mention 的 neighbor projection；
3. library.json：§15.3 的 canonical LibraryEntry 列表，包括 privacy、bounded searchTerms、current/suspended quality、pending/suspended 0|1、新材料数与 lastChangedAt；首版实现固定为 JsonLibraryProjection。

它不保存唯一 materials、claims、versions、corrections 或 current pointer。删除 .index 后，人物事实不丢；但需要显式 rebuild 才恢复 search / queue / graph 服务。

### 23.2 Library 不是 Marketplace

Library 是用户机器上的本地 read model。它回答“我有哪些人物、哪些待审”，不提供发布、购买、关注或云同步。文件名、类型和 UI 文案都使用 library，不使用 marketplace。

### 23.3 Projection 接口

~~~ts
export interface LibraryProjection {
  upsert(entry: LibraryEntry): Promise<void>;
  remove(subjectId: SubjectId): Promise<void>;
  query(input: LibraryQuery): Promise<LibraryPage>;
  rebuild(entries: () => AsyncIterable<LibraryEntry>): Promise<RebuildResult>;
}

export interface LibraryProjectionRecord extends FactEnvelope<1> {
  readonly recordKind: "library";
  readonly entries: readonly LibraryEntry[];
}
~~~

这是 interface，因为生产 JSON、测试内存实现与以后本地全文索引是合理的多个实现。首版不同时维护 SQLite library table。它是内部 extension port，不从 distilly 根导出。

ProjectionService 从 fact stores 生成 LibraryEntry；Panel 不写 projection。`.index/library.json` 是 checksum-protected schemaVersion=1 LibraryProjectionRecord，entries 使用 LibraryPage 的完整 sort tuple 严格升序且 SubjectId 不重复；文件中没有 cursor、page 截断或 UI-only 字段。`.index/library.dirty` 的唯一合法 bytes 是 ASCII `distilly-library-dirty-v1\n`；`.index/library.intent` 的唯一合法 bytes 是 ASCII `distilly-library-intent-v1 <owner-token>\n`，其中 `<owner-token>` 是创建该 marker 的 `.index/library.lock` reservation 所生成的 32 个 lowercase hex owner token，recovery 继承时不重写。`.index/library.lock` 使用 §9.4 相同的跨进程 owner/heartbeat/stale-recovery 纪律；其它 marker bytes、symlink 或 lock protocol mismatch 都返回 index_unavailable，不能猜。

每个可能改变 LibraryEntry 的 writer 把 `.index/library.lock` reservation 作为 subject writer lock 的尾部：先取得 subject lock，再取得 Library reservation，只有两者都成功后 service 才能继续读取或写入该 mutation 的 facts。新 mutation 在锁内发现 intent absent 后先 atomic create+fsync 自己的 exact intent；若旧 intent 已存在，它必须不覆盖 marker、按 Library → subject 释放并返回 retryable busy。prepared-journal recovery 可以继承旧 intent，但不能在单条 journal materialize 中清除它。reservation 一直保持到 recovery 已完成 Library apply 或留下 exact dirty marker并把 journal 标 terminal，最后按 Library → subject 反向释放。同一进程的 apply 必须复用该 reservation，不能二次取得同一 filesystem lock。普通 subject read 在 root reconcile 后取得 subject lock，并在读 facts 前按相同 subject → Library 顺序做一次 O(1) intent probe；若此时发现 reconcile 后新建的 intent，它先释放 subject，再从 root reconcile/retry，绝不持 subject lock恢复 journal。Library query 只取得 Library lock且不扫描 facts；rebuild 同样不取得全库 subject locks，但会在 Library lock 内按 §23.4 枚举 verified subject seed。于是 query / rebuild 若先取得 Library lock，后来的 writer 会在任何事实读写前等待；writer 若先取得 reservation，query / rebuild 会等到该 mutation 的事实与 projection 已处于同一终态。

每个可能改变 LibraryEntry 的事实 mutation 在跨过自己的 state commit point 后、把 journal 标 terminal 前，必须在 library projection lock 内先 atomic create+fsync dirty marker，再从该 mutation journal/verified facts计算 exact upsert/remove，atomic replace+fsync library.json，最后 unlink+fsync dirty marker。clean apply 仍保留 intent；只有 journal 已 durable terminal 且 terminal crash hook 已通过后，普通 writer 才在仍持 reservation 时删除并 fsync自己的 intent。dirty apply、异常退出与 recovery apply 都留下 intent。apply 失败只要 exact dirty marker 已 durable 就不回滚事实；journal 可继续 terminal，但后续 read 返回 index_unavailable。若进程在事实 commit 与 dirty marker create 之间、clean apply 与 terminal 之间、或 terminal 与 intent clear 之间崩溃，intent 都仍 durable；任何 library read 先用 O(1) probe 检查 intent，absent 时不枚举历史 journal，present 时才运行 root prepared-journal reconciliation，recovery 再完成同一 apply、留下 durable dirty，或证明 terminal 后清除 intent。reconcileAll 在处理当轮全部 prepared journal 后取得 Library lock：intent absent 即完成；intent present 时只在该锁内确认 transaction store 已无 prepared journal才 unlink+fsync intent，否则释放并继续 recovery。这个额外的 transaction scan 只在 fail-closed intent 存在时发生，不给普通 clean projection read 增加 subject/fact scan。因而不存在事实已新、index 仍 clean-stale 的可观察窗口。未跨事实 commit point 的 aborted journal 不改 library；它留下的 intent同样只能经上述 reconciliation proof 清除。

### 23.4 Rebuild

rebuild 先完成 root journal reconciliation，再在持有 `.index/library.lock` 的整个 verified seed collection 与 replace 期间执行；seed supplier 只能在拿到 lock 后迭代。与 rebuild 并发的事实 writer 要么已经持有 reservation并先完成，随后 seed 看到终态；要么先取得 subject lock但在 Library reservation 处等待，直到 rebuild replace 后才开始读取或写入该 mutation 的 facts。clean projection 因而不会看到半发布 version，也不会漏 mutation。流程是：

- 扫描 subject.json 与 state.json；
- 校验每个 current / suspended version；
- 从 version quality 生成 LibraryEntry；
- 从 state 重建 pending generation；
- 按 canonical Library sort tuple 排序、拒绝重复 SubjectId；
- 先 durable 写 exact dirty marker，再写 checksum/schemaVersion=1 临时 record，fsync 后原子替换 library.json 与 parent；
- 最后删除并 fsync dirty marker，再释放 lock。relation graph 使用自己的独立 lock/rebuild，不混入 library atomicity。

这里描述的是 `LibraryProjection.rebuild` 的 library phase。顶层 `library.rebuild` method 仍依次调用 queue 与 graph 各自的 locked rebuild，并把三个阶段的 counts/同一次 operation time 汇总成 RebuildResult；三个 disposable indexes 没有伪造共同 atomic commit，一个阶段失败就保留其 exact dirty marker 并返回最窄 index_unavailable。

library query 先完成 root journal reconciliation，再只取得 projection read coordination并要求 intent absent后读取 record；若 reconciliation 后有新 writer 创建 intent，query 返回 retryable busy，调用层可再完成一次 reconciliation/retry，但绝不能读取旧 clean record。它不枚举 subject/space facts，也不取得任一 subject/identity/catalog lock。library.json missing、dirty marker 存在或 malformed、intent malformed、checksum/schema/recordKind/order/duplicate/canonical LibraryEntry 任一损坏都显式 index_unavailable，提示 `library.rebuild`；不全文扫描、不自行修复、不假装搜过但返回空。cursor 在 validated canonical entries 上按 §15.3 生成。

### 23.5 不做向量召回

首版单人物 Recall 读取完整 Profile，不需要 embedding。Library `text` search 固定为 query NFC normalization 后用 ECMAScript `toLowerCase()`，再对 subject displayName、aliases、space displayName、identity hint 的公开字符串与 LibraryEntry.searchTerms 做 substring match；它不是 locale-sensitive collation 或 fuzzy search。searchTerms 让 domainPack、current domain roots 与 lifecycle/privacy/maturity/pending/suspended 状态可搜，同时保持 projection 有界且不复制 Profile 正文。结构化 space/lifecycle/pending/suspended filter 与 text 取交集。只有真实出现“几千份公开 bundle 的语义发现”需求，才评估本地 embedding；它仍是可删投影，不成为 claims 事实层，也不要求云 key。

### 23.6 未来全文索引规则

未来索引必须：

- 文件永久 id 与当前路径分开；
- checksum + mtime 跳过未变文件；
- “索引看到的版本”和“磁盘 current”分开，检测外部变化；
- 读路径只读，不顺手修事实；
- subject family / fictional space 先硬分区，再排序；
- 不让八卦、关系与工作事实在一个统一分数里相互顶掉。

---
