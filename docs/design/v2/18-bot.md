> 本章由 [system-v2.md](../system-v2.md) 生成。**v2 已 deprecated**，只作历史记录；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

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
