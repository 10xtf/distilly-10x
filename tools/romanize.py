"""
한글 로마자 변환.

인물 이름을 파일 경로와 명령 이름에 쓸 수 있는 읽을 수 있는 문자열로 바꾼다.

## 따르는 규정

국어의 로마자 표기법 (문화체육관광부 고시 제2000-8호) 제2장 표기 일람의
초성 / 중성 / 종성 대응표를 그대로 쓴다.

음운 변화는 반영하지 않는다. 같은 고시 제3장 제4항이 인명에 대해
"이름에서 일어나는 음운 변화는 표기에 반영하지 않는다" 고 규정하기 때문이다.
따라서 자음동화, 구개음화, 격음화, 연음을 처리하지 않고 음절 단위로 변환한다.
고시의 예시(한복남 Han Boknam, 홍빛나 Hong Bitna)가 이 방식과 일치한다.

음절은 `-` 로 잇는다. 제4항이 인명의 음절 사이에 붙임표를 허용한다.

## 성을 따로 처리하지 않는 이유

제4항은 성의 표기를 별도 규정에 넘겼고 그 규정은 고시되지 않았다.
관용 표기도 사람마다 다르다 (이 → Lee / Yi / Rhee / Ri).
근거가 갈리는 대응표를 코드에 넣지 않고 표기 일람을 일관되게 적용한다.
같은 이름이면 항상 같은 결과가 나오고, 관용 표기를 쓰고 싶으면
slug 를 직접 지정하면 된다.
"""

from __future__ import annotations

# 한글 음절 영역: U+AC00 (가) ~ U+D7A3 (힣)
SYLLABLE_START = 0xAC00
SYLLABLE_END = 0xD7A3
VOWEL_COUNT = 21
FINAL_COUNT = 28

# 제2장 표기 일람. 색인은 유니코드 한글 음절의 자모 순서와 같다.
INITIALS = (
    "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
    "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
)
VOWELS = (
    "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
    "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
)
# 색인 0 은 종성 없음. 겹받침은 대표음으로 적는다.
FINALS = (
    "", "k", "k", "k", "n", "n", "n", "t", "l", "k",
    "m", "l", "l", "l", "p", "l", "m", "p", "p", "t",
    "t", "ng", "t", "t", "k", "t", "p", "t",
)


def romanize_syllable(char: str) -> str | None:
    """한글 음절 하나를 로마자로 바꾼다. 음절이 아니면 None 을 돌려준다."""
    offset = ord(char) - SYLLABLE_START
    if not 0 <= offset <= SYLLABLE_END - SYLLABLE_START:
        return None

    initial, rest = divmod(offset, VOWEL_COUNT * FINAL_COUNT)
    vowel, final = divmod(rest, FINAL_COUNT)
    return INITIALS[initial] + VOWELS[vowel] + FINALS[final]


def romanize_hangul(text: str) -> str:
    """
    문자열에 섞인 한글 음절만 로마자로 바꾸고 나머지는 그대로 둔다.

    음절 사이와 한글/비한글 경계에 `-` 를 넣어, 뒤이어 돌아가는 slug 정규화가
    음절 경계를 잃지 않게 한다.
    """
    parts: list[str] = []
    previous_was_syllable = False
    for char in text:
        syllable = romanize_syllable(char)
        if syllable is None:
            if previous_was_syllable and char.isalnum():
                parts.append("-")
            parts.append(char)
            previous_was_syllable = False
            continue
        if parts and parts[-1][-1:].isalnum():
            parts.append("-")
        parts.append(syllable)
        previous_was_syllable = True
    return "".join(parts)
