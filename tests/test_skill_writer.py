from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parents[1] / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import skill_writer  # noqa: E402
import version_manager  # noqa: E402
from skill_presets import (  # noqa: E402
    get_character_preset,
    get_research_profile_preset,
    resolve_existing_storage_root,
)
from skill_schema import validate_path_segment  # noqa: E402


class SkillWriterTest(unittest.TestCase):
    def test_slugify_produces_portable_kebab_case(self) -> None:
        self.assertEqual(skill_writer.slugify("Zadie Smith"), "zadie-smith")
        self.assertEqual(skill_writer.slugify("Élodie"), "elodie")
        self.assertEqual(skill_writer.slugify("A/B"), "a-b")

    def test_create_skill_rejects_unsafe_slug_before_writing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            with self.assertRaisesRegex(ValueError, "kebab-case"):
                skill_writer.create_skill(
                    root / "skills" / "colleague",
                    "../escape",
                    {"name": "Unsafe"},
                    "Work body",
                    "Persona body",
                )
            self.assertFalse((root / "skills" / "escape").exists())

    def test_legacy_path_segments_are_windows_safe(self) -> None:
        self.assertEqual(validate_path_segment("Zadie Smith"), "Zadie Smith")
        self.assertEqual(validate_path_segment("Élodie"), "Élodie")
        for value in ("C:", "foo:bar", "CON", "nul.txt", "trailing.", "trailing "):
            with self.subTest(value=value):
                with self.assertRaisesRegex(ValueError, "safe path segment"):
                    validate_path_segment(value)

    def test_create_colleague_uses_portable_names_and_adds_engine_schema(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "colleague"
            meta = {
                "name": "Eulalie",
                "profile": {
                    "company": "ByteDance",
                    "level": "L2-1",
                    "role": "Backend Engineer",
                    "mbti": "INTJ",
                },
                "tags": {
                    "personality": ["direct", "data-driven"],
                    "culture": ["byte-dance-style"],
                },
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "zhangsan",
                meta,
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads(
                (skill_dir / "meta.json").read_text(encoding="utf-8")
            )
            manifest = json.loads((skill_dir / "manifest.json").read_text(encoding="utf-8"))
            combined_skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
            work_skill = (skill_dir / "work_skill.md").read_text(encoding="utf-8")
            persona_skill = (skill_dir / "persona_skill.md").read_text(encoding="utf-8")

            self.assertEqual(saved_meta["schema_version"], "3")
            self.assertEqual(saved_meta["kind"], "meta-skill")
            self.assertEqual(saved_meta["character"], "colleague")
            self.assertEqual(saved_meta["preset"], "distilly.colleague.v1")
            self.assertEqual(saved_meta["engine"]["name"], "distilly")
            self.assertEqual(saved_meta["generation"]["engine"], "distilly")
            self.assertEqual(saved_meta["type"], "colleague")
            self.assertEqual(saved_meta["id"], "meta-skill.colleague.zhangsan")
            self.assertEqual(saved_meta["artifacts"]["combined_name"], "colleague-zhangsan")
            self.assertEqual(saved_meta["artifacts"]["combined_command"], "colleague-zhangsan")
            self.assertEqual(saved_meta["compat"]["legacy_command"], "/create-colleague")
            self.assertEqual(manifest["kind"], "meta-skill")
            self.assertEqual(manifest["character"], "colleague")
            self.assertEqual(manifest["preset"], "distilly.colleague.v1")
            self.assertEqual(manifest["install"]["slash_commands"]["default"], "colleague-zhangsan")
            self.assertEqual(
                manifest["install"]["compatible_runtimes"],
                [
                    "claude-code",
                    "openclaw",
                    "hermes",
                    "codex",
                    "deepseek-harness",
                    "grok-build",
                    "pi",
                    "opencode",
                ],
            )
            self.assertEqual(
                manifest["install"]["installers"]["openclaw"],
                "tools/install_openclaw_generated_skill.py",
            )
            self.assertEqual(
                manifest["install"]["installers"]["codex"],
                "tools/install_codex_generated_skill.py",
            )
            self.assertIn("name: colleague-zhangsan", combined_skill)
            self.assertIn("## PART A: Work", combined_skill)
            self.assertIn("name: colleague-zhangsan-work", work_skill)
            self.assertIn("work capability only", work_skill)
            self.assertIn("name: colleague-zhangsan-persona", persona_skill)
            self.assertIn("persona only", persona_skill)

    def test_create_relationship_uses_character_preset_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "relationship"
            meta = {
                "character": "relationship",
                "name": "Mireille",
                "profile": {
                    "role": "Designer",
                },
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "mireille",
                meta,
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            manifest = json.loads((skill_dir / "manifest.json").read_text(encoding="utf-8"))
            combined_skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")

            self.assertEqual(saved_meta["kind"], "meta-skill")
            self.assertEqual(saved_meta["character"], "relationship")
            self.assertEqual(saved_meta["preset"], "distilly.relationship.v1")
            self.assertEqual(saved_meta["type"], "relationship")
            self.assertEqual(saved_meta["classification"]["gallery_category"], "Relationship")
            self.assertEqual(saved_meta["compat"]["legacy_storage_root"], "skills/relationship")
            self.assertEqual(manifest["id"], "meta-skill.relationship.mireille")
            self.assertEqual(manifest["character"], "relationship")
            self.assertEqual(saved_meta["artifacts"]["combined_command"], "relationship-mireille")
            self.assertIn("name: relationship-mireille", combined_skill)

    def test_create_skill_renders_korean_chrome_when_language_is_ko_kr(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "relationship"
            meta = {
                "character": "relationship",
                "name": "Mireille",
                "classification": {
                    "language": "ko-KR",
                },
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "mireille",
                meta,
                "Work body",
                "Persona body",
            )

            combined_skill = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
            work_skill = (skill_dir / "work_skill.md").read_text(encoding="utf-8")
            persona_skill = (skill_dir / "persona_skill.md").read_text(encoding="utf-8")

            self.assertIn("## PART A: 업무 능력", combined_skill)
            self.assertIn("실행 규칙", combined_skill)
            self.assertIn("Work 전용, Persona 없음", work_skill)
            self.assertIn("Persona 전용, 업무 능력 없음", persona_skill)

    def test_work_only_skill_replaces_persona_handoff(self) -> None:
        ko_handoff = "담당 범위 밖의 질문을 받으면 해당 동료의 방식으로 응답한다 (Persona 부분 참조)."
        en_handoff = (
            "If you are asked a question outside your recorded responsibilities, "
            "respond in this colleague's style (see the Persona section)."
        )
        ko_work_content = (
            "## 업무 능력 사용 설명\n\n"
            "사용자가 다음 과제를 요청하면 위 규범을 그대로 따른다.\n\n"
            f"{ko_handoff}\n"
        )
        en_work_content = (
            "## Scope rule\n\n"
            "If asked outside your recorded responsibilities:\n"
            "- State the evidence gap\n\n"
            "## Persona naming note\n\n"
            "Keep this documentation sentence.\n\n"
            f"{en_handoff}\n"
        )
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "colleague"
            ko_meta = {
                "name": "Eulalie",
                "language": "ko-KR",
                "profile": {
                    "company": "ByteDance",
                    "level": "L2-1",
                    "role": "Backend Engineer",
                },
            }
            en_meta = {
                "name": "Eulalie",
                "language": "en",
                "profile": {
                    "company": "ByteDance",
                    "level": "L2-1",
                    "role": "Backend Engineer",
                },
            }

            ko_dir = skill_writer.create_skill(
                base_dir / "ko",
                "hong",
                ko_meta,
                ko_work_content,
                "Persona body",
            )
            en_dir = skill_writer.create_skill(
                base_dir / "en",
                "hong",
                en_meta,
                en_work_content,
                "Persona body",
            )

            ko_stored_work = (ko_dir / "work.md").read_text(encoding="utf-8")
            ko_combined = (ko_dir / "SKILL.md").read_text(encoding="utf-8")
            en_stored_work = (en_dir / "work.md").read_text(encoding="utf-8")
            en_combined = (en_dir / "SKILL.md").read_text(encoding="utf-8")
            ko_work_skill = (ko_dir / "work_skill.md").read_text(encoding="utf-8")
            en_work_skill = (en_dir / "work_skill.md").read_text(encoding="utf-8")

            self.assertIn(ko_handoff, ko_stored_work)
            self.assertIn(ko_handoff, ko_combined)
            self.assertIn(en_handoff, en_stored_work)
            self.assertIn(en_handoff, en_combined)
            self.assertNotIn(ko_handoff, ko_work_skill)
            self.assertNotIn(en_handoff, en_work_skill)
            self.assertIn("If asked outside your recorded responsibilities:", en_work_skill)
            self.assertIn("## Persona naming note", en_work_skill)
            self.assertIn("Keep this documentation sentence.", en_work_skill)
            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_KO, ko_work_skill)
            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_work_skill)
            self.assertIn("없는 정보를 지어내지 않으며", ko_work_skill)
            self.assertNotIn("추론하지 않는다", ko_work_skill)
            self.assertIn("Do not fabricate missing information", en_work_skill)
            self.assertNotIn("Do not infer", en_work_skill)
            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_KO, ko_combined)
            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_combined)

    def test_create_celebrity_adds_research_dirs_and_toolchain(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "celebrity"
            meta = {
                "character": "celebrity",
                "name": "Zadie Smith",
                "profile": {
                    "identity": "Novelist",
                    "known_for": "Essay and criticism",
                },
                "tags": ["literature", "essay", "public-intellectual"],
                "knowledge_sources": ["interview", "essay"],
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "zadie-smith",
                meta,
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            manifest = json.loads((skill_dir / "manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(saved_meta["character"], "celebrity")
            self.assertEqual(saved_meta["preset"], "distilly.celebrity.v1")
            self.assertEqual(saved_meta["research_profile"], "budget-friendly")
            self.assertIn("research_tools", saved_meta["engine"])
            self.assertEqual(saved_meta["engine"]["research_profile"], "budget-friendly")
            self.assertIn("research_tools", manifest["toolchain"])
            self.assertEqual(manifest["research_profile"], "budget-friendly")
            self.assertEqual(
                saved_meta["classification"]["tags"],
                ["literature", "essay", "public-intellectual"],
            )
            self.assertIn("Novelist", saved_meta["summary"])
            self.assertIn("Essay and criticism", saved_meta["summary"])
            self.assertTrue((skill_dir / "knowledge" / "research" / "raw").exists())
            self.assertTrue((skill_dir / "knowledge" / "research" / "merged").exists())
            self.assertTrue((skill_dir / "knowledge" / "transcripts").exists())
            self.assertTrue((skill_dir / "knowledge" / "subtitles").exists())

    def test_create_celebrity_budget_unfriendly_embeds_profile_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "celebrity"
            meta = {
                "character": "celebrity",
                "research_profile": "budget-unfriendly",
                "name": "Xu Zhisheng",
                "classification": {"language": "ko-KR"},
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "hong-gildong",
                meta,
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            manifest = json.loads((skill_dir / "manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(saved_meta["research_profile"], "budget-unfriendly")
            self.assertEqual(saved_meta["engine"]["quality_profile"], "budget-unfriendly")
            self.assertIn(
                "prompt_kor/celebrity/budget_unfriendly/research.md",
                saved_meta["engine"]["research_profile_bundle"].values(),
            )
            self.assertIn(
                "prompt_kor/celebrity/budget_unfriendly/audit.md",
                saved_meta["engine"]["research_profile_bundle"].values(),
            )
            self.assertIn(
                "references/celebrity_budget_unfriendly_framework.md",
                saved_meta["engine"]["research_profile_references"],
            )
            self.assertEqual(manifest["research_profile"], "budget-unfriendly")
            self.assertEqual(manifest["toolchain"]["quality_profile"], "budget-unfriendly")
            self.assertEqual(manifest["toolchain"]["merge_strategy"], "deep")

    def test_create_celebrity_accepts_string_profile_from_runtime_meta(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "celebrity"
            meta = {
                "character": "celebrity",
                "name": "홍길동",
                "display_name": "홍길동",
                "classification": {"language": "ko-KR"},
                "profile": "한국 스탠드업 코미디언. 자조적 관찰 코미디로 알려져 있다.",
            }

            skill_dir = skill_writer.create_skill(
                base_dir,
                "hong-gildong",
                meta,
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(
                saved_meta["profile"], "한국 스탠드업 코미디언. 자조적 관찰 코미디로 알려져 있다."
            )
            self.assertIn("한국 스탠드업 코미디언", saved_meta["summary"])

    def test_existing_dot_skill_metadata_keeps_legacy_engine_identifiers(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "colleague"
            skill_dir = skill_writer.create_skill(
                base_dir,
                "legacy",
                {
                    "name": "Legacy",
                    "preset": "dot.colleague.v1",
                    "engine": {"name": "dot-skill"},
                    "generation": {"engine": "dot-skill"},
                    "artifacts": {
                        "combined_name": "colleague_legacy",
                        "work_name": "colleague_legacy_work",
                        "persona_name": "colleague_legacy_persona",
                    },
                },
                "Work body",
                "Persona body",
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_meta["preset"], "dot.colleague.v1")
            self.assertEqual(saved_meta["engine"]["name"], "dot-skill")
            self.assertEqual(saved_meta["generation"]["engine"], "dot-skill")
            self.assertEqual(saved_meta["artifacts"]["combined_name"], "colleague_legacy")
            self.assertIn(
                "name: colleague_legacy",
                (skill_dir / "SKILL.md").read_text(encoding="utf-8"),
            )

    def test_update_preserves_names_from_legacy_meta_without_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            skill_dir = Path(tmp_dir) / "skills" / "colleague" / "legacy_person"
            skill_dir.mkdir(parents=True)
            (skill_dir / "versions").mkdir()
            (skill_dir / "meta.json").write_text(
                json.dumps(
                    {
                        "name": "Legacy Person",
                        "type": "colleague",
                        "version": "v1",
                    }
                ),
                encoding="utf-8",
            )
            (skill_dir / "work.md").write_text("Legacy work\n", encoding="utf-8")
            (skill_dir / "persona.md").write_text("Legacy persona\n", encoding="utf-8")
            legacy_names = {
                "SKILL.md": "colleague_legacy_person",
                "work_skill.md": "colleague_legacy_person_work",
                "persona_skill.md": "colleague_legacy_person_persona",
            }
            for filename, name in legacy_names.items():
                (skill_dir / filename).write_text(
                    f"---\nname: {name}\ndescription: Legacy\n---\n\nLegacy body\n",
                    encoding="utf-8",
                )

            skill_writer.update_skill(skill_dir, work_patch="Updated work")

            for filename, name in legacy_names.items():
                content = (skill_dir / filename).read_text(encoding="utf-8")
                self.assertIn(f"name: {name}", content)
            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            self.assertEqual(
                saved_meta["artifacts"]["combined_command"],
                "colleague-legacy-person",
            )

    def test_update_rejects_traversal_in_stored_version_before_backup(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            skill_dir = skill_writer.create_skill(
                root / "skills" / "colleague",
                "unsafe-version",
                {"name": "Unsafe Version"},
                "Work body",
                "Persona body",
            )
            meta_path = skill_dir / "meta.json"
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            meta["version"] = "../../../../escape"
            meta["lifecycle"]["version"] = "../../../../escape"
            meta_path.write_text(json.dumps(meta), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "safe path segment"):
                skill_writer.update_skill(skill_dir, work_patch="Should not be written")

            self.assertFalse((root / "escape").exists())
            self.assertNotIn(
                "Should not be written",
                (skill_dir / "work.md").read_text(encoding="utf-8"),
            )

    def test_update_regenerates_manifest_and_archives_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "colleague"
            skill_dir = skill_writer.create_skill(
                base_dir,
                "zhangsan",
                {"name": "Eulalie"},
                "Initial work",
                "Initial persona",
            )

            new_version = skill_writer.update_skill(
                skill_dir,
                work_patch="More work",
                correction={"scene": "challenged", "wrong": "apologize", "correct": "ask for evidence"},
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            manifest = json.loads((skill_dir / "manifest.json").read_text(encoding="utf-8"))
            archived_manifest = skill_dir / "versions" / "v1" / "manifest.json"
            persona_doc = (skill_dir / "persona.md").read_text(encoding="utf-8")

            self.assertEqual(new_version, "v2")
            self.assertEqual(saved_meta["version"], "v2")
            self.assertEqual(saved_meta["corrections_count"], 1)
            self.assertTrue(archived_manifest.exists())
            self.assertEqual(manifest["entrypoints"]["default"], "SKILL.md")
            self.assertIn("apologize", persona_doc)
            self.assertIn("ask for evidence", persona_doc)

    def test_update_accepts_multiple_persona_corrections_in_one_payload(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "celebrity"
            skill_dir = skill_writer.create_skill(
                base_dir,
                "im-kkeokjeong",
                {
                    "character": "celebrity",
                    "name": "임꺽정",
                    "classification": {"language": "ko-KR"},
                },
                "Initial work",
                "Initial persona",
            )

            new_version = skill_writer.update_skill(
                skill_dir,
                correction={
                    "persona_corrections": [
                        {
                            "scene": "상황을 깔 때",
                            "wrong": "시작하자마자 판단부터 내린다",
                            "correct": "상황을 평범하게 깔아둔 뒤 가볍게 한 번 짚는다",
                        },
                        {
                            "scene": "입장을 밝힐 때",
                            "wrong": "대놓고 자조하는 형태로 쓴다",
                            "correct": "청중과 함께 모두가 같은 처지임을 인정한다",
                        },
                    ]
                },
            )

            saved_meta = json.loads((skill_dir / "meta.json").read_text(encoding="utf-8"))
            persona_doc = (skill_dir / "persona.md").read_text(encoding="utf-8")

            self.assertEqual(new_version, "v2")
            self.assertEqual(saved_meta["corrections_count"], 2)
            self.assertIn("시작하자마자 판단부터 내린다", persona_doc)
            self.assertIn("대놓고 자조하는 형태로 쓴다", persona_doc)
            self.assertEqual(persona_doc.count("## Correction Log"), 1)

    def test_update_replaces_existing_markdown_sections_instead_of_appending_duplicates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "celebrity"
            skill_dir = skill_writer.create_skill(
                base_dir,
                "im-kkeokjeong",
                {
                    "character": "celebrity",
                    "name": "임꺽정",
                    "classification": {"language": "ko-KR"},
                },
                "\n".join(
                    [
                        "# Work",
                        "",
                        "## 표현 규범",
                        "",
                        "- 원래 표현",
                        "",
                        "## 출력 스타일",
                        "",
                        "- 원래 구조",
                    ]
                ),
                "\n".join(
                    [
                        "# Persona",
                        "",
                        "## Layer 2: Expression DNA",
                        "",
                        "이전 내용",
                        "",
                        "## Layer 3: Mental Models",
                        "",
                        "변경 없음",
                    ]
                ),
            )

            skill_writer.update_skill(
                skill_dir,
                work_patch="\n".join(
                    [
                        "## 표현 규범",
                        "",
                        "- 새로운 리듬 제어",
                        "",
                        "## 출력 스타일",
                        "",
                        "- 새로운 구조 템플릿",
                    ]
                ),
                persona_patch="\n".join(
                    [
                        "## Layer 2: Expression DNA",
                        "",
                        "새 내용",
                    ]
                ),
            )

            work_doc = (skill_dir / "work.md").read_text(encoding="utf-8")
            persona_doc = (skill_dir / "persona.md").read_text(encoding="utf-8")

            self.assertEqual(work_doc.count("## 표현 규범"), 1)
            self.assertEqual(work_doc.count("## 출력 스타일"), 1)
            self.assertIn("새로운 리듬 제어", work_doc)
            self.assertNotIn("원래 표현", work_doc)
            self.assertEqual(persona_doc.count("## Layer 2: Expression DNA"), 1)
            self.assertIn("새 내용", persona_doc)
            self.assertNotIn("이전 내용", persona_doc)


class VersionManagerTest(unittest.TestCase):
    def test_backup_and_rollback_include_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_dir = Path(tmp_dir) / "skills" / "colleague"
            skill_dir = skill_writer.create_skill(
                base_dir,
                "zhangsan",
                {"name": "Eulalie"},
                "v1 work",
                "v1 persona",
            )

            version_manager.backup_current_version(skill_dir)
            skill_writer.update_skill(skill_dir, work_patch="v2 work")

            success = version_manager.rollback(skill_dir, "v1")
            restored_work = (skill_dir / "work.md").read_text(encoding="utf-8")

            self.assertTrue(success)
            self.assertIn("v1 work", restored_work)
            self.assertTrue((skill_dir / "versions" / "v1" / "manifest.json").exists())
            self.assertFalse(version_manager.rollback(skill_dir, "../v1"))

    def test_version_manager_can_still_resolve_legacy_colleagues_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            cwd = Path.cwd()
            try:
                os.chdir(tmp_dir)
                legacy_base_dir = Path("colleagues")
                skill_writer.create_skill(
                    legacy_base_dir,
                    "zhangsan",
                    {"name": "Eulalie"},
                    "v1 work",
                    "v1 persona",
                )

                resolved = resolve_existing_storage_root("colleague", slug="zhangsan")
                self.assertEqual(resolved, Path("colleagues"))
            finally:
                os.chdir(cwd)


class PromptPresetTest(unittest.TestCase):
    def test_character_prompt_bundles_exist(self) -> None:
        project_root = Path(__file__).resolve().parents[1]

        for character in ("colleague", "relationship", "celebrity"):
            preset = get_character_preset(character)
            for prompt_path in preset["prompt_bundle"].values():
                if not isinstance(prompt_path, str) or not prompt_path.startswith("prompt_kor/"):
                    continue
                self.assertTrue(
                    (project_root / prompt_path).exists(),
                    f"missing prompt file for {character}: {prompt_path}",
                )
            for tool_path in preset.get("research_tools", {}).values():
                self.assertTrue(
                    (project_root / tool_path).exists(),
                    f"missing research tool for {character}: {tool_path}",
                )
            for profile_name in preset.get("research_profiles", {}):
                profile = get_research_profile_preset(character, profile_name)
                for prompt_path in profile.get("prompt_bundle", {}).values():
                    if not isinstance(prompt_path, str) or not prompt_path.startswith("prompt_kor/"):
                        continue
                    self.assertTrue(
                        (project_root / prompt_path).exists(),
                        f"missing profile prompt file for {character}/{profile_name}: {prompt_path}",
                    )
                for reference_path in profile.get("references", []):
                    self.assertTrue(
                        (project_root / reference_path).exists(),
                        f"missing profile reference for {character}/{profile_name}: {reference_path}",
                    )

        friendly_prompt = (project_root / "prompt_kor" / "celebrity" / "research.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("01_core_profile.md", friendly_prompt)
        self.assertIn("03_expression_and_reception.md", friendly_prompt)
        self.assertIn("raw 노트 파일을 최소 3개", friendly_prompt)
        self.assertIn("실제로 열어 본 페이지", friendly_prompt)
        self.assertIn("자동 수집 도구는 제공하지 않는다", " ".join(friendly_prompt.split()))

        strict_prompt = (
            project_root
            / "prompt_kor"
            / "celebrity"
            / "budget_unfriendly"
            / "research.md"
        ).read_text(encoding="utf-8")
        self.assertIn("01_writings.md", strict_prompt)
        self.assertIn("06_timeline.md", strict_prompt)
        self.assertIn("근거 있는 출처 URL 최소 8개", strict_prompt)
        self.assertIn("이 여섯 파일을 하나의 통합 스크래치패드로 대체하지 않는다", strict_prompt)
        self.assertIn("실제로 열어 본 페이지", strict_prompt)
        self.assertIn("자동 수집 도구는 제공하지 않는다", " ".join(strict_prompt.split()))


if __name__ == "__main__":
    unittest.main()
