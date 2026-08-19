> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

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
