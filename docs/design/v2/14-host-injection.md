> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

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
