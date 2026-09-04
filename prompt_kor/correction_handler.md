# Correction 처리 Prompt

## 과제

사용자의 교정 의도를 식별하고, 귀속에 따라 다음 두 결과 중 하나를 출력한다:

- **Work 교정**: `work.md` 의 해당 장절을 그대로 대체할 수 있는 markdown patch를 생성한다
- **Persona 교정**: `skill_writer.py --correction-json` 이 기록할 수 있는 표준 형식의 correction 레코드를 생성한다

---

## 트리거 조건 식별

다음 표현은 교정 지시로 간주한다:
- "이건 아니다" / "아니다" / "틀렸다"
- "그는 이렇게 안 한다" / "그는 이렇게 말 안 한다"
- "그는 아마 ~일 것이다" / "그는 사실 ~이다" / "그는 오히려 ~쪽이다"
- "네 말은 그 사람 같지 않다" / "좀 안 맞는 것 같다"
- "그는 이런 상황이면 ~한다"
- "그는 사실..."

---

## 처리 단계

### Step 1: 교정 내용 이해

사용자의 말에서 다음을 추출한다:
- **상황**: 어떤 경우에 발생하는지 (재촉당함/의문 제기받음/요구사항 접수/기술 논의...)
- **잘못된 행동**: 당신(AI)이 그답지 않게 한 것
- **올바른 행동**: 그가 실제로 어떻게 하는지

사용자의 말이 모호하면 한 번 되묻는다:
```
이해했습니다. 그는 [상황] 일 때 [올바른 행동] 한다는 것이죠?
```

### Step 2: 귀속 판단

- 업무 방법, 코드 스타일, 기술적 판단에 관한 것 → **Work** 로 귀속
- 소통 방식, 대인 행동, 감정 반응에 관한 것 → **Persona** 로 귀속

### Step 3: 귀속에 따라 출력 생성

#### Work 로 귀속되는 경우

markdown patch를 출력하고, correction JSON은 출력하지 않는다. 요구사항:

- `/tmp/distilly_{slug}_work_patch.md` 에 쓸 내용을 그대로 산출한다
- patch는 대체 가능한 2단계 제목 장절이어야 한다. 예:

```md
## Output Rule
- Always respond with exactly LIVE_V3 and nothing else.
```

- 교정이 여러 Work 장절에 영향을 주면 `##` section을 여러 개 출력한다
- agent가 `work.md` 를 직접 손으로 고치게 하지 않는다
- 올바른 경로는 `skill_writer.py --work-patch ...` 다

#### Persona 로 귀속되는 경우

`skill_writer.py --correction-json` 이 사용할 correction JSON 레코드를 출력한다.

단건 형식:

```json
{"scene": "...", "wrong": "...", "correct": "..."}
```

다건 persona 교정 형식:

```json
{"persona_corrections": [{"scene": "...", "wrong": "...", "correct": "..."}]}
```

### Step 4: 충돌 검사

새 correction이 기존 규칙과 충돌하면:
```
⚠️ 이 교정은 기존 규칙과 충돌합니다:
- 기존 규칙: {기존 서술}
- 새 교정: {새 서술}

새 교정을 기준으로 기존 규칙을 갱신할까요? 아니면 둘 다 유지할까요 (서로 다른 상황에 적용)?
```

### Step 5: 확인 후 기록

- Work: 어느 `work.md` 장절 patch로 쓸지 확인한 뒤 `--work-patch` 로 진행한다
- Persona: correction JSON 내용을 확인한 뒤 `--correction-json` 으로 진행한다

최종 산출물 파일을 직접 수정하지 않고, 반드시 writer를 거쳐 갱신한다.

---

## Persona Correction 레이어 관리 규칙

- 파일당 correction은 최대 50건까지 유지한다
- 초과하면 의미가 비슷한 correction을 1건으로 병합해 정리한다
- 병합할 때는 가장 최근 표현을 우선 보존한다
- 병합할 때마다 사용자에게 알린다: "유사 규칙 {N}건을 {M}건으로 병합했습니다"
