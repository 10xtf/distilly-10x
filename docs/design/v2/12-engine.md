> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 12. 引擎内部

对外瘦，对内按职责切。每个类的失败行为都要显式。

```ts
class Layout              // 全部路径约定：subjectDir / profileDir / coreMd / domainMd /
                          // claims / knowledge / corrections / versions / lineage /
                          // relationsLog / queueDb / graphDb
class MaterialStore       // put(subject, item) → { digest, isNew }
                          // inventory(subject)：raw/ 里未转文本的不计入
class MaterialHasher      // hashSet(digests)：顺序无关的集合哈希
class SubjectStore        // create / get / list / readProfile / writeCurrent
class QueueService        // enqueue / claim / finish / recoverOrphans / pendingDistill
class DistillRunner       // shouldRun（哈希相同 → false）/ hostBriefing / runLlm
class DraftValidator      // §11.5 第二行；空内核合法，facet 语法必须过
class CommitService       // commit / promote / reject；写事实层再更新投影
class ProfileRenderer     // renderFacet(facet, claims) / renderPrompt(profile)
                          // 第一版不按显著度丢内容
class LegacySkillMigrator // 旧技能产物 → subjects/；只认 fixture 覆盖过的 schema 版本
class RelationLog         // link / invalidate / neighbors；邻居走投影
class MentionQueue        // add / resolve
class SkillProjector      // profile → SKILL.md
class HostExport          // profile → 宿主身份文件
class Telemetry           // 无端点则完全惰性
```

### 12.1 蒸馏的两个入口，一个校验器

`DistillRunner.hostBriefing()` 产出「给宿主模型看的任务说明 + 材料清单」，`runLlm()` 是有 key 时的后台路径。两者产出同一种 `DistillDraft`，都必须过同一个 `DraftValidator` 才能进 `CommitService`。**没有第二条提交路径。**

### 12.2 队列

队列表**一个主体（或一个路径）一行**，不是一个事件一行：worker 来不及处理时同一主体被改十次，UPSERT 成最新，天然去重。

- `claim` 用「只更新仍是 pending 的那一行」，受影响行数为 0 表示被别人抢走了。
- `finish` 的条件是「这一行仍在 processing」：用户又改了文件、行已经被 UPSERT 回 pending 时，丢掉这条过时的完成结果。
- 启动时 `recoverOrphans` 把 processing 收回 pending——上次进程崩溃留下的认领必须能被回收。
- 失败三态：可重试则自动再入队；不可重试等人改文件；第三态表示这一行没失败过。**内容变了重试计数清零。**
- LSN 给顺序、重新入队的公平性和积压量。取当前最大值加一**不是严格单调**，并发写入会撞号；第一版接受这个精度，真要做变更流再上更强的事务隔离。
- 文件修改时间的容差必须和对账逻辑**共用一个常量**，否则会出现「对账认为变了、跳过逻辑认为没变」的死循环。

对外状态机比内部小：外面只看 `pending` / `done` / `failed`，`processing` 是内部状态。

### 12.3 写强一致，读最终一致

`commit` 在一个事务里写完事实层，再更新投影。索引落后是允许的，且必须写进文档，不留给用户自己撞。索引坏了就重建，**不给全文搜索兜底**——假可用比不可用更糟。

---
