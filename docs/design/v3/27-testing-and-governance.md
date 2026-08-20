> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 27. 测试、宿主契约与治理

### 27.1 测试原则

- 测真实入口与真实磁盘状态，不测“helper 被调用”。
- temp DISTILLY_ROOT，绝不碰用户目录。
- mock 只放在 clock、id、network、LLM / DraftProducer 与不可控宿主。
- 无 live web、无真实 API key、无真实个人数据。
- 发现零测试、意外 skip、取消或超时都不是绿。
- generated prompt、skill、manifest 与 bundle 用可读 snapshot；更新逐条 review。

### 27.2 Protocol 与纯函数

- 所有品牌 id 与 schema accepted / rejected fixtures；七种随机 id（含 lease_owner）与 RequestId 使用各自前缀 + 32 lowercase hex，Raw/Version/Claim/Relation 与九种摘要型 id 使用各自前缀 + 64 lowercase hex，不接受空值、大写、额外字符、separator 或 dot segment；
- IsoDateTime 只接受有效 UTC 毫秒 form，HostName / FacetPath / m001..m999 的边界和 grammar 都有接受/拒绝 fixture；
- 五工具真实 names、titles、descriptions、draft-2020-12 inputSchema/outputSchema 与四个 annotation hints 的完整 tools/list snapshot；runtime schema 与 JSON Schema 用相同 accepted/rejected fixtures；
- get / pending 的 action→success-kind 映射、分支专属 key 和 handler→EngineMethodMap 映射；
- Wire major、idempotency conflict、错误码 exhaustiveness；already_exists 必带唯一 subject，ambiguous_subject 必带至少两个 candidates，其它 subjectResolution 和非 JSON details 拒绝；internal_error 固定 retryable=false 且不带 details/cause/stack，expected errors 不得被它吞掉；
- 全部 public object 拒绝 unknown keys；WIRE_LIMITS 每个边界值与总 toolInputBytes、safe/nonnegative integer、positive bounded limit 都有正反 fixture；
- EngineMethodMap 精确 35 keys 与 mutation/query 分区，无 payload 结果字节稳定为 null，不出现 void/undefined；
- EngineEvent decoder 遇到未知 kind 返回 schema_unsupported、不调 handler 并触发全量重读；其它 unknown discriminant 在边界失败；
- full SHA-256 与 MaterialId source semantics；
- source-groups-v1 的五类 exact proof-key preimage、每材料 key union、跨材料 union 与 component `sg_` hash 有 golden fixtures；artifact/representation 共 locator namespace、source.uri 只在无 artifact 时 fallback、CaptureAuditRef 不参与；
- source grouping 顺序无关；不同 URL 同 digest 保留不同 MaterialId 但同组；同 raw 的字幕/OCR/转写与同一 private conversation 的跨 grant 消息同组；bases 只含真实跨 MaterialId 理由并按 enum 排序，singleton 只有 unknown；unknown 不增加 eligible count；
- 同 URL/正文以相反顺序输入不同 provenance 得到同一最终 group / quality；同 proof key 的 public/private access 冲突为 ineligible 且返回 access_conflict caution；未引用或只被 superseded claim 引用的来源不提高 maturity；
- MaterialSetHash 顺序无关；
- parser draft 经 engine 绑定 RawId 后的 raw_extract type / round-trip；correction 的 direct-user 与 relayed provenance 产生可实现且不同的 digest；
- claim patch empty/add/revise/supersede/contest；每 base active/contested claim 最多一次且 superseded target 拒绝，resolved evidence exact-dedupe + MaterialId/locator/quote UTF-8 sort、observedIn dedupe/sort、validFrom<=validTo 与 ClaimId `claim-v1` golden preimage；revise 新 active + 旧 supersededBy、supersede 无 supersededBy、contest 保留 id/createdIn/text并合并 evidence；
- quote / locator 的 Unicode scalar `start < end` 正反边界、跨主体与跨 generation evidence 拒绝；EvidenceContext 从 verified state/base/materials 按 pinned v1 重建与 m001 mapping，不读取 brief OperationRecord；
- quality / maturity exact counts、first-version delta skip、canonical reason code/internal ordering与 renderer byte stability；
- `profile-renderer-v1` 七 core 固定顺序、domain root/ClaimId UTF-8 顺序、active/contested/superseded exclusion、JSON-string Markdown/HTML/backtick/newline injection fixtures、empty arrays与每个 section/profile/prompt 单 LF golden；SubjectRecord 改名后历史 Profile.displayName/prompt bytes 不变；
- OperationFact 的 completed/tombstone discriminant、OperationScope 与每个 completed mutation method 的唯一 result schema 做类型 fixture 和 round-trip，不能交叉存储另一 method 的 result，tombstone 不能带 actor/result；distill.brief OperationRecord 可精确 round-trip 4 MiB 内完整 briefing；
- BriefContract exact-three-field digest、raw prompt asset + NUL + evidenceRulesV1 promptVersion、source-groups-v1 与 draftSchemaVersion=1 有 byte-level golden fixtures；
- VersionId fixture 删除全部 Claim.createdIn 后计算，再把新 claim createdIn 填成所得 id；改变 createdIn 不改变 preimage，改变 version-time subjectDisplayName、reviewReasons 或其它 canonical claim 字段必须改变 id。Profile.displayName 必须等于 subjectDisplayName，current 无 reviewReasons，suspended reasons 非空且与 CommitResult/journal 相同。

Step 8 client-adapter conformance 另覆盖：Distilly / Person 的每个公开方法映射到 exact EngineMethodMap key/params/result，mutation 缺省 RequestId 只生成一次、显式 RequestId 原样复用、EmptyResult 只在 facade 外层变 void、close ownership 不漂移且 facade 不新增 watch；browser-safe bundle/runtime/type-only export allowlist 不含 Node builtin。MCP 使用 protocol descriptor 注册 exact 五工具，input-first/output-last，get/pending action 封闭映射，commit digest 原样透传，correct current 分支拒绝，presenter ref/route mismatch fail closed；每个 success/failure 的 JSON text content 与 structuredContent 深相等。真实 child-process stdio fixture 覆盖 initialize server name/version、tools/list、五 call、invalid/domain/unexpected WireFailure、EOF/signal/explicit close 幂等，以及 transport onerror 立即触发 teardown、in-flight handler 在 4,999 ms 内正常等待和 5,000 ms 到期 settle；该 fixture 注入 full fake client/presenter，必须断言没有关闭 borrowed client/presenter、没有创建 DISTILLY_ROOT 或导入 runtime，不能作为 production MCP 证据。

### 27.3 Fact layer 与 crash

真实临时目录覆盖：

- create + first ingest 在 root transaction 与 `subjects/.staging/<request>.<subject>` 下的原子性；createdSubject=true 的 targetSubjectChecksum/absent previous 与 existing 的 inverse schema 均有正反 fixture；
- 同空间两个进程并发 create 相同 locator/name 时只有一个主体成功；request → catalog（inline）→ space identity → subject → projection 的锁顺序无死锁；BUILTIN_PEOPLE_SPACE_ID 并发 bootstrap 只得到 exact People record，其它内容拒绝；
- label-v1 的 NFC、四种 ASCII edge trim、case/internal-byte preservation 与 alias canonical dedupe/sort；inline space 的 kind+exact canonical label 并发解析不重复建 space；
- create 重复矩阵覆盖 exact locator、唯一 exact name/alias、两个以上候选、same-kind locator disagreement 排除、description 不参与唯一性；
- duplicate 与同正文不同来源；
- material-text-v1 的 CRLF/CR、NFC、行尾 space/tab、行数/最终 LF 保留与 whitespace-only 拒绝；label/content 的 U+0344 NFC 扩张与 URI percent-encoding 扩张必须在 normalize 后重新命中原 UTF-8 上限；source identity 四级 namespace/NUL 拒绝、独立 8,208-byte schema 正反边界、完整 8,192-byte URI、URI canonicalization 及 authors/participants/flags/sensitivity defaults 和稳定排序；
- auto-v1 的累计 uncommitted count=2/3、oldest age 在 30 分钟前/恰好边界、duplicate-only attempt 与“无 timer” fake-clock fixture；currentVersionId 存在时必须经 FileVersionManifestStore 验证 manifest 并作 baseline，无 current 则为空，corrupt/missing version fact 不能猜测；
- duplicate-only enqueue=now 能复用已存在的 pending job；当前集合不同 current 时必须建 job，已等于 current 且无 pending 才无 job；pending 存在后新 generation 即使未达 auto 阈值也替换为新 job，同 generation/set 复用 JobId；
- raw-only ingest 不改变 generation/hash、不排 job，parser extraction 只能由 engine 绑定 RawId；
- state.materialManifest 排序、去重、摘要与 materialSetHash 一致；目录中未被 state/version/journal 引用的 material 不会被静默收编；
- 相同 RequestId 跨 method/space 只共享一把 root lock；相同 method/input/actor 返回原 IngestResult 且不重复 event/job，不同 method/input/actor 返回 idempotency_conflict，RequestId 不进 inputChecksum；slash、backslash、dot segment、错误长度/大小写 RequestId 在拼路径前拒绝；
- request / space catalog / space identity / subject lock 竞争和 stale lock recovery；两进程同时越过 preflight、旧 writer 留 prepared 后新 writer 的锁内二次检查必须释锁并 retryable busy，不反向取旧 request lock；create 对同 space prepared create 同样阻断；
- ingest 在 prepared journal、新 material rename、state/subject-directory commit point、operation、event、queue projection 每一步崩溃；恢复必须 target-first，包括 previous==target，否则只能是完整 previous/absent 并只删 journal 命名的 material/staging，第三态必须 storage_corrupt；原 ingested retry 不退化成 unchanged；
- aborted 同 request/input/actor 可复用同 candidate SubjectId 重进 prepared 并重算 target，不同 input/actor 永久 conflict；committed/completed 只 immutable replay；壁钟前进不会自动 GC prepared、completed 或 terminal journal；
- DistillCommitTransactionRecord runtime round-trip/cross-invariant 覆盖 acceptedPatch+patchDigest、lease owner、previous checksum/pending、完整 targetState、VersionRecord/materials/claims/Profile/prompt、correlated OperationRecord、固定 `[version.current|version.suspended, job.changed]` 与 lifecycle；任一 nested mismatch 拒绝；
- commit 在 prepared journal、固定 `versions/.staging/<request>.<version>` 各文件、version rename、state swap、operation、两 event、current projection、queue 与 terminal journal 每一步崩溃；target finish、exact previous abort、第三态 corrupt；abort 只删同 journal 且逐字节匹配的 staging/未引用 published version，不能删被 state/lineage/其它 journal 引用的目录；published abort cleanup 在 atomic rename 到固定 `.deleting` path 前后及 recursive cleanup 中断后都可重入，published path 不得留下半目录；
- claims.json 是单一 VersionClaimsSnapshot，claims 按 ClaimId UTF-8 严格升序无重复；version/material manifest/material content/evidence quote/Unicode-scalar locator/Profile/renderer/prompt 任一 missing 或不一致必须 storage_corrupt，manifest 缺项、hash 或 materialCount 不符同样拒绝；current/suspended reader 即使没有 prepared journal 也验证完整 version；
- recovery 幂等且只有一个 current；
- queue apply 在 durable marker、SQLite commit/DB fsync、marker unlink/parent fsync 每步崩溃；queue.dirty v2 exact bytes、PRAGMA user_version=2、missing/corrupt DB 与 malformed marker 都触发 sibling-DB atomic rebuild，从全部 verified SubjectStateRecord v2 以相同 JobId 重建，不能假装空且不回滚人物事实；Step 5 user_version=1 在 open 时判 index_unavailable 并自动 rebuild，不执行 ALTER/row migration；
- queue rebuild 在 projection lock 内才调用 AsyncIterable seed supplier；并发 writer 在 snapshot 前、snapshot 中和 replace/clear-marker 后提交 state 的 fixtures 都证明其 apply 最终发生在 rebuild 后或被 snapshot 包含，不会留下 clean-but-stale；
- corrupt checksum / unknown schema 拒绝；
- symlink / path traversal 拒绝；
- purge 的精确删除边界；prepared purge journal 后逐 operation atomic replace / 逐 journal delete 的每个崩溃点都能 recovery 到全部完成，subject-scoped completed operation 及 journal-only request 都最终变 tombstone，同 input 重试 not_found，不同 input/actor conflict，tombstone 不含 actor/result。

### 27.4 Lease 与并发

- 每个 EngineClient 获得不同 engine-owned LeaseOwnerId，模型/public params 不能提交 owner；两个 client 同时 brief，只有一个成功；
- SubjectStateRecord v2 的 pending.lease 是唯一权威；QueueRepository 没有 acquire/renew/release，删除或重建 queue.db 后未过期 lease 仍 leased、过期 marker 显示 pending；
- PendingJob 三态判别字段、JobLease expiresAt>acquiredAt 与 briefing 的 job/lease/generation/digest/base/ref/material 交叉关系有正反 fixtures；
- brief 只允许 absent/expired→active，renew 只改 expiry，release 只删 marker；renew/release 的 job、lease、owner 与 active 检查，恰好 expiry 时 lease_expired 且 state checksum/event 不变；
- expiry 完全由 clock 派生，没有 timer、recoverExpired、heartbeat 或 expiry event；下一次 brief 可替换过期 marker；
- lease 后新材料使旧 commit stale；
- briefing 的 baseline evidence 与新增材料被当前 generation 合成同组；brief 后升级默认 grouping / prompt / draft schema 时，commit 仍使用 state lease 固定的完整 BriefContract，缺少旧实现则 schema_unsupported 而不是静默换规则；
- 相同 patch / material set 在不同 BriefContract 下产生不同 VersionId；renew 保持原 briefContractDigest；
- 相同 RequestId 的 brief/renew/release 只在 method+params+actor+owner（brief 再加 canonical capacity）完全相同时精确重放；换 client owner 或 capacity 返回 idempotency_conflict；
- brief 以完整 briefing 作为 OperationRecord.result；prepared journal、state swap、operation、唯一 job.changed event、queue apply 的每个 crash point都做 target-first recovery，previous abort、target finish、第三态 storage_corrupt；ingest 在同 subject lock 下先阻断/reconcile prepared lease journal；
- capacity missing 返回 host_unsupported；完整 compact canonical JSON 的 fixed-point byte/token 估算在等于/超过 host token、host result bytes、4,194,304-byte internal cap、999 refs 各边界有 fixtures，任何失败都发生在 journal/state lease前，details 不含材料内容；maximumOutputBytes 固定 65,536；
- accepted DistillPatch canonical bytes=65,536 通过、65,537 invalid_input；active suspended、stale job、lease missing/owner/expiry、pinned algorithm、patch/target/date/cycle、evidence/locator 与 corrupt storage 按 §7.6 exact precedence/code，所有 hard reject 证明 journal/version/state/operation/event/projection 零写且 pending/lease逐字节不变；
- current success 证明 current=new、suspended absent、pending absent；suspended success 证明 current unchanged、suspended=new、pending absent；两者的 operation/result、reason tuple、两事件顺序与 terminal journal exact replay 不漂移；
- stale worker finish 不覆盖新 generation；
- requestId 重试不重复主体、材料或版本；
- panel、MCP、CLI 三进程 writer 的锁顺序无死锁；
- CLI distill 的真实 binary fixture 在一个 process/client/LeaseOwnerId 中完成 brief→current-user-only envelope→renew→commit；另一个 process 即使读到 envelope/LeaseId 也 lease_conflict，文件从不包含 owner；confirm 前 snapshot 被改、symlink/unsafe permission、cancel、SIGINT、expiry 与 commit crash 各自验证 release/expiry、清理和最终事实。

### 27.5 Keyless host workflow

完整 production FakeHost conformance 至少有 Codex-like 与 Claude-like 两个 fixture：

clean root → get not_found → ingest(create) → research fixture materials → enqueue now → pending brief → fixed claim patch → commit → get / prompt → correct → review。

这条 clean-root 流程不属于 Step 8 injected-client stdio smoke。correct→review 只有在真实 CorrectionService、PanelLauncher/ReviewPresenter、全部 Core handlers 与 production composition 落地后才进入 FakeHost；更早的 fake correct/suspended result 只证明 handler shape，不能写成 correction、Panel 或 keyless product 已实现。

还要覆盖：

- no web fallback；
- 无 document/OCR/caption/transcription 能力时走文字稿或 unavailable；raw/unparsed 只由 SDK / CLI 的显式 file-ingest fixture 证明，不伪装成五工具结果；
- subrun 不继承 MCP；
- malicious material instructions；
- validator remediation 重试；
- briefing_too_large；
- suspended + Panel review。

FakeHost 不声称证明真实宿主 UI；每个实际 binding 另有 manifest / launcher / capability smoke。

private UI capture conformance 还必须覆盖：第一帧前原生 consent；exact app/account/1:1 thread/range；OS permission 或 Always allow 不能绕过；错账号、错窗口、侧栏、通知、OTP/支付/secret 立即停止；群聊、附件、链接、scheduled/background/locked/subrun/executor 拒绝；无发送/删除/下载；屏幕 prompt injection 无效；audit stamp 不能由 MaterialInput 伪造；public/shareable/web/article/URI/artifact 等跨字段伪装被 engine 拒绝；grant replay 与授权后、ingest 前 revoke 被拒绝且 audit 保留 guard 的真实 reason；每个 start 在成功、engine ingest_rejected、coordinator_aborted 与 process recovery 下都恰有一个封闭 stop；成功与中止后 DISTILLY_ROOT、日志和诊断包都没有 screenshot；privacy purge 删除 transcript；host data policy unknown 返回 unsupported。稳定 locator 的 label 改名仍合到同 conversation，同名但不同 locator 不碰撞；无 locator 的 subject fallback 保守合一；create+fallback 在 hash 前绑定最终预分配 SubjectId；两个 runtime 与重启使用同一安装 audit key；原生 action 的 IngestResult 必须返回当前 task。fixture 只用合成窗口和合成聊天，不读取真实个人数据。

### 27.6 Panel

- 无 token、错 token、跨站 Origin、错 Host、超大 body、路径逃逸和占用端口拒绝；
- token 从 fragment 移除并以 header 发送；
- CSP 无远程资源；
- SSE unknown event 由 decoder 产生 schema_unsupported、不调 UI handler 并触发全库 re-read；
- Panel action 与等价 CLI action 产出相同 version / event；
- UI 显示的 quality 字段全部来自 protocol；
- Evidence / Materials 显示 medium、role、derivation、raw/capture provenance 与 engine source-group basis，不在前端重算 eligibility；
- atVersionId 只从该版本 materials manifest 重建 source group；新增 bridge material不改变历史展示，旧 grouping 实现不可用时明确 schema_unsupported；
- Discover 首版不存在。

### 27.7 Fresh install

从 Core closure + production composition 之后构建的发布包而不是 source；此前的 injected-client stdio child 不满足本节：

- npx setup 写 versioned runtime 与绝对 launcher；
- 两宿主 manifest schema；
- MCP tools/list 恰好五工具，且 name/title/description/schemas/hints 与 protocol snapshot 字节一致；
- engine / plugin wire mismatch 拒绝；
- skill copies 与 canonical digest 相同；
- 路径含空格、非 ASCII 与 Windows separator fixture；
- upgrade 原子切换且可 rollback；
- uninstall 保留 DISTILLY_ROOT 人物事实。

### 27.8 门禁

设计目标中的 pnpm 门禁：

~~~text
pnpm install --frozen-lockfile
pnpm run gates:fast
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run snapshots
pnpm run docs
pnpm run notes
pnpm run build
pnpm run hygiene
pnpm run gates
~~~

命令只有实际存在并跑过后，才能写入当前态 docs/development.md。构建产物 import、类型解析、exports、未声明依赖与 plugin archive 是独立发布门禁；源码测试绿不等于可安装。

### 27.9 设计 corpus 治理

- system-v3.md 是唯一父合同；
- v3/ 编号章节只由 scripts/sync_design_chapters.py 生成；
- V1 / V2 保留 deprecated 历史，不改正文保持一致；
- corpus registry 在写任何文件前验证 parent、version、chapter dir、输出路径唯一和恰好一个 in-force；
- governed change 同 PR 更新 owning Agent Note；
- architecture.md 只写 shipped tree，不把 V3 目标说成已发布；
- cookbook 只在真实入口落地后写可执行步骤；
- 机器验证链接、结构、生成一致性；语义 review 判断设计是否正确。

---
