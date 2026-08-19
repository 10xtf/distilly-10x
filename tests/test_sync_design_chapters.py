"""Canonical design chapter generation behavior."""

from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from scripts.sync_design_chapters import V1, V2, expected_chapters, verify


class SyncDesignChaptersTests(unittest.TestCase):
    def _root(self) -> Path:
        root = Path(tempfile.mkdtemp())
        parent = root / "docs/design/system-v1.md"
        parent.parent.mkdir(parents=True)
        sections = []
        for number in range(len(V1.names)):
            body = f"## {number}. Section {number}\n\nBody {number}."
            if number == 0:
                body += (
                    "\n\n```md\n## 99. Not a section\n"
                    "```not-a-close\n## 98. Still not a section\n```"
                    "\n\n    ```md"
                )
            if number == 23:
                body += (
                    "\n\n[process](../process/review.md)"
                    "\n\n[asset](../asset(a).png)"
                    "\n\n``[literal](../process/review.md)``"
                    "\n\n<img src=\"../asset.png\">"
                    "\n\n<a href=../process/review.md>review</a>"
                    "\n\n\\[escaped](../process/review.md)"
                    "\n\n<!-- [commented](../process/review.md) -->"
                    "\n\n[review]: ../process/review.md"
                )
            sections.append(body)
        parent.write_text("# Design\n\n" + "\n\n---\n\n".join(sections) + "\n")
        process = root / "docs/process/review.md"
        process.parent.mkdir(parents=True)
        process.write_text("# Review\n", encoding="utf-8")
        (root / "docs/asset.png").write_bytes(b"png")
        (root / "docs/asset(a).png").write_bytes(b"png")
        return root

    def test_expected_chapters_rewrite_relative_links(self) -> None:
        root = self._root()
        expected = expected_chapters(root, (V1,))
        chapter = expected[root / "docs/design/v1/23-governance.md"]
        self.assertIn("[process](../../process/review.md)", chapter)
        self.assertIn("[asset](../../asset(a).png)", chapter)
        self.assertIn("``[literal](../process/review.md)``", chapter)
        self.assertIn('src="../../asset.png"', chapter)
        self.assertIn("href=../../process/review.md", chapter)
        self.assertIn("\\[escaped](../process/review.md)", chapter)
        self.assertIn("<!-- [commented](../process/review.md) -->", chapter)
        self.assertIn("[review]: ../../process/review.md", chapter)

    def test_verify_accepts_generated_chapters(self) -> None:
        root = self._root()
        for path, content in expected_chapters(root, (V1,)).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        self.assertEqual(verify(root, (V1,)), [])

    def test_verify_rejects_drift_and_missing_chapter(self) -> None:
        root = self._root()
        expected = expected_chapters(root, (V1,))
        for path, content in expected.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        stale = root / "docs/design/v1/05-architecture.md"
        stale.write_text("stale\n", encoding="utf-8")
        (root / "docs/design/v1/06-source-tree.md").unlink()
        errors = verify(root, (V1,))
        self.assertTrue(any("05-architecture" in error for error in errors), errors)
        self.assertTrue(any("06-source-tree" in error for error in errors), errors)

    def test_verify_reports_each_corpus_by_its_own_parent(self) -> None:
        root = self._root()
        for path, content in expected_chapters(root, (V1,)).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        errors = verify(root, (V1, V2))
        self.assertEqual(errors, ["docs/design/system-v2.md is missing"])

    def test_verify_rejects_section_count_mismatch(self) -> None:
        root = self._root()
        short = replace(V1, names=V1.names[:-1])
        errors = verify(root, (short,))
        self.assertTrue(any("0..22" in error for error in errors), errors)


if __name__ == "__main__":
    unittest.main()
