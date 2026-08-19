"""Tracked pre-push hook fail-closed behavior."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


class PrePushHookTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=self.root,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Test"], cwd=self.root, check=True
        )
        subprocess.run(
            ["git", "branch", "-M", "distilly"], cwd=self.root, check=True
        )

        scripts = self.root / "scripts"
        hooks = self.root / ".githooks"
        fake_bin = self.root / "fake-bin"
        scripts.mkdir()
        hooks.mkdir()
        fake_bin.mkdir()
        (self.root / "tools").mkdir()
        (self.root / "tests").mkdir()
        for name in ("verify_docs.py", "verify_agent_notes.py"):
            (scripts / name).write_text("raise SystemExit(0)\n", encoding="utf-8")
        shutil.copyfile(
            Path(__file__).resolve().parents[1] / ".githooks/pre-push",
            hooks / "pre-push",
        )
        (hooks / "pre-push").chmod(0o755)
        ruff = fake_bin / "ruff"
        ruff.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
        ruff.chmod(0o755)
        (self.root / "README.md").write_text("# Test\n", encoding="utf-8")
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=self.root, check=True)
        self.oid = self._git("rev-parse", "HEAD")
        self.env = os.environ.copy()
        self.env["PATH"] = str(fake_bin) + os.pathsep + self.env["PATH"]

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _git(self, *args: str) -> str:
        return subprocess.run(
            ["git", *args],
            cwd=self.root,
            check=True,
            text=True,
            stdout=subprocess.PIPE,
        ).stdout.strip()

    def _run(self, record: str, **environment: str) -> subprocess.CompletedProcess:
        env = self.env.copy()
        env.update(environment)
        return subprocess.run(
            [".githooks/pre-push", "origin", "https://example.invalid/repo.git"],
            cwd=self.root,
            env=env,
            input=record,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )

    def test_accepts_clean_fast_forward_persistent_branch(self) -> None:
        record = f"refs/heads/distilly {self.oid} refs/heads/distilly {self.oid}\n"
        result = self._run(record)
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_rejects_persistent_branch_deletion(self) -> None:
        zeros = "0" * 40
        record = f"refs/heads/distilly {zeros} refs/heads/distilly {self.oid}\n"
        result = self._run(record)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("refusing to delete", result.stdout)

    def test_rejects_dirty_tree(self) -> None:
        (self.root / "dirty.txt").write_text("dirty\n", encoding="utf-8")
        record = f"refs/heads/distilly {self.oid} refs/heads/distilly {self.oid}\n"
        result = self._run(record)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("must be clean", result.stdout)

    def test_rejects_status_failure(self) -> None:
        record = f"refs/heads/distilly {self.oid} refs/heads/distilly {self.oid}\n"
        result = self._run(record, GIT_INDEX_FILE="/")
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("cannot inspect", result.stdout)

    def test_rejects_feature_branch_without_verified_base(self) -> None:
        subprocess.run(
            ["git", "branch", "-m", "codex/test"], cwd=self.root, check=True
        )
        record = f"refs/heads/codex/test {self.oid} refs/heads/codex/test {'0' * 40}\n"
        result = self._run(record)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("no verified base", result.stdout)


if __name__ == "__main__":
    unittest.main()
