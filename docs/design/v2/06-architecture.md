> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 6. 总体架构

### 6.1 五层

```
绑定层     Claude Code / Codex / LangGraph / OpenAI Agents / Hermes / Telegram
           Recall = get() / prompt()      Capture = ingest() / acceptCollect()
           自动路径必须挂宿主生命周期钩子，不能指望模型自觉
                │
门面        distilly              Distilly + Person，程序员和绑定只碰这一层
                │
协议        @distilly/protocol    方法名、值类型、错误码；同进程与以后的跨进程共用
                │
引擎        @distilly/engine      收集 → 材料
                                  蒸馏 → 画像 + claim + 关系
                                  队列 / 版本 / 投影
                │
存储        ~/.distilly/          Markdown / jsonl = 事实
            .index/               可删可重建
```

引擎是车，`Distilly` + `Person` 是方向盘。**不要把七组业务摊成门面上的三十个方法**，也不要把市场焊进模型工具里。

### 6.2 四张脸，不是四套产品

```
                       @distilly/engine
                              │
                    EngineClient（唯一传输缝）
          ┌──────────┬────────┴────────┬──────────┐
       MCP 工具    Person          交互式界面    Bot binding
     （给模型）  （给脚本）      TUI ／ 面板     （钉住一个人）
                                进程内 ／ 回环 HTTP
```

四张脸共用同一套动词。任何一张脸需要新动词，先问它是不是应该进 §9 的内部清单，而不是直接长在门面上。

交互式界面那一张有两种呈现：终端里的 TUI 和浏览器里的面板。两者读同一批聚合、走同一个 `EngineClient`，区别只在渲染介质和进程边界（§16）。

### 6.3 蒸馏执行者：两条路，一个提交口

```
无 LLM key ──► 摄入/去重/边界/排队 ──► 标 pending ──► 宿主蒸 ──► commit
有 LLM key ──► 同上                 ──► daemon 蒸 ──► 同一 commit
                                                       │
                                            置信度 ≥ 当前 → 成为 current
                                            置信度 < 当前 → 挂起，等 promote/reject
```

没有 `pending` + `commit` 这一对，默认零 key 路径就是断的。这也是 `ingest` 和 `commit` **不能合成一个动词**的原因：一步到位地「加记忆就地抽事实」必然要求引擎自己有模型。

### 6.4 多模态

图片、PDF、音频先落 `raw/`。谁来解析可以切换：宿主的视觉能力、本机 OCR、或用户自愿配置的云端 key。**没解析成文本的不进蒸馏**，否则模型会看着图编。

### 6.5 三条队列，成本差三个数量级

| 队列 | 成本 | 何时跑 | 失败性质 |
|---|---|---|---|
| ingest | 廉价 | 材料落地就处理：哈希、归档、计数 | 多为磁盘或格式问题，不可重试 |
| distill | 昂贵 | **按主体边界**，绝不逐条。无 key 时只挂 pending | 限流超时可重试；材料坏了需人介入 |
| index | 中等 | 产物变了 | 派生物，失败可重建 |

边界由材料积累量、时间窗、用户显式 `flush` 决定，**不是**对话语义边界。把三条队列合成一条，等于让每条消息触发一次昂贵蒸馏。

### 6.6 绑定怎么挂：各框架的钩子位置

下表定的是「在哪一层挂」。宿主的词汇留在绑定层，不进 SDK。

| 框架 | Recall 挂在 | Capture 挂在 | 坑 |
|---|---|---|---|
| OpenAI Agents SDK | 一次 run 开始前 | 整个 run 成功之后 | 交接给别的 agent 时不要每次都提交 |
| LangGraph | agent 前置钩子，一次 | agent 后置钩子 | 禁止每轮模型调用前都 `get` |
| AutoGen | 实现它的记忆查询接口 | 自己包一层 run 再 flush | 它不会替你 flush |
| CrewAI | 模型调用前，必须做 run 级缓存 | 执行结束 | 不缓存会按步数放大调用 |
| Claude Code / Codex | 工具 + **生命周期钩子** | 结束时看 `pending` | 只靠模型主动调工具不可靠 |
| Bot 宿主 | 进程启动时 | 每条用户消息 | 见 §18 |

两条通用规则：Capture **不要默认把整段对话当记忆**——进库的是材料或用户修正，不是推理过程；Recall 默认是对指定主体的 `get`，不是广搜。

---
