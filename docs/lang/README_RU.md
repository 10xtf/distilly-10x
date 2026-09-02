# Distilly — Developer Preview

Эта страница кратко описывает текущую предварительную версию. Полные канонические инструкции находятся в [корневом README](../../README.md).

Distilly превращает явно предоставленные материалы в версионируемые **Person Profiles for Agents**. Вызываемая поверхность остаётся Skill, а хранилище, runtime, проверка и жизненный цикл host поставляются как локальный Plugin.

## Установка

Предварительная версия находится в ветке `codex/distilly-plugin` и сейчас проверена для Codex. Нужны Node.js `22.19+` или `24`, pnpm `10.32+` и локальная CLI Codex:

```bash
git clone --branch codex/distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

После установки перезапустите Codex. Удаление интеграции host сохраняет людей, профили и локальные материалы:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

Контракт MCP для модели содержит ровно пять инструментов: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` и `distilly_correct`.

## Текущий охват

Поддерживаются выбранные пользователем TXT, Markdown, JSON и SRT/VTT, вставленный текст и выбранные публичные URL. Codex проверен; для Claude Code, Grok Bot, OpenCode, Pi agent и DeepSeek Harness (DSH) нужны community bindings и fixtures.

См. [дорожную карту](../../ROADMAP.md) и [обновление 2026-09](../../UPDATES.md).
