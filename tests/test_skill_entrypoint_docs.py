from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SUPPORTED_HOSTS = (
    "Claude Code",
    "Hermes Agent",
    "OpenClaw",
    "Codex",
    "DeepSeek Harness",
    "Pi coding agent",
    "Grok Build",
    "OpenCode",
)
# Slash invocations start at a text boundary; slashes inside install paths are allowed.
README_INVOCATION_PATTERNS = (
    re.compile(r"\$distilly\b"),
    re.compile(r"@distilly\b"),
    re.compile(r"(?<![\w.-])/distilly\b"),
    re.compile(r"(?<![\w.-])/skill(?:\s+|:)distilly\b"),
    re.compile(r"(?<![\w.-])/skills\b"),
    re.compile(r"(?<![\w.-])/\{character\}-\{slug\}"),
    re.compile(r"\$\{character\}-\{slug\}"),
    re.compile(r"(?<![\w.-])/skill:\{character\}-\{slug\}"),
)
HAN_CHARACTER = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


class SkillEntrypointDocsTest(unittest.TestCase):
    def _assert_readme_support_contract(self, content: str, source: str) -> None:
        self.assertIn("### 3️⃣", content, f"missing host section in {source}")
        host_section = content.split("### 3️⃣", 1)[1].split("\n---", 1)[0]
        host_rows = re.findall(r"^- \[([^\]]+)\]\(", host_section, re.M)

        self.assertEqual(list(SUPPORTED_HOSTS), host_rows, f"wrong host list in {source}")
        self.assertNotIn("🟣 **Claude Code**", host_section, f"text host rows remain in {source}")
        self.assertNotIn(
            "img.shields.io/badge/Claude%20Code-Skill",
            content,
            f"duplicate host badges remain in {source}",
        )
        self.assertNotIn(
            "assets/hosts",
            content,
            f"third-party host brand assets are referenced in {source}",
        )
        self.assertIn("Grok Bot", host_section, f"missing Grok Bot preview in {source}")
        self.assertIn("{character}-{slug}", content, f"missing generated Skill name in {source}")
        self.assertNotIn("## 📂", content, f"project structure section remains in {source}")
        for pattern in README_INVOCATION_PATTERNS:
            self.assertIsNone(
                pattern.search(content),
                f"invocation tutorial matching {pattern.pattern!r} remains in {source}",
            )

    def _assert_readme_quick_start(
        self, content: str, source: str, install_link: str
    ) -> None:
        self.assertIn("## ⚡", content, f"missing install section in {source}")
        quick_start = content.split("## ⚡", 1)[1].split("\n## ✨", 1)[0]
        self.assertIn("### 🤖", quick_start, f"missing Agent path in {source}")
        self.assertIn("### 👤", quick_start, f"missing human path in {source}")
        self.assertIn(
            "git clone https://github.com/10xtf/distilly-10x "
            "<DISTILLY_SKILL_DIR>",
            quick_start,
            f"missing short clone command in {source}",
        )
        self.assertIn(install_link, quick_start, f"missing install guide link in {source}")
        self.assertIn("{character}-{slug}", quick_start)
        self.assertNotIn("<details>", quick_start, f"collapsed install table remains in {source}")
        self.assertNotIn(
            "tools/install_generated_skill.py",
            quick_start,
            f"generated Skill installer detail remains in {source}",
        )
        self.assertNotIn(
            "tools/research/",
            quick_start,
            f"celebrity research commands remain in {source}",
        )

    def test_root_skill_uses_distilly_entrypoint(self) -> None:
        content = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: distilly", content)
        self.assertIn("`/distilly`", content)
        self.assertIn("`$distilly`", content)
        self.assertIn("`/skill:distilly`", content)
        self.assertNotIn("name: dot-skill", content)
        self.assertNotIn("`/dot-skill`", content)
        self.assertIn("호환 호스트", content)
        self.assertIn("compatible hosts", content.lower())
        self.assertIn("Grok Build", content)
        self.assertIn("Grok Bot", content)
        self.assertIn("Pi coding agent", content)
        self.assertIn("관리 작업", content)
        self.assertIn("tools/skill_writer.py", content)
        self.assertIn("prompt_kor/celebrity/research.md", content)
        self.assertIn("budget-unfriendly", content)
        self.assertIn("references/celebrity_budget_unfriendly_framework.md", content)
        self.assertIn("01_core_profile.md", content)
        self.assertIn("03_expression_and_reception.md", content)
        self.assertIn("Files scanned >= 3", content)
        self.assertIn("Unique URLs >= 2", content)
        self.assertIn("Potential long quote lines = 0", content)
        self.assertIn("실제로 열어본 구체적 페이지", content)
        self.assertIn("actual inspected pages", content)
        self.assertIn("01_writings.md", content)
        self.assertIn("06_timeline.md", content)
        self.assertIn("Files scanned >= 6", content)
        self.assertIn("Unique URLs >= 8", content)
        self.assertIn("Primary-source markers >= 3", content)
        self.assertIn("research_audit.md", content)
        self.assertIn("--work-patch /tmp/distilly_{slug}_work_patch.md", content)
        self.assertIn("Do not hand-edit `work.md`", content)
        self.assertIn("{distilly_skill_root}", content)
        self.assertIn("${CLAUDE_SKILL_DIR}", content)
        self.assertIn("Do not assume the shell's current working directory", content)
        self.assertNotIn("python3 tools/", content)
        self.assertNotIn("`/list-skills`", content)
        self.assertNotIn("Compatibility aliases:", content)

    def test_readme_quick_start_and_install_detail_contract(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        install = (ROOT / "INSTALL.md").read_text(encoding="utf-8")
        install_en = (ROOT / "INSTALL_EN.md").read_text(encoding="utf-8")
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")

        self._assert_readme_support_contract(readme, "README.md")
        self._assert_readme_quick_start(readme, "README.md", "(INSTALL_EN.md)")
        self.assertNotIn("/dot-skill", readme)
        self.assertNotIn("skills/dot-skill", readme)
        self.assertIn("https://github.com/10xtf/distilly-10x", readme)
        self.assertNotIn("https://github.com/titanwings/colleague-skill", readme)

        self.assertIn(".claude/skills/distilly", install)
        self.assertIn("~/.openclaw/workspace/skills/distilly", install)
        self.assertIn("~/.agents/skills/distilly", install)
        self.assertIn("~/.dsh/skills/distilly", install)
        self.assertIn("~/.pi/agent/skills/distilly", install)
        self.assertIn("~/.grok/skills/distilly", install)
        self.assertIn("~/.config/opencode/skills/distilly", install)
        self.assertIn(".opencode/skills/distilly", install)
        self.assertIn("/distilly", install)
        self.assertNotIn("/dot-skill", install)
        self.assertNotIn("skills/dot-skill", install)
        self.assertIn("https://github.com/10xtf/distilly-10x", install)
        self.assertNotIn("https://github.com/titanwings/colleague-skill", install)
        self.assertIn("./skills/colleague", install)
        self.assertIn("install_claude_generated_skill.py", install)
        self.assertIn("install_openclaw_generated_skill.py", install)
        self.assertIn("install_codex_generated_skill.py", install)
        self.assertIn("install_openclaw_skill.py", install)
        self.assertIn("install_codex_skill.py", install)
        self.assertIn("tools/research/quality_check.py", install)
        self.assertIn("tools/research/merge_research.py", install)
        self.assertIn("pip3 install -r requirements.txt", install)
        self.assertIn("~/.claude/skills/distilly", install_en)
        self.assertIn("~/.openclaw/workspace/skills/distilly", install_en)
        self.assertIn("~/.hermes/skills/openclaw-imports/distilly", install_en)
        self.assertIn("~/.agents/skills/distilly", install_en)
        self.assertIn("~/.dsh/skills/distilly", install_en)
        self.assertIn("~/.pi/agent/skills/distilly", install_en)
        self.assertIn("~/.grok/skills/distilly", install_en)
        self.assertIn("~/.config/opencode/skills/distilly", install_en)
        self.assertIn("tools/install_generated_skill.py", install_en)
        self.assertIn("tools/research/merge_research.py", install_en)
        self.assertIn("tools/research/quality_check.py", install_en)
        self.assertIn("pip3 install -r requirements.txt", install_en)
        self.assertIn("/{character}-{slug}", install)
        self.assertIn("./skills/colleague", skill)
        self.assertIn("DeepSeek Harness", skill)
        self.assertIn("OpenCode", skill)
        self.assertIn("eight agent hosts", readme.lower())
        self.assertIn("호환 호스트", install)

        self.assertFalse((ROOT / "docs" / "assets" / "hosts").exists())

    def test_repo_examples_live_under_skills_colleague(self) -> None:
        self.assertTrue((ROOT / "skills" / "colleague" / "example_hong").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_im").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_seong").exists())
        self.assertFalse((ROOT / "colleagues").exists())

    def test_multilingual_readmes_list_hosts_without_invocation_tutorials(self) -> None:
        for readme_path in (ROOT / "docs" / "lang").glob("README_*.md"):
            content = readme_path.read_text(encoding="utf-8")
            self.assertNotIn("/dot-skill", content, f"stale /dot-skill in {readme_path.name}")
            self._assert_readme_support_contract(content, readme_path.name)
            self._assert_readme_quick_start(
                content,
                readme_path.name,
                "(../../INSTALL.md)"
                if readme_path.name == "README_ZH.md"
                else "(../../INSTALL_EN.md)",
            )
            self.assertIn(
                "https://github.com/10xtf/distilly-10x",
                content,
                f"missing published repository URL in {readme_path.name}",
            )
            self.assertNotIn(
                "https://github.com/titanwings/colleague-skill",
                content,
                f"stale repository URL in {readme_path.name}",
            )
            self.assertNotIn(
                "colleague_skill.pdf",
                content,
                f"broken local paper link in {readme_path.name}",
            )

    def test_docs_do_not_reference_removed_messenger_collectors(self) -> None:
        readmes = [ROOT / "README.md"]
        readmes.extend(
            ROOT / "docs" / "lang" / f"README_{language}.md"
            for language in ("DE", "EN", "ES", "JA", "KO", "PT", "RU", "ZH")
        )
        readmes.extend(
            ROOT / "docs" / "lang" / f"ROADMAP_{language}.md"
            for language in ("DE", "ES", "JA", "KO", "PT", "RU", "ZH")
        )
        readmes.extend([ROOT / "ROADMAP.md", ROOT / "INSTALL.md", ROOT / "INSTALL_EN.md"])
        for path in readmes:
            content = path.read_text(encoding="utf-8")
            for removed in ("Lark", "Feishu", "feishu", "DingTalk", "dingtalk", "飞书", "钉钉"):
                self.assertNotIn(
                    removed,
                    content,
                    f"removed messenger collector still referenced in {path.name}",
                )

    def test_non_chinese_surfaces_do_not_mix_chinese_copy(self) -> None:
        single_language_paths = [
            ROOT / "README.md",
            ROOT / "ROADMAP.md",
            ROOT / "CONTRIBUTING.md",
            ROOT / "CITATION.cff",
            ROOT / "INSTALL_EN.md",
            ROOT / "docs" / "lang" / "README_EN.md",
            ROOT / "prompt_kor" / "celebrity" / "research.md",
            ROOT / "prompt_kor" / "celebrity" / "budget_unfriendly" / "research.md",
            ROOT / "references" / "celebrity_budget_unfriendly_framework.md",
            ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md",
        ]
        single_language_paths.extend(
            ROOT / "docs" / "lang" / f"{stem}_{language}.md"
            for stem in ("README", "ROADMAP")
            for language in ("DE", "ES", "KO", "PT", "RU")
        )
        single_language_paths.extend(
            ROOT / ".github" / "ISSUE_TEMPLATE" / name
            for name in (
                "bug_report.md",
                "config.yml",
                "feature_request.md",
                "question.md",
            )
        )

        for path in single_language_paths:
            content = path.read_text(encoding="utf-8")
            self.assertIsNone(
                HAN_CHARACTER.search(content),
                f"Chinese copy remains in {path.relative_to(ROOT)}",
            )

        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        frontmatter = skill.split("---", 2)[1]
        korean_skill = skill.split("# English Version", 1)[0]
        english_skill = skill.split("# English Version", 1)[1]
        self.assertIsNone(HAN_CHARACTER.search(frontmatter))
        self.assertIsNone(HAN_CHARACTER.search(english_skill))
        self.assertIn("이 Skill은 한국어와 영어를 지원한다", korean_skill)
        self.assertIsNone(HAN_CHARACTER.search(korean_skill))

        for name in ("README_JA.md", "ROADMAP_JA.md"):
            content = (ROOT / "docs" / "lang" / name).read_text(encoding="utf-8")
            for stale_phrase in ("原同事", "留痕", "企業微信"):
                self.assertNotIn(stale_phrase, content, f"Chinese phrase in {name}")

    def test_code_uses_new_names_with_explicit_legacy_fallbacks(self) -> None:
        writer = (ROOT / "tools" / "skill_writer.py").read_text(encoding="utf-8")
        schema = (ROOT / "tools" / "skill_schema.py").read_text(encoding="utf-8")
        codex_installer = (ROOT / "tools" / "install_codex_skill.py").read_text(encoding="utf-8")
        generated_installer = (
            ROOT / "tools" / "install_generated_skill_common.py"
        ).read_text(encoding="utf-8")

        self.assertIn("DISTILLY_AUTO_INSTALL_CLAUDE", writer)
        self.assertIn("DOT_SKILL_AUTO_INSTALL_CLAUDE", writer)
        self.assertIn('engine.setdefault("name", "distilly")', schema)
        self.assertIn('generation.setdefault("engine", "distilly")', schema)
        self.assertIn('Path.home() / ".agents" / "skills" / "distilly"', codex_installer)
        self.assertIn('.distilly-install.json', generated_installer)


if __name__ == "__main__":
    unittest.main()
