"""Behavior of the Agent Note format gate."""

from __future__ import annotations

import sys
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.verify_agent_notes import (
    Change,
    changes_from_git,
    parse_name_status,
    verify,
    verify_diff,
)


VALID_IMPLEMENTED = """# Agent Note: Example shipped rule

Status: implemented

## Problem

Need a record.

## Decision

We ship the rule.

## Alternatives considered

- **Do nothing** — rejected: no record.

## Consequences

Agents can find the decision.

## Verification

The format gate accepts this note.
"""


class VerifyAgentNotesTests(unittest.TestCase):
    def _tree(self, rel: str, body: str) -> Path:
        root = Path(tempfile.mkdtemp())
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
        return root

    def test_accepts_valid_implemented_note(self) -> None:
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md",
            VALID_IMPLEMENTED,
        )
        self.assertEqual(verify(root), [])

    def test_rejects_proposal_heading_on_implemented_note(self) -> None:
        body = VALID_IMPLEMENTED.replace("## Decision", "## Proposal")
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md",
            body,
        )
        errors = verify(root)
        self.assertTrue(any("banned" in e or "missing" in e for e in errors), errors)

    def test_rejects_unknown_class_folder(self) -> None:
        root = self._tree(
            ".agents/notes/proposed/misc/2026-08-19-example.md",
            VALID_IMPLEMENTED.replace("implemented", "proposed"),
        )
        errors = verify(root)
        self.assertTrue(any("unknown class" in e for e in errors), errors)

    def test_rejects_invalid_calendar_date(self) -> None:
        root = self._tree(
            ".agents/notes/implemented/process/2026-02-30-example.md",
            VALID_IMPLEMENTED,
        )
        errors = verify(root)
        self.assertTrue(any("real calendar date" in e for e in errors), errors)

    def test_rejects_duplicate_status_and_heading(self) -> None:
        body = VALID_IMPLEMENTED.replace(
            "## Decision", "Status: implemented\n\n## Decision\n\nAgain.\n\n## Decision"
        )
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md",
            body,
        )
        errors = verify(root)
        self.assertTrue(any("only one Status" in e for e in errors), errors)
        self.assertTrue(any("duplicate heading" in e for e in errors), errors)

    def test_rejects_loose_and_nested_notes(self) -> None:
        root = self._tree(
            ".agents/notes/implemented/2026-08-19-loose.md", VALID_IMPLEMENTED
        )
        nested = (
            root
            / ".agents/notes/implemented/process/nested/2026-08-19-example.md"
        )
        nested.parent.mkdir(parents=True)
        nested.write_text(VALID_IMPLEMENTED, encoding="utf-8")
        errors = verify(root)
        self.assertTrue(any("class folder" in e for e in errors), errors)
        self.assertTrue(any("nested note folders" in e for e in errors), errors)

    def test_rejects_note_at_notes_root(self) -> None:
        root = self._tree(".agents/notes/2026-08-19-loose.md", VALID_IMPLEMENTED)
        errors = verify(root)
        self.assertTrue(any("lifecycle and class" in e for e in errors), errors)

    def test_tilde_fence_cannot_supply_required_headings(self) -> None:
        body = VALID_IMPLEMENTED.replace(
            "## Decision", "~~~md\n## Decision"
        ).replace("## Verification", "## Verification\n~~~")
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md", body
        )
        errors = verify(root)
        self.assertTrue(any("missing `## Decision`" in e for e in errors), errors)

    def test_indented_fence_does_not_hide_required_headings(self) -> None:
        body = VALID_IMPLEMENTED.replace("## Decision", "    ```md\n## Decision")
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md", body
        )
        self.assertEqual(verify(root), [])

    def test_fence_suffix_is_not_a_closing_fence(self) -> None:
        body = VALID_IMPLEMENTED.replace(
            "## Decision",
            "```md\n## Decision\n```not-a-close",
        ).replace("The format gate accepts this note.", "```\n")
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md", body
        )
        errors = verify(root)
        self.assertTrue(any("missing `## Decision`" in e for e in errors), errors)

    def test_code_block_is_valid_verification_content(self) -> None:
        body = VALID_IMPLEMENTED.replace(
            "The format gate accepts this note.", "```sh\npython3 verify.py\n```"
        )
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md", body
        )
        self.assertEqual(verify(root), [])

    def test_rejects_same_note_in_two_lifecycles(self) -> None:
        root = self._tree(
            ".agents/notes/implemented/process/2026-08-19-example.md",
            VALID_IMPLEMENTED,
        )
        proposed = root / ".agents/notes/proposed/process/2026-08-19-example.md"
        proposed.parent.mkdir(parents=True)
        proposed.write_text(
            """# Agent Note: Proposed example

Status: proposed

## Problem

Need a decision.

## Proposal

Make one.

## Alternatives considered

- Do nothing.

## Acceptance criteria

The decision is testable.

## Risks

The choice may change.
""",
            encoding="utf-8",
        )
        errors = verify(root)
        self.assertTrue(any("duplicates note" in e for e in errors), errors)

    def test_governed_diff_requires_non_deleted_note(self) -> None:
        errors = verify_diff([Change("M", "tools/example.py")])
        self.assertTrue(any("requires" in error for error in errors), errors)
        errors = verify_diff(
            [
                Change("M", "tools/example.py"),
                Change(
                    "D",
                    ".agents/notes/implemented/process/2026-08-19-example.md",
                ),
            ]
        )
        self.assertTrue(any("requires" in error for error in errors), errors)
        errors = verify_diff(
            [Change("R", "archive/example.txt", "scripts/example.py")]
        )
        self.assertTrue(any("requires" in error for error in errors), errors)

    def test_governed_diff_accepts_changed_note(self) -> None:
        errors = verify_diff(
            [
                Change("M", "scripts/example.py"),
                Change(
                    "M",
                    ".agents/notes/implemented/process/2026-08-19-example.md",
                ),
            ]
        )
        self.assertEqual(errors, [])

    def test_typescript_workspace_and_root_configs_require_note(self) -> None:
        governed_paths = (
            "packages/protocol/src/index.ts",
            "packages/protocol/package.json",
            "package.json",
            "pnpm-workspace.yaml",
            "pnpm-lock.yaml",
            "pnpmfile.cjs",
            ".npmrc",
            ".gitignore",
            ".node-version",
            ".nvmrc",
            "tsconfig.json",
            "tsconfig.base.json",
            "eslint.config.js",
            "vitest.config.ts",
            "knip.json",
            ".prettierrc.json",
            ".prettierignore",
        )

        for path in governed_paths:
            with self.subTest(path=path):
                errors = verify_diff([Change("M", path)])
                self.assertEqual(len(errors), 1, errors)
                self.assertIn(path, errors[0])

    def test_typescript_workspace_and_root_configs_accept_changed_note(self) -> None:
        changes = [
            Change("M", "packages/protocol/src/index.ts"),
            Change("M", "package.json"),
            Change("M", "pnpm-workspace.yaml"),
            Change("M", "pnpm-lock.yaml"),
            Change("M", "tsconfig.tools.json"),
            Change("M", "eslint.config.mjs"),
            Change("M", "vitest.workspace.ts"),
            Change("M", "knip.config.ts"),
            Change("M", "prettier.config.cjs"),
            Change(
                "M",
                ".agents/notes/implemented/process/2026-08-19-example.md",
            ),
        ]

        self.assertEqual(verify_diff(changes), [])

    def test_colocated_typescript_tests_do_not_require_note(self) -> None:
        self.assertEqual(
            verify_diff(
                [
                    Change("M", "packages/protocol/src/ids.test.ts"),
                    Change(
                        "M",
                        "packages/protocol/src/public-api.snapshot.test.ts",
                    ),
                    Change(
                        "M",
                        "packages/protocol/src/__snapshots__/public-api.snap",
                    ),
                ]
            ),
            [],
        )

    def test_ungoverned_diff_does_not_require_note(self) -> None:
        self.assertEqual(
            verify_diff(
                [
                    Change("M", "tests/test_example.py"),
                    Change("M", "docs/lang/README_ZH.md"),
                ]
            ),
            [],
        )

    def test_parses_nul_delimited_rename(self) -> None:
        changes = parse_name_status(
            b"R100\0old.md\0new.md\0M\0tools/example.py\0"
        )
        self.assertEqual(
            changes,
            [Change("R", "new.md", "old.md"), Change("M", "tools/example.py")],
        )

    @patch("scripts.verify_agent_notes.subprocess.run")
    def test_git_diff_uses_exact_base_and_head(self, run) -> None:
        run.return_value.returncode = 0
        run.return_value.stdout = b"M\0tools/example.py\0"
        run.return_value.stderr = b""
        changes = changes_from_git("base-sha", Path("/repo"), head="head-sha")
        self.assertEqual(changes, [Change("M", "tools/example.py")])
        self.assertIn("base-sha...head-sha", run.call_args.args[0])

    def test_direct_range_detects_ancestor_rewind(self) -> None:
        root = Path(tempfile.mkdtemp())
        subprocess.run(["git", "init", "-q"], cwd=root, check=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=root,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Test"], cwd=root, check=True
        )
        (root / "README.md").write_text("# Root\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=root, check=True)
        subprocess.run(["git", "commit", "-qm", "base"], cwd=root, check=True)
        old = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
        ).stdout.strip()
        tool = root / "tools/example.py"
        tool.parent.mkdir()
        tool.write_text("VALUE = 1\n", encoding="utf-8")
        subprocess.run(["git", "add", "tools/example.py"], cwd=root, check=True)
        subprocess.run(["git", "commit", "-qm", "add tool"], cwd=root, check=True)
        new = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
        ).stdout.strip()

        self.assertEqual(
            changes_from_git(new, root, head=old, range_mode="merge-base"), []
        )
        self.assertEqual(
            changes_from_git(new, root, head=old, range_mode="direct"),
            [Change("D", "tools/example.py")],
        )


if __name__ == "__main__":
    unittest.main()
