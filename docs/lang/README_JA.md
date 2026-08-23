<div align="center">

# 🧬 Distilly

**Formerly: Colleague Skill / colleague-skill（原同事 Skill）**

![Distilly — Distill how they think into Person Profiles for Agents](../social-preview-distilly-v6.png)

### **Distill how they think.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Skill-blueviolet)](https://claude.ai/code)
[![Hermes](https://img.shields.io/badge/Hermes-Skill-orange)](https://github.com/titanwings/colleague-skill)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-teal)](https://github.com/titanwings/colleague-skill)
[![Codex](https://img.shields.io/badge/Codex-Skill-black)](https://learn.chatgpt.com/docs/build-skills)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-Skill-4D6BFE)](https://github.com/topics/dsh-plugin)
[![Pi](https://img.shields.io/badge/Pi-Agent%20Skill-7B61FF)](https://pi.dev/docs/latest/skills)
[![Grok Build](https://img.shields.io/badge/Grok%20Build-Skill-black)](https://docs.x.ai/build/features/skills-plugins-marketplaces)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/NVX66RxWZv)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;同僚が辞めて、メンターが卒業して、チームメイトが異動して——プレイブックもコンテキストも丸ごと持って行かれた？<br>
💞 &nbsp;家族、旧友、パートナーと疎遠になりつつあり——あの頃一緒にいた空気感を手元に残しておきたい？<br>
🌟 &nbsp;憧れの作家、アイドル、思想家には一生会えない——でも、自分の問いに彼らなら何と答えるか知りたい？

</td></tr>
</table>

### ✨ Distilly は人物を再利用可能な Person Profile へ蒸留します。

<br>

Distilly は、人物の根拠ある経験・判断・語り口・仕事の進め方を、AIエージェントや互換Botで再利用できる Person Profile へ蒸留します。

同僚・パートナー・家族・旧友・アイドル・著名人・架空のキャラクター——さらには自分自身まで

**ソース資料 + あなたの説明 → 根拠に基づく Person Profile → Agent / Bot**

<br>

[🆕 What's new](#-このメジャーリリースの新機能) · [📦 データソース](#-対応データソース) · [⚡ インストール](#-インストール) · [🚀 使い方](#-使い方) · [✨ デモ](#-デモ) · [💬 Discord](https://discord.gg/NVX66RxWZv)

[**English**](../../README.md) · [**中文**](README_ZH.md) · [**Español**](README_ES.md) · [**Deutsch**](README_DE.md) · [**Русский**](README_RU.md) · [**Português**](README_PT.md) · [**한국어**](README_KO.md)

</div>

---

<div align="center">

### 🎉 2026.08.13 マイルストーン — **Distilly が 20K ⭐ を突破しました！**

スターをくださった皆さま、本当にありがとうございます——これからもリリースを重ね、蒸留を続けます。

</div>

> 🧬 **2026.08.23 更新** — Creator 名、ディレクトリ名、エントリポイントを **Distilly** に統一しました。Claude Code、Hermes、OpenClaw、Codex、DeepSeek Harness、Pi、Grok Build のローカル Skill 検出を各ホストの現行仕様に沿って記載し、Grok Bot は保存済み Skill の別プレビューフローとして扱います。

> 📝 **2026.06.01 更新** — **[COLLEAGUE.SKILL 技術レポート](https://arxiv.org/pdf/2605.31264) を公開しました**。今回いちばん嬉しいのは paper の公開そのものだけでなく、コミュニティの力で gallery が 165 名のコントリビューターによる 215 skills、skill cards 累計 100k+ stars まで育ち、論文の Acknowledgements に全員を記載できたことです。

> 🗺️ **2026.04.13** — **Distilly Roadmap 公開！** colleague.skill として始まったプロジェクトは、現在 **Distilly** という名称で、同僚に限らずあらゆる人物を蒸留します。 👉 **[Roadmap 全文を読む](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/NVX66RxWZv)**

> 🌐 **2026.04.07** — コミュニティギャラリーが稼働開始！どんな skill や meta-skill でも、自分の GitHub リポジトリへ直接トラフィックを流せます。仲介なし。 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Created by [@titanwings](https://github.com/titanwings)

</div>

---

## 🆕 このメジャーリリースの新機能

### 1️⃣ Colleague Skill から Distilly へ

Distilly は「同僚」シナリオだけを想定した作りではありません。`distilly` Creator は、同じワークフローで3つの人物ファミリー向けに根拠に基づく Person Profile を作成し、それぞれを Agent Skill としてパッケージ化します。Creator Skill とエントリポイントの正式名称は `distilly` です。

### 2️⃣ 3つのキャラクターファミリー

<table>
<thead>
<tr>
<th width="33%" align="center">🧑‍💼 colleague</th>
<th width="33%" align="center">💞 relationship</th>
<th width="33%" align="center">🌟 celebrity</th>
</tr>
</thead>
<tbody>
<tr>
<td align="center"><sub>同僚・メンター・チームメイト・上下流のパートナー</sub></td>
<td align="center"><sub>元恋人・パートナー・両親・友人・身近な家族</sub></td>
<td align="center"><sub>著名人・クリエイター・論客・架空のキャラクター</sub></td>
</tr>
<tr>
<td><sub>Work Skill + Persona の二層アーキテクチャ——技術基準やワークフローと、話し方や職場での立ち居振る舞いの両方を学習します。Lark / DingTalk / Slack の自動収集に対応。</sub></td>
<td><sub>🆕 <b>写真共有機能が近日登場</b> — 蒸留された関係性は、メッセージに返信するだけではありません。実在の人のように写真を送り、日常の一コマを共有してくれるようになります。</sub></td>
<td><sub><b>6次元リサーチの完全なツールチェーン</b>（字幕ダウンロード → トランスクリプト整形 → リサーチ統合 → 品質チェック）を標準装備。単なる口調模倣ではなく、ソースから確認できる思考・意思決定パターンを再構成します。</sub></td>
</tr>
</tbody>
</table>

各ファミリーは独自の素材収集戦略、分析軸、Person Profile 構造を持ちます。

### 3️⃣ 対応Agentホストの拡大

Distilly は、7つのローカル Agent ホストに対応しています：

| 対応ホスト |
|------------|
| 🟣 **Claude Code** |
| 🟠 **Hermes Agent** |
| 🔵 **OpenClaw** |
| ⚫ **Codex** |
| 🔷 **DeepSeek Harness** |
| 🟢 **Pi coding agent** |
| ⚪ **Grok Build** |

生成された各 Person Profile は Agent Skill としてパッケージ化され、対応ホストの Skill ディレクトリに配置できます。

**Grok Bot（preview）** は別の手動フローです。Distilly の workflow を保存済み private Skill へ手動で移行し、対象の Bot で有効にします。このリポジトリの `SKILL.md` を Grok Bot に直接インストールする方法は、公式文書になく、検証もされていません。

---

## 📦 対応データソース

| ソース | メッセージ | ドキュメント / Wiki | スプレッドシート | 備考 |
|--------|:--------:|:-----------:|:------------:|------|
| 🟢 Lark（自動） | ✅ API | ✅ | ✅ | 名前を入力するだけで全自動 |
| 🟡 DingTalk（自動） | ⚠️ ブラウザ | ✅ | ✅ | DingTalk API はメッセージ履歴に非対応 |
| 🟣 Slack（自動） | ✅ API | — | — | 管理者による Bot 導入が必要；無料プランは 90 日制限 |
| 𝕏 公開 X 投稿 | ✅ API | — | — | Xquik 経由の任意・件数制限付き celebrity リサーチ候補 |
| 💬 WeChat チャット履歴 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 で先にエクスポート |
| 📄 PDF / 画像 / スクリーンショット | — | ✅ | — | 手動アップロード |
| 📦 Lark JSON エクスポート | ✅ | ✅ | — | 手動アップロード |
| ✉️ メール `.eml` / `.mbox` | ✅ | — | — | 手動アップロード |
| 📝 Markdown / 直接貼り付け | ✅ | ✅ | — | 手動入力 |

> 現在の Lark 互換 collector は中国リージョンのエンドポイントを使用しています。国際版 `larksuite.com` テナントへのルーティングはまだ実装されていません。

---

## ⚡ インストール

いまは 2026 年——あなたには Agent がいます。自分でインストールさせましょう。お使いのローカルホストを開いて、この一行を渡してください：

> Distilly をインストールして：`https://github.com/titanwings/colleague-skill`

Agent は現在のホストの skills ディレクトリを検出し、リポジトリを `distilly` として clone して、ホストが Distilly を検出できることを確認します。

<details>
<summary><b>🛠️ 自分でインストールしたい？パスはこちら</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| ホスト | `<TARGET>` パス |
|------|-----------------|
| Claude Code | `~/.claude/skills/distilly` |
| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
| Codex | `~/.agents/skills/distilly` |
| DeepSeek Harness | `~/.dsh/skills/distilly` または `<project>/.dsh/skills/distilly` |
| Pi coding agent | `~/.pi/agent/skills/distilly` または `~/.agents/skills/distilly` |
| Grok Build | `~/.grok/skills/distilly` または `~/.agents/skills/distilly` |
| Hermes | clone 後に `python3 tools/install_hermes_skill.py --force` を実行 |

</details>

> **旧インストールからの移行：** `dot-skill` という名前の古い clone、または以前の Codex パス `~/.codex/skills` 配下にある clone は、`git pull` だけでは新しい `distilly` エントリをホストが確実に検出できません。古い clone のルートで、対象ホストに合うリポジトリ内インストーラーを実行してください：
>
> ```bash
> python3 tools/install_openclaw_skill.py --force
> python3 tools/install_codex_skill.py --force
> python3 tools/install_hermes_skill.py --force
> ```
>
> または、上の表にある対象ホストの canonical な `distilly` パスへリポジトリを clone し直します。まずホストが Distilly を検出できることを確認し、その後で古いディレクトリを手動で扱ってください。自動削除は推奨しません。設定やメタデータの legacy fallback は古いデータとの互換性だけを目的としており、既存のインストールディレクトリを自動的に改名するものではありません。

> Lark/DingTalk 自動収集のクレデンシャル、各ホストへのインストール方法、Grok Bot の preview フロー、Windows の互換性情報などは **[詳細インストールガイド (INSTALL.md)](../../INSTALL.md)** を参照してください。

---

## 🚀 使い方

Distilly の作成フローでは、まずどのファミリーを蒸留するか聞かれます：`colleague`、`relationship`、`celebrity` のいずれか。

次にニックネーム、基本情報、性格タグを入力し、データソースを選びます。すべての項目はスキップ可能——説明文だけでも Person Profile を生成できます。

生成後、Profile は `{character}-{slug}` という名前の Skill としてパッケージ化され、対応する任意のホストにインストールできます。

#### 統一インストーラーで生成済み Skill をインストールする

このリポジトリのルートで次を実行します：

```bash
python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
```

`<host>` に指定できる値は `hermes`、`deepseek-harness`、`pi`、`grok-build` です。デフォルトではユーザー単位でインストールされます。プロジェクト単位でインストールする場合は、対応する `--skills-dir` を追加します：

| ホスト | デフォルトのインストール先 | プロジェクト用パラメータとインストール先 |
|--------|----------------------------|------------------------------------------|
| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |

Hermes のプロジェクトは `hermes skills trust` で trust する必要があります。インストール後は Hermes の新しいセッションを開始するか、`/reload-skills` を実行してください。

Hermes はデフォルトでは `~/.agents/skills` を検索しません。Hermes でこのパスを使うのは、`skills.external_dirs` に明示的に設定した場合だけです。

インストーラーは、legacy のアンダースコア形式の frontmatter 名をインストール先のコピーだけで canonical kebab 形式の `{character}-{slug}` に正規化します。ソースディレクトリは変更しません。インストール先に入るのは自己完結型の `SKILL.md` と `.distilly-install.json` だけで、非公開の元素材はコピーされません。

### 🔬 Celebrity Research Toolchain

`celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：

公開 X 投稿の収集は任意です。API キーは環境変数 `XQUIK_API_KEY` からのみ読み込まれます。公開クエリは第三者サービス Xquik に送信され、返された投稿数に応じて課金され、credits を消費する場合があるため、Agent は実行前に `--limit` を確認します。

出力 JSON は信頼できない証拠候補として扱います。著者と permalink を検証し、対象本人の投稿だけを短文の一次資料として使用し、長文の一次資料や意思決定の記録より低い重みにします。第三者の投稿は補助資料に格下げするか破棄し、著作権に配慮した言い換えだけを残します。読み取り後は Skill ディレクトリ外の一時ファイルを削除します。

Xquik は独立した第三者サービスであり、X Corp. との提携関係はありません。「Twitter」と「X」は X Corp. の商標です。

```bash
# 動画の字幕をダウンロード
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# 字幕 → トランスクリプト
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# 公開 X 投稿の候補 → 一時的な正規化 JSON（任意）
python3 tools/research/xquik_public_posts.py \
  --username "<public-handle>" \
  --limit 20 \
  --output "/tmp/distilly-x-public-posts.json"

# Agent が候補を検証・言い換えした後に削除
rm "/tmp/distilly-x-public-posts.json"

# リサーチノートを統合
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# 品質チェック
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

---

## ✨ デモ

各ファミリーから 1 つずつ。

<br>

### 🌟 celebrity — Andrej Karpathy を蒸留

> 6 次元リサーチ：著作・インタビュー・意思決定・表現 DNA・外部評価・タイムライン<br>
> コミュニティの成果 [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill) を参考にしたケース

```
User            ❯ みんな Agent の話ばかりしてますが、2026 年の AI Agent はどうなると思いますか？

celebrity.skill ❯ 誰もがデモを作ってる、誰も eval をやっていない。
                  Agent のボトルネックはずっとモデルの知能じゃない——スキャフォールディングだ：
                  厳格な評価ハーネス、細粒度のエラーリプレイ、
                  制御可能なツール呼び出しバジェット、クリーンな失敗モード分析。
                  ほとんどのプロダクトは今も「API + いくつかのツール + システムプロンプトをラップ」の段階で止まっている。
                  それはデモであって agent ではない。
                  2026 年、俺が賭けるのは最強のモデルじゃない——最良のスキャフォールディングと、
                  最も厳格な eval に賭ける。
```

<br>

### 🧑‍💼 colleague — ByteDance L2-1 バックエンドを蒸留

> 入力：`ByteDance L2-1 バックエンドエンジニア、INTJ、責任転嫁体質、ByteDance カルチャー`

```
User            ❯ この API 設計、レビューしてもらえる？

colleague.skill ❯ ちょっと待って——影響範囲は？背景がまだ説明されてないけど。
                  （読んだ後）N+1 クエリ、直して。標準の
                  {code, message, data} レスポンス形式を使うこと。それが規約、
                  理由は聞かないで。

User            ❯ このバグ、君が入れたんじゃない？

colleague.skill ❯ タイムラインは合ってる？あの機能は複数箇所に手が入ってて、
                  他の変更もあったはずだよ。
```

<br>

### 💞 relationship — 片想い中の相手を蒸留

> 半年分のチャット履歴 ＋「繊細、物静かだけど芯は強い、肝心なときはちゃんと返信してくれる」をアップロード

```
User               ❯ 今日、私のこと考えた？

relationship.skill ❯ ……ちょっとだけね。なんで訊くの？
```

<div align="center">

📚 実例はさらに **[コミュニティギャラリー](https://titanwings.github.io/colleague-skill-site/)** に——100+ の skill が集まり続けています

</div>

---

## 🔧 機能

### 🧱 生成される Skill の構造

Distilly は **Persona** を共通の土台とし、その上にファミリー固有モジュールを重ねる構成です：

| ファミリー | Persona の内容 | 追加モジュール |
|--------|-----------------|-------------------|
| 🧑‍💼 **colleague** | 6 層の性格構造：ハードルール → アイデンティティ → 表現スタイル → 意思決定 → 対人行動 → Correction | ➕ **Work Skill**：担当領域、ワークフロー、出力の好み、経験知識ベース |
| 💞 **relationship** | 表現 DNA・感情トリガー・衝突パターン・修復パターン | — |
| 🌟 **celebrity** | 思考モデル・意思決定ヒューリスティクス・表現 DNA・外部評価とのコントラスト | ➕ 6 次元リサーチドシエ（著作/インタビュー/意思決定/タイムライン…） |

> **実行フロー**：タスク受信 → Persona が態度と口調を決定 → 追加モジュールが実行ディテールを埋める → その人の声で出力

### 🧬 進化メカニズム

- 📥 **ファイル追加** → 自動で差分分析 → 関連セクションにマージ、既存の結論は上書きしない
- 💬 **会話による修正** → 「彼はそんなことしない、xxx のはず」と伝える → Correction レイヤーに書き込まれ、即座に反映
- 🕰️ **バージョン管理** → 更新のたびに自動アーカイブ、任意の過去バージョンへロールバック可能
- 🔬 **Celebrity リサーチパイプライン** → 字幕 → トランスクリプト整形 → 6 次元リサーチ → 品質チェック

---

## 📂 プロジェクト構造

本プロジェクトは [AgentSkills](https://agentskills.io) オープン標準に準拠しています。リポジトリ全体がひとつの skill ディレクトリです：

```
distilly/
├── SKILL.md                        # skill entry point (official frontmatter)
├── prompts/                        # prompt system across three families
│   ├── intake.md                   #   [colleague] info intake
│   ├── work_analyzer.md            #   [colleague] work capability extraction
│   ├── persona_analyzer.md         #   [colleague] personality extraction
│   ├── work_builder.md             #   [colleague] work.md generation
│   ├── persona_builder.md          #   [colleague] persona.md 6-layer structure
│   ├── merger.md                   #   [shared] incremental merge logic
│   ├── correction_handler.md       #   [shared] conversation correction
│   ├── relationship/               #   [relationship] emotion/conflict/repair prompts
│   └── celebrity/                  #   [celebrity] six-dimension research + mental-model prompts
├── tools/                          # Python tools
│   ├── feishu_auto_collector.py    #   [colleague] Lark 対応自動コレクター
│   ├── dingtalk_auto_collector.py  #   [colleague] DingTalk auto-collector
│   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
│   ├── email_parser.py             #   [shared] email parser
│   ├── research/                   #   [celebrity] celebrity research toolchain
│   │   ├── download_subtitles.sh   #     subtitle download
│   │   ├── transcribe_audio.py     #     audio → text
│   │   ├── srt_to_transcript.py    #     subtitles → transcript
│   │   ├── xquik_public_posts.py   #     public X posts → normalized candidates
│   │   ├── merge_research.py       #     six-dimension research merge
│   │   └── quality_check.py        #     quality check
│   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
│   ├── skill_writer.py             #   [shared] skill file management
│   └── version_manager.py          #   [shared] version archive & rollback
├── skills/                         # generated Skills (gitignored)
│   ├── colleague/                  #   colleagues
│   ├── relationship/               #   close relationships
│   └── celebrity/                  #   public figures
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ 注意事項

**ソース素材の品質 = Person Profile の品質** — そして質の高いソースはファミリーごとに異なります：

| ファミリー | ソースの優先順位（高 → 低） |
|--------|------------------------------|
| 🧑‍💼 **colleague** | **本人が書いた**長文（設計ドキュメント／レビューコメント）**›** **意思決定に関する返信** **›** 雑談チャット |
| 💞 **relationship** | 完全なチャット履歴 **›** 手紙／SNS 投稿／日記 **›** 第三者による描写 |
| 🌟 **celebrity** | 長文の一次資料（本人の書籍／ブログ／長尺インタビュー） **›** 意思決定記録（リリース、コードコミット、Q&A） **›** 検証済みの対象本人による短文投稿 **›** 第三者のコメント |

- **colleague** Lark 自動収集：関連グループチャットに App Bot を追加する必要があります
- **relationship**：時間スパンが長いほど良く、衝突と修復の両方をカバーした素材が理想的です
- **celebrity**：二次解釈だけを食わせるのは避けてください
- これはまだデモ版です——バグを見つけたら issue を立ててください！

---

## 📄 技術レポート

> **[COLLEAGUE.SKILL: Automated AI Skill Generation via Expert Knowledge Distillation](https://arxiv.org/pdf/2605.31264)** ([arXiv](https://arxiv.org/abs/2605.31264) · [arXiv PDF](https://arxiv.org/pdf/2605.31264))
>
> これは Distilly の前身である **colleague.skill** の論文です。Work Skill + Persona の二層アーキテクチャ、マルチソースデータ収集、Skill 生成メカニズムを扱っており、今日の `colleague` ファミリーの理論的基盤となっています。relationship / celebrity ファミリーの拡張については、別途論文の公開を予定しています。

---

## ⭐ Star History

<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

**MIT License** © [titanwings](https://github.com/titanwings)

<sub>Made with 🧬 for everyone who wants to distill a person into a reusable Person Profile.</sub>

</div>
