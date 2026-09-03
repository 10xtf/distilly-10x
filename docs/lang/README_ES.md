# Distilly — Developer Preview

Esta página resume la vista previa actual. Consulta el [README raíz](../../README.md) para las instrucciones canónicas completas.

Distilly convierte material proporcionado explícitamente en **Person Profiles for Agents** versionados. La interfaz invocable sigue siendo un Skill; el almacenamiento, el runtime, la revisión y el ciclo de vida del host se entregan como un Plugin local.

## Instalación

La vista previa está en la rama `distilly-plugin` y actualmente está verificada para Codex. Necesitas Node.js `22.19+` o `24`, pnpm `10.32+` y la CLI local de Codex:

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

Reinicia Codex después de instalar. Puedes quitar la integración del host sin borrar personas, perfiles ni materiales locales:

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

OpenClaw y Hermes ya cuentan con bindings locales de compatibilidad. OpenClaw instala y descubre el bundle compatible con Claude; Hermes instala el Skill gestionado y registra el mismo servidor MCP mediante su wrapper y configuración. Ambos bindings ejecutan smoke checks de instalación, descubrimiento y las cinco herramientas. Esta versión aún no tiene un fixture exacto de capacidad de briefing para ninguno de los dos hosts, por lo que setup falla de forma segura antes del briefing y no declara compatibilidad completa de destilación.

El contrato visible para el modelo contiene exactamente cinco herramientas MCP: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` y `distilly_correct`.

## Compatibilidad con el Skill heredado

Los requisitos de Node.js, pnpm y Codex indicados arriba solo se aplican al Plugin nativo de Codex; el modo Legacy no necesita Codex, Node.js ni pnpm, pero su flujo completo depende de que el host admita Skills normales y de contar con capacidades de filesystem, Bash y Python.

Codex es actualmente el único host con capacidad de briefing verificada para el Plugin `distilly-plugin`. OpenClaw y Hermes tienen bindings de compatibilidad, pero aún no un fixture exacto de capacidad. Si un host local de Skills todavía no tiene un binding de Plugin verificado, el usuario puede instalar explícitamente el Skill heredado mantenido en la rama `dot-skill`:

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

Es una implementación independiente sin un modelo de datos compartido compatible. Los collectors heredados pueden usar el espacio de nombres `~/.distilly`; no combines las rutas Legacy y Plugin hasta aislar y auditar esa interacción. Por ahora, la compatibilidad solo cubre archivos locales y texto pegado. No ofrece la autoridad SQLite, las cinco herramientas MCP, el Panel ni el ciclo de vida del Plugin de la Preview. Un fallo de setup o preflight nunca cambia a esta ruta automáticamente. En el mismo ámbito de descubrimiento del host solo debe haber una instalación activa llamada `distilly`; desactiva o retira cualquier otra copia antes de reiniciar. La importación de un repositorio local de Skills para Grok Bot aún no está verificada; por ahora, se recomienda usar un Skill guardado/privado de forma manual.

## Alcance actual

La vista previa acepta archivos TXT, Markdown, JSON y SRT/VTT seleccionados por el usuario, texto pegado y URLs públicas seleccionadas. Codex está verificado para briefings. OpenClaw y Hermes superan los smoke checks locales de compatibilidad para instalación, descubrimiento y las cinco herramientas, pero aún necesitan fixtures exactos de capacidad antes de que el setup de briefing pueda tener éxito. Los bindings nativos de Plugin para Claude Code, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode y Grok Bot aún necesitan fixtures de la comunidad, y Grok Bot no tiene importación local de repositorios verificada.

Consulta la [hoja de ruta](../../ROADMAP.md) y la [actualización de 2026-09](../../UPDATES.md).
