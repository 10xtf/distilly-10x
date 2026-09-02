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

## Escopo atual

A prévia aceita arquivos TXT, Markdown, JSON e SRT/VTT selecionados pelo usuário, texto colado e URLs públicas selecionadas. Codex está verificado; Claude Code, Grok Bot, OpenCode, Pi agent e DeepSeek Harness (DSH) precisam de bindings e fixtures da comunidade.

Veja o [roadmap](../../ROADMAP.md) e a [atualização de 2026-09](../../UPDATES.md).
