from __future__ import annotations

import sys
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import skill_writer  # noqa: E402
from romanize import FINALS, INITIALS, VOWELS, romanize_hangul, romanize_syllable  # noqa: E402


class RomanizationTableTest(unittest.TestCase):
    """국어의 로마자 표기법 제2장 표기 일람과 제3장 제4항에 대조한다."""

    def test_table_sizes_match_the_unicode_jamo_counts(self) -> None:
        self.assertEqual(len(INITIALS), 19)
        self.assertEqual(len(VOWELS), 21)
        self.assertEqual(len(FINALS), 28)

    def test_official_personal_name_examples(self) -> None:
        # 고시 제3장 제4항 예시. 음운 변화를 반영하지 않는 표기다.
        self.assertEqual(romanize_hangul("한복남"), "han-bok-nam")
        self.assertEqual(romanize_hangul("홍빛나"), "hong-bit-na")

    def test_every_vowel_matches_the_official_table(self) -> None:
        syllables = "아애야얘어에여예오와왜외요우워웨위유으의이"
        expected = (
            "a ae ya yae eo e yeo ye o wa wae oe yo u wo we wi yu eu ui i".split()
        )
        for syllable, romanized in zip(syllables, expected):
            with self.subTest(syllable=syllable):
                self.assertEqual(romanize_syllable(syllable), romanized)

    def test_finals_use_the_representative_sound(self) -> None:
        cases = {
            "악": "ak", "안": "an", "앋": "at", "알": "al", "암": "am",
            "압": "ap", "앙": "ang", "앚": "at", "앛": "at", "앜": "ak",
            "앝": "at", "앞": "ap", "앟": "at",
            # 겹받침
            "앆": "ak", "앇": "ak", "앉": "an", "앍": "ak", "앎": "am",
            "앏": "al", "앐": "al", "앑": "al", "앒": "ap", "앓": "al",
            "앖": "ap", "았": "at",
        }
        for syllable, romanized in cases.items():
            with self.subTest(syllable=syllable):
                self.assertEqual(romanize_syllable(syllable), romanized)

    def test_aspirated_and_tense_initials(self) -> None:
        self.assertEqual(romanize_syllable("까"), "kka")
        self.assertEqual(romanize_syllable("따"), "tta")
        self.assertEqual(romanize_syllable("빠"), "ppa")
        self.assertEqual(romanize_syllable("싸"), "ssa")
        self.assertEqual(romanize_syllable("짜"), "jja")
        self.assertEqual(romanize_syllable("차"), "cha")

    def test_syllable_boundaries_of_the_hangul_block(self) -> None:
        # U+AC00 과 U+D7A3. 힣 의 받침 ㅎ 은 대표음 t 로 적는다
        # (표준발음법 제12항: 어말 ㅎ 은 [ㄷ] 으로 발음한다).
        self.assertEqual(romanize_syllable("가"), "ga")
        self.assertEqual(romanize_syllable("힣"), "hit")
        self.assertIsNone(romanize_syllable("A"))
        self.assertIsNone(romanize_syllable("ㄱ"))  # 호환 자모는 음절이 아니다


class RomanizeTextTest(unittest.TestCase):
    def test_non_hangul_text_passes_through_untouched(self) -> None:
        self.assertEqual(romanize_hangul("Big Mike"), "Big Mike")
        self.assertEqual(romanize_hangul("gil-dong"), "gil-dong")
        self.assertEqual(romanize_hangul(""), "")

    def test_separator_is_inserted_at_script_boundaries(self) -> None:
        self.assertEqual(romanize_hangul("홍길동A"), "hong-gil-dong-A")
        self.assertEqual(romanize_hangul("A홍길동"), "A-hong-gil-dong")

    def test_existing_punctuation_is_left_for_the_slug_normalizer(self) -> None:
        self.assertEqual(romanize_hangul("홍길동 팀장"), "hong-gil-dong tim-jang")


class SlugifyIntegrationTest(unittest.TestCase):
    def test_korean_names_produce_readable_slugs(self) -> None:
        self.assertEqual(skill_writer.slugify("홍길동"), "hong-gil-dong")
        self.assertEqual(skill_writer.slugify("김철수"), "gim-cheol-su")
        self.assertEqual(skill_writer.slugify("박영희"), "bak-yeong-hui")

    def test_korean_names_no_longer_fall_back_to_a_hash(self) -> None:
        for name in ("홍길동", "김철수", "박영희", "이몽룡"):
            with self.subTest(name=name):
                self.assertNotIn("person-", skill_writer.slugify(name))

    def test_slugify_is_idempotent(self) -> None:
        once = skill_writer.slugify("홍길동 팀장")
        self.assertEqual(skill_writer.slugify(once), once)

    def test_latin_behaviour_is_unchanged(self) -> None:
        self.assertEqual(skill_writer.slugify("Zadie Smith"), "zadie-smith")
        self.assertEqual(skill_writer.slugify("Élodie"), "elodie")

    def test_scripts_without_an_ascii_mapping_still_use_the_hash_fallback(self) -> None:
        # 로마자화 경로가 없는 문자는 이전과 같이 결정적 해시로 떨어진다.
        slug = skill_writer.slugify("周奇墨")
        self.assertTrue(slug.startswith("person-"), slug)
        self.assertEqual(slug, skill_writer.slugify("周奇墨"))

    def test_generated_slug_passes_slug_validation(self) -> None:
        for name in ("홍길동", "김철수", "남궁민수", "선우용녀"):
            with self.subTest(name=name):
                slug = skill_writer.slugify(name)
                self.assertEqual(skill_writer.validate_slug(slug), slug)

    def test_romanization_does_not_launder_path_traversal(self) -> None:
        """
        명시된 --slug 은 romanize_hangul 만 거쳐 validate_slug 로 간다.

        전체 slug 정규화를 먼저 적용하면 ../ 와 / 가 사라져 검증을 통과한다.
        로마자 변환은 한글 음절만 건드리므로 경로 문자가 그대로 남아 거부된다.
        """
        for unsafe in ("../escape", "../홍길동", "홍길동/../x", "홍길동/x"):
            with self.subTest(slug=unsafe):
                self.assertIn("/", romanize_hangul(unsafe))
                with self.assertRaises(ValueError):
                    skill_writer.validate_slug(romanize_hangul(unsafe))


if __name__ == "__main__":
    unittest.main()
