# Distilly — Developer Preview

이 페이지는 현재 프리뷰를 요약합니다. 전체 기준 안내는 [루트 README](../../README.md)를 확인하세요.

Distilly는 사용자가 명시적으로 제공한 자료를 버전이 있는 **Person Profiles for Agents**로 변환합니다. 호출 표면은 Skill로 유지되며 저장소, 런타임, 검토, 호스트 수명주기는 로컬 Plugin으로 제공합니다.

## 설치

프리뷰는 `codex/distilly-plugin` 브랜치에 있으며 현재 Codex에서 검증되었습니다. Node.js `22.19+` 또는 `24`, pnpm `10.32+`, 로컬 Codex CLI가 필요합니다.

```bash
git clone --branch codex/distilly-plugin https://github.com/titanwings/distilly.git
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

## 현재 범위

사용자가 선택한 TXT, Markdown, JSON, SRT/VTT 파일과 붙여 넣은 텍스트, 공개 URL을 지원합니다. Codex는 검증 완료이며 Claude Code, Grok Bot, OpenCode, Pi agent, DeepSeek Harness (DSH)는 커뮤니티 binding과 fixture가 필요합니다.

[로드맵](../../ROADMAP.md)과 [2026-09 업데이트](../../UPDATES.md)를 참고하세요.
