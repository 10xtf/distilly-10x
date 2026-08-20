> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，直接继任者是 [system-v2.md](../system-v2.md)；当前生效合同是 [system-v3.md](../system-v3.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 21. 落地顺序

1. 冻结仓库、包、路径和遥测命名；实时基线只从 architecture、源码与 CI 读取
2. 保持治理、文档、lint 和 Python 矩阵门禁真实通过，再增加产品状态
3. 搬可验证的 adapters 能力 + `Distilly`/`Person` + 进程内引擎 + 新磁盘 + 从当前 schema 迁移
4. MCP 五工具 + 宿主注入（Claude Task / Codex instructions）+ 产品 skill 禁令
5. pending / commit / 置信度闸 / corrections / 集合哈希跳过
6. 关系 jsonl + `link`/`neighbors`/`mentions`
7. 一个 bot 绑定
8. Codex/Claude marketplace 插件包（本地 stdio）
9. daemon 队列（有 key 时）
10. 面板、相似、marketplace、Direct 飞书 API

第一版明确不做：daemon 常驻定时轮询（SDK 不强制）；必填 multimodal/embedding key；向量库；salience 裁剪；相似边；在 `api.py` 写死宿主路径。

---
