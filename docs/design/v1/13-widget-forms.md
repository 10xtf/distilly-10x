> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，只作历史记录；生效合同是 [system-v2.md](../system-v2.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 13. 问人表单是什么

不是一种表单控件，是一份「问人」的适配 skill。不决定问什么，只决定：在这个宿主上，结构化问题用什么原生 UI 问出来。

网页能渲染的富控件，Codex/Claude 渲染不了。所以先抽中性字段再翻译：

| 语义类型 | 意思 |
|---|---|
| `short_text` | 一行文本 |
| `explicit_consent` | 必须用户主动确认，不能预勾 |
| `playable_single_choice` | 单选，选项上能带试听 |
| `playable_preview` | 只展示，不提交 |
| `audio_reference` | 表单里不能上传；让用户把文件附到对话上 |

- Codex：`ask_followup_questions`，MCP App 卡片。不要输出 HTML。
- Claude：Elicitation / `show_widget`。**禁止**调 `ask_followup_questions`。

distilly 若第一版要在 Codex 里问「蒸哪个人 / 选哪个版本」，才需要这一层。只做 get/ingest/commit、用对话能问清楚的，可以先不做。判据是**选项集是不是封闭且带媒体**——一旦要问「从这十段语音里选一段」，纯对话一定会问乱。

---
