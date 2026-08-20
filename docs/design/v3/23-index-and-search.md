> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 23. 本地索引、Library 与以后检索

### 23.1 索引职责

.index 首版只做三件事：

1. queue.db：job、lease、attempt、LSN 与幂等工作状态；
2. graph.db：relation / mention 的 neighbor projection；
3. library.json：主体列表、名称/别名、空间、maturity、pending 与 suspended 数；首版实现固定为 JsonLibraryProjection。

它不保存唯一 materials、claims、versions、corrections 或 current pointer。删除 .index 后，人物事实不丢；但需要显式 rebuild 才恢复 search / queue / graph 服务。

### 23.2 Library 不是 Marketplace

Library 是用户机器上的本地 read model。它回答“我有哪些人物、哪些待审”，不提供发布、购买、关注或云同步。文件名、类型和 UI 文案都使用 library，不使用 marketplace。

### 23.3 Projection 接口

~~~ts
export interface LibraryProjection {
  upsert(entry: LibraryEntry): Promise<void>;
  remove(subjectId: SubjectId): Promise<void>;
  query(input: LibraryQuery): Promise<LibraryPage>;
  rebuild(entries: AsyncIterable<LibraryEntry>): Promise<RebuildResult>;
}
~~~

这是 interface，因为生产 JSON、测试内存实现与以后本地全文索引是合理的多个实现。首版不同时维护 SQLite library table。它是内部 extension port，不从 distilly 根导出。

ProjectionService 从 fact stores 生成 LibraryEntry；Panel 不写 projection，SubjectService / CommitService 在事实提交后 best-effort 更新。失败设置 dirty marker。

### 23.4 Rebuild

rebuild：

- 扫描 subject.json 与 state.json；
- 校验每个 current / suspended version；
- 从 version quality 生成 LibraryEntry；
- 从 state 重建 pending generation；
- 从 relation events 重建 graph；
- 写临时 index，再原子替换；
- 记录输入 root checksum 和 projection schema。

读取发现 dirty / schema mismatch 时显式 index_unavailable，提示 distilly library rebuild；不假装搜过但返回空。

### 23.5 不做向量召回

首版单人物 Recall 读取完整 Profile，不需要 embedding。Library search 用名字、别名、空间、domain 和状态字段。只有真实出现“几千份公开 bundle 的语义发现”需求，才评估本地 embedding；它仍是可删投影，不成为 claims 事实层，也不要求云 key。

### 23.6 未来全文索引规则

未来索引必须：

- 文件永久 id 与当前路径分开；
- checksum + mtime 跳过未变文件；
- “索引看到的版本”和“磁盘 current”分开，检测外部变化；
- 读路径只读，不顺手修事实；
- subject family / fictional space 先硬分区，再排序；
- 不让八卦、关系与工作事实在一个统一分数里相互顶掉。

---
