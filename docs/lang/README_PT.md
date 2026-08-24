<div align="center">

# 🧬 Distilly

**Anteriormente: Colleague Skill / colleague-skill.**

![Distilly — Distill how they think into Person Profiles for Agents](../social-preview-distilly-v7.png)

### **Distill how they think.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://python.org)
[![AgentSkills](https://img.shields.io/badge/AgentSkills-Standard-green)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/titanwings/colleague-skill?style=social)](https://github.com/titanwings/colleague-skill/stargazers)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?logo=discord&logoColor=white)](https://discord.gg/NVX66RxWZv)

<br>

<table>
<tr><td align="left">

🧑‍💼 &nbsp;Seu colega pediu demissão, seu mentor se formou, seu parceiro de time foi transferido — levando junto todo o playbook e contexto?<br>
💞 &nbsp;Sua família, amigos antigos, seu parceiro(a) se distanciando — e você quer preservar o jeito que era estar com eles?<br>
🌟 &nbsp;Seu autor favorito, ídolo, pensador que você nunca vai conhecer — mas quer saber o que eles diriam sobre a sua pergunta?

</td></tr>
</table>

### ✨ Distilly transforma pessoas em Person Profiles reutilizáveis.

<br>

A Distilly transforma a experiência, o julgamento, a voz e as formas de trabalhar de uma pessoa, sustentados por fontes, em um Person Profile reutilizável por agentes de IA e bots compatíveis.

Colegas · parceiros · família · amigos antigos · ídolos · figuras públicas · personagens fictícios — até você mesmo

**Materiais de origem + sua descrição → um Person Profile baseado em evidências → seu Agent ou bot compatível**

<br>

[🆕 Novidades](#-o-que-há-de-novo-nesta-grande-versão) · [📦 Fontes de dados](#-fontes-de-dados-suportadas) · [⚡ Instalação](#-instalação) · [🚀 Uso](#-uso) · [✨ Demo](#-demo) · [💬 Discord](https://discord.gg/NVX66RxWZv)

[**Inglês**](../../README.md) · [**Chinês**](README_ZH.md) · [**Espanhol**](README_ES.md) · [**Alemão**](README_DE.md) · [**Japonês**](README_JA.md) · [**Russo**](README_RU.md) · [**Coreano**](README_KO.md)

</div>

---

<div align="center">

### 🎉 Marco 2026.08.13 — **Distilly ultrapassou 20K ⭐!**

Um obrigado enorme a todos que deram estrela — seguiremos lançando, seguiremos destilando.

</div>

> 🧬 **Atualização 2026.08.24** — O nome do creator, o diretório e o ponto de entrada agora são **Distilly** de ponta a ponta. A descoberta local de Skills é compatível com Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi, Grok Build e OpenCode; o Grok Bot permanece separado como preview de saved Skills.

> 📝 **Atualização 2026.06.01** — **[O relatório técnico do COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) já está disponível**; o que mais nos deixa felizes não é apenas publicar um paper, mas ver a comunidade levar a galeria a 215 skills de 165 contribuidores e 100k+ stars acumuladas em skill cards, com todos os contribuidores reconhecidos nos Acknowledgements.

> 🗺️ **2026.04.13** — **O Roadmap da Distilly está no ar!** O projeto que começou como colleague.skill agora se chama **Distilly** — destile qualquer pessoa, não apenas colegas. 👉 **[Roadmap completo](../../ROADMAP.md)** · **[💬 Discord](https://discord.gg/NVX66RxWZv)**

> 🌐 **2026.04.07** — A galeria comunitária está no ar! Qualquer skill ou meta-skill pode direcionar tráfego diretamente para o seu próprio repositório do GitHub. Sem intermediários. 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**

<div align="center">

Criado por [@titanwings](https://github.com/titanwings)

</div>

---

## 🆕 O que há de novo nesta grande versão?

### 1️⃣ De Colleague Skill para Distilly

A Distilly não é mais construída apenas em torno do cenário de “colega”. O creator `distilly` cria Person Profiles baseados em fontes para três famílias de pessoas em um único fluxo e empacota cada Profile como Agent Skill. O nome canônico do Skill do creator e de seu diretório é `distilly`.

### 2️⃣ Três famílias de personagens

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
<td align="center"><sub>Colegas de trabalho · mentores · parceiros de time · parceiros upstream/downstream</sub></td>
<td align="center"><sub>Ex-parceiros · parceiros atuais · pais · amigos · família próxima</sub></td>
<td align="center"><sub>Figuras públicas · criadores · vozes públicas · personagens fictícios</sub></td>
</tr>
<tr>
<td><sub>Arquitetura de duas camadas Work Skill + Persona — aprende tanto os padrões técnicos e workflows quanto o jeito de falar e a postura profissional. Suporta coleta automática em Lark / DingTalk / Slack.</sub></td>
<td><sub>🆕 <b>Recurso de compartilhamento de fotos em breve</b> — sua relação destilada não vai só responder mensagens; ela vai mandar fotos e compartilhar pedaços do dia, do jeito que uma pessoa real faria.</sub></td>
<td><sub>Vem com uma <b>cadeia de ferramentas de pesquisa em seis dimensões</b> completa (legendas → limpeza de transcrição → merge de pesquisa → checagem de qualidade). Não se limita a imitar o tom: reconstrói, com base nas fontes, padrões observáveis de raciocínio e decisão.</sub></td>
</tr>
</tbody>
</table>

Cada família tem sua própria estratégia de coleta de fontes, dimensões de análise e estrutura de Person Profile.

### 3️⃣ Mais hosts de Agent

A versão antiga rodava só no Claude Code. Agora oito hosts locais descobrem a Distilly nativamente pelo formato `SKILL.md`:

<table>
<tr>
<td align="center" width="25%"><a href="https://claude.ai/code"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/claude-code-wordmark-dark.svg"><img src="../assets/hosts/claude-code-wordmark-light.svg" alt="Claude Code" height="28"></picture></a></td>
<td align="center" width="25%"><a href="https://github.com/NousResearch/hermes-agent"><img src="../assets/hosts/hermes-agent-wordmark.png" alt="Hermes Agent" height="32"></a></td>
<td align="center" width="25%"><a href="https://github.com/openclaw/openclaw"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/openclaw-wordmark-dark.svg"><img src="../assets/hosts/openclaw-wordmark-light.svg" alt="OpenClaw" height="38"></picture></a></td>
<td align="center" width="25%"><a href="https://github.com/openai/codex" title="Codex"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/codex-mark-dark.png"><img src="../assets/hosts/codex-mark-light.png" alt="Codex" height="64"></picture></a></td>
</tr>
<tr>
<td align="center" width="25%"><a href="https://github.com/deepseek-ai/deepseek-harness"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/deepseek-wordmark-dark.svg"><img src="../assets/hosts/deepseek-wordmark-light.svg" alt="DeepSeek Harness" height="32"></picture></a></td>
<td align="center" width="25%"><a href="https://pi.dev/docs/latest/skills"><img src="../assets/hosts/pi-mark.svg" alt="Pi coding agent" height="46"></a></td>
<td align="center" width="25%"><a href="https://docs.x.ai/build/features/skills-plugins-marketplaces"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/grok-build-mark-dark.png"><img src="../assets/hosts/grok-build-mark-light.png" alt="Grok Build" height="46"></picture></a></td>
<td align="center" width="25%"><a href="https://opencode.ai/docs/skills"><picture><source media="(prefers-color-scheme: dark)" srcset="../assets/hosts/opencode-wordmark-dark.svg"><img src="../assets/hosts/opencode-wordmark-light.svg" alt="OpenCode" height="32"></picture></a></td>
</tr>
</table>

Cada Person Profile gerado é empacotado como Agent Skill e pode ser colocado no diretório de Skills de cada host.

**Preview no Grok Bot:** migração manual como private saved skill. A instalação direta do `SKILL.md` deste repositório no Grok Bot não está documentada oficialmente nem foi verificada.

---

## 📦 Fontes de dados suportadas

| Fonte | Mensagens | Docs / Wiki | Planilhas | Notas |
|-------|:---------:|:-----------:|:---------:|-------|
| 🟢 Lark (auto) | ✅ API | ✅ | ✅ | Basta digitar um nome, totalmente automático |
| 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | A API do DingTalk não dá acesso ao histórico de mensagens |
| 🟣 Slack (auto) | ✅ API | — | — | Precisa que o admin instale o Bot; plano gratuito limitado a 90 dias |
| 𝕏 Posts públicos do X | ✅ API | — | — | Candidatos opcionais e limitados para pesquisa de celebrity via Xquik |
| 💬 Histórico do WeChat | ✅ SQLite | — | — | Exportar antes com WeChatMsg ou PyWxDump |
| 📄 PDF / Imagens / Screenshots | — | ✅ | — | Upload manual |
| 📦 Export JSON do Lark | ✅ | ✅ | — | Upload manual |
| ✉️ Email `.eml` / `.mbox` | ✅ | — | — | Upload manual |
| 📝 Markdown / colar direto | ✅ | ✅ | — | Entrada manual |

> **Nota de compatibilidade do Lark:** o coletor compatível atual usa os endpoints da região da China. O roteamento pelos endpoints internacionais de `larksuite.com` ainda não foi implementado.

---

## ⚡ Instalação

É 2026 — você tem um Agent, deixa ele se instalar sozinho. Abra seu Claude Code / Hermes / OpenClaw / Codex / DeepSeek Harness / Pi coding agent / Grok Build / OpenCode e mande esta linha para ele:

> Instala a Distilly pra mim: `https://github.com/titanwings/colleague-skill`

O Agent vai detectar o diretório de skills do host atual, clonar o repositório e permitir que o host descubra a Distilly.

<details>
<summary><b>🛠️ Quer instalar na mão? Clique para ver os caminhos</b></summary>

<br>

```bash
git clone https://github.com/titanwings/colleague-skill <TARGET>
```

| Host | Caminho `<TARGET>` |
|------|--------------------|
| Claude Code | `~/.claude/skills/distilly` |
| Hermes | Depois de clonar, rode `python3 tools/install_hermes_skill.py --force` |
| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
| Codex | `~/.agents/skills/distilly` |
| DeepSeek Harness | `~/.dsh/skills/distilly` ou `.dsh/skills/distilly` no projeto |
| Pi coding agent | `~/.pi/agent/skills/distilly` ou `~/.agents/skills/distilly` |
| Grok Build | `~/.grok/skills/distilly` ou `~/.agents/skills/distilly` |
| OpenCode | `~/.config/opencode/skills/distilly` (usuário) ou `.opencode/skills/distilly` (projeto) |

</details>

> **Migração de uma instalação existente:** um clone que ainda se chama `dot-skill`, ou que permanece na raiz legada `~/.codex/skills`, não tem garantia de expor a nova entrada `distilly` após apenas um `git pull`. Na raiz do clone antigo, execute o instalador de repositório aplicável (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py` ou `tools/install_hermes_skill.py`) ou clone novamente no caminho canônico `distilly` do host mostrado acima. Primeiro verifique se o host descobre a Distilly; depois decida manualmente como tratar o diretório antigo, sem apagá-lo automaticamente. Os fallbacks legados de config/meta mantêm os dados antigos legíveis, mas não renomeiam um diretório instalado.

Instale um Skill de personagem gerado a partir da raiz do repositório com o instalador unificado:

```bash
python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
```

Os valores válidos de `<host>` são `hermes`, `deepseek-harness`, `pi`, `grok-build` e `opencode`. O padrão é uma instalação no nível do usuário; para instalar no projeto, adicione o `--skills-dir` correspondente:

| Host | Diretório instalado por padrão | Override e diretório instalado no projeto |
|------|--------------------------------|-------------------------------------------|
| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |

O instalador normaliza o frontmatter legado com underscores para o nome canônico em kebab case `{character}-{slug}` somente na cópia instalada e mantém o diretório de origem inalterado. O diretório instalado contém apenas o `SKILL.md` autocontido e `.distilly-install.json`; os materiais de origem privados do diretório gerado não são copiados.

Para instalar o Hermes no nível do projeto, primeiro marque o projeto como confiável com `hermes skills trust`. Depois da instalação, inicie uma nova sessão do Hermes ou execute `/reload-skills`. `~/.agents/skills` não é um diretório padrão do Hermes; ele só é usado quando adicionado explicitamente a `skills.external_dirs`.

> Para credenciais de coleta automática do Lark/DingTalk, mais detalhes de instalação, o status de preview do Grok Bot e notas de compatibilidade, veja o **[Guia de Instalação Detalhado (INSTALL.md)](../../INSTALL.md)**

---

## 🚀 Uso

A Distilly primeiro pergunta qual família você quer destilar: `colleague` · `relationship` · `celebrity`.

Depois, informe apelido, dados básicos, tags de personalidade e escolha uma fonte de dados. Todos os campos podem ser pulados — até mesmo só uma descrição já consegue criar um Person Profile.

O Profile é empacotado como um Skill chamado `{character}-{slug}` (Persona + Work).

### 🔬 Celebrity Research Toolchain

A família `celebrity` vem com uma cadeia de pesquisa fim-a-fim, das legendas até o rascunho finalizado:

```bash
# Baixar legendas de vídeo
bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"

# Legendas → transcrição
python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"

# Candidatos de posts públicos do X → JSON normalizado (opcional)
python3 tools/research/xquik_public_posts.py \
  --username "<public-handle>" \
  --limit 20 \
  --output "/tmp/distilly-x-public-posts.json"

# O Agent verifica autor e permalink e leva apenas paráfrases seguras para as notas de pesquisa.

# Merge das notas de pesquisa
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# Apagar os candidatos temporários do X depois da leitura
rm "/tmp/distilly-x-public-posts.json"

# Checagem de qualidade
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

`XQUIK_API_KEY` é lida somente do ambiente. A requisição envia a consulta pública ao provedor terceiro Xquik; a cobrança é feita por tweet retornado e pode consumir créditos. Por isso, o Agent deve confirmar o valor de `--limit` antes de executar a ferramenta.

O JSON contém evidência candidata não confiável, e não evidência aceita automaticamente: verifique o autor e o permalink. Somente posts curtos da própria pessoa-alvo podem servir como evidência primária de formato curto, sempre com peso menor que fontes primárias longas ou registros de decisões. Posts de terceiros devem ser rebaixados ou descartados. Mantenha apenas paráfrases seguras do ponto de vista de direitos autorais, nunca salve o arquivo candidato dentro do Skill gerado e apague-o depois da leitura.

Xquik é um serviço independente de terceiros e não é afiliado à X Corp. “Twitter” e “X” são marcas registradas da X Corp.

---

## ✨ Demo

Um exemplo de cada família.

<br>

### 🌟 celebrity — destilando Andrej Karpathy

> Pesquisa em seis dimensões: obras · entrevistas · decisões · DNA de expressão · avaliações externas · linha do tempo<br>
> Caso adaptado do trabalho comunitário [alchaincyf/karpathy-skill](https://github.com/alchaincyf/karpathy-skill)

```
Usuário         ❯ Todo mundo tá falando de Agents agora — como você imagina o AI Agent de 2026?

celebrity.skill ❯ Todo mundo faz demo, ninguém faz eval.
                  O gargalo do Agent nunca foi a inteligência do modelo — é o scaffolding:
                  um harness de avaliação rigoroso, replay de erros com granularidade fina,
                  orçamentos controláveis de tool-calling, análise limpa de modos de falha.
                  A maioria dos produtos ainda tá presa em "envelopa uma API + algumas tools + um system prompt."
                  Isso é demo, não é agent.
                  Em 2026 eu não aposto no modelo mais forte — aposto no melhor
                  scaffolding e no eval mais rigoroso.
```

<br>

### 🧑‍💼 colleague — destilando um backend L2-1 da ByteDance

> Entrada: `engenheiro backend L2-1 da ByteDance, INTJ, empurra a responsabilidade, estilo ByteDance`

```
Usuário         ❯ Pode revisar esse design de API?

distilly ❯ Peraí — qual é o impacto? Você não explicou o contexto.
                  (depois de ler) Query N+1, corrige isso. Usa o formato
                  padrão de resposta {code, message, data}. Isso é convenção,
                  não pergunta por quê.

Usuário         ❯ Esse bug foi você que introduziu, né?

distilly ❯ A timeline bate? Essa feature mexeu em vários lugares,
                  teve outros commits também.
```

<br>

### 💞 relationship — destilando alguém por quem você tem uma queda

> Upload de meio ano de histórico de conversa + "sensível, quieto mas teimoso, responde de verdade quando é importante"

```
Usuário            ❯ Pensou em mim hoje?

relationship.skill ❯ ...pensei, um pouquinho. Por que tá perguntando?
```

<div align="center">

📚 Mais casos do mundo real na **[galeria comunitária](https://titanwings.github.io/colleague-skill-site/)** — mais de 100 skills e contando

</div>

---

## 🔧 Funcionalidades

### 🧱 Estrutura do Skill gerado

A Distilly usa **Persona** como a base universal, com módulos específicos de cada família em cima:

| Família | Conteúdo da Persona | Módulos Adicionais |
|---------|---------------------|---------------------|
| 🧑‍💼 **colleague** | Personalidade em 6 camadas: regras rígidas → identidade → expressão → decisões → interpessoal → Correção | ➕ **Work Skill**: escopo, workflow, preferências de output, base de conhecimento de experiência |
| 💞 **relationship** | DNA de expressão · gatilhos emocionais · padrão de conflito · padrão de reparo | — |
| 🌟 **celebrity** | Modelos mentais · heurísticas de decisão · DNA de expressão · contraste com avaliação externa | ➕ Dossiê de pesquisa em seis dimensões (obras / entrevistas / decisões / linha do tempo...) |

> **Execução**: Receber tarefa → Persona decide atitude e tom → Módulos adicionais preenchem o detalhe de execução → Output na voz dele

### 🧬 Evolução

- 📥 **Adicionar arquivos** → auto-análise de delta → merge nas seções relevantes, nunca sobrescreve conclusões existentes
- 💬 **Correção por conversa** → diga "ele não faria isso, ele seria xxx" → escreve na camada de Correção, efeito imediato
- 🕰️ **Controle de versão** → auto-arquivamento a cada atualização, rollback para qualquer versão anterior
- 🔬 **Pipeline de pesquisa de celebrity** → legendas → limpeza de transcrição → pesquisa em seis dimensões → checagem de qualidade

---

## 📂 Estrutura do projeto

Este projeto segue o padrão aberto [AgentSkills](https://agentskills.io). O repositório inteiro é um diretório de skill:

```
distilly/
├── SKILL.md                        # ponto de entrada do skill (frontmatter oficial)
├── prompts/                        # sistema de prompts através das três famílias
│   ├── intake.md                   #   [colleague] intake de informação
│   ├── work_analyzer.md            #   [colleague] extração de capacidade de trabalho
│   ├── persona_analyzer.md         #   [colleague] extração de personalidade
│   ├── work_builder.md             #   [colleague] geração de work.md
│   ├── persona_builder.md          #   [colleague] estrutura em 6 camadas do persona.md
│   ├── merger.md                   #   [shared] lógica de merge incremental
│   ├── correction_handler.md       #   [shared] correção por conversa
│   ├── relationship/               #   [relationship] prompts de emoção/conflito/reparo
│   └── celebrity/                  #   [celebrity] pesquisa em seis dimensões + prompts de modelo mental
├── tools/                          # ferramentas Python
│   ├── feishu_auto_collector.py    #   [colleague] coletor automático do Lark
│   ├── dingtalk_auto_collector.py  #   [colleague] coletor automático do DingTalk
│   ├── slack_auto_collector.py     #   [colleague] coletor automático do Slack
│   ├── email_parser.py             #   [shared] parser de email
│   ├── research/                   #   [celebrity] cadeia de pesquisa de celebrity
│   │   ├── download_subtitles.sh   #     download de legendas
│   │   ├── transcribe_audio.py     #     áudio → texto
│   │   ├── srt_to_transcript.py    #     legendas → transcrição
│   │   ├── xquik_public_posts.py   #     posts públicos do X → JSON candidato
│   │   ├── merge_research.py       #     merge de pesquisa em seis dimensões
│   │   └── quality_check.py        #     checagem de qualidade
│   ├── install_*_skill.py          #   [shared] instaladores one-shot multi-host
│   ├── skill_writer.py             #   [shared] gestão de arquivos de skill
│   └── version_manager.py          #   [shared] arquivamento e rollback de versões
├── skills/                         # Skills gerados (gitignored)
│   ├── colleague/                  #   colegas
│   ├── relationship/               #   relações próximas
│   └── celebrity/                  #   figuras públicas
├── docs/PRD.md
├── requirements.txt
└── LICENSE
```

---

## ⚠️ Observações

**Qualidade do material fonte = Qualidade do Person Profile** — e as boas fontes variam conforme a família:

| Família | Prioridade de fontes (alta → baixa) |
|---------|-------------------------------------|
| 🧑‍💼 **colleague** | **Textos longos escritos pela própria pessoa** (docs de design / comentários de review) **›** **respostas de tomada de decisão** **›** chat casual em grupo |
| 💞 **relationship** | Histórico completo de conversa **›** cartas / posts em redes sociais / diários **›** descrições de terceiros |
| 🌟 **celebrity** | Fontes primárias longas (livros / blogs / entrevistas longas em primeira pessoa) **›** registros de decisão (lançamentos, commits, Q&A) **›** posts curtos verificados da pessoa-alvo **›** comentários de terceiros |

- **colleague** coleta automática do Lark: requer adicionar o bot do App aos grupos relevantes
- **relationship**: janelas de tempo mais longas são melhores; material cobrindo tanto conflito quanto reparo é ideal
- **celebrity**: evite alimentar só interpretações de segunda mão
- Esta ainda é uma versão demo — por favor crie issues se encontrar bugs!

---

## 📄 Relatório Técnico

> **[COLLEAGUE.SKILL: Automated AI Skill Generation via Expert Knowledge Distillation](https://arxiv.org/pdf/2605.31264)** ([arXiv](https://arxiv.org/abs/2605.31264) · [arXiv PDF](https://arxiv.org/pdf/2605.31264))
>
> Este é o paper do **colleague.skill**, antecessor da Distilly. Ele cobre a arquitetura de duas camadas Work Skill + Persona, coleta de dados multi-fonte e a mecânica de geração de Skills — a base teórica da família `colleague` atual. Papers separados sobre as extensões das famílias relationship / celebrity estão planejados.

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

<sub>Feito com 🧬 para quem quer destilar uma pessoa em um Person Profile reutilizável.</sub>

</div>
