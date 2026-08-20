> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

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
