> 本章由 [system-v2.md](../system-v2.md) 生成，属于生效的目标合同；当前已发布行为以 [architecture.md](../../architecture.md) 为准。请只编辑父文件，然后运行 `python3 scripts/sync_design_chapters.py`。

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
