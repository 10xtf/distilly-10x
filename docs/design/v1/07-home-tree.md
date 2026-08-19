> 本章由 [system-v1.md](../system-v1.md) 生成。**v1 已 deprecated**，只作历史记录；生效合同是 [system-v2.md](../system-v2.md)。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

## 7. 家目录文件树（运行时）

家：`~/.distilly/`，可用 `DISTILLY_ROOT` 改。

```
~/.distilly/
├── distilly.toml                      # 根配置（无 key 也能跑）
├── adapters.toml                      # 凭据；secret 字段由框架保管
├── spaces/
│   ├── entrepreneurs.china.toml       # 显示名、是否虚构、默认域包
│   └── anime.naruto.toml
├── subjects/
│   └── <subject-id>/                  # self / wang-xing / luffy
│       ├── manifest.json
│       ├── meta.json                  # schema、身份、provenance、材料集合哈希、lifecycle
│       ├── SKILL.md                   # 投影，可重建，不是事实
│       ├── profile/
│       │   ├── identity.md            # 内核，空合法
│       │   ├── voice.md
│       │   ├── psyche.md
│       │   ├── relations.md
│       │   ├── boundaries.md
│       │   ├── texture.md
│       │   ├── timeline.md            # 可空
│       │   ├── domains/
│       │   │   ├── vocation.md        # 有材料才建
│       │   │   ├── craft.md
│       │   │   ├── intimacy.md
│       │   │   ├── kinship.md
│       │   │   └── public.md
│       │   └── claims.jsonl
│       ├── knowledge/
│       │   ├── messages/
│       │   ├── emails/
│       │   ├── docs/
│       │   ├── web/
│       │   ├── transcripts/
│       │   ├── raw/                   # 图/PDF/音频；未转文本不进蒸馏
│       │   └── corrections/           # 最高信
│       ├── versions/
│       │   ├── vN/                    # 当时整个 profile/ + SKILL + meta
│       │   └── vN-awaiting/           # 置信度下降未顶替
│       ├── lineage.jsonl
│       └── state.json                 # pending / awaiting_promote / 上次集合哈希
├── relations/
│   └── <a>__<b>/                      # 仅「关系也值得蒸」时升级
├── graph/
│   └── relations.jsonl                # 关系事实层，只追加 + valid_to
└── .index/                            # 可删可重建
    ├── sqlite/
    │   ├── queue.db                   # ingest/distill/index + LSN
    │   └── graph.db                   # 节点、关系、mention；派生边以后才有
    └── catalog.json                   # list/search 投影
```

旧 `PRIMARY_ARTIFACTS`（`SKILL.md` `work.md` `persona.md` `work_skill.md` `persona_skill.md` `manifest.json` `meta.json`）迁移时拆进内核/域。迁移器必须读取当前源码定义的 schema 版本，不能假定仓外 prototype 的 v4。`work_skill.md` / `persona_skill.md` 若还要，是 **install 时的切片**，不是家里的结构。

`install(host)`：

```
~/.distilly/subjects/<id>/     ← 唯一事实
        │  install("claude-code")
        ▼
~/.claude/skills/<id>/SKILL.md ← 投影，可再生成
```

血缘和材料不搬家。

---
