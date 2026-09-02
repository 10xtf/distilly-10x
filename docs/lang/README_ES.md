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

El contrato visible para el modelo contiene exactamente cinco herramientas MCP: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit` y `distilly_correct`.

## Alcance actual

La vista previa acepta archivos TXT, Markdown, JSON y SRT/VTT seleccionados por el usuario, texto pegado y URLs públicas seleccionadas. Codex está verificado; Claude Code, Grok Bot, OpenCode, Pi agent y DeepSeek Harness (DSH) necesitan bindings y fixtures de la comunidad.

Consulta la [hoja de ruta](../../ROADMAP.md) y la [actualización de 2026-09](../../UPDATES.md).
