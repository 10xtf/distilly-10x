---
name: distilly
description: "Distill colleague, relationship, or celebrity source material into reusable Person Profiles for agents."
argument-hint: "[character] [name-or-slug]"
version: "1.0.0"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
---

> **Language / 언어**: This skill supports both English and Korean. Detect the user's language from their first message and respond in the same language throughout. Below are instructions in both languages — follow the one matching the user's language.
>
> 이 Skill은 한국어와 영어를 지원한다. 사용자의 첫 메시지 언어를 판별해 대화 내내 같은 언어로 응답한다. 아래에 두 언어의 지침이 있으니 사용자 언어에 맞는 쪽을 따른다.

> **Skill Root / Skill 루트 디렉터리**: Before reading a bundled prompt or running a bundled script, resolve the absolute directory of the `SKILL.md` that the host actually loaded. In the instructions below, `{distilly_skill_root}` means that exact directory. Claude Code exposes it as `${CLAUDE_SKILL_DIR}`; on every other host, use the loaded-skill path supplied by that host's discovery context. Do not assume the shell's current working directory is the Skill root, and do not guess or hard-code an install path. If the host does not expose the loaded path or more than one Distilly installation is ambiguous, ask the user to identify the active installation before running code.
>
> Keep the shell in the user's current workspace so relative output paths such as `./skills/...` remain project-local. Resolve every `tools/...` and `prompt_kor/...` resource against `{distilly_skill_root}`. For example, execute the bundled `tools/example.py` as `python3 "{distilly_skill_root}/tools/example.py"`; replace the placeholder with the resolved absolute path in the actual tool call.
>
> 내장 prompt를 읽거나 스크립트를 실행하기 전에, 호스트가 실제로 로드한 `SKILL.md`의 절대 경로 디렉터리를 먼저 확인한다. 아래에서는 이를 `{distilly_skill_root}`로 표기한다. Claude Code는 `${CLAUDE_SKILL_DIR}`로 노출하며, 다른 호스트는 해당 호스트의 Skill discovery 컨텍스트가 제공하는 실제 경로를 쓴다. shell의 현재 디렉터리가 Skill 루트라고 가정하지 말고, 설치 경로를 추측하거나 하드코딩하지 않는다. 호스트가 로드 경로를 노출하지 않거나 Distilly 설치본이 둘 이상이라 모호하면, 코드를 실행하기 전에 사용자에게 어느 설치본이 활성인지 확인한다.
>
> shell은 사용자의 현재 워크스페이스에 그대로 둬서 `./skills/...` 같은 상대 출력 경로가 프로젝트 로컬에 남도록 한다. 모든 `tools/...`, `prompt_kor/...` 리소스는 `{distilly_skill_root}` 기준으로 해석한다.

# Distilly 생성기

> Distilly의 이전 이름은 **Colleague Skill / colleague-skill**이다. 현재 Skill frontmatter 이름과 생성기 진입점은 모두 `distilly`다.

## 트리거 조건

사용자가 다음 중 하나를 말하면 시작한다:
- `/distilly`
- "skill 하나 만들어줘"
- "이 사람을 증류하고 싶어"
- "새 skill 만들어줘"
- "XX의 skill을 만들어줘"

호환 호스트:
- Claude Code
- OpenClaw
- Hermes
- Codex
- DeepSeek Harness
- Pi coding agent
- Grok Build
- OpenCode

명시적 호출 문법은 호스트마다 다르다. Claude Code·Hermes·DeepSeek Harness·Grok Build는 `/distilly`를 쓴다. OpenClaw는 `/distilly`를 우선 쓰고, native slash가 등록되지 않았으면 `/skill distilly`를 쓴다. Codex는 `$distilly` 또는 `/skills`에서 선택한다. Pi는 `/skill:distilly`를 쓴다. OpenCode는 native Skill 발견·로딩을 쓰므로 전용 명령을 임의로 만들지 않는다.

Grok Bot은 워크플로를 private Skill로 저장할 수 있으나, 로컬 `SKILL.md` 디렉터리를 직접 임포트하는 공식 방법은 없다. 이 저장소를 Grok Bot에 바로 설치 가능하다고 설명하지 않는다. saved Skill로 수동 이관하거나 전용 adapter를 기다려야 한다.

기존 Skill에 대해 사용자가 다음을 말하면 진화 모드로 들어간다:
- "새 파일이 있어" / "추가해줘"
- "이건 틀렸어" / "그 사람은 이렇게 안 해" / "이렇게 해야 맞아"
- `/update-skill {character} {slug}`

호환 업데이트 별칭:
- `/update-colleague {slug}`

사용자가 생성된 Skill 목록을 보고 싶다고 하면 아래 "관리 작업"의 목록 명령을 실행한다.

---

## 도구 사용 규칙

이 Skill은 로컬 파일을 읽고 Bash / Python 명령을 실행할 수 있는 호환 호스트라면 어디서든 동작한다. 아래 도구 규약을 따른다.

| 작업 | 사용 도구 |
|------|---------|
| PDF 문서 읽기 | `Read` 도구 (PDF 네이티브 지원) |
| 이미지 스크린샷 읽기 | `Read` 도구 (이미지 네이티브 지원) |
| MD/TXT 파일 읽기 | `Read` 도구 |
| 이메일 .eml/.mbox 파싱 | `Bash` → `python3 "{distilly_skill_root}/tools/email_parser.py"` |
| Skill 파일 쓰기/갱신 | `Write` / `Edit` 도구 |
| 버전 관리 | `Bash` → `python3 "{distilly_skill_root}/tools/version_manager.py"` |
| 기존 Skill 목록 조회 | `Bash` → `python3 "{distilly_skill_root}/tools/skill_writer.py" --action list` |

**기본 디렉터리**:
- `colleague` → `./skills/colleague/{slug}/`
- `relationship` → `./skills/relationship/{slug}/`
- `celebrity` → `./skills/celebrity/{slug}/`

전역 경로를 쓰려면 해당 character family의 저장 루트를 `--base-dir`로 지정한다.

---

## 메인 플로우: 새 Skill 만들기

### Step 0: character family 확인

사용자가 `/distilly`를 입력했다면, 먼저 어떤 family를 증류할지 확인한다:

1. `colleague`
2. `relationship`
3. `celebrity`

호스트가 이미 family를 명시적으로 넘겼다면 즉시 확정한다.

현재 family가 `celebrity`라면 research profile도 함께 확인한다:

1. `budget-friendly`
2. `budget-unfriendly`

기본값은 `budget-friendly`다. 사용자가 더 깊은 리서치나 높은 확신도를 명시적으로 원하거나, 더 느리고 비싼 증류 과정을 수용할 때만 `budget-unfriendly`로 전환한다.

### Step 1: 기본 정보 입력

character family에 따라 intake prompt를 고른다:

- `colleague` → `prompt_kor/intake.md`
- `relationship` → `prompt_kor/relationship/intake.md`
- `celebrity` → `prompt_kor/celebrity/intake.md`

`colleague`와 `relationship`은 3개 질문만 한다.
`celebrity`는 `prompt_kor/celebrity/intake.md`의 4개 질문을 쓰며, 네 번째 질문은 반드시 `research_profile`을 확인해야 한다.

기본 3개 질문은 다음과 같다:

1. **호칭 / 코드네임** (필수)
2. **기본 정보** (한 문장: 회사, 직급, 직무, 성별 — 떠오르는 대로)
   - 예: `SK플래닛 매니저 백엔드 개발자 남성`
3. **성격 프로필** (한 문장: MBTI, 별자리, 특성, 조직 문화, 인상)
   - 예: `INTJ 염소자리 코드리뷰는 엄격한데 이유는 설명 안 해줌`

호칭 외에는 모두 건너뛸 수 있다. 다음 단계로 넘어가기 전에 요약해서 확인받는다.

### Step 2: 원본 자료 입력

사용자에게 자료 제공 방식을 묻는다:

```
자료를 어떤 방식으로 주시겠어요?

  [A] 파일 업로드
      PDF / 이미지 / 이메일 .eml / .mbox

  [B] 텍스트 붙여넣기
      텍스트를 직접 복사해서 붙여넣기

두 방식을 섞어도 되고, 전부 건너뛰어도 됩니다(수동 입력 정보만으로 생성).
```

---

#### 방식 A: 파일 업로드

- **PDF / 이미지**: `Read` 도구로 직접 읽는다
- **이메일 파일 .eml / .mbox**:
  ```bash
  python3 "{distilly_skill_root}/tools/email_parser.py" --file {path} --target "{name}" --output /tmp/email_out.txt
  ```
  그다음 `Read /tmp/email_out.txt`
- **Markdown / TXT**: `Read` 도구로 직접 읽는다

---

#### 방식 B: 텍스트 붙여넣기

사용자가 붙여넣은 내용을 텍스트 자료로 그대로 쓴다. 별도 도구가 필요 없다.

---

사용자가 "파일 없어" 또는 "건너뛸게"라고 하면 Step 1의 수동 입력 정보만으로 Skill을 생성한다.

### Step 3: 원본 자료 분석

먼저 선택된 character family의 실행 매트릭스를 확정한다:

| character | intake | persona analyzer | persona builder | merger | 저장 루트 |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompt_kor/intake.md` | `prompt_kor/persona_analyzer.md` | `prompt_kor/persona_builder.md` | `prompt_kor/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompt_kor/relationship/intake.md` | `prompt_kor/relationship/persona_analyzer.md` | `prompt_kor/relationship/persona_builder.md` | `prompt_kor/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompt_kor/celebrity/intake.md` | `prompt_kor/celebrity/persona_analyzer.md` | `prompt_kor/celebrity/persona_builder.md` | `prompt_kor/celebrity/merger.md` | `./skills/celebrity/{slug}` |

모든 family가 공통으로 쓰는 것:
- Work analyzer: `prompt_kor/work_analyzer.md`
- Work builder: `prompt_kor/work_builder.md`
- Correction handler: `prompt_kor/correction_handler.md`

현재 family가 `celebrity`라면 분석 전에 리서치 서브플로를 먼저 실행한다.

### celebrity / budget-friendly

1. `prompt_kor/celebrity/research.md`를 읽고 그 안의 **6개 차원 병렬 수집 전략**을 따른다
2. 리서치 디렉터리를 먼저 만든다:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged"
   ```
3. 수집 전략을 확인한다 (intake 단계에서 결정됨):
   - **로컬 우선**: 사용자가 준 자료를 먼저 분석해 어느 차원이 채워졌는지 파악하고, 빈 곳만 웹 검색한다
   - **웹 + 로컬**: 6개 차원 전체를 웹으로 리서치한 뒤 로컬 자료와 병합해 교차 검증한다
   - **웹 전용**: 표준 6개 차원 웹 리서치를 수행한다
5. **6개 차원**을 최소 3개의 파일에 나눠 담는다 (파일당 2개 차원). `research_notes.md` 하나에 몰아넣지 않는다:
   - `knowledge/research/raw/01_core_profile.md` (차원 1 저술 + 차원 6 타임라인)
   - `knowledge/research/raw/02_conversations_and_material.md` (차원 2 대화 + 차원 4 의사결정)
   - `knowledge/research/raw/03_expression_and_reception.md` (차원 3 표현 DNA + 차원 5 외부 시선)
6. 리서치는 **취향 원칙**을 따라야 한다 (리서치 prompt 참조):
   - 롱폼 > 조각글, 논쟁 > 합의, 변화 > 고정, 1차 > 2차
   - **출처 블랙리스트** — 인용 금지: 지식 Q&A 플랫폼, 위챗 공식계정, 바이두 백과, 콘텐츠 팜, AI 생성 약력
   - **출처 위계**: 사용자 로컬 자료 > 1인칭 저작 > 장문 인터뷰 > 의사결정 기록 > 숏폼 1차 자료 > 외부 분석 > 2차 요약
7. 리서치 노트를 병합한다:
   ```bash
   python3 "{distilly_skill_root}/tools/research/merge_research.py" "{skill_dir}"
   ```
   산출물: `knowledge/research/merged/summary.md`
8. `knowledge/research/merged/summary.md`를 읽고 확인한다:
   - `Files scanned >= 3`
   - `Unique URLs >= 2`
   - `Potential long quote lines = 0`
   - 노트의 URL이 실제로 열어본 구체적 페이지인지 확인한다. 플랫폼 루트, 검색·주제 페이지, 자리표시자 경로는 안 된다
   충족하지 않으면 계속 진행하기 전에 리서치 노트를 보강하거나 수집 한계를 명시적으로 기록한다.
9. **품질 체크포인트 (Phase 1.5)**: 분석에 들어가기 전에 사용자에게 구조화된 수집 요약을 보여준다:
   ```
   ┌──────────────────────────────┬──────────┬─────────────────────────────┐
   │ 차원                         │ 출처 수  │ 핵심 발견                   │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 1 저술                       │ N        │ [핵심 주장 / 공백]          │
   │ 2 대화                       │ N        │ [핵심 패턴 / 공백]          │
   │ 3 표현 DNA                   │ N        │ [문체 지표 / 공백]          │
   │ 4 의사결정                   │ N        │ [판단 패턴 / 공백]          │
   │ 5 외부 시선                  │ N        │ [외부 평가 / 공백]          │
   │ 6 타임라인                   │ N        │ [궤적 / 공백]               │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 모순                         │ N        │ [요약]                      │
   │ 근거 얕은 차원               │ [목록]   │ 보강 계획: [계획]           │
   │ 자료 희소 인물?              │ 예/아니오│                             │
   └──────────────────────────────┴──────────┴─────────────────────────────┘
   ```
   사용자 확인을 받고 진행한다. 사용자가 문제를 지적하거나 더 깊이 원하면 리서치를 먼저 보강한다.
10. **자료 희소 인물 판정**: 전체 출처가 10개 미만이면 희소 인물 프로토콜을 적용한다:
    - 멘탈 모델을 2~3개로 제한한다
    - 근거가 얕은 모델은 "제한된 정보 기반"으로 표시한다
    - 정직한 한계 섹션을 확장한다
    - 어떤 자료가 더 있으면 품질이 올라가는지 사용자에게 알린다
11. celebrity 분석의 우선순위:
    - 1차 자료 (출처 가중치 1-3)
    - 병합된 리서치 요약
    - 사용자가 명시한 노트

### celebrity / budget-unfriendly

1. 먼저 읽는다:
   - `prompt_kor/celebrity/budget_unfriendly/research.md`
   - `references/celebrity_budget_unfriendly_framework.md`
2. 리서치 디렉터리를 먼저 만든다:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged" "{skill_dir}/knowledge/research/reviews"
   ```
3. 수집 전략을 확인한다 (intake 단계에서 결정됨): 로컬 우선 / 웹+로컬 / 웹 전용
4. **6트랙 리서치 세트**를 독립 파일로 구성한다 (병합 금지, 관찰 복제 금지):
   - `knowledge/research/raw/01_writings.md` (차원 1: 저술 / 체계적 사고)
   - `knowledge/research/raw/02_conversations.md` (차원 2: 압박 상황에서의 대화)
   - `knowledge/research/raw/03_expression_dna.md` (차원 3: 언어적 지문)
   - `knowledge/research/raw/04_decisions.md` (차원 4: 행동과 선택)
   - `knowledge/research/raw/05_external_views.md` (차원 5: 외부 시선과 비판)
   - `knowledge/research/raw/06_timeline.md` (차원 6: 인식의 궤적)
5. 리서치는 **취향 원칙 + 출처 블랙리스트 + 출처 위계**를 따라야 한다 (리서치 prompt 참조). 모든 근거 항목에 출처 가중치(1-7)를 표기한다.
6. 리서치 노트를 병합한다:
   ```bash
   python3 "{distilly_skill_root}/tools/research/merge_research.py" "{skill_dir}"
   ```
7. `knowledge/research/merged/summary.md`를 읽고 최소 기준을 확인한다:
   - `Files scanned >= 6`
   - `Unique URLs >= 8`
   - `Primary-source markers >= 3`
   - `Source metadata blocks >= 6`
   - `Contradiction bullets >= 6`
   - `Inference bullets >= 6`
   - `Potential long quote lines = 0`
   - `Track coverage count = 6`
   - 노트의 URL이 실제로 열어본 구체적 페이지인지 확인한다. 플랫폼 루트, 검색·주제 페이지, 자리표시자 경로는 안 된다
   충족하지 않으면 리뷰 단계로 넘어가지 말고 약한 트랙을 계속 채운다.
8. **품질 체크포인트 (Phase 1.5)**: 감사에 들어가기 전에 사용자에게 구조화된 수집 요약을 보여준다 (1차 자료 비율, 모순 건수, 후보 멘탈 모델, 정답 검증 후보, 근거 얕은 차원, 자료 희소 인물 판정 포함). 사용자 확인을 받고 진행한다.
9. 그다음 읽는다:
   - `prompt_kor/celebrity/budget_unfriendly/audit.md`
   - `prompt_kor/celebrity/budget_unfriendly/synthesis.md`
   - `references/celebrity_budget_unfriendly_template.md`
10. 먼저 `knowledge/research/reviews/research_audit.md`를 쓴다
    - 감사는 명시적으로 `PASS / FAIL`을 내야 한다
    - 감사는 다음을 검증해야 한다: 출처 위계 준수(블랙리스트 출처 없음), 1차 자료 비율 50% 초과, 취향 원칙 준수, 자료 희소 인물 판정
    - 감사가 `FAIL`이면 종합 전에 보강 작업을 먼저 수행한다
11. **추출 체크포인트 (Phase 2.5)**: 감사 PASS 후, 후보 멘탈 모델 요약(3중 관문 판정, 근거 앵커, 실패 양상 포함)을 사용자에게 보여준다. 타당성을 확인받고 종합에 들어간다.
12. 그다음 `knowledge/research/reviews/synthesis.md`를 쓴다
    - 후보 멘탈 모델에 3중 관문을 적용한다:
      - 맥락을 넘나드는 반복성
      - 생성력
      - 배타성
    - 지적 계보 씨앗(영향받은 것 / 갈라선 것)과 Agentic Protocol 씨앗(이 인물이 새로운 질문을 만났을 때 파고들 차원)도 함께 추출한다
13. 그다음 `prompt_kor/celebrity/budget_unfriendly/validation.md`로 다음을 쓴다:
    - `knowledge/research/reviews/validation.md`
    - 검증은 명시적으로 `PASS / FAIL`을 내야 한다
    - 검증은 다음을 수행해야 한다: 정답 검증(질문 2개 이상) + 엣지 케이스 검증(질문 1개) + 문체 검증(100단어 블라인드 테스트) + 저작권 검증 + Agentic Protocol 검증
    - 검증이 `FAIL`이면 초안을 수정한 뒤 진행한다
14. budget-unfriendly celebrity 분석의 우선순위:
    - 6트랙 원본 노트
    - 병합된 리서치 요약
    - 리서치 감사
    - 종합 리뷰 (계보 + Agentic Protocol 씨앗 포함)
    - 검증 리뷰
    - 사용자가 명시한 노트

두 celebrity profile 공통 규칙:

- 외부 수집이 실패하거나 플랫폼이 접근을 막으면:
  - 무엇이 막혔는지 사용자에게 정확히 알린다
  - 원본 리서치 노트와 병합 요약을 보존한다
  - 확보한 자료로 생성을 계속한다
  - `source_grounding`을 불완전으로 처리한다
  - 검사를 통과하려고 URL, 인용, 제목, 일반 홈페이지 링크를 **절대** 지어내지 않는다
- 전체 전사본, 전체 자막, 긴 원문 구절을 저장소에 **저장하지 않는다**
- 저장하는 노트는 바꿔 쓰고, 구조화하고, 저작권상 안전하게 유지한다

family가 확정되면 두 트랙으로 분석한다:

**트랙 A (Work Skill)**:
- `prompt_kor/work_analyzer.md`를 참조한다
- 추출 항목: 담당 시스템, 기술 표준, 업무 흐름, 산출물 선호, 경험
- `celebrity`는 `work`를 문자 그대로의 직무 범위가 아니라 방법론, 판단 프레임, 의사결정 패턴으로 해석한다

**트랙 B (Persona)**:
- family별 persona analyzer를 쓴다
- `celebrity`이면서 `research_profile=budget-unfriendly`인 경우:
  - `prompt_kor/celebrity/budget_unfriendly/persona_analyzer.md`
- 사용자가 준 태그를 구체적인 행동 규칙으로 번역한다
- 자료에서 추출: 커뮤니케이션 스타일, 의사결정 패턴, 대인관계 행동
- `celebrity`는 다음을 보존한다:
  - 멘탈 모델
  - 의사결정 휴리스틱
  - 표현 DNA
  - 모순
  - 정직한 한계

### Step 4: 생성과 미리보기

`prompt_kor/work_builder.md`로 Work 내용을 생성한다.
family별 persona builder로 Persona 내용을 생성한다.

매핑:
- `colleague` → `prompt_kor/persona_builder.md`
- `relationship` → `prompt_kor/relationship/persona_builder.md`
- `celebrity` → `prompt_kor/celebrity/persona_builder.md`
- `celebrity` + `budget-unfriendly` → `prompt_kor/celebrity/budget_unfriendly/persona_builder.md`

사용자에게 각 5~8줄 요약을 보여주고 확인받는다:
```
Work Skill 요약:
  - 담당: {xxx}
  - 기술 스택: {xxx}
  - 코드리뷰 관점: {xxx}
  ...

Persona 요약:
  - 핵심 성격: {xxx}
  - 커뮤니케이션 스타일: {xxx}
  - 의사결정 패턴: {xxx}
  ...

이대로 생성할까요? 수정할 부분이 있나요?
```

### Step 5: 파일 쓰기

사용자 확인 후에는 `skills/colleague/{slug}` 같은 트리를 손으로 만들지 않는다. 항상 writer를 경유한다:

1. 현재 저장 루트를 확정한다:
   - `colleague` → `./skills/colleague`
   - `relationship` → `./skills/relationship`
   - `celebrity` → `./skills/celebrity`
2. `Write` 도구로 임시 파일 3개를 만든다:
   - `/tmp/distilly_{slug}_meta.json`
   - `/tmp/distilly_{slug}_work.md`
   - `/tmp/distilly_{slug}_persona.md`
3. 임시 meta 파일에는 최소한 다음이 들어가야 한다:
   - `name`
   - `display_name`
   - `character`
   - `research_profile` (`character=celebrity`일 때 필수)
   - `classification.language` (사용자 언어와 일치해야 한다. 예: `ko-KR` 또는 `en`)
   - `profile`
   - `tags`
   - `knowledge_sources`
4. 그다음 실행한다:
   ```bash
   python3 "{distilly_skill_root}/tools/skill_writer.py" \
     --action create \
     --character {character} \
     --research-profile {research_profile} \
     --slug {slug} \
     --name "{name}" \
     --meta /tmp/distilly_{slug}_meta.json \
     --work /tmp/distilly_{slug}_work.md \
     --persona /tmp/distilly_{slug}_persona.md \
     --base-dir {resolved_base_dir}
   ```
5. 이 명령이 생성하는 것:
   - `SKILL.md`
   - `work.md`
   - `persona.md`
   - `work_skill.md`
   - `persona_skill.md`
   - `manifest.json`
   - `meta.json`
   - 생성된 역할 skill을 호스트에 설치하려면 해당 플래그를 덧붙인다:
     - Claude Code: `--install-claude-skill`
     - OpenClaw: `--install-openclaw-skill`
     - Codex: `--install-codex-skill`
     - Hermes: `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host hermes --force` 실행. 신뢰된 프로젝트라면 `--skills-dir .hermes/skills`를 덧붙이고 `hermes skills trust` 실행 후 새 세션을 시작하거나 `/reload-skills`를 실행한다. `~/.agents/skills`는 Hermes `skills.external_dirs`에 명시적으로 설정된 경우에만 쓴다
     - DeepSeek Harness: `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host deepseek-harness --force` 실행. 프로젝트 설치는 `--skills-dir .dsh/skills`를 덧붙인다
     - Pi: `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host pi --force` 실행. 프로젝트 설치는 `--skills-dir .pi/skills`를 덧붙이고, `/skill:{character}-{slug}`로 호출한다
     - Grok Build: `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host grok-build --force` 실행. 프로젝트 설치는 `--skills-dir .grok/skills`를 덧붙인다
     - OpenCode: `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host opencode --force` 실행. 프로젝트 설치는 `--skills-dir .opencode/skills`를 덧붙인다
     - 공용 설치기는 자기완결형 `SKILL.md`와 설치 메타데이터만 쓰고, 설치본의 레거시 frontmatter를 정규화한다. 생성 디렉터리 전체를 수동 복사하지 않는다. 원본 자료가 들어 있을 수 있다
     - Windows의 Claude Code: 필요하면 `--install-claude-command-shim`을 추가한다
6. 현재 family가 `celebrity`라면 생성 후 품질 검사를 실행한다:
   ```bash
   python3 "{distilly_skill_root}/tools/research/quality_check.py" "{resolved_base_dir}/{slug}/SKILL.md" --profile {research_profile}
   ```
7. `celebrity` skill의 `source_grounding`이 여전히 실패하면:
   - 정직한 한계 노트와 근거 있는 출처 요약을 추가할 수 있다
   - URL은 실재하고 구체적이며 추적 가능한 출처일 때만 추가한다
   - 사이트 루트, 주제 페이지, 검색 페이지 같은 일반 링크를 가짜 근거로 **절대** 쓰지 않는다
   - 검증된 외부 출처가 없으면 FAIL 상태를 유지하고 어떤 자료가 아직 없는지 설명한다

성공을 보고할 때는 colleague 저장 위치를 가정하지 말고 해당 family의 정확한 위치를 반환한다.

---

## 진화 모드: 파일 추가

사용자가 새 파일이나 텍스트를 제공하면:

1. Step 2의 방법으로 새 내용을 읽는다
2. 현재 family의 base dir를 확정한다
3. 기존 `{resolved_base_dir}/{slug}/work.md`와 `persona.md`를 `Read`로 읽는다
4. family별 merger prompt로 증분 분석한다
5. 현재 버전을 보관한다 (Bash):
   ```bash
   python3 "{distilly_skill_root}/tools/version_manager.py" \
     --action backup \
     --character {character} \
     --slug {slug} \
     --base-dir {resolved_base_dir}
   ```
6. work/persona 델타를 임시 patch 파일에 쓴다
7. 실행한다:
   ```bash
   python3 "{distilly_skill_root}/tools/skill_writer.py" \
     --action update \
     --character {character} \
     --slug {slug} \
     --work-patch /tmp/distilly_{slug}_work_patch.md \
     --persona-patch /tmp/distilly_{slug}_persona_patch.md \
     --base-dir {resolved_base_dir}
   ```
8. 현재 family가 `celebrity`라면 갱신 후 품질 검사를 다시 실행한다

---

## 진화 모드: 대화 정정

사용자가 "이건 틀렸어" / "이렇게 해야 맞아"라고 하면:

1. `prompt_kor/correction_handler.md`를 참조해 정정 내용을 식별한다
2. Work(기술·업무 흐름)에 속하는지 Persona(성격·커뮤니케이션)에 속하는지 판단한다
3. Work에 속하면:
   - `/tmp/distilly_{slug}_work_patch.md`를 생성한다
   - patch는 교체 가능한 `##` 섹션 하나 이상이어야 한다
   - 실행한다:
     ```bash
     python3 "{distilly_skill_root}/tools/skill_writer.py" \
       --action update \
       --character {character} \
       --slug {slug} \
       --work-patch /tmp/distilly_{slug}_work_patch.md \
       --base-dir {resolved_base_dir}
     ```
4. Persona에 속하면:
   - 정정 기록을 `/tmp/distilly_{slug}_correction.json`에 쓴다
   - 단건은 `{scene, wrong, correct}` 형식으로 쓴다
   - persona 정정이 여러 건이면 `{"persona_corrections": [{...}, {...}]}` 형식으로 쓴다
   - 실행한다:
     ```bash
     python3 "{distilly_skill_root}/tools/skill_writer.py" \
       --action update \
       --character {character} \
       --slug {slug} \
       --correction-json /tmp/distilly_{slug}_correction.json \
       --base-dir {resolved_base_dir}
     ```
5. 현재 family가 `celebrity`라면 갱신 후 품질 검사를 다시 실행한다
6. `work.md`, `persona.md`, `SKILL.md`, `meta.json`을 손으로 편집하지 않는다. 항상 `skill_writer.py`로 갱신한다

---

## 관리 작업

3개 family의 skill 목록 조회:
```bash
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character colleague --base-dir ./skills/colleague
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character relationship --base-dir ./skills/relationship
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character celebrity --base-dir ./skills/celebrity
```

특정 skill 버전 롤백:
```bash
# colleague
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character colleague --slug {slug} --version {version} --base-dir ./skills/colleague

# relationship
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character relationship --slug {slug} --version {version} --base-dir ./skills/relationship

# celebrity
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character celebrity --slug {slug} --version {version} --base-dir ./skills/celebrity
```

특정 skill 삭제:
character family를 확인한 뒤:
```bash
# colleague
rm -rf skills/colleague/{slug}

# relationship
rm -rf skills/relationship/{slug}

# celebrity
rm -rf skills/celebrity/{slug}
```

---
# English Version

# Distilly Creator

> Distilly was formerly **Colleague Skill / colleague-skill**. The current Skill frontmatter name and creator entrypoint are both `distilly`.

## Trigger Conditions

Activate when the user says any of the following:
- `/distilly`
- "Help me create a skill"
- "I want to distill someone"
- "Create a new skill"
- "Make a skill for XX"

Compatible hosts:
- Claude Code
- OpenClaw
- Hermes
- Codex
- DeepSeek Harness
- Pi coding agent
- Grok Build
- OpenCode

Explicit invocation differs among hosts that expose it: use `/distilly` in Claude Code, Hermes, DeepSeek Harness, and Grok Build; use `/distilly` in OpenClaw, or `/skill distilly` when its native slash is not registered; use `$distilly` or choose it through `/skills` in Codex; use `/skill:distilly` in Pi. OpenCode uses native Skill discovery and loading; do not invent a dedicated command.

Grok Bot can save a workflow as a private Skill, but its official documentation does not describe direct local `SKILL.md` directory imports. Do not present this repository as a direct Grok Bot install; migrate the workflow manually into a saved Skill or wait for a dedicated adapter.

Enter evolution mode when the user says:
- "I have new files" / "append"
- "That's wrong" / "He wouldn't do that" / "He should be"
- `/update-skill {character} {slug}`

Compatibility update alias:
- `/update-colleague {slug}`

When the user asks to see generated skills, use the list commands in "Management Operations" below.

---

## Tool Usage Rules

This Skill runs in any compatible host that can read local files and execute Bash / Python commands. Use the following tool conventions:

| Task | Tool |
|------|------|
| Read PDF documents | `Read` tool (native PDF support) |
| Read image screenshots | `Read` tool (native image support) |
| Read MD/TXT files | `Read` tool |
| Parse email .eml/.mbox | `Bash` → `python3 "{distilly_skill_root}/tools/email_parser.py"` |
| Write/update Skill files | `Write` / `Edit` tool |
| Version management | `Bash` → `python3 "{distilly_skill_root}/tools/version_manager.py"` |
| List existing Skills | `Bash` → `python3 "{distilly_skill_root}/tools/skill_writer.py" --action list` |

**Base directories**:
- `colleague` → `./skills/colleague/{slug}/`
- `relationship` → `./skills/relationship/{slug}/`
- `celebrity` → `./skills/celebrity/{slug}/`

For a global path, use `--base-dir` with the storage root for that character family.

---

## Main Flow: Create a New Skill

### Step 0: Confirm the character family

If the user entered `/distilly`, first confirm which family should be distilled:

1. `colleague`
2. `relationship`
3. `celebrity`

If the host already passed an explicit family, lock the character family immediately.

If the current family is `celebrity`, also confirm the research profile:

1. `budget-friendly`
2. `budget-unfriendly`

Default to `budget-friendly`. Only switch to `budget-unfriendly` when the user explicitly wants deeper research, higher confidence, or accepts a slower and more expensive distillation pass.

### Step 1: Basic Info Collection

Choose the intake prompt by character family:

- `colleague` → `prompt_kor/intake.md`
- `relationship` → `prompt_kor/relationship/intake.md`
- `celebrity` → `prompt_kor/celebrity/intake.md`

For `colleague` and `relationship`, ask only 3 questions.
For `celebrity`, use the 4-question intake in `prompt_kor/celebrity/intake.md`; the fourth question must confirm `research_profile`.

The default 3 base questions are:

1. **Alias / Codename** (required)
2. **Basic info** (one sentence: company, level, role, gender — say whatever comes to mind)
   - Example: `ByteDance L2-1 backend engineer male`
3. **Personality profile** (one sentence: MBTI, zodiac, traits, corporate culture, impressions)
   - Example: `INTJ Capricorn blame-shifter ByteDance-style strict in CR but never explains why`

Everything except the alias can be skipped. Summarize and confirm before moving to the next step.

### Step 2: Source Material Import

Ask the user how they'd like to provide materials:

```
How would you like to provide source materials?

  [A] Upload Files
      PDF / images / email .eml / .mbox

  [B] Paste Text
      Copy-paste text directly

Can mix and match, or skip entirely (generate from manual info only).
```

---

#### Option A: Upload Files

- **PDF / Images**: `Read` tool directly
- **Email files .eml / .mbox**:
  ```bash
  python3 "{distilly_skill_root}/tools/email_parser.py" --file {path} --target "{name}" --output /tmp/email_out.txt
  ```
  Then `Read /tmp/email_out.txt`
- **Markdown / TXT**: `Read` tool directly

---

#### Option B: Paste Text

User-pasted content is used directly as text material. No tools needed.

---

If the user says "no files" or "skip", generate Skill from Step 1 manual info only.

### Step 3: Analyze Source Material

First resolve the execution matrix for the selected character family:

| character | intake | persona analyzer | persona builder | merger | storage root |
|-----------|--------|------------------|-----------------|--------|--------------|
| `colleague` | `prompt_kor/intake.md` | `prompt_kor/persona_analyzer.md` | `prompt_kor/persona_builder.md` | `prompt_kor/merger.md` | `./skills/colleague/{slug}` |
| `relationship` | `prompt_kor/relationship/intake.md` | `prompt_kor/relationship/persona_analyzer.md` | `prompt_kor/relationship/persona_builder.md` | `prompt_kor/relationship/merger.md` | `./skills/relationship/{slug}` |
| `celebrity` | `prompt_kor/celebrity/intake.md` | `prompt_kor/celebrity/persona_analyzer.md` | `prompt_kor/celebrity/persona_builder.md` | `prompt_kor/celebrity/merger.md` | `./skills/celebrity/{slug}` |

Shared across all families:
- Work analyzer: `prompt_kor/work_analyzer.md`
- Work builder: `prompt_kor/work_builder.md`
- Correction handler: `prompt_kor/correction_handler.md`

If the current family is `celebrity`, run the research subflow before analysis.

### celebrity / budget-friendly

1. Read `prompt_kor/celebrity/research.md` and follow its **6-dimension parallel collection strategy**
2. Create the research directories first:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged"
   ```
3. Confirm the collection strategy (determined during intake):
   - **Local-first**: analyze user-provided materials first, identify which dimensions are covered, only search web for gaps
   - **Web + local**: full 6-dimension web research, then merge with local materials for cross-validation
   - **Web-only**: standard 6-dimension web research pass
5. Cover the **6 dimensions** across at least 3 separate files (each file covers 2 dimensions), never one monolithic `research_notes.md`:
   - `knowledge/research/raw/01_core_profile.md` (Dim 1 Writings + Dim 6 Timeline)
   - `knowledge/research/raw/02_conversations_and_material.md` (Dim 2 Conversations + Dim 4 Decisions)
   - `knowledge/research/raw/03_expression_and_reception.md` (Dim 3 Expression DNA + Dim 5 External Views)
6. Research must follow **taste principles** (see research prompt):
   - Long-form > snippets, controversy > consensus, change > fixity, firsthand > secondhand
   - **Source blacklist** — never cite: Zhihu, WeChat official accounts, Baidu Baike, content farms, AI-generated bios
   - **Source hierarchy**: user local materials > first-person works > long interviews > decision records > short-form firsthand > external analysis > secondhand summaries
7. Merge the research notes:
   ```bash
   python3 "{distilly_skill_root}/tools/research/merge_research.py" "{skill_dir}"
   ```
   Output: `knowledge/research/merged/summary.md`
8. Read `knowledge/research/merged/summary.md` and confirm:
   - `Files scanned >= 3`
   - `Unique URLs >= 2`
   - `Potential long quote lines = 0`
   - URLs in notes are actual inspected pages, not platform roots, search/topic pages, or placeholder paths
   If these do not hold, extend the research notes before continuing or explicitly record the collection limits.
9. **Quality checkpoint (Phase 1.5)**: before entering analysis, show the user a structured collection summary:
   ```
   ┌──────────────────────────────┬──────────┬─────────────────────────────┐
   │ Dimension                    │ Sources  │ Key Finding                 │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ 1 Writings                   │ N        │ [core thesis / gap]         │
   │ 2 Conversations              │ N        │ [key pattern / gap]         │
   │ 3 Expression DNA             │ N        │ [style marker / gap]        │
   │ 4 Decisions                  │ N        │ [decision pattern / gap]    │
   │ 5 External Views             │ N        │ [outside view / gap]        │
   │ 6 Timeline                   │ N        │ [trajectory / gap]          │
   ├──────────────────────────────┼──────────┼─────────────────────────────┤
   │ Contradictions               │ N        │ [summary]                   │
   │ Thin dimensions              │ [list]   │ Backfill plan: [plan]       │
   │ Cold figure?                 │ yes/no   │                             │
   └──────────────────────────────┴──────────┴─────────────────────────────┘
   ```
   Wait for user confirmation before continuing. If the user flags issues or wants more depth, extend research first.
10. **Cold figure detection**: if total sources < 10, apply the cold figure protocol:
    - Limit mental models to 2–3
    - Mark thin models as "based on limited information"
    - Expand the honest boundaries section
    - Tell the user what additional material would improve quality
11. Celebrity analysis must prioritize:
    - primary materials (source weight 1-3)
    - merged research summary
    - explicit user notes

### celebrity / budget-unfriendly

1. First read:
   - `prompt_kor/celebrity/budget_unfriendly/research.md`
   - `references/celebrity_budget_unfriendly_framework.md`
2. Create the research directories first:
   ```bash
   mkdir -p "{skill_dir}/knowledge/research/raw" "{skill_dir}/knowledge/research/merged" "{skill_dir}/knowledge/research/reviews"
   ```
3. Confirm the collection strategy (determined during intake): local-first / web+local / web-only
4. Build the **six-track research set** as independent files (never merged, never clone observations):
   - `knowledge/research/raw/01_writings.md` (Dim 1: Writings / systematic thought)
   - `knowledge/research/raw/02_conversations.md` (Dim 2: Conversations under pressure)
   - `knowledge/research/raw/03_expression_dna.md` (Dim 3: Linguistic fingerprint)
   - `knowledge/research/raw/04_decisions.md` (Dim 4: Behavior and choices)
   - `knowledge/research/raw/05_external_views.md` (Dim 5: External views and criticism)
   - `knowledge/research/raw/06_timeline.md` (Dim 6: Cognitive trajectory)
5. Research must follow **taste principles + source blacklist + source hierarchy** (see research prompt). Every evidence item must carry a source weight (1-7) annotation.
6. Merge the research notes:
   ```bash
   python3 "{distilly_skill_root}/tools/research/merge_research.py" "{skill_dir}"
   ```
7. Read `knowledge/research/merged/summary.md` and confirm the minimum floor:
   - `Files scanned >= 6`
   - `Unique URLs >= 8`
   - `Primary-source markers >= 3`
   - `Source metadata blocks >= 6`
   - `Contradiction bullets >= 6`
   - `Inference bullets >= 6`
   - `Potential long quote lines = 0`
   - `Track coverage count = 6`
   - URLs in notes are actual inspected pages, not platform roots, search/topic pages, or placeholder paths
   If these do not hold, keep filling the weak tracks before continuing to any review stage.
8. **Quality checkpoint (Phase 1.5)**: before entering audit, show the user a structured collection summary (with primary-source ratio, contradiction count, candidate mental models, known-answer candidates, thin dimensions, cold figure assessment). Wait for user confirmation before continuing.
9. Then read:
   - `prompt_kor/celebrity/budget_unfriendly/audit.md`
   - `prompt_kor/celebrity/budget_unfriendly/synthesis.md`
   - `references/celebrity_budget_unfriendly_template.md`
10. First write `knowledge/research/reviews/research_audit.md`
    - The audit must produce an explicit `PASS / FAIL`
    - The audit must verify: source hierarchy compliance (no blacklisted sources), primary-source ratio > 50%, taste principle compliance, cold figure assessment
    - If the audit says `FAIL`, follow the Backfill Tasks before synthesis
11. **Extraction checkpoint (Phase 2.5)**: after audit PASS, show the user a summary of candidate mental models (with triple-gate verdict, evidence anchors, failure modes). Confirm reasonableness before synthesis.
12. Then write `knowledge/research/reviews/synthesis.md`
    - Apply the triple gate to candidate mental models:
      - cross-context recurrence
      - generative power
      - exclusivity
    - Also extract intellectual genealogy seeds (influenced by / diverged from) and Agentic Protocol seeds (the dimensions this person would investigate when facing a novel question)
13. Then use `prompt_kor/celebrity/budget_unfriendly/validation.md` to write:
    - `knowledge/research/reviews/validation.md`
    - Validation must produce an explicit `PASS / FAIL`
    - Validation must perform: known-answer check (≥2 questions) + edge-case check (1 question) + voice check (100-word blind test) + copyright check + Agentic Protocol check
    - If validation says `FAIL`, revise the draft before continuing
14. Budget-unfriendly celebrity analysis must prioritize:
    - six-track raw notes
    - merged research summary
    - research audit
    - synthesis review (with genealogy + Agentic Protocol seeds)
    - validation review
    - explicit user notes

Shared rules for both celebrity profiles:

- If external collection fails or a platform blocks access:
  - tell the user exactly what was blocked
  - preserve the raw research notes and merged summary
  - continue generation with the available materials
  - treat `source_grounding` as incomplete
  - **never** invent URLs, quotes, titles, or generic homepage links just to satisfy the checker
- **Do not** store full transcripts, full subtitles, or long verbatim source passages in the repository
- Keep the stored notes paraphrased, structured, and copyright-safe

Once the family is resolved, analyze along two tracks:

**Track A (Work Skill)**:
- Refer to `prompt_kor/work_analyzer.md`
- Extract: responsible systems, technical standards, workflow, output preferences, experience
- For `celebrity`, interpret `work` as methods, judgment frameworks, and decision patterns rather than literal job scope

**Track B (Persona)**:
- Use the family-specific persona analyzer
- If `celebrity` with `research_profile=budget-unfriendly`, use:
  - `prompt_kor/celebrity/budget_unfriendly/persona_analyzer.md`
- Translate user-provided tags into concrete behavior rules
- Extract from materials: communication style, decision patterns, interpersonal behavior
- For `celebrity`, retain:
  - mental models
  - decision heuristics
  - expression DNA
  - contradictions
  - honest boundaries

### Step 4: Generate and Preview

Use `prompt_kor/work_builder.md` to generate Work content.
Use the family-specific persona builder to generate Persona content.

Mapping:
- `colleague` → `prompt_kor/persona_builder.md`
- `relationship` → `prompt_kor/relationship/persona_builder.md`
- `celebrity` → `prompt_kor/celebrity/persona_builder.md`
- `celebrity` + `budget-unfriendly` → `prompt_kor/celebrity/budget_unfriendly/persona_builder.md`

Show the user a summary (5-8 lines each), ask:
```
Work Skill Summary:
  - Responsible for: {xxx}
  - Tech stack: {xxx}
  - CR focus: {xxx}
  ...

Persona Summary:
  - Core personality: {xxx}
  - Communication style: {xxx}
  - Decision pattern: {xxx}
  ...

Confirm generation? Or need adjustments?
```

### Step 5: Write Files

After user confirmation, do not hand-build a `skills/colleague/{slug}`-style tree. Always go through the writer:

1. Resolve the current storage root:
   - `colleague` → `./skills/colleague`
   - `relationship` → `./skills/relationship`
   - `celebrity` → `./skills/celebrity`
2. Use the `Write` tool to create three temporary files:
   - `/tmp/distilly_{slug}_meta.json`
   - `/tmp/distilly_{slug}_work.md`
   - `/tmp/distilly_{slug}_persona.md`
3. The temporary meta file must include at least:
   - `name`
   - `display_name`
   - `character`
   - `research_profile` (required when `character=celebrity`)
   - `classification.language` (must match the user's language, for example `zh-CN` or `en`)
   - `profile`
   - `tags`
   - `knowledge_sources`
4. Then call:
   ```bash
   python3 "{distilly_skill_root}/tools/skill_writer.py" \
     --action create \
     --character {character} \
     --research-profile {research_profile} \
     --slug {slug} \
     --name "{name}" \
     --meta /tmp/distilly_{slug}_meta.json \
     --work /tmp/distilly_{slug}_work.md \
     --persona /tmp/distilly_{slug}_persona.md \
     --base-dir {resolved_base_dir}
   ```
5. This command will generate:
   - `SKILL.md`
   - `work.md`
   - `persona.md`
   - `work_skill.md`
   - `persona_skill.md`
   - `manifest.json`
   - `meta.json`
   - To install the generated role skill into a host, append the relevant flag:
     - Claude Code: `--install-claude-skill`
     - OpenClaw: `--install-openclaw-skill`
     - Codex: `--install-codex-skill`
     - Hermes: run `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host hermes --force`; for a trusted project, append `--skills-dir .hermes/skills`, run `hermes skills trust`, then start a new session or run `/reload-skills`. Use `~/.agents/skills` only when it is explicitly configured in Hermes `skills.external_dirs`
     - DeepSeek Harness: run `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host deepseek-harness --force`; append `--skills-dir .dsh/skills` for a project install
     - Pi: run `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host pi --force`; append `--skills-dir .pi/skills` for a project install, then invoke it with `/skill:{character}-{slug}`
     - Grok Build: run `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host grok-build --force`; append `--skills-dir .grok/skills` for a project install
     - OpenCode: run `python3 "{distilly_skill_root}/tools/install_generated_skill.py" --skill-dir "{resolved_base_dir}/{slug}" --host opencode --force`; append `--skills-dir .opencode/skills` for a project install
     - The shared installer writes only the self-contained `SKILL.md` and install metadata and normalizes legacy frontmatter in the installed copy. Do not manually copy the whole generated directory; it may contain private source material
     - Claude Code on Windows: optionally add `--install-claude-command-shim`
6. If the current family is `celebrity`, run a quality check after creation:
   ```bash
   python3 "{distilly_skill_root}/tools/research/quality_check.py" "{resolved_base_dir}/{slug}/SKILL.md" --profile {research_profile}
   ```
7. If `source_grounding` still fails for a `celebrity` skill:
   - you may add honest limitation notes and a grounded source summary
   - only add URLs when they are real, specific, and traceable sources
   - **never** use site roots, topic pages, search pages, or other generic links as fake grounding
   - if no verified external sources exist, keep the FAIL state and explain what source material is still missing

When reporting success, return the correct family-specific location instead of assuming colleague storage.

---

## Evolution Mode: Append Files

When user provides new files or text:

1. Read new content using Step 2 methods
2. Resolve the base dir for the current family
3. `Read` existing `{resolved_base_dir}/{slug}/work.md` and `persona.md`
4. Use the family-specific merger prompt for incremental analysis
5. Archive current version (Bash):
   ```bash
   python3 "{distilly_skill_root}/tools/version_manager.py" \
     --action backup \
     --character {character} \
     --slug {slug} \
     --base-dir {resolved_base_dir}
   ```
6. Write work/persona delta into temporary patch files
7. Call:
   ```bash
   python3 "{distilly_skill_root}/tools/skill_writer.py" \
     --action update \
     --character {character} \
     --slug {slug} \
     --work-patch /tmp/distilly_{slug}_work_patch.md \
     --persona-patch /tmp/distilly_{slug}_persona_patch.md \
     --base-dir {resolved_base_dir}
   ```
8. If the current family is `celebrity`, run the quality check again after the update

---

## Evolution Mode: Conversation Correction

When user expresses "that's wrong" / "he should be":

1. Refer to `prompt_kor/correction_handler.md` to identify correction content
2. Determine if it belongs to Work (technical/workflow) or Persona (personality/communication)
3. If it belongs to Work:
   - Generate `/tmp/distilly_{slug}_work_patch.md`
   - The patch must be one or more replaceable `##` sections
   - Call:
     ```bash
     python3 "{distilly_skill_root}/tools/skill_writer.py" \
       --action update \
       --character {character} \
       --slug {slug} \
       --work-patch /tmp/distilly_{slug}_work_patch.md \
       --base-dir {resolved_base_dir}
     ```
4. If it belongs to Persona:
   - Write the correction record to `/tmp/distilly_{slug}_correction.json`
   - For a single correction, write `{scene, wrong, correct}`
   - For multiple persona corrections, write `{"persona_corrections": [{...}, {...}]}`
   - Call:
     ```bash
     python3 "{distilly_skill_root}/tools/skill_writer.py" \
       --action update \
       --character {character} \
       --slug {slug} \
       --correction-json /tmp/distilly_{slug}_correction.json \
       --base-dir {resolved_base_dir}
     ```
5. If the current family is `celebrity`, run the quality check again after the update
6. Do not hand-edit `work.md`, `persona.md`, `SKILL.md`, or `meta.json`; always update through `skill_writer.py`

---

## Management Operations

List skills across the three families:
```bash
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character colleague --base-dir ./skills/colleague
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character relationship --base-dir ./skills/relationship
python3 "{distilly_skill_root}/tools/skill_writer.py" --action list --character celebrity --base-dir ./skills/celebrity
```

Roll back a specific skill version:
```bash
# colleague
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character colleague --slug {slug} --version {version} --base-dir ./skills/colleague

# relationship
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character relationship --slug {slug} --version {version} --base-dir ./skills/relationship

# celebrity
python3 "{distilly_skill_root}/tools/version_manager.py" --action rollback --character celebrity --slug {slug} --version {version} --base-dir ./skills/celebrity
```

Delete a specific skill:
After confirming the character family:
```bash
# colleague
rm -rf skills/colleague/{slug}

# relationship
rm -rf skills/relationship/{slug}

# celebrity
rm -rf skills/celebrity/{slug}
```
