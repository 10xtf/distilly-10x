> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 5. 总体架构

```
绑定层     Claude / Codex / LangGraph / OpenAI Agents SDK / Hermes / Telegram
           Recall = get() / prompt()     Capture = ingest | accept_collect
           自动路径必须挂 lifecycle hook，不能指望模型自觉
                │
Client SDK  Distilly + Person          ← 程序员和绑定只碰这一层
                │
Protocol    同进程 | 以后 JSON-RPC / MCP 共用形状
                │
引擎        收集管道 → Material
           蒸馏管道 → profile + claims + 关系
           队列 / 版本 / 投影
                │
存储        ~/.distilly/
            Markdown / jsonl = 事实
            .index/ = 可删可重建
```

四张脸（不是四套产品）：

```
                    distilly_engine
                   /    |     |     \
            MCP工具  Person   面板HTTP   Bot binding
            （模型） （脚本）  （市场/图） （钉一个人）
```

分工类比：engine = 车，`Distilly`+`Person` = 方向盘。**不要把七组业务摊成 Client 上 30 个方法**，也不要把市场焊进 MCP。

蒸馏执行者：

```
无 LLM key ──► 摄入/去重/边界/排队 ──► 标 pending ──► 宿主蒸 ──► commit
有 LLM key ──► 同上                 ──► daemon 蒸  ──► 同一 commit
                                                      │
                                           置信度 ≥ 当前 → current
                                           置信度 < 当前 → 挂起 promote/reject
```

没有 `pending` + `commit`，默认零 key 路径是断的。

多模态同一规则：图/PDF/音频先落 `raw/`；谁解析（宿主视觉 / 本机 OCR / 可选云端 key）可切换；没解析的像素不进蒸馏，否则模型会「看图编」。

三条队列，成本差三个数量级，触发必须分开：

| 队列 | 成本 | 何时 | 失败 |
|---|---|---|---|
| ingest | 廉价 | 材料落地就处理：哈希、归档、计数 | 几乎只可能是磁盘/格式，多为不可重试 |
| distill | 昂贵 | **按主体边界**，绝不逐条。无 key 只挂 pending | 限流超时可重试；材料坏了需人介入 |
| index | 中等 | 产物变了 | 派生物，失败可重建。第一版可空转 |

边界：材料积累量、时间窗、用户 `flush`。不是对话语义边界。

采纳 / 排除的存储与队列机制：

| 项 | 取舍 | 理由 |
|---|---|---|
| 三层存储 | 采纳 | Markdown 事实、SQLite 状态队列、索引可重建 |
| 队列表 + processing 守卫 | 采纳 | 认领、终态 WHERE、启动回收孤儿 |
| retryable 三态 TRUE/FALSE/NULL | 采纳 | 限流 ≠ YAML 写坏 |
| 部分索引 | 采纳 | 队列表不随历史涨 |
| 写强一致 / 读最终一致 | 采纳 | 写进文档，不留给用户撞 |
| 对外状态机比内部小 | 采纳 | 对外 pending/done/failed，processing 是内部 |
| profile 单份覆写 | 改造 | 我们有版本，current 是指针 |
| 合并式重写 + 软废弃 | 采纳方向 | 改到几十版会碎片化 |
| episode 流水账 | 排除 | 主体是人不是事件 |
| 向量召回 + 多段融合排序 | 排除 | 第一版整份进 context |
| 必填四 key | 排除 | 默认宿主蒸 |
| 采集写死在仓库 | 排除 | 主路径 agent + 用户喂 |
| 拒绝 grep 兜底 | 采纳 | 索引坏了重建，不给假可用 |

Recall / Capture 在各框架的挂载点（宿主词汇不进 SDK）：

| 框架 | Recall | Capture | 注意 |
|---|---|---|---|
| OpenAI Agents SDK | `Runner.run()` 前 | 整个 run 成功后从 result | handoff 不要每个 `on_agent_end` 都提交 |
| LangGraph | `before_agent` 一次 | `after_agent` | 禁止每轮 `before_model` 都 `get` |
| AutoGen | 实现他们的 `Memory.query` | 自己包 `run()` flush | 他们不会替你 flush |
| CrewAI | `PRE_MODEL_CALL` 必须 run 级缓存 | `OUTPUT` / `EXECUTION_END` | |
| Claude / Codex | MCP + **lifecycle hook** | 结束看 `pending` | 只靠模型调 MCP 不可靠 |

Capture **不要默认把整段对话当记忆**。进库的是材料或用户修正，不是推理过程（存工具调用、排除推理内容）。Recall 默认是指定主体的 `get`，不是广搜。

---
