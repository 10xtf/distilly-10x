# Distilly 설치 안내

> Distilly의 이전 이름은 **Colleague Skill / colleague-skill**이다. 현재 생성기 이름과 설치 디렉터리는 모두 `distilly`다.

---

<a id="existing-install-migration"></a>

## 기존 설치본에서 이전

기존 clone 디렉터리 이름이 아직 `dot-skill`이라면 `git pull`만으로는 호스트 발견 디렉터리가 `distilly`로 바뀌지 않는다. Codex의 구 디렉터리 `~/.codex/skills/` 도 현재의 `~/.agents/skills/` 로 자동 이전되지 않는다. 기존 사본은 롤백용으로 남겨 두고, 새 canonical 사본을 먼저 설치해 검증한다.

| 호스트 | 1회성 이전 대상 |
|------|--------------|
| Claude Code | `~/.claude/skills/distilly` 또는 프로젝트 `.claude/skills/distilly` |
| OpenClaw | 기존 clone 루트에서 `python3 tools/install_openclaw_skill.py --force` 실행 |
| Hermes | 기존 clone 루트에서 `python3 tools/install_hermes_skill.py --force` 실행 |
| Codex | 기존 clone 루트에서 `python3 tools/install_codex_skill.py --force` 실행. 대상은 `~/.agents/skills/distilly` |
| DeepSeek Harness | `~/.dsh/skills/distilly`, `$DSH_HOME/skills/distilly` 또는 프로젝트 `.dsh/skills/distilly` 로 재clone |
| Pi coding agent | `~/.pi/agent/skills/distilly` 또는 `~/.agents/skills/distilly` 로 재clone |
| Grok Build | `~/.grok/skills/distilly` 또는 `~/.agents/skills/distilly` 로 재clone |
| OpenCode | `~/.config/opencode/skills/distilly` 또는 프로젝트 `.opencode/skills/distilly` 로 재clone |

아래 방법으로 호스트가 Distilly를 발견했는지 확인한 뒤 기존 설치 디렉터리를 직접 정리한다. 설치기는 구 사본을 자동으로 삭제하지 않는다. `~/.colleague-skill/` 설정과 구 인물 Skill 메타데이터에 대한 읽기 전용 호환 폴백도 호스트 설치 디렉터리 이름을 바꾸지 않는다.

---

## 플랫폼 선택

### A. Claude Code (권장)

이 프로젝트는 공식 [AgentSkills](https://agentskills.io) 표준을 따르며, 저장소 전체가 곧 skill 디렉터리다. Claude skills 디렉터리로 clone하면 된다.

```bash
# ⚠️ 반드시 git 저장소 루트에서 실행할 것
cd $(git rev-parse --show-toplevel)

# 방법 1: 현재 프로젝트에 설치
mkdir -p .claude/skills
git clone https://github.com/titanwings/distilly .claude/skills/distilly

# 방법 2: 전역 설치 (모든 프로젝트에서 사용)
git clone https://github.com/titanwings/distilly ~/.claude/skills/distilly
```

이후 Claude Code에서 `/distilly` 를 입력하면 시작된다.

호환 호스트:
- Claude Code
- OpenClaw
- Hermes
- Codex
- DeepSeek Harness
- Pi coding agent
- Grok Build
- OpenCode

호스트별 명시적 호출 문법은 다음과 같다.

| 호스트 | 생성기 명령 |
|------|------------|
| Claude Code | `/distilly` |
| Hermes | `/distilly` |
| OpenClaw | `/distilly`. native slash가 등록되지 않았으면 `/skill distilly` |
| Codex | `$distilly` 또는 `/skills` 에서 선택 |
| DeepSeek Harness | `/distilly` |
| Pi coding agent | `/skill:distilly` |
| Grok Build | `/distilly` |
| OpenCode | 네이티브 Skill 도구가 필요할 때 로드한다. 별도 slash 명령 없음 |

Distilly가 이미 특정 인물 Skill을 생성했고 그것을 특정 호스트에서 바로 쓰고 싶다면 해당 설치기를 실행한다.

```bash
python3 tools/install_claude_generated_skill.py --skill-dir skills/{character}/{slug} --force
python3 tools/install_openclaw_generated_skill.py --skill-dir skills/{character}/{slug} --force
python3 tools/install_codex_generated_skill.py --skill-dir skills/{character}/{slug} --force
```

생성된 Skill의 이름은 `{character}-{slug}` 다. Claude Code / Hermes / DeepSeek Harness / Grok Build 등 slash-name 호스트에서의 호출 형식은 다음과 같다.

```text
/{character}-{slug}
```

Codex에서는 `$` 로 호출한다.

```text
${character}-{slug}
```

Pi에서는 `/skill:{character}-{slug}` 를 쓴다.

Windows의 Claude 설치기는 현재의 skill 발견 문제를 우회하기 위해 `~/.claude/commands/{character}-{slug}.md` 를 추가로 기록한다.

생성된 Skill은 character family에 따라 기록된다.
- `colleague` → `./skills/colleague/`
- `relationship` → `./skills/relationship/`
- `celebrity` → `./skills/celebrity/`

호스트 호출에 쓰이는 `SKILL.md` 는 Persona + Work를 이미 자기완결적으로 담고 있다. 생성 Skill을 설치할 때는 공용 설치기를 쓴다. 설치기는 이 파일과 `.distilly-install.json` 만 기록하며, 사적인 원본 자료가 들어 있을 수 있는 생성 디렉터리 전체를 복사하지 않는다. 구버전 밑줄 frontmatter는 설치 사본에서만 `{character}-{slug}` 로 정규화하고 원본 Skill은 수정하지 않는다.

```bash
python3 tools/install_generated_skill.py \
  --skill-dir "skills/{character}/{slug}" \
  --host <host> \
  --force
```

| 호스트 | `<host>` | 기본 사용자 레벨 대상 | 프로젝트 레벨 `--skills-dir` |
|------|----------|----------------|----------------------|
| Claude Code | `claude-code` | `~/.claude/skills/{character}-{slug}/SKILL.md` | `.claude/skills` |
| OpenClaw | `openclaw` | `~/.openclaw/workspace/skills/{character}-{slug}/SKILL.md` | 사용자 지정 Skills 디렉터리 |
| Hermes | `hermes` | `~/.hermes/skills/distilly-generated/{character}-{slug}/SKILL.md` | `.hermes/skills` (신뢰 프로젝트) |
| Codex | `codex` | `~/.agents/skills/{character}-{slug}/SKILL.md` | `.agents/skills` |
| DeepSeek Harness | `deepseek-harness` | `~/.dsh/skills/{character}-{slug}/SKILL.md` | `.dsh/skills` |
| Pi coding agent | `pi` | `~/.pi/agent/skills/{character}-{slug}/SKILL.md` | `.pi/skills` |
| Grok Build | `grok-build` | `~/.grok/skills/{character}-{slug}/SKILL.md` | `.grok/skills` |
| OpenCode | `opencode` | `~/.config/opencode/skills/{character}-{slug}/SKILL.md` | `.opencode/skills` |

---

### B. OpenClaw

```bash
python3 tools/install_openclaw_skill.py --force
```

또는 clone 방식을 계속 써도 된다.

```bash
git clone https://github.com/titanwings/distilly ~/.openclaw/workspace/skills/distilly
```

OpenClaw 세션을 재시작하고 `/distilly` 로 시작한다. 현재 채널에 native slash가 등록되지 않았다면 `/skill distilly` 를 쓴다.

---

### C. Hermes

저장소에 포함된 설치기로 현재 repo를 Hermes의 로컬 skill 디렉터리에 동기화하는 방식을 권장한다.

```bash
python3 tools/install_hermes_skill.py --force
hermes skills list | rg distilly
```

설치가 끝나면 Hermes에서 다음과 같이 쓴다.

```text
/distilly
```

인물 Skill은 `install_generated_skill.py --host hermes` 로 설치한 뒤 `/{character}-{slug}` 로 호출한다. 프로젝트 레벨 설치는 `--skills-dir .hermes/skills` 를 덧붙이고, 프로젝트 루트에서 `hermes skills trust` 를 먼저 실행한다. 설치 후 새 세션을 열거나 `/reload-skills` 로 다시 스캔한다. `~/.agents/skills` 는 Hermes 기본 디렉터리가 아니다. `~/.hermes/config.yaml` 의 `skills.external_dirs` 에 명시적으로 설정해야 스캔한다.

설치 대상만 미리 확인하려면 다음을 실행한다.

```bash
python3 tools/install_hermes_skill.py --dry-run
```

---

### D. Codex

저장소에 포함된 설치기로 현재 repo를 Codex의 로컬 skill 디렉터리에 동기화하는 방식을 권장한다.

```bash
python3 tools/install_codex_skill.py --force
```

또는 clone 방식을 계속 써도 된다.

```bash
git clone https://github.com/titanwings/distilly ~/.agents/skills/distilly
```

Codex는 현재 `~/.agents/skills/` 에서 사용자 Skill을 발견한다. 설치 후 `$distilly` 로 명시 호출하거나 `/skills` 에서 선택한다. 생성된 인물 Skill은 `{character}-{slug}` 라는 skill 이름으로 `~/.agents/skills/` 아래에 설치된다.

---

### E. DeepSeek Harness

DeepSeek Harness는 filesystem skill을 네이티브로 발견하므로 별도 플러그인 매니페스트나 래퍼 스크립트가 필요 없다. 설치 범위를 하나 고른다.

```bash
# 방법 1: 현재 프로젝트에 설치
mkdir -p .dsh/skills
git clone https://github.com/titanwings/distilly .dsh/skills/distilly

# 방법 2: 전역 설치 (모든 프로젝트에서 사용)
mkdir -p ~/.dsh/skills
git clone https://github.com/titanwings/distilly ~/.dsh/skills/distilly
```

`DSH_HOME` 이 설정돼 있으면 전역 디렉터리는 `$DSH_HOME/skills/distilly` 가 된다. 설치 후 DeepSeek Harness에서 `/distilly` 를 입력하거나 Agent에게 Distilly 시작을 직접 요청한다.

생성된 역할 Skill은 `install_generated_skill.py --host deepseek-harness` 로 설치한다. 프로젝트 레벨 설치는 `--skills-dir .dsh/skills` 를 덧붙인다. 설치기는 사본에서 구버전 frontmatter를 정규화한다.

---

### F. Pi coding agent

> 여기서 말하는 Pi는 [pi.dev](https://pi.dev/docs/latest/skills) 의 coding agent다.

```bash
# Pi 전용 사용자 디렉터리
mkdir -p ~/.pi/agent/skills
git clone https://github.com/titanwings/distilly ~/.pi/agent/skills/distilly

# 또는 여러 호스트가 공유하는 디렉터리
mkdir -p ~/.agents/skills
git clone https://github.com/titanwings/distilly ~/.agents/skills/distilly
```

명시적 호출 명령은 `/distilly` 가 아니라 `/skill:distilly` 다.

생성된 인물 Skill은 `install_generated_skill.py --host pi` 로 설치한다. 프로젝트 레벨 설치는 `--skills-dir .pi/skills` 를 덧붙이고, 이후 `/skill:{character}-{slug}` 로 호출한다.

---

### G. Grok Build

```bash
# Grok 전용 사용자 디렉터리
mkdir -p ~/.grok/skills
git clone https://github.com/titanwings/distilly ~/.grok/skills/distilly

# 또는 여러 호스트가 공유하는 디렉터리
mkdir -p ~/.agents/skills
git clone https://github.com/titanwings/distilly ~/.agents/skills/distilly
```

Grok Build는 Skill 디렉터리의 `SKILL.md` 를 발견하며, 명시적 호출 명령은 `/distilly` 다. 해당 머신에 Python과 Distilly가 요구하는 의존성은 여전히 설치돼 있어야 한다.

생성된 인물 Skill은 `install_generated_skill.py --host grok-build` 로 설치한다. 프로젝트 레벨 설치는 `--skills-dir .grok/skills` 를 덧붙이고, 이후 `/{character}-{slug}` 로 호출한다.

---

### H. OpenCode

OpenCode는 사용자 레벨과 프로젝트 레벨 Skill 디렉터리를 네이티브로 발견한다.

```bash
# 사용자 레벨
git clone https://github.com/titanwings/distilly ~/.config/opencode/skills/distilly

# 프로젝트 레벨
mkdir -p .opencode/skills
git clone https://github.com/titanwings/distilly .opencode/skills/distilly
```

생성된 인물 Skill은 `install_generated_skill.py --host opencode` 로 설치한다. 프로젝트 레벨 설치는 `--skills-dir .opencode/skills` 를 덧붙인다. 디렉터리 규칙은 [OpenCode Agent Skills](https://opencode.ai/docs/skills) 를 참고한다.

---

### I. Grok Bot (프리뷰)

Grok Bot은 문서화된 절차나 데모를 private Skill로 저장한 뒤 Settings → Plugins 에서 활성화하고 `/` 메뉴에서 선택하는 방식을 지원한다.

공식 문서에는 Grok Bot이 로컬 Skill 디렉터리를 스캔한다거나 이 저장소의 `SKILL.md` 를 직접 임포트할 수 있다는 설명이 없다. 따라서 현재로서는 Distilly 절차를 수동으로 saved Skill로 옮기는 방법만 가능하며, 저장소를 원클릭으로 Grok Bot에 설치할 수 있다고 설명해서는 안 된다.

---

## 의존성 설치

이 Skill은 외부 서비스를 호출하지 않는다. 자료는 파일 업로드와 텍스트 붙여넣기로만 들어온다.

```bash
# requirements.txt 에 선언된 Python 의존성 설치 (Python 3.9+)
pip3 install -r requirements.txt
```

### 데이터 소스별 방식 선택

| 상황 | 권장 방식 |
|------|---------|
| 이메일 `.eml` / `.mbox` 보유 | `email_parser.py` |
| PDF / 이미지 / 스크린샷 보유 | `Read` 도구로 직접 업로드 |
| 메신저 대화 기록 | 내보내기 후 텍스트로 붙여넣기 |
| 그 외 문서 | Markdown / TXT로 변환해 업로드 |

메신저·SNS 자동 수집기는 제공하지 않는다. 자격증명을 저장하는 코드가 없으므로
토큰이나 API 키를 이 Skill에 설정할 일이 없다.

---

### 유명 인물 조사 툴체인 (선택)

`celebrity` 유형은 사용자가 제공한 조사 노트를 병합해 품질 검사까지 진행할 수 있다.
자료 수집 자체는 사용자가 수행하고, 이 Skill은 정리·검증만 담당한다.

```bash
# 확인이 끝난 조사 노트 병합
python3 tools/research/merge_research.py "./skills/celebrity/<slug>"

# 품질 검사
python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
```

두 도구 모두 로컬 파일만 읽고 쓴다. 네트워크를 타지 않는다.

전사본, 자막, 긴 원문 구절은 skill 디렉터리에 저장하지 않는다.
`knowledge/research/raw/` 에는 출처 메타데이터가 붙은 짧은 의역 노트만 넣는다.

---


## 빠른 검증

```bash
cd <distilly-install-path>   # 예: ~/.claude/skills/distilly 또는 ~/.dsh/skills/distilly

# 이메일 파서 확인
python3 tools/email_parser.py --help

# Hermes 설치기 확인
python3 tools/install_hermes_skill.py --dry-run

# OpenClaw / Codex 설치기 확인
python3 tools/install_openclaw_skill.py --dry-run
python3 tools/install_codex_skill.py --dry-run

# celebrity research toolchain 확인
python3 tools/research/merge_research.py --help
python3 tools/research/quality_check.py --help

# 기존 인물 Skill 목록 조회
python3 tools/skill_writer.py --action list --base-dir ./skills/colleague
```

---

## 디렉터리 구조 설명

이 프로젝트는 저장소 전체가 하나의 skill 디렉터리다 (AgentSkills 표준 형식).

```
distilly/               ← 호스트의 skills/distilly/ 로 clone (예: .claude/skills 또는 .dsh/skills)
├── SKILL.md            # skill 진입점 (공식 frontmatter)
├── prompt_kor/         # 분석·생성용 한국어 Prompt 템플릿
├── tools/              # Python 도구 스크립트
│   ├── install_hermes_skill.py   # Hermes 로컬 설치기
│   ├── install_openclaw_skill.py # OpenClaw 로컬 설치기
│   ├── install_codex_skill.py    # Codex 로컬 설치기
│   ├── install_openclaw_generated_skill.py # OpenClaw 역할 Skill 설치기
│   ├── install_codex_generated_skill.py    # Codex 역할 Skill 설치기
│   ├── email_parser.py           # 이메일 파서 (로컬 .eml/.mbox)
│   └── research/
│       ├── merge_research.py               # 조사 노트 병합 (로컬 전용)
│       └── quality_check.py                # 품질 검사 (로컬 전용)
├── docs/               # 문서 (PRD 등)
│
└── skills/             # Distilly가 생성한 인물 Skill (.gitignore 제외 대상)
    └── {character}/
        └── {slug}/
            ├── SKILL.md        # 완성 Skill (Persona + Work)
            ├── work.md         # 업무 능력만
            ├── persona.md      # 인물 성격만
            ├── meta.json       # 메타데이터
            ├── versions/       # 이력 버전
            └── knowledge/      # 원본 자료 보관
```
