# distilly 系统设计 v2（TypeScript）

> **这是唯一需要读的产品与架构合同。** 它自足：不需要读过其他项目、其他仓库，也不需要读过上一版设计。每个术语在 §0 定义，每个类型在 §10 定义。
> **实现状态：** 尚无 TypeScript 产品代码。当前树实际发布什么只看 [architecture.md](../architecture.md)、源码和测试。设计文本不是「已实现」的证据（§20）。
> 按章加载：[design/README.md](README.md)。分层目录：[docs/README.md](../README.md)。
> 决策记录：[TypeScript 产品线](../../.agents/notes/proposed/architecture/2026-08-19-typescript-product-line.md)、[TypeScript 治理周期](../../.agents/notes/proposed/process/2026-08-19-typescript-governance-lifecycle.md)。
> 与上一版的关系见 §26.3。创建：2026-08-19

---

## 0. 怎么读这份文档

### 0.1 三条读法

**第一次读，要理解产品是什么：** §1 意图 → §2 存储形态 → §3 哲学 → §5 已锁定 → §6 总体架构。读完这五章能回答「distilly 是什么、为什么它的事实层是 Markdown」。

**要动某一个缝：** §5 确认没有踩锁定项 → §6 找到那一层 → 该缝自己的章（采集 §13 / 注入 §14 / CLI 与插件 §15 / TUI 与面板 §16 / 问人表单 §17 / Bot §18 / 关系 §21 / 索引 §22）→ §10 与 §11 对齐类型和签名。

**要评审别人的改动：** §5 锁定与冻结 → §3 哲学里对应那条的「拒绝」 → §24 门禁能证明什么、不能证明什么 → §20 完成度的事实归属。

### 0.2 词汇表

这些词在本文里是精确的，不要按日常语感理解。

| 词 | 含义 |
|---|---|
| **主体 subject** | 我们要记住的一个人或角色。同事、亲人、公众人物、动漫角色、以及使用者自己，都是主体。每个主体一个 id、一个目录 |
| **`self`** | 使用者本人。它是一个普通主体 id，走完全相同的模型，没有特殊代码路径 |
| **空间 space** | 主体所属的世界，例如「中国企业家」或「火影」。用于隔离同名与跨世界关系，默认边不跨空间 |
| **域包 domain pack** | 建主体时选的预设，决定默认打开哪些域。`person` / `colleague` / `celebrity` / `self` 都是域包，**不是人的类型** |
| **内核面 core facet** | 七个所有人共用的画像面：身份、声音、内在、对人、边界、质地、时间。闭集，增删要升 schema |
| **域 domain** | 这个人生活里的一块，有材料才建：`vocation`（怎么做事）、`craft`、`intimacy`、`kinship`、`public` 等。开集 |
| **facet 路径** | claim 挂载点，开放点分命名，如 `voice.opener`、`texture.hands`、`psyche.contradiction.thrift-vs-gift`。新细节等于新路径，不升 schema |
| **claim** | 一条可溯源的人物判断：一句话 + 证据列表 + 置信度 + facet 路径。散文由 claim 渲染，不是反过来 |
| **材料 material** | 进过引擎的一份原始事实：一条消息、一封邮件、一篇网页、一份转写。落盘后有内容哈希 |
| **材料摘要 digest** | 材料的内容标识，格式 `src_` + 八位十六进制。claim 的证据引用它 |
| **材料集合哈希** | 一个主体当前全部材料摘要的顺序无关哈希。它没变就跳过蒸馏 |
| **摄入 ingest** | 把材料落盘、去重、计数、排队。**不产生画像** |
| **pending** | 材料已过边界、等人或等 daemon 去蒸的状态 |
| **draft** | 蒸馏的产出：claim 列表 + 各面 Markdown + 可选关系，尚未成为版本 |
| **提交 commit** | 校验 draft 并把它变成一个新版本 |
| **版本 version** | 某一时刻整份画像的快照。`current` 是当前生效的那一版；置信度下降的新版本进 `suspended`，等 `promote` 或 `reject` |
| **血缘 lineage** | 只追加的事件流，回答「第 N 版是从哪些材料、由谁、在什么时候产生的」 |
| **修正 correction** | 用户补充材料里没有的事实。它是最高信的材料，不是元数据 |
| **置信度 confidence** | 这条结论被材料支撑的程度，**不是**模型对自己文笔的把握 |
| **成熟度 maturity** | 画像的完整程度：`sparse` / `forming` / `stable` |
| **显著度 salience** | 这条 claim 有多能代表这个人。第一版写入但不据此裁剪 |
| **事实层 fact layer** | Markdown 与 jsonl。删掉就是丢记忆 |
| **投影 projection** | 从事实层派生、可随时重建的东西：`SKILL.md`、宿主身份文件、索引、目录 |
| **索引 index** | `.index/` 下的派生数据与工作队列。删掉不丢记忆 |
| **关系 relation** | 两个主体之间有证据的边：合伙、师徒、夫妻、同部作品。进事实层 |
| **相似 affinity** | 两个人在同一 facet 上足够像。派生物，第一版不做 |
| **提及 mention** | 材料里出现但没对上任何主体的名字。等人点一下对齐，**不自动猜** |
| **采集适配器 SourceAdapter** | 「材料从哪来」的缝。可以自己采，也可以只给宿主一份采集计划 |
| **宿主注入器 HostInjector** | 「画像怎么进到某个宿主」的缝 |
| **宿主 host** | 跑模型的那个程序：Claude Code、Codex、LangGraph、Hermes、Telegram 等 |
| **绑定 binding** | 把 distilly 接进某个框架的胶水层，负责在正确的生命周期点调用 |
| **Recall / Capture** | 绑定只需要两个动词：取出画像（Recall）、把新材料收进来（Capture） |
| **`EngineClient`** | 门面与引擎之间唯一的传输缝。第一版是进程内派发，面板出现时多一个 HTTP 实现（§11.2） |
| **改变通知 watch** | `EngineClient` 上的订阅。事件只说「哪个主体的什么变了」，是重读信号，不是可信状态（§16.2） |
| **面板 panel** | 浏览器里的图形界面，由本机回环 HTTP 服务提供。第一版可以没有（§16.3） |
| **TUI** | 终端里的长驻界面。架构上就是门面的普通调用方，没有特权（§16.4） |
| **LSN** | 队列里的单调序号，给顺序、公平性和积压量用 |

### 0.3 一句话架构

`~/.distilly/` 里的 Markdown 和 jsonl 是唯一事实；引擎把材料蒸成带证据的 claim、渲染成画像、留下版本与血缘；`Distilly` + `Person` 两个类是唯一对外面孔；模型、宿主插件、面板和 bot 是同一个引擎的四张脸。

---

## 1. 产品意图

起点不是「做一个 SDK」。起点是一个具体不满：给同事做的画像技能 scope 太小，应该把它做成**所有 agent 自带的 profile 层**。

**distilly = 用客观蒸馏，从已有事实生成可追溯的 personal memory / profile layer，再用一个瘦 SDK 接到 coding agent 和 bot 上。**

它不是「又一个 Claude 技能」。`SKILL.md`、`SOUL.md`、`agent.md` 都是投影。真相是引擎里的主体、材料、claim、版本和关系。

### 1.1 五条产品面

1. **前端面板与 Marketplace** — 给每个 agent 建 profile，从市场里选一份加载进来。
2. **用户自定义** — 在前端里改画像；材料可以从桌面浏览记录之类的地方加载。采集范围的**选择权归用户**，我们不替用户设限制。
3. **Evolving 与版本** — 持续改进人物性格，用户自己选加载哪一版。血缘必须在**版本粒度**看得见：这一版用到的一百个源里有哪些。
4. **Bot** — 可以先做。每个 bot 提前内置蒸出来的真人性格，不让 bot 自己编一份。用户 @ 它交互。
5. **先适配 Codex 和 Claude Code**，再铺开到别的宿主。

### 1.2 记谁

所有人。同事、亲人与关系、公众人物、动漫角色，以及使用者自己。`self` 与他人共用同一套模型，只是 id 特殊。

这条决定了画像不能按「同事」建模。一个母亲、一个已故作家、一个虚构角色，都要能装进同一套结构（§19）。

### 1.3 材料从哪来

宿主帮你扒网、截屏与导出、用户直接喂文件、用户自己纠正。四条路最后都汇进同一个 `ingest`。

### 1.4 谁负责蒸

默认是**宿主已经付过钱的那个模型**。用户不需要为了用 distilly 再买一份 API key。想让它在后台自动蒸，才需要给一把 LLM key（§6.3）。

---

## 2. 存储形态：为什么事实层是 Markdown

这一章从产品需求推出存储形态，并把被排除的形态写清楚。它存在的目的是让评审不必凭印象讨论「为什么不用向量库」。

### 2.1 分界线是「这份存储写给谁看」

选存储不是选新旧，是回答一个问题：**这份数据主要给谁打开。**

| 主要读者 | 该存什么 | 后果 |
|---|---|---|
| 人要打开、直接编辑 | 纯文本 | 可 diff、可 review、可手改，但没有查询能力 |
| 只有机器读，且数据量远超一次能加载的量 | 数据库或向量库 | 有查询能力，但用户无法直接改，改动无法 review |
| 两者都要 | 纯文本当事实 + 可删可重建的索引 | 两边都拿到，代价是要自己维护一致性 |

**我们的产品前提是用户要在面板里直接改画像**（§1.1 第 2 条），而且一份画像只有几 KB、整份都能进 context。这两条同时成立，就把答案钉死在第三行：**Markdown 与 jsonl 是事实，索引是投影**。这是需求推出来的，不是审美偏好。

一份画像的量级同时否掉了向量检索：几 KB 的文本整份注入，比先做召回再拼接更准，也更容易解释。检索要到市场规模才成为真问题（§22.3）。

### 2.2 三条从「纯文本 + 索引」这条路上必然会踩的坑

选了这条路，就要提前处理三件已知会出问题的事。

**坑一：客观事实与主观判断混在一份散文里，就再也拆不开。** 「他叫 X」是客观事实；「我认为他喜欢短回答」是带置信度的判断。混在同一段 Markdown 里，后者出错时无法单独修正，也无法回答「这句话凭什么」。**对策是把粒度做到单条判断**：每条 claim 自带 facet 路径、证据列表和置信度（§19.3），散文由 claim 渲染而来，不是反过来。只做到文件级是不够的——文件级只能回答「这个人的声音那一节来自哪些材料」，不能回答「『从不用「在吗」』这句凭什么」。

**坑二：把不可变用错地方，改一条要重建整份文件。** 内容哈希加只追加，是保证血缘可信的正确手段。但如果把**产物**也做成不可变链，那么用户改一个字都要重写整条链，面板里的编辑体验直接废掉。**对策是把不可变限制在血缘上：`lineage.jsonl` 只追加，画像产物随时可改**，版本快照负责保留历史。

**坑三：纯文本没有 schema，写着写着就没人守得住格式。** agent 生态里广泛使用的那类上下文文件（`AGENTS.md` / `CLAUDE.md` 这类约定）恰好证明了这一点：格式是共识而非规范，没有版本号，也没有可校验的约束。**对策是把 schema 放在文本旁边而不是文本里**：`meta.json` 带单调递增的 schema 版本，`claims.jsonl` 每行结构固定，读入时校验（§11.5 第三行），认不出的版本直接拒绝加载。

### 2.3 我们和「自带模型的记忆服务」的四点不同

另一类做法是把记忆做成一个自带模型调用的服务：它自己持有模型、向量、多模态、重排四类凭据，用户必须全部配好才能用。这条路我们不走，四点不同要写进 README 第一屏，因为这是用户第一眼就会比较的东西。

| | 自带模型的记忆服务 | 我们 |
|---|---|---|
| 凭据 | 四类必填：模型、向量、多模态、重排 | **默认零 key**，用宿主已经付过钱的模型蒸（§6.3） |
| 主体 | 通常只给使用者本人做一份 | 多主体：他人、亲人、公众人物、虚构角色、`self` 同一套模型 |
| 历史 | 单份画像持续覆写，改了就没了 | 版本 + 血缘，可回滚、可对比、可挂起 |
| 分享 | 私有 | 可导出成宿主身份文件，以后可上市场 |

「默认零 key」不是省钱技巧，是产品可用的前提：要求用户为了记住一个同事先去申请四类 API，绝大多数人会在这一步流失。

### 2.4 采纳与排除的存储机制

下面每条都是本设计的决定，写在这里是为了让后续实现不必重新论证。**「采纳」表示这个机制进第一版；「排除」表示明确不做，且不接受以「顺手加一下」的形式回来。**

| 机制 | 取舍 | 理由 |
|---|---|---|
| 三层：Markdown 事实 + SQLite 状态队列 + 可重建索引 | 采纳 | §2.1 推出的结构，也是 §3.1 的直接后果 |
| 队列表带 `processing` 认领守卫 | 采纳 | 崩溃后必须能回收孤儿认领，否则作业永久卡住（§12.2） |
| 失败三态：可重试 / 不可重试 / 未失败 | 采纳 | 「被限流」和「YAML 写坏了」的处置完全不同，压成一个布尔值就只能全部重试或全部放弃 |
| 队列表用部分索引 | 采纳 | 索引只覆盖未完成行，表不随历史增长 |
| 写强一致、读最终一致 | 采纳 | 事实层在事务里写完，索引允许落后。这条必须写进文档，不能留给用户自己撞 |
| 对外状态机比内部小 | 采纳 | 外部只看 `pending` / `done` / `failed`；`processing` 是内部状态，暴露出去会让调用方依赖时序 |
| 合并式重写 + 软废弃旧结论 | 采纳方向 | 改到几十版之后，逐条追加会让画像碎片化 |
| 索引损坏时拒绝退化成全文扫描 | 采纳 | 假可用比不可用更糟：用户会以为搜过了 |
| 单份画像覆写 | 改造后采纳 | 保留「当前只有一份」的简单性，但 `current` 是指向某个版本的指针，不是唯一存在 |
| 事件流水账（每条对话存一行） | 排除 | 我们的主体是人不是事件；流水账会让画像被最近的噪声主导 |
| 向量召回 + 多段融合排序 | 排除 | 第一版整份画像进 context（§22.1） |
| 让不同类型的记忆在同一排序空间里竞争 | 排除 | 会出现一条八卦顶掉一条工作事实（§22.4） |
| 四类必填凭据 | 排除 | 与 §2.3 的产品前提冲突 |
| 把采集器写死在仓库里 | 排除 | 主路径是宿主采 + 用户喂；采集器留缝给社区（§13） |

---

## 3. 设计哲学

一条原则如果没有对应的**拒绝**，它就只是口号。所以每条都写明它禁止什么。

### 3.1 Markdown 是唯一事实来源

其余一切都是投影，且必须可从事实层重建：版本快照、血缘、`SKILL.md` 的 frontmatter、索引、面板看到的一切。

**拒绝：** 把画像状态放进云端数据库。这是我们与「托管后端」类产品的根本分歧。

### 3.2 可追溯是一等公民，不是元数据装饰

每个版本都要能回答：我从哪些材料蒸出来、置信多少、覆盖多完整。来源信息进版本快照，另有只追加的血缘事件流；快照被裁剪之后血缘仍在。

**拒绝：** 只在最新版本上记血缘。回滚会让血缘与产物错位。

### 3.3 默认惰性，显式启用

任何有副作用的能力，在没有被显式配置之前应当完全不动，**包括不打扰用户**。遥测没有配置端点就不问也不发。后台蒸馏必须显式给 key。

**拒绝：** 「默认开启 + README 教你怎么关」。受益方是我们，就不该由用户承担默认成本。

### 3.4 不为度量扭曲产品

模型读一份画像文件时不执行代码，所以「这份人格被用了几次」根本数不到。文档里就直说遥测数的是**创作活跃度**，不是使用活跃度。

**拒绝：** 在画像投影里塞一个必须调用的工具来凑使用量。

### 3.5 地基不压在会腐烂的接口上

越靠近宿主内部机制的东西越不能承重。插件第一版可以完全没有面板：纯 MCP 加宿主原生表单。宿主的预览、卡片和子进程 API 会在小版本里消失。

**拒绝：** 先做面板再做引擎。委托采集故意烂在宿主技能里，不烂在仓库里。

### 3.6 选择权归用户

Agent 的权限比普通软件大，我们不替用户设采集限制，但每个选择必须显式可见。采集器逐个 opt-in。遥测在交互式终端问一次并记住；**非交互运行一律拒绝且不落盘**。

**拒绝：** 把「非交互时的拒绝」写进配置文件——那会让用户永远不再被问到。

### 3.7 蒸馏是客观的

从已有事实里抽出结构，不是再采样一次主观印象。温度计读数有波动，不代表温度是主观的。

七条推论，每条都可测：

1. 材料没变而输出变了是 **bug**，要有测试。
2. **置信度 = 这条结论被材料支撑的程度**，不是模型对自己文笔的把握。
3. **每条 claim 的证据不是可选项**：不能溯源的判断就是模型编的。所以先写 claim，再渲染散文。
4. 新版本置信度**下降本身是异常**：材料只会增加，支撑只应变强。挂起等人处理。
5. 材料集合哈希没变 → **跳过蒸馏**。客观意味着幂等。
6. 用户纠正是**他补了材料里没有的事实**，必须变成材料存进 `corrections/`。修正后重蒸仍然冲突，去查提示词或解析，不要改结论。
7. 采样噪声要**压**：降温度、固定采样、结构化字段做一致性校验。不当成系统固有属性去容忍。

**拒绝：** 把重跑差异说成「模型的创造性」。

### 3.8 不随部署变化的东西不要给旋钮

用户该调的是「要不要后台自动蒸」，不是检索融合的权重。给出不该调的旋钮是在制造事故。

**拒绝：** 把算法超参数放进用户配置文件。

### 3.9 类型是可执行的合同

「协议冻名字、只加不改」这条规矩，靠人评审会漏，靠编译器不会。带品牌的 id 让主体 id 不能当版本 id 传；判别联合加穷尽检查让新增一个状态就必须处理每一处分支。

**拒绝：** 在同进程、类型已知的边界上补运行时校验和兜底分支。校验只发生在 §11.5 列出的六道真实边界上。

### 3.10 门禁跟着构建产物走，不只跟着源码

这一类项目最常见的事故是「源码测试全绿，发布出去的包 import 不进来」：导出映射写错、类型没随包发、模块解析条件踩坑。所以发布路径要有自己的门禁（§24.2）。

**拒绝：** 只跑单元测试就宣布可发布。

### 3.11 零原生依赖

队列和索引用运行时内置的 SQLite，不用需要预编译的原生模块。用户装 distilly 不应该触发编译工具链，插件宿主的运行时版本也不由我们决定。

**拒绝：** 为了性能引入需要预构建的数据库模块；第一版还没有能证明需要它的负载。

---

## 4. 语言与运行时：为什么 TypeScript

### 4.1 决策

**产品代码是 TypeScript，ESM only，Node `^22.19 || >=24`。**

### 4.2 六条理由

1. **四张脸里三张的宿主本来就是 Node。** 两个 coding agent 的插件、以后的面板都在 TypeScript 与 Web 里。产品核心用别的语言，等于把协议写两遍，而两份手写副本一定会漂。
2. **模型那张脸的生态在 TypeScript 上最完整。** 标准输入输出的工具服务器、工具入参 schema、卡片能力，都优先在这里落地。
3. **分发。** 一条 `npx` 命令就能跑，而 Node 已经随两个目标宿主装在用户机器上了。换成需要解释器版本、虚拟环境和多种包管理器的语言，安装说明会比产品长。
4. **类型能承重**（§3.9）。
5. **运行时内置 SQLite。** 队列和图索引零原生依赖（§3.11）。
6. **治理工具成熟。** §24 那套门禁在这个生态里有现成实现，不必自己写第二套。

### 4.3 代价，写明白

- 已有的 Python 蒸馏与安装链**不能直接复用**。提示词是纯文本可以搬；采集脚本要重写或退役（§25）。
- OCR、语音转写、文档解析在 Python 生态更强。对策：解析器是**可替换的外部进程**，不进主路径；没解析成文本的材料不进蒸馏——这本来就是产品规则。
- 一段时间内仓库是双语言，门禁要双跑。这是有期限的代价，不是长期结构。
- 只会 Python 的贡献者，第一版能改的是提示词和文档。

### 4.4 被拒绝的替代

| 替代 | 为什么不选 |
|---|---|
| 继续用 Python 写核心 | 插件和面板迟早要第二语言，协议写两遍，两套门禁长期并存 |
| Python 引擎 + TypeScript 插件壳 | 两个事实源；跨进程协议在第一版就被迫变成公开合同，而 §5.1 项 18 已定第一版进程内 |
| Rust 或 Go 引擎 + TypeScript 壳 | 分发和宿主插件生态不匹配；贡献门槛高；内置 SQLite 的零依赖优势消失 |
| 只把模型那一层写成 TypeScript，引擎留 Python | 那是最薄的一层，值不回两语言的成本；而且 `commit` 的校验必须和引擎同侧 |
| 把提示词改写成 TypeScript 字符串常量 | 提示词是文本资产，引擎读文件就行 |

---

## 5. 已锁定 / 仍开放 / 本版冻结

### 5.1 已锁定（要改必须写新 Agent Note，并写明被打败的方案）

1. 独立产品与存储边界。技能只是分发形态，不是产品边界。
2. Markdown 与 jsonl 是事实。SQLite 是派生索引与队列状态，可删可重建。
3. 蒸馏客观。集合哈希没变就跳过。输出漂是缺陷。
4. 默认零 key。无 key 时只标 pending 由宿主 `commit`；有 key 时 daemon 也走同一个 `commit`。
5. 要处理多模态，**但不要必填多模态 key**。未解析成文本的不进蒸馏。
6. 采集留缝给社区。第一版主路径是宿主 `ingest`。仓库里不写任何厂商的官方采集 API。
7. 绑定只有 **Recall / Capture** 两个动词。自动路径挂宿主生命周期钩子，不指望模型记得调工具。
8. 用户纠正必须变成证据：进 `corrections/`、立刻出新版本、参与下次蒸馏。置信度下降挂起，等 `promote` / `reject`。
9. 对外只有 `Distilly` + `Person`。七组能力是内部模块，但**清单要留着**（§9）。
10. 一个引擎、**四张脸**：模型工具 / 宿主插件 / 交互式界面 / Bot。交互式界面有两种呈现——TUI 与浏览器面板（§16），共用同一份聚合与同一个传输缝，不算成两张脸。
11. 临时人格用 `get` / `prompt` 塞进**这一次子运行**。禁止写全局指令文件。
12. 完整画像整段塞。第一版不做显著度裁剪。塞不下就报错，不准偷偷裁。
13. 画像 = 闭内核 + 开域 + 带证据 claim。不要顶层「工作档 + 性格档」两分。
14. `colleague` / `celebrity` 是默认域包，不是人的类型。默认入口是 `person`。
15. 图第一版只做**关系**，不做「相似」。加节点 O(1)，接关系 O(k)，禁止每次提交做全图两两比较。
16. Bot 是一种装法，不准自建人格文件。一个 bot 第一版钉一个主体加一个版本。
17. 插件只装清单与技能，业务在本机引擎；不做托管后端与登录。验收：不登录也能蒸公开人物并 `get`。
18. 第一版进程内引擎。换成守护进程时方法名不变。面板服务器随 `distilly panel` 这条命令起停，**不是**常驻守护进程，CLI 也不连它（§16.6）。
19. 协议冻名字。工具名、材料字段、错误码只加不改。
20. **产品代码是 TypeScript**（§4）。公开 API 全异步（§11.1）。
21. **零原生依赖。** 队列与图索引用运行时内置 SQLite。
22. **界面只渲染，不派生产品事实。** 置信度、成熟度、覆盖度只能读引擎给的值；界面自己算一个等于产品有了第二个答案。屏幕需要的聚合先进 §9 与 §11，再被界面消费（§16.5）。
23. **`EngineClient.watch` 是必填成员，事件是重读信号。** 每个事件对应一次已落盘的写入，载荷只够定位，不带内容；`kind` 是可扩展联合，消费者留 default 分支（§16.2）。
24. **面板服务器只绑回环、带一次性令牌、校验 `Origin`、端口被占就退出。** 它的写入走 `/rpc` 上与 `EngineClient` 同名的方法，绝不直接写 `~/.distilly`（§16.3）。

### 5.2 仍开放

| # | 问题 | 倾向 |
|---|---|---|
| A | `create` 时材料必须属于谁 | 必须指明。归属推断第二版 |
| B | marketplace 形态 | 第二版。引擎先留导出与版本标识 |
| C | 公众人物肖像与同意 | 产品政策，不进第一版引擎 |
| D | Bot 先做哪个宿主 | 一个已有画像目录约定的宿主更省事；一个成熟聊天平台的 UI 现成 |
| E | 宿主内嵌浏览器能不能开本机回环地址 | 一个宿主已确认可以；另一个未实测。不影响面板本身的设计（§16.3），影响的只是「谁来打开这个地址」——最差情况让用户自己粘到系统浏览器 |
| F | 仓库与环境变量改名 | npm 包名已在 §7 冻结；仓库改名与统一 `DISTILLY_*` 待定 |
| K | 校验库是否长期用 `zod` | 第一版用它写 §11.5 的六道边界。若打包体积成为面板瓶颈，再评估更小的替代 |
| M | TUI 用哪个终端渲染库 | 取决于第一屏做多复杂；四屏只读的话手写 ANSI 也够。这一项不影响 §16 的任何接口 |

### 5.3 本版冻结的三项

这三项在上一版是开放的，直接阻塞实现，现在关闭。**不做兼容重载，不保留第二种形状。**

**冻结一：`create` 与 `commit` 各一种签名。** 以 §11 为准，§9 的能力表只是内部动词清单，不是签名来源。

- `Distilly.create(input: CreateSubjectInput)`：域包字段承担旧 `kind` 的角色，显示名字段承担旧 `name`。
- `Distilly.commit(input: CommitInput)`：来源信息**不是独立参数**。它由 `jobId` 对应的材料集合、draft 里的集合哈希和 `actor` 三者共同确定，引擎自己写入元数据与血缘。**调用方无法伪造血缘。**

**冻结二：`correct` 是确定性引擎路径，不调模型。** 它只做四件事：把原文写成 `corrections/` 里一条材料、生成一条置信度为 1 的 claim（facet 由调用方给，缺省 `corrections.unassigned`）、重渲染受影响的那一面、提交新版本。

把一句自然语言拆成多条精确 claim 属于蒸馏，由宿主或 daemon 在**下一次** `commit` 完成——修正材料改变了集合哈希，所以下一次蒸馏一定不会被跳过。宿主可以先用自己的模型把用户原话解析成 facet 再调 `correct`，但落盘、claim 变更和版本提交由引擎验证。

**冻结三：邻居查询走事实层 jsonl 加可重建投影。**

- 关系日志是事实，只追加，失效写截止时间。
- 投影建在 `(主体, 类型)` 上，邻居查询 O(k)。
- 删掉索引后由关系日志单遍重建，O(边数)。
- **禁止**在建边或提交的热路径上扫描整个日志或整张图。

---

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

## 7. 包切分与依赖方向

pnpm workspaces，九个包。最后三个（`tui` / `panel` / `governance`）都是叶子：删掉任何一个，其余包照样编译、照样测试。

```
distilly/
├── package.json                    私有根：workspaces + 全部门禁脚本
├── pnpm-workspace.yaml
├── tsconfig.base.json              严格编译选项的唯一来源
├── tsconfig.json                   solution 文件，只列 references
├── eslint.config.js  vitest.config.ts  knip.json
├── packages/
│   ├── protocol/                   @distilly/protocol —— 共享词汇
│   │   └── src/
│   │       ├── ids.ts              Branded 工具与全部 id 类型
│   │       ├── values.ts           §10 的全部值类型
│   │       ├── methods.ts          方法名常量：subjects.* materials.* distill.* profile.* graph.* hosts.*
│   │       ├── errors.ts           错误码闭集与 DistillyError
│   │       ├── schemas.ts          跨边界输入的校验 schema（§11.5）
│   │       └── mcp.ts              五个工具的名字与入参 schema
│   ├── engine/                     @distilly/engine —— 车
│   │   └── src/
│   │       ├── store/              layout, subject, material, catalog
│   │       ├── queue/              schema, service（LSN、认领守卫）
│   │       ├── distill/            hasher, runner, validator, commit, prompts
│   │       ├── profile/            schema, render, migrate
│   │       ├── graph/              relations, mentions
│   │       ├── version/            snapshot, lineage
│   │       ├── project/            skill, host
│   │       ├── telemetry.ts
│   │       └── inProcess.ts        实现 EngineClient 的进程内派发
│   ├── adapters/                   @distilly/adapters
│   │   └── src/                    base.ts, registry.ts, builtin/web.ts
│   ├── bindings/                   @distilly/bindings
│   │   └── src/                    protocol.ts, claude.ts, codex.ts, langgraph.ts,
│   │                               openaiAgents.ts, hermes.ts, telegram.ts, registry.ts
│   ├── cli/                        @distilly/cli
│   │   └── src/                    bin.ts（distilly …）, mcp.ts（stdio 服务器）,
│   │                               panel.ts（回环 HTTP + SSE，§16.3）
│   ├── tui/                        @distilly/tui —— 可删的终端界面（§16.4）
│   │   └── src/                    app.ts 与四个屏；只用门面，不碰引擎内部
│   ├── panel/                      @distilly/panel —— 可删的面板静态资源
│   │   └── src/                    浏览器侧；只通过 /rpc 与 /events 说话
│   ├── governance/                 @distilly/governance
│   │   └── src/                    verifyDocs, verifyNotes, syncDesign, runGates
│   └── distilly/                   distilly —— 用户实际安装的门面包
│       └── src/
│           ├── index.ts            只导出 Distilly, Person, 错误, 值类型
│           ├── api.ts              Distilly / Person 的产品面
│           └── client.ts           EngineClient 接口与 openInProcess
├── plugin/
│   ├── marketplace.json
│   ├── codex/                      .codex-plugin/plugin.json + .mcp.json + skills/
│   └── claude/                     .claude-plugin/plugin.json + skills/
├── examples/
├── docs/  .agents/  .github/  .githooks/
└── tools/ prompts/ skills/ tests/  ← 冻结的 Python 遗产（§25）
```

### 7.1 依赖方向是单向的

```
protocol  ←  engine  ←  distilly  ←  bindings
    ↑           ↑           ↑   ↖
 adapters      cli   ────────┘    tui
governance 只依赖 protocol 与运行时内置模块
panel 只依赖 protocol 的类型，运行时只认 HTTP
```

六条规则：

- **`@distilly/protocol` 是共享词汇的唯一家。** 值类型放在客户端包里会逼引擎向上依赖自己的消费者，那是反的。
- **`distilly` 是门面包，不是第二套 API。** 它拥有 `Distilly` / `Person` 的实现和 `openInProcess`；换成守护进程传输时只换 `client.ts`。
- **深用要显式依赖。** 采集计划、`promote`、适配器注册表不从门面根导出，要用就依赖 `@distilly/engine` 或 `@distilly/adapters`。
- **界面包在最外层，没有包指回它们。** `tui` 依赖门面，`panel` 只依赖 `protocol` 的类型（运行时通过 HTTP 说话），`cli` 提供面板服务器但**不依赖** `panel` 的构建产物：资源缺失时 `distilly panel` 报错并说明怎么装，不服务一个空白页。
- **界面不许 import `@distilly/engine`。** 绕过门面就绕过了 §11.5 的校验和 §16.5 的聚合归属。这一条由未声明依赖门禁机械拦住。
- **每个包一个编译配置**，只 reference 它真正依赖的包。仓库级程序（门禁、脚本）用单独的配置，不挂在 solution 上。

未用导出和未声明依赖由门禁检查（§24.2），所以依赖回环会变成一条机械报错，而不是评审意见。

---

## 8. 家目录与磁盘格式

家目录是 `~/.distilly/`，用 `DISTILLY_ROOT` 覆盖。**这份布局与语言无关**，换实现语言不改动它。

```
~/.distilly/
├── distilly.toml                      # 根配置（无 key 也能跑）
├── adapters.toml                      # 凭据引用；真正的 secret 由框架保管
├── spaces/
│   ├── entrepreneurs.china.toml        # 显示名、是否虚构、默认域包
│   └── anime.naruto.toml
├── subjects/
│   └── <subject-id>/                   # self / wang-xing / luffy
│       ├── manifest.json               # 身份、别称、域包、所属空间
│       ├── meta.json                   # schema 版本、来源摘要、材料集合哈希、生命周期
│       ├── SKILL.md                    # 投影，可重建，不是事实
│       ├── profile/
│       │   ├── identity.md             # 七个内核面，空是合法状态
│       │   ├── voice.md
│       │   ├── psyche.md
│       │   ├── relations.md
│       │   ├── boundaries.md
│       │   ├── texture.md
│       │   ├── timeline.md
│       │   ├── domains/                # 有材料才建
│       │   │   ├── vocation.md
│       │   │   ├── craft.md
│       │   │   ├── intimacy.md
│       │   │   ├── kinship.md
│       │   │   └── public.md
│       │   └── claims.jsonl            # 每行一条 Claim
│       ├── knowledge/
│       │   ├── messages/  emails/  docs/  web/  transcripts/
│       │   ├── raw/                    # 图/PDF/音频；未转文本不进蒸馏
│       │   └── corrections/            # 最高信材料
│       ├── versions/
│       │   ├── vN/                     # 当时整个 profile/ + SKILL.md + meta.json
│       │   └── vN-awaiting/            # 置信度下降、未顶替 current
│       ├── lineage.jsonl               # 只追加
│       └── state.json                  # pending / awaiting_promote / 上次集合哈希
├── relations/
│   └── <a>__<b>/                       # 仅当「这段关系本身也值得蒸一版画像」时才升级成目录
├── graph/
│   └── relations.jsonl                 # 关系事实层，只追加 + 失效时间
└── .index/                             # 可删可重建
    ├── sqlite/
    │   ├── queue.db                    # 三条队列 + LSN
    │   └── graph.db                    # 节点、关系、提及投影
    └── catalog.json                    # 列表与搜索投影
```

### 8.1 三条磁盘约束

- **`state.json` 是事实层，`queue.db` 是它的工作副本。** 删掉 `.index/` 之后，队列由每个主体的 `state.json` 与材料清单重建，**不丢记忆**。
- **schema 版本单调递增。** 画像与队列各有一个版本号，写在 `@distilly/protocol` 与队列 schema 里。后端**拒绝**不认识的旧格式，不做静默升级（发布前没有外部消费者，纠正格式比背兼容包袱便宜）。
- **安装只写投影。** 血缘和材料不搬家：

```
~/.distilly/subjects/<id>/        ← 唯一事实
        │  install("claude-code")
        ▼
~/.claude/skills/<id>/SKILL.md    ← 投影，可再生成
```

如果某个宿主确实需要「工作档 / 性格档」两个文件，那是 **install 时的切片**，不是家目录里的结构。

---

## 9. 七组产品能力（内部清单）

七组是**怕漏**，不是用户 API。面板、市场、批准流程没有这些动词做不出来。签名以 §11 为准；下面的括号只表示这个动词需要哪些信息。

对外第一眼仍然只有 `Distilly` + `Person`。README 第一屏只写 `get`、`ingest`、`ingestFiles`、`correct`、`install`、`link`、`neighbors`，外加 `Distilly.pending` / `commit`。

### 9.1 主体

| 动词 | 做什么 |
|---|---|
| `create(域包, 显示名, 身份字段)` | 建一个主体。域包决定默认打开哪些域 |
| `list(按空间/按域包过滤)` | 有哪些人 |
| `get(主体, 版本?)` | 结构化画像。Recall 用这个 |
| `search(查询)` | 按名字、别称、标签 |
| `delete(主体)` | 软删除，**不物理抹掉血缘** |

`self` 用域包 `self` 建一次即可，之后与他人无差别。

### 9.2 收集

| 动词 | 做什么 |
|---|---|
| `ingest(主体, 材料[])` | 所有路径汇合：落盘、哈希、去重、过边界 |
| `ingestFiles(主体, 路径[])` | 用户直接丢文件 |
| `listAdapters()` | 已注册的来源 |
| `resolveSubject(适配器, 查询)` | 这个平台上「他」是谁；**多候选不猜** |
| `planCollect(...)` | 委托型：给宿主一份采集计划 |
| `acceptCollect(计划, 产物[])` | 把宿主交回的产物转成材料并内部 ingest |
| `collect(...)` | 直采型自己采（第一版可不实现） |
| `preflight(适配器)` | 凭据在不在，别白排一次队 |

宿主自己扒网收成文本，直接 `ingest`，不必经过适配器。

### 9.3 蒸馏与修正

| 动词 | 做什么 |
|---|---|
| `pending()` | 已过边界、等着被蒸的作业 |
| `flush(主体)` | 现在就过边界 |
| `commit(作业, draft)` | 交回结果；置信度下降则进挂起 |
| `promote` / `reject` | 处理挂起的版本 |
| `correct(主体, 修正)` | 写进 `corrections/` 并立刻出新版本（§5.3 冻结二） |
| `status(主体)` | 材料数、集合哈希、队列态、置信度、成熟度 |

### 9.4 版本

| 动词 | 做什么 |
|---|---|
| `versions(主体)` | 版本列表 + 每版来源摘要 |
| `diff(主体, a, b)` | 两版差异 |
| `rollback(主体, 版本)` | 恢复为当前；血缘记一次回滚事件，**不删历史** |
| `lineage(主体, 版本?)` | 版本粒度的源清单 |

### 9.5 装载

| 动词 | 做什么 |
|---|---|
| `prompt(主体, 版本?)` | 只给模型看的字符串，不落宿主目录。临时人格用这个 |
| `export(主体, 宿主, 目标)` | 一对一身份文件 |
| `install(主体, 宿主)` | 写进该宿主的技能根目录。实现必须是「宿主 id → 安装器」，**不能写死某一家的路径** |
| `uninstall(主体, 宿主)` | 去掉投影，不动家目录 |

### 9.6 市场（接口留着，实现第二版）

`browse` / `pull` / `publish`。**不进模型工具，不进 README 第一屏。**

### 9.7 关系

`link` / `invalidate` / `neighbors` / `path` / `subgraph` / `mentions` / `resolveMention`。

`similar` 与全图重建留给以后的「相似」，第一版不做（§21.1）。

---

## 10. 值类型

全部住在 `@distilly/protocol`。落盘用同一套字段名，不做第二种命名。

### 10.1 品牌 id 与枚举

```ts
declare const brand: unique symbol;
/** 让不同用途的字符串 id 在编译期不可互换。 */
export type Branded<T, B extends string> = T & { readonly [brand]: B };

export type SubjectId      = Branded<string, "SubjectId">;
export type VersionId      = Branded<string, "VersionId">;
export type JobId          = Branded<string, "JobId">;
export type RelationId     = Branded<string, "RelationId">;
export type MentionId      = Branded<string, "MentionId">;
export type SpaceId        = Branded<string, "SpaceId">;
/** 材料内容标识，格式 `src_` + 八位十六进制。 */
export type MaterialDigest = Branded<string, "MaterialDigest">;

export type HostName =
  | "claude-code" | "codex" | "langgraph"
  | "openai-agents" | "hermes" | "telegram";

export type Actor         = "host" | "daemon" | "user";
export type Maturity      = "sparse" | "forming" | "stable";
export type VersionStatus = "current" | "suspended" | "rejected" | "historical";
export type QueueKind     = "ingest" | "distill" | "index";
/** 对外状态机；`processing` 是引擎内部状态，不出现在这里（§12.2）。 */
export type QueueState    = "pending" | "done" | "failed";

export type CoreFacetName =
  | "identity" | "voice" | "psyche"
  | "relations" | "boundaries" | "texture" | "timeline";
```

### 10.2 证据与 claim

```ts
export interface EvidenceRef {
  readonly materialDigest: MaterialDigest;
  readonly quote?: string;
  readonly path?: string;
}

export interface Claim {
  readonly id: string;
  /** 开放点分路径，如 voice.opener / texture.hands。新细节不升 schema。 */
  readonly facet: string;
  readonly text: string;
  /** 空证据是无效 claim（§3.7 推论 3）。 */
  readonly evidence: readonly EvidenceRef[];
  /** 材料支撑度 0..1，不是文笔自评。 */
  readonly confidence: number;
  /** 第一版写入但不据此裁剪。 */
  readonly salience: number;
  readonly domain?: string;
  readonly observedIn: readonly string[];
  readonly validFrom?: string;   // ISO 8601
  readonly validTo?: string;
}
```

`claims.jsonl` 每行就是一条 `Claim`。一条真实 claim 长这样：

```json
{"id":"clm_8f3a","facet":"voice.opener",
 "text":"语音开场几乎总是「喂——你听得到吗」，从不用「在吗」",
 "evidence":[{"materialDigest":"src_a1b2"},{"materialDigest":"src_c3d4"}],
 "confidence":0.86,"salience":0.9,"observedIn":["voice-note","late-night"]}
```

### 10.3 画像

```ts
export interface CoreFacet   { readonly name: CoreFacetName; readonly markdown: string }
export interface DomainFacet { readonly name: string;        readonly markdown: string }

export interface Profile {
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly core: readonly CoreFacet[];
  readonly domains: readonly DomainFacet[];
  readonly claims: readonly Claim[];
  readonly confidence: number;
  readonly maturity: Maturity;
  /** 整份中性 Markdown，注入用的就是它。 */
  readonly rendered: string;
}

export interface FacetDiff {
  readonly facet: string;
  readonly added: readonly Claim[];
  readonly removed: readonly Claim[];
  readonly changed: readonly { readonly before: Claim; readonly after: Claim }[];
}

export interface ProfileDiff {
  readonly from: VersionId;
  readonly to: VersionId;
  readonly facets: readonly FacetDiff[];
  readonly confidenceDelta: number;
}
```

### 10.4 材料与摄入

```ts
export interface MaterialIn {
  readonly kind: string;        // message / email / document / web / transcript / correction
  readonly content: string;     // 进蒸馏必须已经是文本
  readonly sourceId?: string;
  readonly occurredAt?: string;
  readonly participants?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Material extends MaterialIn {
  readonly digest: MaterialDigest;
  readonly subjectId: SubjectId;
  readonly storedAt: string;
  /** raw/ 下尚未转成文本的材料为 false，它不参与蒸馏。 */
  readonly distillable: boolean;
}

export interface IngestResult {
  readonly kind: "ingested";
  readonly accepted: readonly MaterialDigest[];
  readonly duplicates: readonly MaterialDigest[];
  readonly unparsed: readonly MaterialDigest[];
  readonly materialSetHash: string;
  /** 过了边界就带上新排的作业。 */
  readonly job?: PendingJob;
}
```

### 10.5 蒸馏与版本

```ts
export interface RelationDraft {
  readonly other: SubjectId | { readonly rawName: string };
  readonly type: string;
  readonly evidence: readonly EvidenceRef[];
  readonly confidence?: number;
  readonly role?: Readonly<Record<string, string>>;
}

export interface DistillDraft {
  /** 必须等于引擎当前算出的集合哈希，否则拒绝提交。 */
  readonly materialSetHash: string;
  readonly claims: readonly Claim[];
  readonly coreMarkdown: Readonly<Partial<Record<CoreFacetName, string>>>;
  readonly domainMarkdown: Readonly<Record<string, string>>;
  /** 不带这个，批量蒸完图是空的（§21.2）。 */
  readonly relations?: readonly RelationDraft[];
  readonly notes?: string;
}

export interface PendingJob {
  readonly id: JobId;
  readonly subjectId: SubjectId;
  readonly kind: QueueKind;
  readonly materialSetHash: string;
  readonly materialCount: number;
  readonly queuedAt: string;
  readonly lsn: number;
}

export interface Version {
  readonly id: VersionId;
  readonly subjectId: SubjectId;
  readonly parentId?: VersionId;
  readonly actor: Actor;
  readonly materialSetHash: string;
  readonly confidence: number;
  readonly status: VersionStatus;
  readonly createdAt: string;
}

export type LineageEventKind =
  | "ingested" | "distilled" | "committed" | "corrected"
  | "promoted" | "rejected" | "rolled_back";

export interface LineageEvent {
  readonly kind: LineageEventKind;
  readonly at: string;
  readonly actor: Actor;
  readonly versionId?: VersionId;
  readonly materials: readonly MaterialDigest[];
  readonly note?: string;
}

export interface SubjectStatus {
  readonly subjectId: SubjectId;
  readonly materialCount: number;
  readonly materialSetHash: string;
  readonly queue: QueueState;
  readonly currentVersion?: VersionId;
  readonly awaitingVersion?: VersionId;
  readonly confidence: number;
  readonly maturity: Maturity;
  /** 七个内核面里有 claim 支撑的那些（§20.2）。 */
  readonly coveredFacets: readonly CoreFacetName[];
}
```

### 10.6 主体与关系

```ts
export interface CreateSubjectInput {
  readonly subjectId: string;
  readonly space: string;
  readonly displayName: string;
  readonly domainPack?: string;        // 默认 "person"
  readonly aliases?: readonly string[];
}

export interface CommitInput {
  readonly jobId: JobId;
  readonly draft: DistillDraft;
  readonly actor?: Actor;              // 默认 "host"
}

export interface SubjectSummary {
  readonly subjectId: SubjectId;
  readonly space: SpaceId;
  readonly displayName: string;
  readonly domainPack: string;
  readonly maturity: Maturity;
  readonly currentVersion?: VersionId;
}

export interface Relation {
  readonly id: RelationId;
  readonly space: SpaceId;
  readonly a: SubjectId;
  readonly b: SubjectId;
  /** 开放点分：work.invested / canon.rival / fanon.* */
  readonly type: string;
  /** 方向性用角色表达，例如 { src: "invested", dst: "founded" }。 */
  readonly role?: Readonly<Record<string, string>>;
  readonly evidence: readonly EvidenceRef[];
  readonly confidence: number;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly extractedFrom?: VersionId;
}

export interface RelationGraph {
  readonly nodes: readonly SubjectSummary[];
  readonly edges: readonly Relation[];
  readonly truncated: boolean;
}

export interface PendingMention {
  readonly id: MentionId;
  readonly rawName: string;
  readonly context: string;
  readonly subjectHint?: SubjectId;
}
```

### 10.7 适配器与宿主

```ts
export interface AdapterCapabilities {
  readonly kinds: readonly string[];
  readonly needsCredentials: boolean;
  readonly canResolveSubject: boolean;
  readonly incremental: boolean;
}

export interface AdapterConfig {
  /** 名字以 token / secret / key 结尾的字段按秘密处理，不落日志。 */
  readonly fields: Readonly<Record<string, string>>;
}

export interface PreflightResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
  readonly remediation?: string;
}

export interface SubjectRef {
  readonly adapterId: string;
  readonly externalId: string;
  readonly displayName: string;
  readonly confidence: number;
}

export interface CollectRequest {
  readonly since?: string;
  readonly until?: string;
  readonly kinds?: readonly string[];
  readonly limit?: number;
}

export interface AgentPlan {
  readonly kind: "plan";
  readonly adapterId: string;
  readonly subject: SubjectRef;
  /** 交给宿主模型执行的步骤，纯文本。 */
  readonly steps: readonly string[];
  readonly expectedArtifacts: readonly string[];
}

export interface Injection {
  readonly instructions: string;
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly displayName: string;
}

export interface HostSpawnRequest {
  readonly instructions?: string;
  readonly tools?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface InstallRef {
  readonly host: HostName;
  readonly path: string;
  readonly versionId: VersionId;
}
```

---

## 11. 公开 API

### 11.1 异步模型

**公开方法全部返回 `Promise`，没有同步孪生。** 引擎在启动时可以做一次性同步读取，但任何会被宿主事件循环等到的操作都是异步的：同步文件 I/O 会卡住插件宿主。

### 11.2 `Distilly`

```ts
export interface DistillyOptions {
  readonly root?: string;        // 默认 ~/.distilly，或 DISTILLY_ROOT
  readonly client: EngineClient; // 显式传入，不在构造器里偷偷造一个引擎
}

export class Distilly {
  constructor(options: DistillyOptions);

  person(subjectId: string, options?: { readonly space?: string }): Person;
  create(input: CreateSubjectInput): Promise<Person>;
  list(filter?: { readonly space?: string; readonly domainPack?: string }): Promise<SubjectSummary[]>;
  search(query: string): Promise<SubjectSummary[]>;
  delete(subjectId: string): Promise<void>;

  pending(filter?: { readonly subjectId?: string }): Promise<PendingJob[]>;
  commit(input: CommitInput): Promise<Version>;
  promote(versionId: VersionId): Promise<Version>;
  reject(versionId: VersionId, options?: { readonly reason?: string }): Promise<void>;

  subgraph(seed: readonly SubjectId[], options?: { readonly hops?: number }): Promise<RelationGraph>;
  listAdapters(): Promise<AdapterCapabilities[]>;
  close(): Promise<void>;
}
```

进程内接线由引擎提供，门面只薄封装一层：

```ts
export function openInProcess(root?: string): Promise<Distilly>;
```

`EngineClient` 是唯一的传输缝：

```ts
export interface EngineClient {
  call<T>(method: string, params: unknown): Promise<T>;
  /** 订阅引擎写入；语义与事件类型见 §16.2。 */
  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}
```

换成守护进程或回环 HTTP 时换掉它的实现，`Distilly` / `Person` 一行不改（§5.1 项 18）。`watch` 是必填的：长驻界面靠它重画，一问一答的调用方不订阅就是了（§16.2）。市场方法第二版再挂，不要为了做市场养肥 `Person`。

### 11.3 `Person`

```ts
export class Person {
  readonly id: SubjectId;
  readonly space: SpaceId;

  get(options?: { readonly version?: VersionId }): Promise<Profile>;
  /** 完整中性 Markdown。第一版等于渲染 get() 的结果，不裁剪。 */
  prompt(options?: { readonly version?: VersionId }): Promise<string>;
  status(): Promise<SubjectStatus>;

  ingest(materials: readonly MaterialIn[], options: { readonly source: string }): Promise<IngestResult>;
  ingestFiles(paths: readonly string[], options?: { readonly kind?: string }): Promise<IngestResult>;
  /** 委托型返回计划；直采型自己采完返回结果。判别字段是 kind。 */
  collect(adapterId: string, request: CollectRequest): Promise<AgentPlan | IngestResult>;
  acceptCollect(plan: AgentPlan, artifacts: readonly string[]): Promise<IngestResult>;

  correct(input: { readonly text: string; readonly facet?: string }): Promise<Version>;
  flush(): Promise<PendingJob>;

  versions(): Promise<Version[]>;
  diff(a: VersionId, b: VersionId): Promise<ProfileDiff>;
  rollback(version: VersionId): Promise<Version>;
  lineage(options?: { readonly version?: VersionId }): Promise<LineageEvent[]>;

  install(host: HostName): Promise<InstallRef>;
  uninstall(host: HostName): Promise<void>;
  export(host: HostName, dest: string): Promise<string>;

  link(other: string | Person, input: {
    readonly type: string;
    readonly evidence: readonly EvidenceRef[];
    readonly confidence?: number;
    readonly role?: Readonly<Record<string, string>>;
  }): Promise<Relation>;
  invalidate(relationId: RelationId, input: { readonly reason: string }): Promise<void>;
  neighbors(filter?: { readonly type?: string }): Promise<Relation[]>;
  path(other: string | Person, options?: { readonly maxHops?: number }): Promise<Relation[]>;
  mentions(): Promise<PendingMention[]>;
  resolveMention(mentionId: MentionId, subjectId: SubjectId): Promise<Relation>;
}
```

`collect` 的返回是判别联合，调用方必须按 `kind` 分辨，**不许用「有没有某个字段」来猜**。

### 11.4 错误

错误码是**冻结的闭集**，也是跨进程契约：只传 `code`，不传类名。

```ts
export type DistillyErrorCode =
  | "not_found" | "already_exists" | "stale_version" | "pending_commit"
  | "confidence_gate" | "ambiguous_mention" | "host_unsupported"
  | "invalid_input" | "adapter_failed";

export class DistillyError extends Error {
  readonly code: DistillyErrorCode;
  readonly retryable: boolean;
  readonly remediation?: string;
}
```

| 码 | 什么时候 |
|---|---|
| `not_found` | 主体、版本、作业、关系不存在 |
| `already_exists` | 重复建同一个主体 id |
| `stale_version` | 提交或回滚时基准版本已经不是当前 |
| `pending_commit` | 已有挂起版本未处理，又来一次提交 |
| `confidence_gate` | 新版本置信度低于当前，已挂起等 `promote` |
| `ambiguous_mention` | 名字对上多个候选，拒绝猜 |
| `host_unsupported` | 这个宿主没有被请求的装载方式 |
| `invalid_input` | 六道边界上的校验失败 |
| `adapter_failed` | 采集适配器出错，`retryable` 与 `remediation` 透传 |

`switch (error.code)` 必须以穷尽检查收尾，新增一个码就必须处理每一处分支。

### 11.5 运行时校验只发生在这六道边界

「类型已知就信类型」的边界要写死，否则运行时校验会到处长。schema 用 `zod` 写，全部住在 `@distilly/protocol/schemas.ts`。

| 边界 | 校验什么 | 失败 |
|---|---|---|
| 模型 / 工具入参 | 模型生成的 JSON | `invalid_input`，把出错字段路径写进 `remediation` |
| `commit` 的 draft | 集合哈希一致、facet 语法、claim 证据非空、置信度区间 | `invalid_input`；**空内核合法** |
| 磁盘读入 | `meta.json` / `state.json` / `claims.jsonl` / `relations.jsonl` 的 schema 版本与字段 | 拒绝加载，不静默修 |
| 配置 | `distilly.toml` / `adapters.toml` | 加载即失败，指出字段 |
| 适配器产出 | 第三方给的材料 | `adapter_failed` |
| 以后的守护进程 / worker | 进程间 JSON | 同模型入参 |

**其他地方不校验。** 同进程、类型已知的调用不加防御分支，也不为「类型上不可能」的输入写测试。

### 11.6 模型那张脸：五个工具

| 工具 | 对应 |
|---|---|
| `distilly_get` | `Person.get` / `prompt` |
| `distilly_ingest` | `Person.ingest`（必须带主体 id） |
| `distilly_pending` | `Distilly.pending` |
| `distilly_commit` | `Distilly.commit` |
| `distilly_correct` | `Person.correct` |

只这五个。一千个人不能 `get` 一遍，模型只应对当前这个人 `get`。`link` 第二版再给模型，避免它乱连；市场浏览永远不做成模型的常用工具。工具名和入参字段只加不改（§5.1 项 19）。

---

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

## 14. 宿主注入

采集适配器可以后做，**注入适配器第一版就要有**，否则 `get` 在各家会塞错地方。

```ts
export interface HostInjector {
  readonly host: HostName;
  /** 禁止写全局指令文件。禁止把这次注入登记成一次 install。 */
  injectSubagent(injection: Injection, request: HostSpawnRequest): HostSpawnRequest;
  install(profile: Profile, destRoot: string): Promise<InstallRef>;
  exportIdentity(profile: Profile, dest: string): Promise<string>;
}
```

`get` 只产出一份中性 Markdown。**不要为不同宿主蒸两份画像**，各注入器只加前后几句包装。

### 14.1 三种装法，混用会把产品做脏

```
profile/（家里，唯一事实）
    ├─ prompt() / get()  → 这一次子运行     ← 临时 10 个人用这条
    ├─ install(host)     → 宿主 skills/     ← 长期、可被宿主发现
    └─ export(host)      → 单个身份文件     ← 一个常驻身份一个文件
```

宿主的全局指令文件是**这份运行时的说明书**。一个进程通常只吃一套，它该写「怎么测试这个项目」，不是用来轮换人格：改它会让所有对话和所有子代理一起变；派十个临时人格还要写十份再删，和宿主缓存缠在一起;十个人写进同一份又挤又串台。

**「会话级」在 coding agent 里等于子运行级注入，不是给当前窗口打隐藏补丁。** 各家都没有稳妥的「给当前会话打补丁」接口。

| 环境 | 实际口子 | 十个临时人格怎么做 |
|---|---|---|
| Claude Code | 派子代理时自定义 prompt | 十次派发，每次换一个人 |
| Codex | 子任务 instructions / 动态 instructions | 同上 |
| OpenAI Agents / LangGraph | 每轮 run 的 instructions | 最干净 |
| Bot 宿主 | 一个进程一份人格 | 要十个就起十个进程 |

### 14.2 注入器必须挡住的七件事

1. **没有统一的「设置系统提示」。** 父对话里 `get` 了，父自己不会变成那个人；十个临时人格必须派十个子运行。
2. **塞错槽位污染全局。** 写成改宿主全局指令文件，等于整个仓库沾上，十个人互相覆盖。这是产品技能的第一禁令。
3. **`install` 不等于会话注入。** 注入器不要默认走 install。
4. **各家包装不同，中性正文只有一份。**
5. **子代理不一定带得上工具连接。** 人格必须已经在它的 prompt 里：父 `get`，子只拿文本。
6. **完整画像有代价。** 十路等于十份全文。第一版不裁；塞不下就报「塞不下」（§5.1 项 12）。
7. **不要跨宿主调 UI。** 只调用本宿主真有的子运行或 instructions 接口。

---

## 15. CLI 与插件包

### 15.1 CLI

`@distilly/cli` 提供 `distilly` 可执行文件，既是「人和 CI 的那张脸」，也是插件里工具服务器的启动入口：

```
distilly mcp                          # 标准输入输出的工具服务器，插件配置指向这里
distilly ingest <subject> <path...>
distilly pending [--subject <id>]
distilly commit <job> --draft <file>
distilly get <subject> [--version vN]
distilly install <subject> --host claude-code
distilly migrate --from <legacy-skill-dir>
distilly status <subject>
```

CLI 只做参数解析、输出格式化和退出码，业务全在引擎。**测试测真实入口**，不测内部帮助函数。

### 15.2 插件包：本机引擎，不做托管后端

```
plugin/marketplace.json                                 # 这个 git 仓库本身就是市场
plugin/codex/.codex-plugin/plugin.json + .mcp.json + skills/
plugin/claude/.claude-plugin/plugin.json + skills/      # 规范技能 symlink，同一份内容
```

`.mcp.json` 指向本机的 `distilly mcp`（§15.1）。六条打包规则：

1. **一个 git 仓库当市场。** 用户加一次仓库地址就能装，不需要我们运营一个注册服务。
2. **两个宿主各一个包目录**，因为两家的清单文件名和字段不同。共用内容靠 symlink，不靠复制。
3. **规范技能只有一份内容。** 两个包目录里的技能是同一份文件的软链，避免两边行为漂移。
4. **`plugin.json` 填满宿主提供的展示位**（名称、说明、品牌标识），否则用户在插件列表里看不出这是什么。
5. **装完必须提醒用户新开对话。** 宿主在会话启动时读取工具清单，当前会话看不到新装的工具，不提醒就会被当成装失败。
6. **插件包里不复制引擎。** 包只有清单与技能，业务全在本机的 `distilly` 可执行文件里。

明确不做的三件事：

- **不做远程服务器 + 登录换 token。** 那等于把画像放到我们的云上，与 §3.1 直接冲突。画像只在 `~/.distilly`，装插件不需要注册账号（§15.4 第 4 条）。
- **第一版不做内嵌大面板**（§3.5：地基不压在会腐烂的接口上）。
- **不让模型去点编辑器 DOM。** 需要让用户看图形界面时，工具返回一个 URL，由宿主的内嵌浏览器打开；模型的职责到「给出地址」为止。

产品技能写死流程：先 `get`，再按当前宿主注入器投放，**禁止改仓库里的全局指令文件**。

### 15.3 面板从这里进来

工具或 CLI 返回一个本机回环地址，宿主的内嵌浏览器打开它。服务器、令牌与端口规则见 §16.3；第一版可以完全没有面板。

`install` 的实现必须是「宿主 id → 安装器」，每多一个宿主加一个安装器，和采集适配器同一道缝。

### 15.4 插件验收四条

1. 装完新开对话，模型能列出五个工具。
2. 「蒸馏公开人物 X」走完：浏览 → `ingest` → `commit` → 本地出现 `subjects/`。
3. 下一句「你是 X」能 `get` 到声音和例句。
4. **不登录任何云账号**也能完成。

---

## 16. 交互式界面：TUI 与面板

CLI（§15.1）、模型工具（§11.6）和 bot（§18）都是一问一答：收到一次请求，产出一次结果，结束。TUI 和面板不是——它们**开着不关**，用户一边看，后台作业一边在改同一份数据。这一章定的是这个差别逼出来的接口，以及为了不把引擎搞脏必须守的规矩。

第一版可以两个都没有。但**接口现在就定**，因为事后补「改变通知」要动 `EngineClient`，而那是所有脸共用的唯一传输缝（§11.2）。它们是 §5.1 项 10 里「交互式界面」那一张脸的两种呈现，不是第五张脸。

### 16.1 它们和已有的脸差在哪

| | 一问一答的脸 | TUI 与面板 |
|---|---|---|
| 生命周期 | 一次调用 | 长驻，用户可能开一整天 |
| 数据会不会在脚下变 | 不会 | 会：daemon 在后台蒸，用户可能同时用编辑器改 `voice.md` |
| 需要的动词 | 单主体读写 | 还要浏览、翻版本、看队列 |
| 拿不到通知的后果 | 没有后果 | 画面停在旧状态，用户以为操作没生效 |

第二行是全部麻烦的来源，第四行是为什么必须加东西。第三行不需要加东西：浏览类动词在 §9 的清单里已经有了，只是**故意不给模型**（§11.6：一千个人不能 `get` 一遍）。

### 16.2 唯一的新缝：改变通知

轮询是错的答案。按秒扫目录既贵，又只能得到「有变化」而说不出变了什么，于是界面只能整体重画。所以 `EngineClient` 加一个成员：

```ts
export interface EngineClient {
  call<T>(method: string, params: unknown): Promise<T>;
  /** 订阅引擎写入。返回退订函数。 */
  watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}

export type Unsubscribe = () => void;

export interface EngineEvent {
  readonly kind:
    | "subject.created" | "subject.deleted"
    | "material.ingested" | "queue.changed"
    | "version.committed" | "version.suspended"
    | "version.promoted" | "version.rejected" | "version.rolledBack"
    | "relation.changed" | "mention.added";
  readonly subjectId?: SubjectId;
  readonly versionId?: VersionId;
  readonly at: string;
}
```

三条契约，缺一条就会长出「界面显示的和磁盘上的不一样」这类 bug：

1. **事件只是「该重读了」的信号，不是可信状态。** 载荷只够定位（哪个主体、哪一版），不带画像内容。收到就重新 `get` / `status`。理由和 §12.3 相同：写强一致、读最终一致，事件在最终一致那一侧。
2. **事件从事实层派生，不是第二个真相。** 每个事件对应一次已经落盘的写入——一条血缘事件或一次队列状态变更。**不许**为了界面好看而发一个磁盘上没有对应写入的事件；那等于让界面成为事实来源，违反 §3.1。
3. **`kind` 是可扩展联合，消费者必须留 default 分支。** 新增一种写入就多一个 `kind`。旧版本界面收到不认识的 `kind`，正确反应是「重读一次」，既不是崩掉，也不是丢弃。

`watch` 是必填成员，不是可选能力。进程内实现就是提交成功后发一次，代价接近零；做成可选会让每个消费者都写一遍「这个 client 有没有 watch」的分支。

### 16.3 面板：本机 HTTP 加一次性令牌

面板跑在浏览器里，所以它是**第一个进程外的调用方**。它不需要新协议：`EngineClient` 已经是唯一传输缝，面板要的就是它的 HTTP 实现。

```
distilly panel [--port <n>]
  ├── GET  /            静态资源
  ├── POST /rpc         方法名与 EngineClient.call 完全一致
  ├── GET  /events      Server-Sent Events，就是 watch
  └── 打印 http://127.0.0.1:<port>/#<token>
```

工具或 CLI 把这行地址交给用户，宿主的内嵌浏览器打开它。模型的职责到「给出地址」为止，不去点 DOM（§15.2）。

五条不能省的规矩：

1. **只绑 `127.0.0.1`。** 绑 `0.0.0.0` 等于把本机全部画像挂到局域网上。
2. **每次启动生成一次性令牌**，放在 URL 片段里，`/rpc` 与 `/events` 都校验。没有令牌，本机任意进程和任意网页都能驱动你的引擎。
3. **校验 `Origin`**，拒绝跨站请求。只绑回环挡不住浏览器里的恶意页面——它照样能对 `127.0.0.1` 发请求。
4. **端口被占就报错退出，不自动换端口。** 静默换端口会让已经打印出去的地址指向别的东西。端口随环境变，所以是配置项；上面三条不随环境变，所以写死——这是 §3.8 的两面。
5. **面板不是写事实层的第二条路。** 它的每次写入都走 `/rpc` 上的同名方法，落到同一个 `CommitService`。面板绝不直接碰 `~/.distilly` 下的文件。

`/rpc` 的入参按 §11.5 第一行校验：它是进程外来的 JSON，和模型给的 JSON 同级，不因为「是我们自己的前端」就免检。

### 16.4 TUI：门面的普通调用方

`distilly tui` 起一个终端界面。它在架构上**没有任何特殊地位**：就是一个用 `Distilly` + `Person` 的脚本，和用户自己写的脚本同级。

第一版四屏，够用且不多：

| 屏 | 看什么 | 用已有的哪些动词 |
|---|---|---|
| 人列表 | 主体、空间、成熟度、当前版本 | `list` / `search` |
| 一个人 | 七个内核面加已建域，claim 可展开看证据 | `get` / `status` |
| 版本 | 时间线、每版来源数、挂起的那一版 | `versions` / `diff` / `lineage` / `promote` / `reject` |
| 队列 | pending 作业、失败原因、可不可重试 | `pending` / `flush` |

四条规矩：

1. **不加新动词。** TUI 缺东西，缺的是 §9 的清单和 §11 的门面，不是 TUI 自己补一个。
2. **不派生产品事实。** 置信度、成熟度、覆盖了哪几个内核面，全部读 `SubjectStatus`（§10.5）。界面自己算一个「完成度百分比」，产品就有了第二个答案（§20）。
3. **靠 `watch` 重画，不靠定时器。**
4. **可删。** 删掉 `@distilly/tui` 不许弄坏任何其它包。依赖方向单向：`tui → distilly`，没有任何包指回来（§7.1）。

### 16.5 两张脸共用什么

两种呈现要显示的东西高度重合：一行主体摘要、一条版本时间线、一条带证据的 claim、一行队列作业。**这些聚合由引擎算，不由界面各算一遍。**

规则是：屏幕需要的每一种聚合，都是一个引擎读方法，返回 §10 里的类型。**不新增「给界面用的」包。** 那个包一定会开始自己算数，然后两张脸对同一个人给出两个成熟度。

需要一种现在没有的聚合时，顺序固定：先进 §9 的动词清单 → 再进 §11 的门面 → 两边都用它。反过来做（先在 TUI 里算出来，以后再搬下去）永远搬不动。

### 16.6 第一版做什么、不做什么

| | 第一版 | 以后 |
|---|---|---|
| `EngineClient.watch` | 有，进程内实现 | 面板出现时加 HTTP 实现 |
| `distilly tui` | 可以没有；做就是那四屏 | 直接编辑 claim、拖关系 |
| `distilly panel` | 可以没有 | 市场浏览（§9.6）、关系图 |
| 传输 | 只有进程内 | HTTP 与面板同时出现 |
| 守护进程 | 不做 | 有「两个客户端同时写」的真实需求再评估 |

面板和 CLI **不共用长驻守护进程**：`distilly panel` 活在这条命令的生命周期里，CLI 每次调用仍然进程内直连。上守护进程要先有并发写的真实需求，以及随之而来的锁与孤儿回收设计——那是队列已经解过一遍的问题（§12.2），不要在没有需求时再解一遍。

---

## 17. 问人表单

「问人表单」不是一种表单控件，是一道**适配缝**，和采集适配器（§13）、宿主注入器（§14）同构：它不决定问什么，只决定**在这个宿主上，一个结构化问题用什么原生 UI 问出来**。

原因是各宿主能渲染的东西不一样：网页能给出的富控件，coding agent 渲染不了；反过来 coding agent 的追问卡片在网页里也没有对应物。如果每个提问点都按当前宿主手写一遍，加第三个宿主时要把所有提问重写。

做法是**先抽中性语义类型，再由各宿主翻译**。语义类型描述「这个问题的性质」，不描述控件长什么样：

| 语义类型 | 意思 | 为什么单独成一类 |
|---|---|---|
| `short_text` | 一行文本 | 最基本的一类，各宿主都有 |
| `explicit_consent` | 必须用户主动确认，不能预勾 | 涉及采集范围与公众人物政策，默认勾选就等于没问（§3.6） |
| `playable_single_choice` | 单选，且选项上能试听 | 选声音、选语音样本时，不听就选等于瞎选 |
| `playable_preview` | 只展示、不提交 | 让用户确认「就是这一版」，但不产生一次选择 |
| `audio_reference` | 表单里不能上传，让用户把文件附到对话上 | 宿主的表单通常拿不到本机文件句柄；硬做会做成一个永远失败的上传框 |

翻译规则有两条硬约束：

- **只调用当前宿主真有的接口，不要交叉调用。** Codex 用它的追问卡片，Claude 用它自己的征询机制；把一家的接口名写进另一家的路径里是直接报错。
- **不要输出 HTML。** 宿主不渲染，用户只会看到一堆标签源码。

distilly 什么时候需要这一层：只有在第一版就要在宿主里问「蒸哪个人 / 选哪个版本」的时候。如果只做 `get` / `ingest` / `commit`，用对话把话问清楚就够了，这一层可以先不做。判据是**问题的选项集是不是封闭且带媒体**——一旦要问「从这十段语音里选一段」，纯对话一定会问乱。

---

## 18. Bot

Bot 不是第四套引擎，是 **`Person` 的又一种装法**：常驻对话入口，默认 `get` 某个人，用户 @ 它就是在跟这个人说话。

| | 插件 | Bot |
|---|---|---|
| 谁在跑 | 用户打开的 coding agent | 挂着人格的常驻对话进程 |
| UI | 编辑器 + 工具 + 可选面板 | 聊天平台 |
| 一次加载 | 可以 `get` 不同人 | 通常钉死一个人 |
| 采集 | 模型去扒 | 用户丢消息 / 图 / 语音 → `ingest` |

启动时把 `person.prompt()` 塞进系统提示，每轮用户消息 `ingest`（或先缓冲到边界）。**聊天窗口本身就是面板**：改画像、看版本都可以用对话完成，不必先做前端。

第一版一个 bot 钉一个主体加一个版本；要换人就换一个 bot。图在家目录里，bot 只是图上某一个节点的嘴。

Bot 要 24 小时自己回话，需要的是 **bot 宿主的对话模型 key**，不是 distilly 的蒸馏 key——这两件事经常被混成一件。

**不准自己实现一套人格文件**，只准 `get` / `ingest` / `commit` / `install`。

---

## 19. Profile layer

顶层切成「工作档 + 性格档」，等于默认所有人都是同事。换成母亲、主播、已故作家、你自己，工作档要么空着，要么被硬编成职责说明。正确做法：**所有人共用同一套内核；差异进可选的域；细微性格进带证据的 claim。**

### 19.1 内核（闭集，改要升 schema）

| 面 | 文件 | 装什么 | 真实性主要靠它 |
|---|---|---|---|
| 身份 | `identity.md` | 名字、别称、**复数角色**（可以同时是妈妈、编辑、前同事）、公开与私下身份 | 角色是列表，不是一个头衔 |
| 声音 | `voice.md` | 口头禅、节奏、标点习惯、**会怎么说的对话例** | **最重要**：没有例句就没有这个人 |
| 内在 | `psyche.md` | 价值观排序、矛盾、怎么做决定、怎么回避 | 比性格标签真 |
| 对人 | `relations.md` | 对亲密、陌生、权威、群体分别是什么模式 | 用关系类型，不用职级 |
| 边界 | `boundaries.md` | 雷区、拒绝方式、不会做的事 | 没有边界的人像角色扮演 |
| 质地 | `texture.md` | 身体习惯、口味、时间感、具体物件、只有他会做的小事 | 「越真实越好」主要加在这里 |
| 时间 | `timeline.md` | 只记有证据的时间点 | 可空 |

内核**禁止**出现「职责范围 / 技术栈 / 向谁汇报」。那些属于域。

蒸馏规则：**材料撑不住的面就空着或标未评估，不许用模板句填满。空是合法状态。**

### 19.2 域与 vocation

**域**是这个人生活里的一块，有材料才建。它不是标签，也不是人的类型。

**vocation** 是其中一块：他怎么做事、靠什么立足。故意避开「work」这个词，因为它太像同事档案里那份职责说明。全职父母、学生、职业棋手可能有 vocation；一个母亲往往**没有这个文件**。

| | 内核里写 | vocation 域里写 |
|---|---|---|
| 企业家 | 说话先否定再给方案 | 怎么看项目、怎么待投资人、哪几次出手 |
| 动漫角色 | 口头禅、冲动、对谁护短 | 只有当「职业」在设定里成立才写 |
| 你妈妈 | 催你吃饭的句式 | 往往没有 |
| 同事 | 星座、口头笑声、语音习惯 | 招聘流程、面评、招聘名额 |

还可以有 `craft` / `intimacy` / `kinship` / `public` / `civic`——**加域不加引擎**。域包只决定默认打开哪些域。

### 19.3 Claim

「说话前先笑一下」「拒绝时会先夸对方」「只在语音里骂人」这类细节，不该塞进散文里变得无法溯源。

`facet` 用开放点分命名，新细节等于新路径，不升 schema。内核 Markdown 给人读、给模型演；`claims.jsonl` 是机器索引和血缘。蒸馏时**先写 claim，再渲染各面散文**——顺序反了就会出现无证据的漂亮句子。

---

## 20. 完成度与置信度的事实归属

### 20.1 这份文档不保存实时数据

本文不写实时 schema 号、测试数量、CI 历史或「已落地」清单。这些会随实现变化，写进设计合同就会形成第二事实源。

- [architecture.md](../architecture.md) 说明当前树实际发布什么。
- 源码常量、测试发现结果和 CI 配置是当前 schema、测试数与门禁的**机械证据**。
- 本文任何一节都不能证明 `Distilly`、`Person`、claim、血缘、遥测、工具服务器、注入器、Bot、面板或市场**已经发布**。
- 每个产品切片落地时，同一个 PR 更新 architecture、测试与对应 Agent Note；设计合同只在**目标机制**改变时更新。

在 TypeScript 产品代码出现之前，现有的 Python 蒸馏与安装链只能作为**迁移输入**（§25）。目标中间产物始终是 `claims.jsonl` 加内核与域 Markdown，再投影出宿主文件。

### 20.2 置信度与成熟度怎么算

两者都必须可复算，不能由模型自评：

- **置信度** = 有证据支撑的内核面占比，按各面 claim 的证据数与冲突情况加权。它回答「这份画像有多站得住」。
- **成熟度** 是置信度加覆盖面的粗分档：`sparse`（内核多数为空）、`forming`（声音与身份已成形）、`stable`（七面都有证据且近期无冲突）。
- 两者都写进版本元数据，所以任意历史版本都能回答当时的完成度。
- **置信度下降是异常**（§3.7 推论 4）：材料只增不减，支撑只应变强。下降说明蒸馏出了问题，所以挂起而不是覆盖。

成熟度门禁默认放行（§3.3）：它是给用户的信息，不是拦人的闸。

---

## 21. 关系图

一千个人不能靠堆 `relations/a__b/` 目录，那种目录是「这段关系本身也值得蒸一版画像」时才升级的。图谱要的是**大量轻边**。

### 21.1 两种边，第一版只做第一种

| | 关系（做） | 相似（不做） |
|---|---|---|
| 从哪来 | 材料写明、蒸馏抽到、或手动建边 | 两人在同一 facet 上足够像 |
| 例子 | 合伙、师徒、对手、夫妻、同部作品 | 都用同一句式开场 |
| 存哪 | 事实层 `graph/relations.jsonl`，进血缘 | `.index/`，删了能从 claim 重建 |
| 变了怎么办 | 写失效时间，**不删** | claim 变了重算 |

不要把「我觉得他们性格像」写成关系——没证据会把图弄脏。反过来，官网写明是联合创始人，就不该只当相似度。

### 21.2 节点、空间、边字段

节点就是已有主体。企业家和动漫角色都是 `person`，差在域和**空间**，不新造节点类型。一千个企业家和一千个动漫角色默认各在一个空间；**边默认不跨空间**，跨空间查询要显式打开。

边的 `type` 开放点分，与 `claim.facet` 同一套扩展法：`family.*`、`intimacy.*`、`work.coworker`、`work.founded`、`work.invested`、`work.rivals`；叙事类 `canon.ally`、`canon.rival`、`canon.mentor`、`fanon.*`（同人必须标 fanon）；观念类 `influenced_by`、`opposed_to`。同一对节点可以有多条不同类型的边。方向性用 `role` 表达，不靠 a/b 顺序隐含。

`commit` 必须能带关系，否则批量蒸完图是空的。对不上的名字进待对齐提及，由人点一下——**自动猜错会把图污染到无法用**。

### 21.3 复杂度

| 动作 | 复杂度 |
|---|---|
| 插入节点 | **O(1)**：建目录、插一行索引 |
| 接上关系 | **O(k)**，k 是这次抽到的关系数，与全图人数无关 |
| 邻居查询 | **O(k)**，走 `(主体, 类型)` 投影 |
| 相似（以后，倒排） | O(候选 facet × 该 facet 平均人数)，通常远小于 O(n) |
| 整库重建 | O(人数 + 边数 + 全部 claim) |

**不要在每次提交里对全图做两两比较。** 那才会炸。宽 facet 以后也不物化相似边，只在查询时算。

---

## 22. 索引：现在上什么、以后怎么上

### 22.1 现在的分工

- **检索不上索引。** 不做 embedding、不做向量库、不做多路召回。一份画像几 KB，整份进 context。这一版引入检索是过度工程。
- **队列和图投影上 SQLite。** 队列需要事务、认领守卫和部分索引；邻居查询需要按 `(主体, 类型)` 的索引。手写 jsonl 索引会把这两件事重新实现一遍，还更容易错。运行时内置 SQLite，所以这个决定不引入原生依赖（§3.11）。
- **`.index/` 永远可删。** 事实在 Markdown、jsonl 和 `state.json` 里。

### 22.2 以后要做检索时，索引分三组表

「Markdown 是事实、SQLite 是投影」这件事有三个必须解决的子问题。等到真要做检索时，索引按这三组表设计，每组都写明它防的是什么故障。

**第一组：文件镜像表。** 每个事实文件一行，存 `checksum`、`mtime`、`size`。

- 重建时先比 `checksum` 与 `mtime`，**未变的文件直接跳过**。没有这一列，每次重建都要重读整棵树。
- **永久标识与当前路径分开两列。** 引用指向永久标识，不指向路径，所以用户在面板里改名或搬目录不会让任何引用失效。把路径当主键是这类索引最常见的错误。
- 引用表里「指向谁」可以为空，但「指向的名字」必须有。这一条支持**前向引用**：材料里提到一个还没建档的人时，先记名字，等他被建档再补上 id（这正是 §21.2 的待对齐提及在索引侧的落法）。

**第二组：同步状态机。** 索引里记一份「我上次见到的版本 + 校验和」，磁盘上另有一份当前值。

- 两份分开存才能检测出**索引不知情的外部改动**——用户直接用编辑器改了 `voice.md`，或者 git 切了分支。状态机必须有一个专门的「检测到外部改动」状态，否则这种情况会被误判成「没变」而永久跳过。
- 必须区分「文件被移走后留下的空位」和「真的多了一份副本」。两者的磁盘表现相似，但前者要迁移引用，后者要新建一行。混在一起会产出重复节点。

**第三组：全文索引。** 只在做检索时才建。

- 路径类字段要把 `/` 加进分词字符集，否则 `subjects/wang-xing/voice` 会被切成无意义的碎片。
- 前缀索引长度按真实查询习惯配（人名与 facet 路径通常 1 到 4 个字符起效），不要用默认值。

三条贯穿的原则：**用校验和加修改时间跳过未变文件；把「索引记的版本」和「磁盘上的版本」分开存；给路径类字段单独选分词规则。**

### 22.3 什么时候真的需要

**市场一做就会需要。** 面板要在几百个画像里按域、成熟度、血缘来源筛选；问「第 5 版用了哪些源」如果只有 jsonl 就得全文件扫。到那时：Markdown 与 jsonl 仍是事实，SQLite 只做可删重建的投影，并且必须提供**可测试的增量重建判据**。

embedding 大概率不需要。只有市场上千个画像要做语义搜索时才考虑，那时也可以跑本机模型，仍然不必要 key。

### 22.4 读路径三条规则（第一版不用，先定下来）

真做检索时，这三条从一开始就定，因为它们事后改要动召回入口。

1. **按家族硬分区，不是查一张大表再过滤。** 同事、公众人物、虚构角色应当走不同的召回路径。公众人物涉及公开信息与肖像政策（§5.2 项 C），本该和同事有不同策略；虚构角色的 `fanon.*` 内容也不该混进真人结果。用 `where` 过滤实现「分区」，早晚会有一条漏出去。
2. **读路径只读。** 检索组件不写事实层，也不顺手补索引。要重建就走显式的重建入口，理由与 §12.3 的写强一致一致：写路径只有一条。
3. **组件缺失直接报错，不退化。** 索引没建好时抛错，而不是悄悄改用全文扫描或返回空列表。给用户一个假的「搜过了没有」，比明确告诉他索引要重建更糟。

还有一条负面规则：**不要让不同类型的记忆在同一个排序空间里互相竞争。** 如果把「一条八卦」和「一条工作事实」放进同一个打分堆里按分数截断，前者会因为更新、更具体而顶掉后者。分区在这里同时也是隔离机制。

---

## 23. 遥测

遥测是目标能力，不是当前已发布模块。约束来自 §3.3 与 §3.4：

- 没配端点就**不问、不发**，代码路径完全惰性。
- 交互式终端问一次并记住；**非交互运行拒绝且不落盘**（否则用户永远不会再被问到）。
- 数的是**创作**（蒸了几个、装了几次），并在文档里承认数不到「模型读了这份画像」。
- 禁止为了指标在投影里塞必须调用的工具。
- 环境变量统一 `DISTILLY_*`。

实现时必须在本仓落地并测试，不能把任何仓外原型当依赖。

---

## 24. 全周期治理工具链

治理不是「多写文档」，是让一条闭环稳定成立：**新 agent 知道从哪读；每个事实有唯一归属；重要决定保留原因；改动同时带实现、文档和证据；机器拦可判定的错，独立评审判断它是否真的正确。**

### 24.1 阶段与命令

| 阶段 | 做什么 | 命令 | 判定 |
|---|---|---|---|
| 0 引导 | 装依赖、校验运行时与 lockfile | `pnpm install --frozen-lockfile` | lockfile 漂移即失败 |
| 1 阅读 | 根与局部 `AGENTS.md`、文档地图、本文对应章、拥有该决策的 Note | 无 | 人与 agent 自审 |
| 2 立约 | 写任务契约：目标、非目标、验收、写入范围、验证计划 | 无 | 写不出可观察的验收就不动大改 |
| 3 实现 | 最小改动 | | 每一行可追溯到某条验收 |
| 4 快检 | 变更面的格式、lint、类型、focused 测试 | `pnpm run gates:fast` | 任一红即停 |
| 5 类型 | 全仓项目引用编译 | `pnpm run typecheck` | 零错误 |
| 6 测试 | 单元与契约 | `pnpm run test`、`pnpm run test:coverage` | **发现零测试即失败** |
| 7 模型可见 | `prompt()`、`SKILL.md`、宿主 instructions 的快照 | `pnpm run test -- snapshot` | 差异必须逐条读，不许无脑更新 |
| 8 文档 | 本地链接、末尾换行、生成章节一致 | `pnpm run docs` | 漂移即失败 |
| 9 决策 | Note 树、格式、治理路径归属 | `pnpm run notes` | 改了治理路径没写 Note 即失败 |
| 10 发布面 | 构建产物、导出映射、类型可解析、未用导出 | `pnpm run build && pnpm run hygiene` | 只测源码不算通过（§3.10） |
| 11 推送前 | 上面的便宜子集 | `.githooks/pre-push` | 本地钩子只做快反馈 |
| 12 CI | 全量与平台矩阵 | GitHub Actions | **合并依据只看远端** |
| 13 评审 | 语义评审 | [code-review.md](../process/code-review.md) | 绿灯不证明设计正确 |
| 14 发布 | 版本与变更日志 | 变更集工具（设计好，首个 tag 前不启用） | 未发布就不假装有发布流程 |
| 15 审计 | 月度漂移巡检 | 无固定命令 | 失效链接、过期 Note、重复事实 |

`pnpm run gates` 是聚合入口，按顺序跑 4–10 并把每一步的精确命令打印出来，让报告可以照录而不是转述。

### 24.2 门禁清单

**类型与风格**

- 编译开关：严格模式、索引访问返回可能为空、精确可选属性、导入语法逐字保留、显式 override、switch 不允许穿透。
- Lint（类型感知）：禁止未处理的 Promise、禁止无理由的 `any`、要求导出符号有文档注释、要求判别联合的 switch 收在穷尽检查上。
- 格式化只管格式，检查模式进门禁，**不做「自动修完就算过」**。

**测试**

- 单元测试贴着行为放；**发现零测试要失败**（一条什么都没跑的命令不是证据）。
- 覆盖率出数，但**不设逐文件 100% 门槛**——那需要配套的维护预算，而且被覆盖的行不等于有断言。
- 模型可见投影用无 key 快照。快照更新必须在 PR 里逐条解释。
- 磁盘行为测试一律在临时家目录下断言**真实文件**，不断言某个内部函数被调用过。
- 面板服务器的四条拒绝路径要各有一个红过的测试：无令牌、错令牌、跨站 `Origin`、端口被占（§16.3）。这四条是安全不变量，不是可配置行为。

**发布面**

- 构建出产物；检查包字段；检查在标准模块解析下能拿到类型。
- 未用文件、未用导出和未声明依赖检查——**依赖方向违规在这里现形**（§7.1）。
- 产物 smoke：从打包后的入口 import，跑一次 `openInProcess` 与一次 `get`。

**文档与决策**

- 文档门禁：本地链接可达、禁止非标准链接语法、恰好一个末尾换行、生成的设计章节与父文一致。
- Note 门禁：生命周期与类目闭集、文件名日期、状态行语法、必需小节非空且有序、治理路径改动必须带 Note。
- **门禁不评判散文质量**，也不能证明「所有非平凡改动都写了 Note」。这两件事归语义评审。

### 24.3 CI 布局

| Job | 跑什么 | 为什么这样切 |
|---|---|---|
| governance | 文档、Note、改动行空白 | 与平台无关，只跑一次 |
| typecheck | 全仓编译 | 单一版本足够 |
| lint | Lint + 格式检查 | 单一版本足够 |
| test | 单元测试 × 两个 Node 大版本 × Linux 与 macOS | 路径、大小写和文件系统行为按平台变 |
| build | 构建 + 卫生检查 + 产物 smoke | 发布面独立于源码测试 |
| legacy-python | 现有 Python 门禁 | 只在 Python 产品文件还存在时保留（§25） |

失败、取消、意外跳过都不能汇总成成功。远端 CI 是合并依据，本地钩子只是快反馈——Git 无法强迫贡献者装钩子。

### 24.4 机器与人的分界

| 内容 | 机器能证明 | 仍需语义评审 |
|---|---|---|
| 代码规范 | 固定规则是否满足 | 命名与抽象是否表达了正确的领域概念 |
| 测试 | 是否运行、是否通过 | 断言是否会对目标缺陷变红 |
| 覆盖率 | 哪些行被执行 | 覆盖是否有意义、是否漏了真实入口 |
| 快照 | 输出是否变化 | 新输出是否正确、安全、可理解 |
| 文档 | 链接与结构可解析 | 内容是否准确、是否与实现一致 |
| API | 结构与导出映射 | 默认值、错误语义与能力范围是否合理 |
| Agent Note | 路径、状态、必需小节 | 取舍是否真实、是否与已落地事实一致 |

### 24.5 什么时候才加门禁

不第一天就上二十个检查器。出现下面的**真实问题**才加：

| 观察到 | 加什么 |
|---|---|
| 新 agent 反复漏读某个子树的规则 | 该子树的局部 `AGENTS.md` |
| 同类操作反复出错 | 操作手册；稳定重复两次以上再提炼成技能 |
| API 或配置清单频繁漂移 | 从源码生成清单 + 新鲜度门禁 |
| 活跃 Note 与源码漂移 | 定期语义审计（格式门禁已经在了） |
| 全仓检查太慢 | 按影响面缩小范围，但先证明不会漏隐式依赖 |
| 用户可见输出回归 | 更多无 key 快照 |
| 迁移风险上升 | 旧数据 fixture 与恢复演练 |

反过来说，**一个没有对应故障的检查器就是纯成本**：它增加每次改动的等待时间，而且第一次误报之后会被人加白名单绕过。宁可少两个门禁，也不要养出「红灯是常态」的习惯。

---

## 25. 从 Python 迁移

### 25.1 现在的事实

已发布的技能是 Python 写的，有用户。产品路径分支上的 `tools/`、`prompts/`、`skills/`、`tests/` 是同一套代码。**产品换语言不等于删掉已经发布的东西。**

### 25.2 六条规则

1. **`tools/` 冻结。** 只接受已发布技能的缺陷修复，不接受新能力。新能力一律进 `packages/`。
2. **`prompts/` 是资产，不是代码。** 蒸馏提示词是纯文本，直接被引擎读取，不重写成代码里的字符串常量。
3. **门禁双跑有期限。** Python 产品文件存在期间，CI 保留 `legacy-python` job；最后一个删除时**删掉**这个 job 和对应文档，而不是留着永久关闭的开关。
4. **治理脚本先 Python、后 TypeScript。** 现在的文档与 Note 门禁是 Python 的；`@distilly/governance` 落地后两者在**同一次 PR 里换手**，不并存两个实现。
5. **迁移器只认 fixture 覆盖过的旧格式。** `distilly migrate` 读元数据里的 schema 字段，遇到没有 fixture 的版本**拒绝并报出版本号**，不猜结构。每个能迁的版本在仓库里有一份真实产物 fixture。
6. **旧产物拆进内核与域。** 工作档里的职责段落进 `domains/vocation.md`，性格档里的说话方式进 `voice.md` 与 `texture.md`，元数据里的血缘进 `lineage.jsonl`。**不保留工作档 / 性格档作为顶层切分。**

### 25.3 退役条件

Python 产品代码可以删除，当且仅当三条同时满足：CLI 覆盖了 `tools/` 里对外的每一个入口；`migrate` 能把现有示例技能完整迁进 `subjects/`；已发布技能的用户有一条写清楚的升级路径。

三条都满足之前，删除是破坏行为。

---

## 26. 落地顺序、验收、本文怎么演进

### 26.1 顺序

1. **TS 骨架与门禁**：workspaces、编译配置、Lint、测试运行器、`pnpm run gates`、CI 加 job。没有产品代码，只让 §24 的命令真实通过。
2. **协议与存储**：`@distilly/protocol` 全部值类型与错误码；`Layout`、`MaterialStore`、`MaterialHasher`、`SubjectStore`。
3. **零 key 主路径**：队列、`pending`、`DraftValidator`、`CommitService`、版本快照、血缘、`get` / `prompt`。同时做 `EngineClient.watch` 的进程内实现——它和 `CommitService` 同源，事后补要动所有脸共用的缝（§16.2）。
4. **修正与置信度闸**：`correct`（§5.3 冻结二）、`promote` / `reject`、集合哈希跳过。
5. **模型与宿主**：`distilly mcp` 五个工具；Claude 与 Codex 注入器；产品技能禁令。
6. **关系**：关系日志、`link` / `invalidate` / `neighbors`、待对齐提及、图投影。
7. **迁移器**：旧技能产物 → `subjects/`，带 fixture。
8. **一个 bot 绑定**（§5.2 项 D）。
9. **插件包**：两个宿主的市场包，本机工具服务器。
10. **守护进程执行者**：有 key 时的后台蒸馏，走同一个 `commit`。
11. **TUI 四屏**（§16.4）：只读，靠 `watch` 重画。它是第一个证明「浏览类聚合已经够用」的调用方。
12. **面板**（§16.3）：回环服务器加静态资源，`EngineClient` 的 HTTP 实现在这一步出现。
13. **相似边、市场、直采适配器。**

第一版明确不做：常驻定时轮询、必填多模态或 embedding key、向量库、显著度裁剪、相似边、在门面包里写死宿主路径。

### 26.2 验收

主路径六步，全程无 key：

```
create(person, space)
  → 宿主扒网 / 用户喂文件 / 委托计划加回收
  → ingest（落盘、哈希、去重、过边界）
  → pending
  → 宿主蒸 → commit（校验、出版本、写血缘）
  → get / prompt（下一次对话加载这一版）
  → correct（进 corrections/，立刻再出一版）
```

1. 用户指定一个人。
2. agent 浏览或截图采到材料，或用户丢进导出文件。
3. `ingest` 去重落盘。
4. 宿主蒸馏并 `commit`。
5. 下次对话 `get` 能加载这一版。
6. 用户 `correct` 一处，再 `get` 能看到，且 `corrections/` 里有记录。

这六步过了，第一版成立。其余产品面往这些方法后面加，**不改 `MaterialIn` 和 `commit` 的形状**。

插件另加 §15.4 四条。总验收第一刀：不登录、不给 key，对一个公开网页人物走完全程，并 `get` 到带例句的声音和带证据的 claim。

治理侧的验收：一个没读过任何历史对话的 agent，靠根 `AGENTS.md`、[docs/README.md](../README.md) 和本文，能在十分钟内说出它要改什么、事实在哪、跑哪条命令、需不需要写 Note。

### 26.3 本文怎么演进

- **改接口先改本文，再改代码。**
- 只编辑本文；`python3 scripts/sync_design_chapters.py` 生成 [v2/](v2/) 的章节投影，文档门禁拒绝漂移。治理脚本换成 TypeScript 后命令改名，规则不变。
- 实现开始后，现在时的已发布事实写进 [architecture.md](../architecture.md)，决策进 Agent Note，本文只在**目标机制**改变时更新（§20.1）。
- §5.2 的开放项关闭时改那张表并注日期；§5.1 的锁定项与 §5.3 的冻结项要改，必须有新 Agent Note 写明被打败的方案。
- **上一版设计**（[system-v1.md](system-v1.md) 与 [v1/](v1/)）已 deprecated。它用 Python 写同一个产品；语言无关的结论已全部在本文重述，所以读它只有一个正当理由：想知道某条结论当初打败了什么。不要为了「保持一致」去改它，也不要在实现里引用它。两版章节号不对应，按主题找。
- 仓库外的会话、画布和未提交草稿**不是规范来源**；缺失的事实先写回本文或 Note。
