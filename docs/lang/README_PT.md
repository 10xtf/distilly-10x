# Distilly — Developer Preview

Esta página resume a versão de prévia atual. Para as instruções canônicas completas, consulte o [README raiz](../../README.md).

Distilly transforma material fornecido explicitamente em **Person Profiles for Agents** versionados. A superfície de chamada continua sendo um Skill; armazenamento, runtime, revisão e ciclo de vida do host são entregues como um Plugin local.

## Instalação

A prévia está na branch `distilly-plugin` e atualmente é verificada no Codex. Você precisa de Node.js `22.19+` ou `24`, pnpm `10.32+` e uma CLI local do Codex:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Reinicie o Codex após a instalação. Remover a integração do host preserva pessoas, perfis e materiais locais:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

O contrato exposto ao modelo tem exatamente cinco ferramentas MCP: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` e `distilly_correct`.

## Compatibilidade com o Skill legado

Os requisitos de Node.js, pnpm e Codex acima aplicam-se apenas ao Plugin nativo do Codex; o modo Legacy não precisa de Codex, Node.js nem pnpm, mas seu fluxo completo depende do suporte do host a Skills comuns e das capacidades de filesystem, Bash e Python.

No momento, Codex é o único host verificado para o Plugin `distilly-plugin`. Em um host local de Skills sem binding de Plugin verificado, o usuário pode escolher explicitamente o Skill legado mantido na branch `dot-skill`:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

É uma implementação independente, sem um modelo de dados compartilhado com suporte. Os collectors legados podem usar o namespace `~/.distilly`; não use os caminhos Legacy e Plugin juntos antes de isolar e auditar essa interação. No momento, a compatibilidade cobre apenas arquivos locais e texto colado. Não oferece a autoridade SQLite, as cinco ferramentas MCP, o Panel nem o ciclo de vida do Plugin da Preview. Uma falha de setup ou preflight nunca muda para esse caminho automaticamente. No mesmo escopo de descoberta do host, mantenha apenas uma instalação ativa chamada `distilly`; desative ou remova as outras antes de reiniciar. A importação de um repositório local de Skills pelo Grok Bot ainda não foi verificada; por enquanto, recomenda-se salvar ou migrar manualmente o fluxo como Skill salvo/privado.

## Escopo atual

A prévia aceita arquivos TXT, Markdown, JSON e SRT/VTT selecionados pelo usuário, texto colado e URLs públicas selecionadas. Codex está verificado; os bindings nativos de Plugin para Claude Code, OpenClaw, Hermes, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode e Grok Bot ainda precisam de fixtures da comunidade, e o Grok Bot não tem importação local de repositório verificada.

Veja o [roadmap](../../ROADMAP.md) e a [atualização de 2026-09](../../UPDATES.md).
