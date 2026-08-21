> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 29. 落地顺序、首发验收与本文演进

### 29.1 纵向切片

1. **Design V3 与治理安全**：新父合同、Agent Note、corpus registry fail-closed、V2 deprecated、入口导航。
2. **TypeScript foundation**：workspace、protocol build、lint/type/test/build/hygiene 的真实最小门禁。
3. **Protocol**：完整 ids / value grammars、WIRE_LIMITS、JSON-safe errors / EmptyResult、EngineMethodMap、五工具 runtime + draft-2020-12 descriptor registry 与 snapshots。
4. **Fact foundation**：Layout、FactEnvelope/checksum、atomic write、space/subject/material/state/event/operation stores、full SHA-256、space identity / subject lock。
5. **Create + ingest + queue**：root request lock / operation / transaction、current material manifest、ingest journal/recovery、built-in people / inline space 串行化、保守重复创建、material-text/source-identity v1、request idempotency、auto-v1 与窄 queue projection，以及空 store 到 enqueue now 的真实磁盘路径与 generation。该切片只用 package-internal composition，不落 subjects.create 空主体、public pending/lease service、root EngineRuntime/createEngine 或占位 handlers。
6. **Briefing + lease**：一次不可拆的内部纵向切片交付 SubjectStateRecord v2/PendingLeaseMarker、LeaseOwnerId session 绑定、PendingJob 判别联合、verified state→queue user_version=2 read/list/rebuild、source-groups-v1、incremental baseline、raw-byte-versioned prompt asset、exact BriefContract、容量 fixed point，以及 brief/renew/release 的 DistillLeaseTransactionRecord/OperationRecord/EventRecord 崩溃恢复。验收必须从真实 Step 5 pending state 经 package-internal EngineMethodMap-compatible handlers 完成 list→brief→renew/release、并发 owner 冲突、expiry、idempotent replay、queue 删除/v1 rebuild、prepared journal 每个 crash point与超限前零写入；该切片不导出 partial EngineRuntime/createEngine，也不包含 claim commit。
7. **Claim patch + commit（不可拆 feature）**：在 package-internal composition 中一次交付从 verified state/base/materials 重建的 pinned EvidenceContext、claim-only DistillPatch validator、canonical resolved draft/ClaimId、apply/strength/quality/QualityGate、`profile-renderer-v1`、VersionRecord/material/claims/Profile/prompt 全套事实、DistillCommitTransactionRecord、固定 version staging path、state commit point、target-first recovery、completed operation、固定两事件、current projection与 queue apply。验收矩阵必须同时覆盖 empty/add/revise/supersede/contest、65,536/+1 bytes、locator/date/target/evidence、first-version与 delta gates、current/suspended state、active-review conflict、owner-bound idempotency、每个 crash point及历史 displayName/prompt重放。该 feature 不含 promote/reject、correction、relations、facade/MCP/CLI、root EngineRuntime/createEngine 或任何 public runtime；injected facade/MCP adapters、review、correction、production runtime/CLI 和 relations 分别留给 Steps 8、10、11、12、14。
8. **Injected-client Facade + MCP adapters**：browser-safe `distilly` 根一次交付 Distilly / Person 的完整转发面、精确 runtime/type export allowlist 与 full fake EngineClient contract fixtures；`@distilly/mcp` 一次交付五 handlers、ReviewPresenter seam、统一 WireFailure、structuredContent/text 同值、server identity、真实 stdio child-process conformance 与 built-entry smoke。child 只注入 test-only full fake EngineClient / ReviewPresenter 并证明 transport；本步没有 `distilly/node`、`@distilly/runtime`、`@distilly/cli` executable、production `distilly mcp`、DISTILLY_ROOT backend 或用户可操作产品，不能用 fake smoke 声称主路径成立。
9. **Host capability bindings + canonical skill**：先更新 Protocol HostPreflight 判别联合，再交付 `@distilly/bindings` 的 HostCapabilityBinding/full HostBinding contracts、HostRegistry 与 injected HostPreflightProvider factory seam；Codex / Claude Code concrete 仅为 kind=capability，preflight 只接受可信直接净 handshake 或 exact host/version/environment/release/wire/skill tuple 的真实截断 fixture，不能从 gross limit 推算，两者 privateUiCapture 固定 unavailable。同步交付唯一 recursive canonical skill tree、两个 exact-mirror copy、platform manifest fixtures、schemaVersion=1 release manifest 与 check-mode assembler。该 slice 不读用户 HOME/宿主 executable，不创建 host client，不实现 concrete injector/form renderer/private capture controller/full HostBinding/plugin lifecycle/doctor/runtime bootstrap/setup/production launcher；`.mcp.json.template` 不可安装。
10. **必备 Panel + review（不可与 production landing 混合）**：在 `@distilly/engine` package 内交付 §6 ReviewDecisionTransactionRecord/RollbackTransactionRecord、ReviewService 与 JsonLibraryProjection/read services；Protocol 同步交付完整 read models/pages/schemas。`@distilly/panel` 交付四页最小 UI、PanelLauncher/ReviewPresenter、借用 injected full user EngineClient 的完整 EngineMethodMap HTTP transport、`POST /events` fetch SSE、all-mutation nonce 与 §15/§27 安全拒绝。UI 只启用真实 reads 与 promote/reject/rollback；correct/install/archive/production doctor 只能 disabled/future-only，唯有测试注入的 full client 可显示真实只读 DoctorSnapshot。native_text/host_extract material reads 固定 rawAvailable=false；raw_extract 因没有 verified RawStore reader返回 schema_unsupported。本步不复用 fake host client、不创建/导出 LocalRuntime，不添加 CLI executable、production `distilly panel`/MCP handler、setup 或任何假成功。其验收用真实 temp facts + package-internal review/read composition 和 independently injected full transport fixture，不能声称用户入口已落地。
11. **Correction + Recall / install**：CorrectionService 立即版本、prompt、subrun inject、HostInjector/HostFormRenderer concrete implementations、profile install/export 与对应真实 core/runtime-owned handlers，并开始 raw ingestion/verified RawStore reader slice，使 raw_extract read model 正例可实现；host/sdk relayed 与 user actor 分流闭合后，correct→review 才能进入 product conformance。本步仍不伪造需要 plugin lifecycle/doctor 的 kind=full HostBinding。
12. **Core closure + production composition + CLI/setup（不可拆 production feature）**：先补齐并逐 key integration 证明全部 CoreMethodName 真 handler，包括未在 Step 11 完成的 raw ingestion/read closure；同 feature 的后半把 Step 9 capability preflight、Step 11 injector/form renderer 与本步真实 plugin lifecycle/doctor 组合成 Codex / Claude Code kind=full factories，才导出 createEngine、createLocalRuntime、distilly/node openInProcess 与 actor-bound clients，并交付 production `distilly mcp`、完整数据 CLI、单进程 `distilly distill` lease/edit/commit、runtime bootstrap、doctor、setup/upgrade/uninstall、template→actual `.mcp.json` 渲染与 built-artifact fresh install。任何缺 handler、Panel presenter、CorrectionService、verified net host capacity、full binding method 或 teardown owner 都在 export 前 startup/build fail；不发布 placeholder command 或改名 partial runtime。
13. **Legacy migration**：真实 fixtures 与升级指南。
14. **关系、Bot、TUI、后台 executor**：按真实需求分别落地。
15. **Profile Catalog**：只在 §24.6 条件全部满足后立项。

首个公开产品版本不能停在第 8 步；第 12 步 production composition 与 fresh-install 通过后，前面已落的 Panel/review/correction 才共同构成可审产品。关系、Bot、TUI 与 Catalog 不能反过来阻塞主路径。

### 29.2 Chat 主路径验收

- 干净 DISTILLY_ROOT、无全局 CLI、无 Distilly 账号、无额外 LLM key；
- 一条 setup 后 doctor 绿、宿主重开后恰好五工具；
- 用户只说“调研并蒸馏公开人物 X”；
- get not_found 后 ingest(create) 成功，用户不发明 subject id；
- 宿主按 public-figure portfolio 使用多个 research fixtures，每份保存 artifact / representation、URI / title / time / medium / derivation / body；
- enqueue now 有变化时必返 job；
- pending brief 原子取得 lease，返回 baseline、全部增量正文、来源和短 refs；
- 宿主提交 claim patch，无 Markdown / confidence / actor；
- commit 验证 evidence 后产生 current；
- get 得到 identity、voice 例句、boundaries 与逐 claim evidence；
- 下一次 prompt 可注入同一 current。

### 29.3 审核验收

- clean commit 不要求点击 Panel；
- identity change、coverage drop、new contested 或 correction conflict 产生 suspended；
- old current 不变；
- commit presenter 返回可打开的 review URL；
- Panel 显示 diff、reason、quote、URI 与原始材料；
- 首个 suspended 没有 current/beforeQuality 时不造 baseline；同 ClaimId 内容变化进入 changed before/after，review route 只接受 subject-filtered page 中的 exact candidate；
- promote/reject/rollback 各自跨 state atomic-replace 后可恢复且 RequestId 精确重放；reject pending 原样，promote/rollback pending rebase 使用新 JobId、mutation-time queuedAt、无 lease并重算 delta；
- Panel / CLI promote、reject、correct、rollback 结果一致；
- events 与 versions 保留完整历史。

### 29.4 正确性与恢复验收

- 八位短 hash 不存在于 V3 identity contract；
- duplicate source/content 幂等，同正文不同来源保留；
- 不存在、跨主体、跨 generation evidence 和错误 quote hard reject；
- 相同 requestId 不重复建主体、材料或版本；
- 同 generation 两个 brief 只有一个 lease；
- lease owner 绑定 client session，renew / expiry / release 由 state.pending.lease 与 distill-lease journal 可恢复；
- lease 后新材料使旧 commit stale，新 generation pending；
- briefing 使用 source-groups-v1、raw asset prompt version、exact BriefContract 与 fixed-point capacity；超限在 journal/state 前失败且不返回半份；
- commit 从 verified state/base/materials 而非 brief operation 重建 m001/EvidenceContext；accepted patch 65,536 bytes 通过、+1 zero-write invalid_input，locator start<end、date range、target唯一与 pinned algorithm dispatch 都有正反验收；
- claim add/revise/supersede/contest、canonical ClaimId/evidence/observedIn、exact quality/reason order、首版 delta skip 与 suspicious/manual gate可字节复算；
- commit transaction 每个 crash point只有 target finish、exact previous abort或 storage_corrupt；abort只清 journal匹配且未引用的 staging/published version，恢复后只有一个 current且成功 state 无 pending/lease；
- review-decision 与 rollback transaction 每个 crash point同样只有 target-first finish、exact previous abort或 storage_corrupt；rollback staging/published abort复用固定 `.deleting` cleanup，active suspended/lease 与非法 target 在零写入下返回 exact conflict/input error；
- current 成功 current=new/suspended absent，suspended 成功 current unchanged/suspended=new，已有 active suspended 的 ordinary commit 在任何写入前 review_conflict；
- 删除 .index 或打开 queue user_version=1 不丢人物事实；v2 rebuild 在 projection lock 内读取 verified state，保留 active lease并把 expired marker显示 pending；
- version 的 claims.json 单一快照与 materials/version/content/evidence/profile/prompt 交叉可验证，createdIn 不与 VersionId preimage 循环；`profile-renderer-v1` 七 core/domain/active/contested/JSON escaping 与单 LF 字节稳定，历史 displayName/prompt 不受以后 SubjectRecord 改名影响；
- correction 真实进入 corrections，privacy purge 精确删除。

### 29.5 宿主与安全验收

- no web、no extraction、no file、subrun no MCP 都走明确 fallback；
- 公开人物、创作者与私人联系人三种 source portfolio 都到达 traceable text、用户显式 file-ingest 的 raw-only、或 unavailable 之一；五工具路径不得声称自己保存 raw；
- 同一 artifact 的多个表示不提高 eligible source count，unknown provenance 也不提高 stable；
- Step 9 Codex / Claude Code private UI capture 明确 unavailable 并走粘贴/导出；未来 full binding 只有通过 §27.5 的授权、隔离、只读、前台与零截图留存拒绝矩阵后才可报告 available；
- 恶意材料不能改变工具序列或获得 secret；
- actor、version id、claim id 与 quality 不能由模型输入；
- Panel 的 `/rpc` 覆盖完整 EngineMethodMap并双向 parse，所有 mutation 使用 token/method/requestId/params-bound 60-second one-use nonce；三个 POST endpoint 都要求 exact Bearer/Host/Origin；4 MiB request、16 MiB bounded response、16 KiB header/SSE frame、fixed static allowlist/symlink 与 CSP 拒绝全部通过；
- `POST /events` fetch stream 先 subscribe 再 ready/initial reads，无 replay；慢消费者、未知/超大 event 或断线都取消订阅并全量重读；
- plugin fresh install 不依赖 PATH 或 npx latest；
- canonical skill 两宿主内容 digest 相同；
- 没有 Catalog 登录、上传或 hidden sync；
- executor 未配置时完全不启动。

### 29.6 本文怎么演进

- 产品合同改变：先改 system-v3.md 与 owning Agent Note，再改实现。
- 只编辑 parent；生成 v3/，门禁拒绝 drift。
- 实现落地：同 change 更新 architecture.md、tests 与必要 cookbook；不把 task progress 写进 Agent Note。
- §3.1 锁定项变化必须新 Note；§3.2 开放项关闭时写日期、结论和 owner Note。
- V1 / V2 保留历史，除状态导航外不为“保持一致”重写正文。
- 平台能力变化优先改 HostBinding / distribution 章节；只有破坏 core contract 才升设计 major。
- 仓库外聊天、画布、未跟踪实验和模型记忆都不是规范来源。

### 29.7 设计完成与实现完成不是一回事

V3 完成表示实现者现在能找到：

- 用户闭环与失败语义；
- 每个 wire 字段与 engine-owned 字段；
- 包、文件、interface、纯函数与 concrete service；
- 事实格式、commit point、并发和恢复；
- Panel、插件 bootstrap 与安全边界；
- 未来 executor、关系、索引和 Catalog 的进入缝；
- 可观察的首发验收。

只有代码、真实入口测试、fresh install 和 architecture.md 同时证明这些行为，产品才算 shipped。

---
