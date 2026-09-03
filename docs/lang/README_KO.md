# Distilly — Developer Preview

이 페이지는 현재 프리뷰를 요약합니다. 전체 기준 안내는 [루트 README](../../README.md)를 확인하세요.

Distilly는 사용자가 명시적으로 제공한 자료를 버전이 있는 **Person Profiles for Agents**로 변환합니다. 호출 표면은 Skill로 유지되며 저장소, 런타임, 검토, 호스트 수명주기는 로컬 Plugin으로 제공합니다.

## 설치

프리뷰는 `distilly-plugin` 브랜치에 있으며 현재 Codex에서 검증되었습니다. Node.js `22.19+` 또는 `24`, pnpm `10.32+`, 로컬 Codex CLI가 필요합니다.

```bash
git clone --branch distilly-plugin https://github.com/titanwings/distilly.git
cd distilly
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node packages/cli/lib/bin.js setup --host codex
node packages/cli/lib/bin.js doctor --host codex
```

설치 후 Codex를 다시 시작하세요. 호스트 연동을 제거해도 사람, Profile, 로컬 자료는 보존됩니다.

```bash
node packages/cli/lib/bin.js uninstall --host codex
```

모델에 노출되는 MCP 계약은 정확히 다섯 가지 도구입니다: `distilly_get`, `distilly_ingest`, `distilly_pending`, `distilly_commit`, `distilly_correct`.

## Legacy Skill 호환 모드

위의 Node.js, pnpm, Codex 사전 조건은 네이티브 Codex Plugin에만 적용되며, Legacy 모드에는 Codex·Node.js·pnpm이 필요하지 않지만 전체 기존 흐름에는 호스트의 일반 Skill 지원과 filesystem·Bash·Python 기능이 필요합니다.

현재 `distilly-plugin` Plugin이 검증된 호스트는 Codex뿐입니다. 아직 검증된 Plugin binding이 없는 로컬 Skill 호스트에서는 사용자가 `dot-skill` 브랜치의 유지 관리용 Legacy Skill을 명시적으로 설치할 수 있습니다.

```bash
git clone --single-branch --branch dot-skill --depth 1 \
  https://github.com/titanwings/distilly.git <host-skills-dir>/distilly
git -C <host-skills-dir>/distilly rev-parse HEAD
```

이는 독립적인 구현이며 지원되는 공유 데이터 모델이 없습니다. Legacy collector가 `~/.distilly` 네임스페이스를 사용할 수 있으므로 해당 상호작용을 격리하고 감사하기 전에는 Legacy와 Plugin 경로를 함께 사용하지 마세요. 현재 호환 경로는 로컬 파일과 붙여 넣은 텍스트만 보장합니다. Preview의 SQLite authority, MCP 도구 5개, Panel, Plugin lifecycle을 제공하지 않습니다. Plugin setup 또는 preflight가 실패해도 자동으로 이 경로로 전환하지 않습니다. 같은 호스트의 discovery scope에는 활성 `distilly` 설치를 하나만 두고, 재시작 전에 다른 복사본을 비활성화하거나 제거하세요. Grok Bot의 로컬 Skill 저장소 import는 아직 검증되지 않았으므로, 현재는 saved/private Skill로 수동 저장하는 방법만 권장합니다.

## 현재 범위

사용자가 선택한 TXT, Markdown, JSON, SRT/VTT 파일과 붙여 넣은 텍스트, 공개 URL을 지원합니다. Codex는 검증 완료이며 Claude Code, OpenClaw, Hermes, DeepSeek Harness (DSH), Pi agent, Grok Build, OpenCode, Grok Bot의 네이티브 Plugin binding에는 커뮤니티 fixture가 필요합니다. Grok Bot은 검증된 로컬 저장소 가져오기도 없습니다.

[로드맵](../../ROADMAP.md)과 [2026-09 업데이트](../../UPDATES.md)를 참고하세요.
