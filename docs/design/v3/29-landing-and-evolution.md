> 本章由 [system-v3.md](../system-v3.md) 生成，属于当前生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 29. 落地顺序、首发验收与本文演进

### 29.1 纵向切片

1. **Design V3 与治理安全**：新父合同、Agent Note、corpus registry fail-closed、V2 deprecated、入口导航。
2. **TypeScript foundation**：workspace、protocol build、lint/type/test/build/hygiene 的真实最小门禁。
3. **Protocol**：完整 ids / value grammars、WIRE_LIMITS、JSON-safe errors / EmptyResult、EngineMethodMap、五工具 runtime + draft-2020-12 descriptor registry 与 snapshots。
4. **Fact foundation**：Layout、FactEnvelope/checksum、atomic write、space/subject/material/state/event/operation stores、full SHA-256、space identity / subject lock。
5. **Create + ingest + queue**：current material manifest、ingest journal/recovery、request idempotency，以及空 store 到 enqueue now 的真实磁盘路径与 generation。
6. **Briefing + lease**：pending list/brief/renew/release、incremental baseline、prompt asset、超限失败。
7. **Claim patch + commit**：evidence resolver、patch apply、quality、renderer、journal、current/suspended。
8. **Facade + MCP + CLI**：Distilly / Person、五 handlers、真实 stdio 与 built-entry smoke。
9. **Host bindings + setup**：Codex / Claude Code capability、canonical skill、runtime bootstrap、doctor。
10. **必备 Panel + review**：四页最小 UI、HTTP EngineClient、安全拒绝、promote/reject。
11. **Correction + Recall / install**：立即版本、prompt、subrun inject、install/export。
12. **Legacy migration**：真实 fixtures 与升级指南。
13. **关系、Bot、TUI、后台 executor**：按真实需求分别落地。
14. **Profile Catalog**：只在 §24.6 条件全部满足后立项。

首个公开产品版本不能停在第 8 步；第 10 步通过才有可审的产品。关系、Bot、TUI 与 Catalog 不能反过来阻塞主路径。

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
- Panel / CLI promote、reject、correct、rollback 结果一致；
- events 与 versions 保留完整历史。

### 29.4 正确性与恢复验收

- 八位短 hash 不存在于 V3 identity contract；
- duplicate source/content 幂等，同正文不同来源保留；
- 不存在、跨主体、跨 generation evidence 和错误 quote hard reject；
- 相同 requestId 不重复建主体、材料或版本；
- 同 generation 两个 brief 只有一个 lease；
- lease renew / expiry / release 可恢复；
- lease 后新材料使旧 commit stale，新 generation pending；
- briefing 超限不返回半份；
- transaction 每个 crash point 恢复后只有一个 current；
- 删除 .index 不丢人物事实，rebuild 后服务恢复；
- correction 真实进入 corrections，privacy purge 精确删除。

### 29.5 宿主与安全验收

- no web、no extraction、no file、subrun no MCP 都走明确 fallback；
- 公开人物、创作者与私人联系人三种 source portfolio 都到达 traceable text、用户显式 file-ingest 的 raw-only、或 unavailable 之一；五工具路径不得声称自己保存 raw；
- 同一 artifact 的多个表示不提高 eligible source count，unknown provenance 也不提高 stable；
- private UI capture 满足 §27.5 的授权、隔离、只读、前台与零截图留存拒绝矩阵；
- 恶意材料不能改变工具序列或获得 secret；
- actor、version id、claim id 与 quality 不能由模型输入；
- Panel 拒绝本章规定的所有跨站 / token / path / size 攻击；
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
