"""Validate the repo-local agent harness.

This is a cheap manual gate for documentation and hook changes. It avoids
network access and only checks invariants that are stable inside the repo.
"""

from __future__ import annotations

import ast
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_PATHS = (
    "AGENTS.md",
    "GEMINI.md",
    "project_docs/INDEX.md",
    "project_docs/active/README.md",
    "project_docs/active/codex_harness_engineering.md",
    "project_docs/active/agent_harness/README.md",
    "project_docs/active/agent_harness/harness_blueprint.md",
    "project_docs/active/agent_harness/hooks.md",
    ".codex/hooks/pre_tool_use_policy.py",
    ".codex/hooks/codex_hooks.example.toml",
)


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    """Run a local command from the repository root."""
    return subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


def _check_required_paths(errors: list[str]) -> None:
    """Ensure the harness navigation points at files that actually exist."""
    for relative in REQUIRED_PATHS:
        if not (ROOT / relative).exists():
            errors.append(f"Missing required harness path: {relative}")


def _check_python_parse(errors: list[str]) -> None:
    """Parse hook scripts so syntax mistakes fail before hooks are enabled."""
    for path in (ROOT / ".codex" / "hooks").glob("*.py"):
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"Python syntax error in {path.relative_to(ROOT)}:{exc.lineno}: {exc.msg}")


def _check_gemini_not_modified(errors: list[str]) -> None:
    """Protect the project rule that Codex must not modify GEMINI.md."""
    result = _run(["git", "status", "--short", "--", "GEMINI.md"])
    if result.returncode != 0:
        errors.append(f"Unable to inspect GEMINI.md git status: {result.stderr.strip()}")
        return
    if result.stdout.strip():
        errors.append("GEMINI.md has local changes; Codex must not modify that file.")


def _check_project_doc_links(errors: list[str]) -> None:
    """Catch missing links in the active harness path, not historical archives."""
    markdown_files = [
        ROOT / "AGENTS.md",
        ROOT / "README.md",
        ROOT / "project_docs" / "INDEX.md",
        ROOT / "project_docs" / "active" / "README.md",
        ROOT / "project_docs" / "active" / "codex_harness_engineering.md",
    ]
    markdown_files.extend((ROOT / "project_docs" / "active" / "agent_harness").rglob("*.md"))
    pattern = re.compile(r"`(project_docs/[^`]+?\.md)`")
    for md_path in markdown_files:
        text = md_path.read_text(encoding="utf-8", errors="replace")
        for match in pattern.finditer(text):
            if "<" in match.group(1) or ">" in match.group(1):
                continue
            relative = match.group(1).replace("/", "\\")
            if not (ROOT / relative).exists():
                errors.append(f"{md_path.relative_to(ROOT)} references missing path: {match.group(1)}")


def main() -> int:
    errors: list[str] = []
    _check_required_paths(errors)
    _check_python_parse(errors)
    _check_gemini_not_modified(errors)
    _check_project_doc_links(errors)

    if errors:
        print("Agent harness check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Agent harness check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
