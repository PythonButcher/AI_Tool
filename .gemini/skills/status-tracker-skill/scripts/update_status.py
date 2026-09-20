"""Validate Antigravity readiness and return a bounded handoff to Codex."""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
HOOKS = ROOT / ".codex" / "hooks"
sys.path.insert(0, str(HOOKS))

from harness_validation import run_repository_checks, validate_frontend_handoff_worktree
STATUS_PATH = ROOT / "project_docs/active/status/project_execution_status.md"
AUTHORIZATION_PATH = ROOT / "project_docs/active/status/phase_authorization.json"
HANDOFF_DIRECTORY = ROOT / "project_docs/active/ai_hand_off"
SUPPORTED_READINESS = {"backend_contract_ready", "frontend_repair_only"}
RETURN_FIELDS = {
    "Phase State",
    "What This State Means",
    "Current Owner",
    "Automatic Continuation",
    "Required Action",
    "Active Handoff",
}


def _field(text: str, name: str) -> str:
    matches = re.findall(rf"^- \*\*{re.escape(name)}\*\*:\s*(.+)$", text, flags=re.MULTILINE)
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one '{name}' field in execution status.")
    return matches[0].strip()


def _active_handoffs() -> list[Path]:
    return sorted(path for path in HANDOFF_DIRECTORY.glob("*.md") if path.name.casefold() != "readme.md")


def _validate_start(text: str) -> Path:
    owner = _field(text, "Current Owner").strip("`")
    readiness = _field(text, "Frontend Readiness").strip("`")
    handoffs = _active_handoffs()
    if owner.casefold() != "antigravity":
        raise ValueError(f"Current Owner is '{owner}', not Antigravity.")
    if readiness not in SUPPORTED_READINESS:
        raise ValueError(f"Frontend Readiness '{readiness}' does not authorize handoff execution.")
    if len(handoffs) != 1:
        raise ValueError(f"Expected exactly one active handoff; found {len(handoffs)}.")
    named = _field(text, "Active Handoff")
    if handoffs[0].name not in named:
        raise ValueError("Execution status does not name the single active handoff.")
    return handoffs[0]


def _replace_field(text: str, name: str, value: str) -> str:
    if name not in RETURN_FIELDS:
        raise ValueError(f"Status return cannot change protected field '{name}'.")
    updated, count = re.subn(
        rf"^- \*\*{re.escape(name)}\*\*:\s*.+$",
        f"- **{name}**: {value}",
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise ValueError(f"Could not update '{name}'.")
    return updated


def _atomic_replace(path: Path, text: str) -> None:
    """Replace a status document without exposing a truncated intermediate file."""
    temporary_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary.write(text)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_name = temporary.name
        os.replace(temporary_name, path)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def check_status() -> None:
    handoff = _validate_start(STATUS_PATH.read_text(encoding="utf-8"))
    errors = validate_frontend_handoff_worktree(ROOT, handoff, require_changes=False)
    if errors:
        raise ValueError(" ".join(errors))
    print(f"Antigravity handoff is ready: {handoff.relative_to(ROOT)}")


def return_control(handoff_name: str, summary: str) -> None:
    original = STATUS_PATH.read_text(encoding="utf-8")
    authorization_before = AUTHORIZATION_PATH.read_bytes()
    active_handoff = _validate_start(original)
    if active_handoff.name != Path(handoff_name).name:
        raise ValueError(f"Requested handoff does not match active handoff '{active_handoff.name}'.")
    integrity_errors = validate_frontend_handoff_worktree(ROOT, active_handoff, require_changes=True)
    if integrity_errors:
        raise ValueError(" ".join(integrity_errors))
    repository_errors = run_repository_checks(ROOT)
    if repository_errors:
        raise ValueError("Repository harness failed before return: " + " ".join(repository_errors))
    clean_summary = " ".join(summary.split())
    if not 1 <= len(clean_summary) <= 240:
        raise ValueError("Summary must contain 1 to 240 non-whitespace characters.")

    updated = _replace_field(original, "Phase State", "`IN PROGRESS`")
    updated = _replace_field(updated, "What This State Means", "The frontend handoff returned and requires Codex source and build review.")
    updated = _replace_field(updated, "Current Owner", "Codex")
    updated = _replace_field(updated, "Automatic Continuation", "`CONTINUE`")
    updated = _replace_field(updated, "Required Action", f"Review `{active_handoff.relative_to(ROOT).as_posix()}` and its returned evidence.")
    updated = _replace_field(updated, "Active Handoff", f"`{active_handoff.relative_to(ROOT).as_posix()}` — returned for Codex review: {clean_summary}")

    _atomic_replace(STATUS_PATH, updated)
    if AUTHORIZATION_PATH.read_bytes() != authorization_before:
        raise RuntimeError("Authorization record changed during status return.")
    print(f"Returned {active_handoff.name} to Codex review.")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("check")
    return_parser = subparsers.add_parser("return")
    return_parser.add_argument("--handoff", required=True)
    return_parser.add_argument("--summary", required=True)
    return parser


def main() -> int:
    args = _parser().parse_args()
    try:
        if args.command == "check":
            check_status()
        else:
            return_control(args.handoff, args.summary)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Status tracker blocked: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
