from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SkillEntrypointDocsTest(unittest.TestCase):
    def test_root_skill_uses_distilly_entrypoint(self) -> None:
        content = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: distilly", content)
        self.assertIn("`/distilly`", content)
        self.assertIn("`$distilly`", content)
        self.assertIn("`/skill:distilly`", content)
        self.assertNotIn("name: dot-skill", content)
        self.assertNotIn("`/dot-skill`", content)
        self.assertIn("兼容宿主", content)
        self.assertIn("compatible hosts", content.lower())
        self.assertIn("Grok Build", content)
        self.assertIn("Grok Bot", content)
        self.assertIn("Pi coding agent", content)
        self.assertIn("管理操作", content)
        self.assertIn("tools/skill_writer.py", content)
        self.assertIn("tools/research/xquik_public_posts.py", content)
        self.assertIn("prompts/celebrity/research.md", content)
        self.assertIn("budget-unfriendly", content)
        self.assertIn("references/celebrity_budget_unfriendly_framework.md", content)
        self.assertIn("01_core_profile.md", content)
        self.assertIn("03_expression_and_reception.md", content)
        self.assertIn("Files scanned >= 3", content)
        self.assertIn("Unique URLs >= 2", content)
        self.assertIn("Potential long quote lines = 0", content)
        self.assertIn("实际打开过的具体页面", content)
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

    def test_readme_and_install_use_current_host_paths(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        install = (ROOT / "INSTALL.md").read_text(encoding="utf-8")
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn(".claude/skills/distilly", readme)
        self.assertIn("~/.openclaw/workspace/skills/distilly", readme)
        self.assertIn("~/.agents/skills/distilly", readme)
        self.assertIn("~/.dsh/skills/distilly", readme)
        self.assertIn("~/.pi/agent/skills/distilly", readme)
        self.assertIn("~/.grok/skills/distilly", readme)
        self.assertIn("/distilly", readme)
        self.assertNotIn("/dot-skill", readme)
        self.assertNotIn("skills/dot-skill", readme)
        self.assertIn("https://github.com/titanwings/colleague-skill", readme)
        self.assertNotIn("https://github.com/titanwings/distilly", readme)
        self.assertIn("./skills/colleague", readme)

        self.assertIn(".claude/skills/distilly", install)
        self.assertIn("~/.openclaw/workspace/skills/distilly", install)
        self.assertIn("~/.agents/skills/distilly", install)
        self.assertIn("~/.dsh/skills/distilly", install)
        self.assertIn("~/.pi/agent/skills/distilly", install)
        self.assertIn("~/.grok/skills/distilly", install)
        self.assertIn("/distilly", install)
        self.assertNotIn("/dot-skill", install)
        self.assertNotIn("skills/dot-skill", install)
        self.assertIn("https://github.com/titanwings/colleague-skill", install)
        self.assertNotIn("https://github.com/titanwings/distilly", install)
        self.assertIn("./skills/colleague", install)
        self.assertIn("install_claude_generated_skill.py", readme)
        self.assertIn("install_claude_generated_skill.py", install)
        self.assertIn("install_openclaw_generated_skill.py", readme)
        self.assertIn("install_openclaw_generated_skill.py", install)
        self.assertIn("install_codex_generated_skill.py", readme)
        self.assertIn("install_codex_generated_skill.py", install)
        self.assertIn("install_openclaw_skill.py", install)
        self.assertIn("install_codex_skill.py", install)
        self.assertIn("/{character}-{slug}", install)
        self.assertIn("./skills/colleague", skill)
        self.assertIn("DeepSeek Harness", skill)
        self.assertIn("seven agent hosts", readme.lower())
        self.assertIn("兼容宿主", install)

    def test_repo_examples_live_under_skills_colleague(self) -> None:
        self.assertTrue((ROOT / "skills" / "colleague" / "example_zhangsan").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_tianyi").exists())
        self.assertTrue((ROOT / "skills" / "colleague" / "example_jiaxiu").exists())
        self.assertFalse((ROOT / "colleagues").exists())

    def test_multilingual_readmes_include_hosts_and_research_toolchain(self) -> None:
        for readme_path in (ROOT / "docs" / "lang").glob("README_*.md"):
            content = readme_path.read_text(encoding="utf-8")
            self.assertIn("/distilly", content, f"missing /distilly in {readme_path.name}")
            self.assertNotIn("/dot-skill", content, f"stale /dot-skill in {readme_path.name}")
            self.assertIn("Grok Build", content, f"missing Grok Build in {readme_path.name}")
            self.assertIn("Grok Bot", content, f"missing Grok Bot in {readme_path.name}")
            self.assertIn("Pi", content, f"missing Pi in {readme_path.name}")
            self.assertIn("/skill:distilly", content, f"missing Pi command in {readme_path.name}")
            self.assertIn("$distilly", content, f"missing Codex command in {readme_path.name}")
            self.assertIn(
                "https://github.com/titanwings/colleague-skill",
                content,
                f"missing published repository URL in {readme_path.name}",
            )
            self.assertNotIn(
                "https://github.com/titanwings/distilly",
                content,
                f"unpublished repository URL in {readme_path.name}",
            )
            self.assertIn(
                "tools/install_hermes_skill.py --force",
                content,
                f"missing Hermes installer in {readme_path.name}",
            )
            self.assertIn(
                "tools/research/quality_check.py",
                content,
                f"missing celebrity research toolchain in {readme_path.name}",
            )
            self.assertIn(
                "tools/research/xquik_public_posts.py",
                content,
                f"missing X collector in {readme_path.name}",
            )
            self.assertNotIn(
                "colleague_skill.pdf",
                content,
                f"broken local paper link in {readme_path.name}",
            )

    def test_non_chinese_docs_call_the_product_lark(self) -> None:
        non_chinese = [ROOT / "README.md", ROOT / "docs" / "lang" / "README_EN.md"]
        non_chinese.extend(
            ROOT / "docs" / "lang" / f"README_{language}.md"
            for language in ("DE", "ES", "JA", "KO", "PT", "RU")
        )
        for path in non_chinese:
            content = path.read_text(encoding="utf-8")
            self.assertIn("Lark", content, f"missing Lark in {path.name}")
            self.assertNotIn("Feishu", content, f"stale visible Feishu name in {path.name}")

        chinese = (ROOT / "docs" / "lang" / "README_ZH.md").read_text(encoding="utf-8")
        self.assertIn("飞书", chinese)

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

        for collector_name in (
            "feishu_auto_collector.py",
            "feishu_mcp_client.py",
            "dingtalk_auto_collector.py",
            "slack_auto_collector.py",
        ):
            collector = (ROOT / "tools" / collector_name).read_text(encoding="utf-8")
            self.assertIn('Path.home() / ".distilly"', collector)
            self.assertIn('Path.home() / ".colleague-skill"', collector)
            self.assertIn("CONFIG_PATH.chmod(0o600)", collector)


if __name__ == "__main__":
    unittest.main()
