#!/usr/bin/env python3
"""Enforce Agent Note structure and governed-diff ownership.

See .agents/notes/README.md. Exit non-zero on the first full report of violations
so CI can fail the distilly / dot-skill job.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence

ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / ".agents" / "notes"

LIFECYCLES = ("proposed", "implemented", "rejected")
CLASSES = (
    "feature",
    "bug-fix",
    "simplification",
    "architecture",
    "process",
    "testing",
)
SKIP_NAMES = {"README.md", "AGENTS.md", "CLAUDE.md"}
FILENAME = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$")
STATUS = {
    "proposed": re.compile(r"^Status: proposed$"),
    "implemented": re.compile(r"^Status: implemented$"),
    "rejected": re.compile(r"^Status: rejected — .+$"),
}
REQUIRED = {
    "proposed": (
        "## Proposal",
        "## Alternatives considered",
        "## Acceptance criteria",
        "## Risks",
    ),
    "implemented": (
        "## Decision",
        "## Alternatives considered",
        "## Consequences",
        "## Verification",
    ),
    "rejected": ("## Proposal", "## Alternatives considered"),
}
BANNED_IMPLEMENTED = re.compile(
    r"^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)",
    re.IGNORECASE,
)
FENCE_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})([^\r\n]*)$")


def _opening_fence(line: str) -> Optional[tuple[str, int]]:
    match = FENCE_RE.match(line)
    if match is None:
        return None
    token, info = match.groups()
    if token[0] == "`" and "`" in info:
        return None
    return token[0], len(token)


def _closes_fence(line: str, char: str, length: int) -> bool:
    match = FENCE_RE.match(line)
    if match is None:
        return False
    token, suffix = match.groups()
    return token[0] == char and len(token) >= length and not suffix.strip()


def _classified_lines(text: str) -> list[tuple[str, bool, bool]]:
    """Return (line, outside_fence, fence_delimiter) for Markdown lines."""
    lines: list[tuple[str, bool, bool]] = []
    fence_char: Optional[str] = None
    fence_length = 0
    for line in text.splitlines():
        if fence_char is None:
            opening = _opening_fence(line)
            if opening is not None:
                fence_char, fence_length = opening
                lines.append((line, False, True))
            else:
                lines.append((line, True, False))
            continue
        if _closes_fence(line, fence_char, fence_length):
            lines.append((line, False, True))
            fence_char = None
            fence_length = 0
        else:
            lines.append((line, False, False))
    return lines


def _prose_lines(text: str) -> list[str]:
    return [line for line, outside, _ in _classified_lines(text) if outside]


def _check_note(path: Path, lifecycle: str, root: Path) -> list[str]:
    errors: list[str] = []
    rel = path.relative_to(root).as_posix()
    if not FILENAME.match(path.name):
        errors.append(f"{rel}: filename must be yyyy-mm-dd-topic-title.md")
        return errors
    try:
        dt.date.fromisoformat(path.name[:10])
    except ValueError:
        errors.append(f"{rel}: filename date is not a real calendar date")

    raw = path.read_text(encoding="utf-8")
    if not raw.endswith("\n") or raw.endswith("\n\n"):
        # allow exactly one trailing newline: file ends with \n but not \n\n
        if not raw.endswith("\n"):
            errors.append(f"{rel}: file must end with a newline")
        elif raw.endswith("\n\n"):
            errors.append(f"{rel}: file must end with exactly one newline")

    lines = raw.splitlines()
    if not lines or not re.match(r"^# Agent Note: \S", lines[0]):
        errors.append(f"{rel}: line 1 must be `# Agent Note: <title>`")
    if len(lines) < 4 or lines[1] != "":
        errors.append(f"{rel}: line 2 must be blank")
    status_re = STATUS[lifecycle]
    if len(lines) < 3 or not status_re.match(lines[2]):
        errors.append(f"{rel}: line 3 must match {lifecycle} Status grammar")
    if len(lines) < 4 or lines[3] != "":
        errors.append(f"{rel}: line 4 must be blank")

    prose = _prose_lines(raw)
    status_lines = [ln for ln in prose if ln.startswith("Status:")]
    if len(status_lines) != 1:
        errors.append(f"{rel}: only one Status: line is allowed")

    headings = [ln.rstrip() for ln in prose if ln.startswith("## ")]
    if not headings or headings[0] != "## Problem":
        errors.append(f"{rel}: first section must be ## Problem")
    duplicates = sorted({heading for heading in headings if headings.count(heading) > 1})
    for heading in duplicates:
        errors.append(f"{rel}: duplicate heading `{heading}`")

    required_headings = ("## Problem",) + REQUIRED[lifecycle]
    for required in REQUIRED[lifecycle]:
        if required not in headings:
            errors.append(f"{rel}: missing `{required}`")
    positions = [headings.index(heading) for heading in required_headings if heading in headings]
    if positions != sorted(positions):
        errors.append(f"{rel}: required sections are out of order")

    section_lines: dict[str, list[str]] = {}
    current: Optional[str] = None
    for line, outside, fence_delimiter in _classified_lines(raw):
        if outside and line.startswith("## "):
            current = line.rstrip()
            section_lines.setdefault(current, [])
        elif current is not None and not fence_delimiter:
            section_lines[current].append(line)
    for heading in required_headings:
        if heading in section_lines and not any(
            line.strip() for line in section_lines[heading]
        ):
            errors.append(f"{rel}: `{heading}` must not be empty")
    if lifecycle == "implemented":
        for heading in headings:
            if BANNED_IMPLEMENTED.match(heading):
                errors.append(f"{rel}: `{heading}` is banned on implemented notes")
    return errors


def verify(root: Path = ROOT) -> list[str]:
    notes_root = root / ".agents" / "notes"
    errors: list[str] = []
    if not notes_root.is_dir():
        return [".agents/notes is missing"]

    for loose_file in sorted(notes_root.glob("*.md")):
        if loose_file.name not in SKIP_NAMES:
            errors.append(
                f"{loose_file.relative_to(root).as_posix()}: "
                "note must be inside a lifecycle and class folder"
            )

    for entry in sorted(path for path in notes_root.iterdir() if path.is_dir()):
        if entry.name not in LIFECYCLES:
            errors.append(
                f"{entry.relative_to(root).as_posix()}: unknown lifecycle "
                f"(want {', '.join(LIFECYCLES)})"
            )

    seen: dict[tuple[str, str], str] = {}
    for lifecycle in LIFECYCLES:
        life_dir = notes_root / lifecycle
        if not life_dir.is_dir():
            continue
        for loose_file in sorted(life_dir.glob("*.md")):
            if loose_file.name not in SKIP_NAMES:
                errors.append(
                    f"{loose_file.relative_to(root).as_posix()}: "
                    "note must be inside a class folder"
                )
        for class_dir in sorted(p for p in life_dir.iterdir() if p.is_dir()):
            if class_dir.name not in CLASSES:
                errors.append(
                    f"{class_dir.relative_to(root).as_posix()}: unknown class "
                    f"(want {', '.join(CLASSES)})"
                )
                continue
            nested = sorted(path for path in class_dir.iterdir() if path.is_dir())
            for path in nested:
                errors.append(
                    f"{path.relative_to(root).as_posix()}: nested note folders are not allowed"
                )
            for path in sorted(class_dir.iterdir()):
                if path.is_dir() or path.name in SKIP_NAMES or path.name.endswith(".zh.md"):
                    continue
                if path.suffix != ".md":
                    errors.append(
                        f"{path.relative_to(root).as_posix()}: Agent Notes must be Markdown"
                    )
                    continue
                key = (class_dir.name, path.name)
                previous = seen.get(key)
                if previous is not None:
                    errors.append(
                        f"{path.relative_to(root).as_posix()}: duplicates note in {previous}"
                    )
                else:
                    seen[key] = lifecycle
                errors.extend(_check_note(path, lifecycle, root))
    return errors


@dataclass(frozen=True)
class Change:
    status: str
    path: str
    old_path: Optional[str] = None


GOVERNED_ROOT_FILES = {
    ".prettierignore",
    ".prettierrc",
    ".npmrc",
    ".gitignore",
    ".node-version",
    ".nvmrc",
    "AGENTS.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "SKILL.md",
    "knip.json",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "pnpmfile.cjs",
    "requirements.txt",
    "requirements-dev.txt",
    "ruff.toml",
    "tsconfig.json",
}
GOVERNED_PREFIXES = (
    "packages/",
    "src/",
    "tools/",
    "scripts/",
    "prompts/",
    "plugins/",
    ".githooks/",
    ".agents/skills/",
    ".github/",
    "docs/cookbook/",
    "docs/design/",
    "docs/process/",
)

GOVERNED_ROOT_CONFIG_PREFIXES = (
    ".prettierrc.",
    "eslint.config.",
    "knip.config.",
    "prettier.config.",
    "tsconfig.",
    "vitest.config.",
    "vitest.workspace.",
)
GOVERNED_DOCS = {
    ".agents/notes/README.md",
    "docs/architecture.md",
    "docs/development.md",
    "docs/testing.md",
}

TYPESCRIPT_TEST = re.compile(
    r"^packages/[^/]+/src/(?:.*/)?[^/]+\.(?:test|spec)\.tsx?$"
)
TYPESCRIPT_SNAPSHOT = re.compile(
    r"^packages/[^/]+/src/(?:.*/)?__snapshots__/[^/]+\.snap$"
)


def _is_note(path: str) -> bool:
    parts = Path(path).parts
    return (
        len(parts) == 5
        and parts[:2] == (".agents", "notes")
        and parts[2] in LIFECYCLES
        and parts[3] in CLASSES
        and path.endswith(".md")
        and not path.endswith(".zh.md")
    )


def _is_typescript_test(path: str) -> bool:
    return TYPESCRIPT_TEST.fullmatch(path) is not None or TYPESCRIPT_SNAPSHOT.fullmatch(path) is not None


def _is_governed(path: str) -> bool:
    if _is_typescript_test(path):
        return False
    return (
        path in GOVERNED_ROOT_FILES
        or (
            "/" not in path
            and path.startswith(GOVERNED_ROOT_CONFIG_PREFIXES)
        )
        or path in GOVERNED_DOCS
        or path.startswith(GOVERNED_PREFIXES)
        or path.endswith(("/AGENTS.md", "/CLAUDE.md"))
        or (path.startswith("requirements") and path.endswith(".txt"))
    )


def verify_diff(changes: Sequence[Change]) -> List[str]:
    governed = sorted(
        {
            path
            for change in changes
            for path in (change.old_path, change.path)
            if path is not None and _is_governed(path)
        }
    )
    if not governed:
        return []
    note_changed = any(
        change.status != "D" and _is_note(change.path) for change in changes
    )
    if note_changed:
        return []
    return [
        "governed diff requires an added, modified, or renamed Agent Note; "
        "changed: " + ", ".join(governed)
    ]


def parse_name_status(raw: bytes) -> List[Change]:
    fields = raw.decode("utf-8").split("\0")
    if fields and fields[-1] == "":
        fields.pop()
    changes: List[Change] = []
    index = 0
    while index < len(fields):
        status = fields[index]
        index += 1
        if not status:
            continue
        kind = status[0]
        if kind in {"R", "C"}:
            if index + 1 >= len(fields):
                raise ValueError("truncated git rename/copy record")
            old_path, new_path = fields[index], fields[index + 1]
            changes.append(Change(kind, new_path, old_path))
            index += 2
        else:
            if index >= len(fields):
                raise ValueError("truncated git name-status record")
            changes.append(Change(kind, fields[index]))
            index += 1
    return changes


def changes_from_git(
    base: str,
    root: Path = ROOT,
    *,
    head: str = "HEAD",
    range_mode: str = "merge-base",
) -> List[Change]:
    if range_mode == "merge-base":
        revision_range = f"{base}...{head}"
    elif range_mode == "direct":
        revision_range = f"{base}..{head}"
    else:
        raise ValueError(f"unknown git range mode: {range_mode}")
    result = subprocess.run(
        [
            "git",
            "diff",
            "--name-status",
            "-z",
            "--find-renames",
            revision_range,
        ],
        cwd=root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(
            f"cannot diff {revision_range!r}: {detail or 'git failed'}"
        )
    return parse_name_status(result.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        help="also require a Note when governed paths changed from this git base",
    )
    parser.add_argument(
        "--head",
        help="exact git head for --base comparison (default: local HEAD)",
    )
    parser.add_argument(
        "--range-mode",
        choices=("merge-base", "direct"),
        default="merge-base",
        help="merge-base for PR/feature ranges; direct for old-to-new push snapshots",
    )
    args = parser.parse_args()
    errors = verify()
    if args.head and not args.base:
        errors.append("--head requires --base")
    if args.base:
        try:
            errors.extend(
                verify_diff(
                    changes_from_git(
                        args.base,
                        head=args.head or "HEAD",
                        range_mode=args.range_mode,
                    )
                )
            )
        except (RuntimeError, UnicodeError, ValueError) as exc:
            errors.append(str(exc))
    if errors:
        sys.stderr.write("\n".join(errors) + "\n")
        return 1
    sys.stdout.write("agent notes: ok\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
