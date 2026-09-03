# Distilly — Developer Preview

Эта страница кратко описывает текущую предварительную версию. Полные канонические инструкции находятся в [корневом README](../../README.md).

Distilly превращает явно предоставленные материалы в версионируемые **Person Profiles for Agents**. Вызываемая поверхность остаётся Skill, а хранилище, runtime, проверка и жизненный цикл host поставляются как локальный Plugin.

## Установка

Предварительная версия находится в ветке `distilly-plugin` и сейчас проверена для Codex. Нужны Node.js `22.19+` или `24`, pnpm `10.32+` и локальная CLI Codex:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
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

## Совместимость с Legacy Skill

Указанные выше требования к Node.js, pnpm и Codex относятся только к нативному Plugin Codex; режим Legacy не требует Codex, Node.js или pnpm, но для полного старого workflow нужны обычная поддержка Skill на стороне host и возможности filesystem, Bash и Python.

Сейчас Codex — единственный host, для которого Plugin `distilly-plugin` прошёл проверку. Если локальный host Skill ещё не имеет проверенного Plugin binding, пользователь может явно установить поддерживаемый Legacy Skill из ветки `dot-skill`:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

Это отдельная реализация без поддерживаемой общей модели данных. Legacy collectors могут использовать пространство имён `~/.distilly`; пока это взаимодействие не будет изолировано и проверено, не используйте Legacy и Plugin одновременно. Сейчас совместимость гарантирует только локальные файлы и вставленный текст. Она не предоставляет SQLite authority, пять MCP-инструментов, Panel или жизненный цикл Plugin из Preview. После ошибки setup или preflight автоматического переключения нет. В одной области обнаружения host оставляйте только одну активную установку `distilly`; перед перезапуском отключите или удалите остальные копии. Импорт локального репозитория Skill в Grok Bot пока не проверен; сейчас рекомендуется только вручную сохранить workflow как saved/private Skill.

## Текущий охват

Поддерживаются выбранные пользователем TXT, Markdown, JSON и SRT/VTT, вставленный текст и выбранные публичные URL. Codex проверен; для нативных Plugin bindings Claude Code, OpenClaw, Hermes, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode и Grok Bot ещё нужны community fixtures; для Grok Bot также нет проверенного импорта локального репозитория.

См. [дорожную карту](../../ROADMAP.md) и [обновление 2026-09](../../UPDATES.md).
