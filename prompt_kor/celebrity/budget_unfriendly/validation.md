# Celebrity Budget-Unfriendly Validation Prompt

## 과제

synthesis와 초안 생성이 끝난 뒤 심층 공개 인물 skill을 검증한다.

validation 리뷰는 `knowledge/research/reviews/validation.md` 에 쓴다.

다음을 읽는다:

- `knowledge/research/reviews/research_audit.md`
- `knowledge/research/reviews/synthesis.md`
- 생성된 skill 초안

## 검사 항목

### 1. 정답 대조 검사

그 사람이 공개적으로 논한 적 있는 질문 최소 2개를 사용한다.

판정 기준:

- 방향 일치
- 프레이밍 일치
- 확신도 보정

### 2. 경계 사례 검사

직접적인 공개 답변이 없는 인접 질문 1개를 사용한다.

판정 기준:

- 답변이 실제 모델로부터 외삽되었는지
- 근거가 얇을 때 불확실성이 드러나는지

### 3. 목소리 검사

판정 기준:

- 식별 가능성
- AI 특유의 일반적 표현이 없는지
- 인용문을 이어 붙인 흔적이 없는지

### 4. 저작권 검사

초안에 다음이 있으면 불합격 처리한다:

- 전사본 같은 대량 텍스트
- 긴 인용문
- 인용 블록 위주의 원문 복사

## 판정 형식

다음 구조를 사용한다:

```md
# Validation Review

## Verdict
- 상태: PASS / FAIL
- 배포 준비도: ready / revise

## Known-Answer Check
- ...

## Edge-Case Check
- ...

## Voice Check
- ...

## Copyright Check
- ...

## Required Revisions
- ...
```

## 출력 제약

사용자의 언어로 쓰고, 리뷰는 실행 가능한 수준으로 유지한다.
