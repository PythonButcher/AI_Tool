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
    "project_docs/active/status/project_execution_status.md",
    "project_docs/active/active_gate/README.md",
    "project_docs/active/codex_harness_engineering.md",
    "project_docs/active/agent_harness/README.md",
    "project_docs/active/agent_harness/harness_blueprint.md",
    "project_docs/active/agent_harness/hooks.md",
    ".codex/hooks/pre_tool_use_policy.py",
    ".codex/hooks/codex_hooks.example.toml",
)

# These components are core product entry points. A sudden near-empty rewrite
# is always a recovery incident, not a normal frontend change.
CRITICAL_SOURCE_MIN_LINES = {
    "frontend/frontend/src/features/ai/AIShell.jsx": 500,
    "frontend/frontend/src/components/data_management/AutoMLPanel.jsx": 100,
    "frontend/frontend/src/components/data_management/FileExport.jsx": 20,
}


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
        ROOT / "project_docs" / "active" / "status" / "project_execution_status.md",
        ROOT / "project_docs" / "active" / "ai_hand_off" / "README.md",
        ROOT / "project_docs" / "active" / "codex_harness_engineering.md",
    ]
    markdown_files.extend((ROOT / "project_docs" / "active" / "active_gate").rglob("*.md"))
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


def _check_active_doc_state(errors: list[str]) -> None:
    """Reject stale plans and unnumbered work, while allowing an explicit user-owned idle gate."""
    status_path = ROOT / "project_docs" / "active" / "status" / "project_execution_status.md"
    active_gate_dir = ROOT / "project_docs" / "active" / "active_gate"
    if not status_path.exists() or not active_gate_dir.exists():
        return

    status_text = status_path.read_text(encoding="utf-8", errors="replace")
    gate_match = re.search(r"## Current Gate:\s*(.+)", status_text)
    awaiting_user_goal = bool(
        gate_match
        and re.search(r"awaiting\s+user\s+epic\s+goal", gate_match.group(1), re.IGNORECASE)
    )
    if (
        not gate_match
        or (
            not awaiting_user_goal
            and not re.search(r"\bSlice\s+\d+\b", gate_match.group(1), re.IGNORECASE)
        )
    ):
        errors.append("Current project gate must name the active slice number.")

    gate_readme = active_gate_dir / "README.md"
    unexpected_gate_files = sorted(
        path.relative_to(ROOT)
        for path in active_gate_dir.rglob("*")
        if path.is_file() and path.resolve() != gate_readme.resolve()
    )
    if unexpected_gate_files:
        errors.append(
            "The active gate may contain only project_docs/active/active_gate/README.md; "
            f"remove: {', '.join(str(path) for path in unexpected_gate_files)}"
        )
    if gate_readme.exists():
        gate_readme_text = gate_readme.read_text(encoding="utf-8", errors="replace")
        if not re.search(r"^Goal:\s+\S", gate_readme_text, re.MULTILINE):
            errors.append("The active-gate README must contain an executable 'Goal:' line.")

    current_owner_is_codex = bool(
        re.search(r"- \*\*Current Owner\*\*:\s*Codex\b", status_text, re.IGNORECASE)
    )
    next_gate_match = re.search(
        r"- \*\*Next Action\*\*:\s*Execute\s+`(project_docs/active/active_gate/README\.md)`",
        status_text,
        re.IGNORECASE,
    )
    if current_owner_is_codex and not next_gate_match:
        errors.append(
            "When Codex is current owner, Next Action must execute "
            "project_docs/active/active_gate/README.md."
        )
    if next_gate_match:
        next_gate_path = ROOT / next_gate_match.group(1)
        if not next_gate_path.exists():
            errors.append(f"Next Action references a missing active gate: {next_gate_match.group(1)}")

    complete = bool(re.search(r"- \*\*Status\*\*:\s*Complete", status_text, re.IGNORECASE))
    handoff_match = re.search(r"`(project_docs/active/ai_hand_off/[^`]+\.md)`", status_text)
    if handoff_match and not (ROOT / handoff_match.group(1)).exists():
        errors.append(f"Current status references a missing handoff: {handoff_match.group(1)}")
    if complete and handoff_match:
        errors.append(
            "A complete gate still points to its implementation handoff; archive or replace the handoff and update status."
        )

    if gate_readme.exists():
        gate_text = gate_readme.read_text(encoding="utf-8", errors="replace")
        if gate_text.startswith("> COMPLETED") or gate_text.startswith("# Completed Reference"):
            errors.append(f"Completed reference remains in active gate: {gate_readme.relative_to(ROOT)}")

    active_gate_reference = "project_docs/active/active_gate/README.md"
    index_text = (ROOT / "project_docs" / "INDEX.md").read_text(encoding="utf-8", errors="replace")
    if active_gate_reference not in index_text:
        errors.append("Project index must point to the project active_gate README.")


def _check_critical_source_sizes(errors: list[str]) -> None:
    """Catch accidental truncation before an agent reports work as complete."""
    for relative, minimum_lines in CRITICAL_SOURCE_MIN_LINES.items():
        path = ROOT / relative
        if not path.exists():
            errors.append(f"Critical frontend source is missing: {relative}")
            continue
        line_count = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
        if line_count < minimum_lines:
            errors.append(
                f"Critical frontend source is unexpectedly small: {relative} has {line_count} lines; expected at least {minimum_lines}."
            )


def main() -> int:
    errors: list[str] = []
    _check_required_paths(errors)
    _check_python_parse(errors)
    _check_gemini_not_modified(errors)
    _check_project_doc_links(errors)
    _check_active_doc_state(errors)
    _check_critical_source_sizes(errors)

    if errors:
        print("Agent harness check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Agent harness check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
