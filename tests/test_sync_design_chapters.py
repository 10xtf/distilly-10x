"""Canonical design chapter generation behavior."""

from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from scripts.sync_design_chapters import (
    CORPORA,
    V1,
    V2,
    V3,
    Corpus,
    DesignSyncError,
    chapters_for,
    expected_chapters,
    verify,
    write,
)


class SyncDesignChaptersTests(unittest.TestCase):
    @staticmethod
    def _single(corpus: Corpus) -> Corpus:
        return replace(corpus, status="in_force", successor=None)

    def _write_parent(self, root: Path, corpus: Corpus) -> None:
        parent = root / corpus.parent
        parent.parent.mkdir(parents=True, exist_ok=True)
        sections = []
        for number in range(len(corpus.names)):
            body = f"## {number}. Section {number}\n\nBody {number}."
            if corpus.version == 1 and number == 0:
                body += (
                    "\n\n```md\n## 99. Not a section\n"
                    "```not-a-close\n## 98. Still not a section\n```"
                    "\n\n    ```md"
                )
            if corpus.version == 1 and number == 23:
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
        parent.write_text(
            "# Design\n\n" + "\n\n---\n\n".join(sections) + "\n",
            encoding="utf-8",
        )

    def _root(self, *corpora: Corpus) -> Path:
        root = Path(tempfile.mkdtemp())
        for corpus in corpora:
            self._write_parent(root, corpus)
        process = root / "docs/process/review.md"
        process.parent.mkdir(parents=True, exist_ok=True)
        process.write_text("# Review\n", encoding="utf-8")
        (root / "docs/asset.png").write_bytes(b"png")
        (root / "docs/asset(a).png").write_bytes(b"png")
        return root

    def test_expected_chapters_rewrite_relative_links(self) -> None:
        corpus = self._single(V1)
        root = self._root(corpus)
        expected = expected_chapters(root, (corpus,))
        chapter = expected[root / "docs/design/v1/23-governance.md"]
        self.assertIn("[process](../../process/review.md)", chapter)
        self.assertIn("[asset](../../asset(a).png)", chapter)
        self.assertIn("``[literal](../process/review.md)``", chapter)
        self.assertIn('src="../../asset.png"', chapter)
        self.assertIn("href=../../process/review.md", chapter)
        self.assertIn("\\[escaped](../process/review.md)", chapter)
        self.assertIn("<!-- [commented](../process/review.md) -->", chapter)
        self.assertIn("[review]: ../../process/review.md", chapter)

    def test_verify_accepts_all_three_generated_corpora(self) -> None:
        root = self._root(*CORPORA)
        for path, content in expected_chapters(root, CORPORA).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        self.assertEqual(verify(root, CORPORA), [])

    def test_verify_reports_missing_v3_parent(self) -> None:
        root = self._root(V1, V2)
        for corpus in (V1, V2):
            for path, content in chapters_for(root, corpus).items():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
        errors = verify(root, CORPORA)
        self.assertEqual(errors, ["docs/design/system-v3.md is missing"])

    def test_verify_rejects_v3_drift_missing_and_extra_chapters(self) -> None:
        root = self._root(*CORPORA)
        for path, content in expected_chapters(root, CORPORA).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        stale = root / "docs/design/v3/05-architecture-and-state.md"
        stale.write_text("stale\n", encoding="utf-8")
        (root / "docs/design/v3/06-fact-layer-and-recovery.md").unlink()
        extra = root / "docs/design/v3/30-extra.md"
        extra.write_text("extra\n", encoding="utf-8")
        errors = verify(root, CORPORA)
        self.assertTrue(any("05-architecture" in error for error in errors), errors)
        self.assertTrue(any("06-fact-layer" in error for error in errors), errors)
        self.assertTrue(any("30-extra" in error for error in errors), errors)

    def test_verify_rejects_v3_section_count_mismatch(self) -> None:
        corpus = self._single(V3)
        root = self._root(corpus)
        short = replace(corpus, names=corpus.names[:-1])
        errors = verify(root, (short,))
        self.assertTrue(any("0..28" in error for error in errors), errors)

    def test_registry_rejects_shared_chapter_directory(self) -> None:
        bad_v3 = replace(V3, chapter_dir=V2.chapter_dir)
        root = self._root(V1, V2, V3)
        with self.assertRaisesRegex(DesignSyncError, "expected docs/design/system-v3"):
            expected_chapters(root, (V1, V2, bad_v3))

    def test_registry_rejects_mismatched_version_paths(self) -> None:
        corpus = replace(
            self._single(V3),
            parent=Path("docs/design/system-v4.md"),
            chapter_dir=Path("docs/design/v3"),
        )
        root = self._root(V3)
        with self.assertRaisesRegex(DesignSyncError, "expected docs/design/system-v3"):
            expected_chapters(root, (corpus,))

    def test_registry_requires_exactly_one_in_force_corpus(self) -> None:
        second_in_force = replace(V2, status="in_force", successor=None)
        root = self._root(V1, V2, V3)
        with self.assertRaisesRegex(DesignSyncError, "exactly one in-force"):
            expected_chapters(root, (V1, second_in_force, V3))

    def test_write_validates_registry_before_touching_existing_chapter(self) -> None:
        root = self._root(V1, V2, V3)
        sentinel = root / "docs/design/v2/00-how-to-read.md"
        sentinel.parent.mkdir(parents=True, exist_ok=True)
        sentinel.write_text("keep me\n", encoding="utf-8")
        bad_v3 = replace(V3, chapter_dir=V2.chapter_dir)
        with self.assertRaises(DesignSyncError):
            write(root, (V1, V2, bad_v3))
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep me\n")

    def test_preambles_point_to_v3_and_mark_only_v3_in_force(self) -> None:
        root = self._root(*CORPORA)
        expected = expected_chapters(root, CORPORA)
        v1 = expected[root / V1.chapter_dir / V1.names[0]]
        v2 = expected[root / V2.chapter_dir / V2.names[0]]
        v3 = expected[root / V3.chapter_dir / V3.names[0]]
        self.assertIn("v1 已 deprecated", v1)
        self.assertIn("system-v3.md", v1)
        self.assertIn("v2 已 deprecated", v2)
        self.assertIn("system-v3.md", v2)
        self.assertIn("当前生效的目标合同", v3)
        self.assertNotIn("deprecated", v3)

    def test_v3_parent_change_does_not_change_v2_expected_body(self) -> None:
        root = self._root(*CORPORA)
        before = expected_chapters(root, CORPORA)[
            root / V2.chapter_dir / V2.names[0]
        ]
        v3_parent = root / V3.parent
        v3_parent.write_text(
            v3_parent.read_text(encoding="utf-8").replace("Body 0.", "Changed."),
            encoding="utf-8",
        )
        after = expected_chapters(root, CORPORA)[
            root / V2.chapter_dir / V2.names[0]
        ]
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
