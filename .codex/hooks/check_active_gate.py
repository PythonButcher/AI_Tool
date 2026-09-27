"""Validate AI Tool's sole active gate and executable step."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


REQUIRED_SECTIONS = (
    "User Outcome",
    "Scope",
    "Contracts",
    "Acceptance",
    "Verification",
    "Owner And Control Return",
)
STEP_FIELDS = (
    "Current Step",
    "Target Files",
    "Step Acceptance",
    "Step Verification",
    "Next Step",
    "Continuation Rule",
    "Stop Condition",
)
STEP_PATTERN = re.compile(
    r"^- \[(?P<checked>[ xX])\] \*\*(?P<label>Step (?P<number>\d+): [^*]+)\*\*"
    r"\s+—\s+\[(?P<state>COMPLETED|IN PROGRESS|PENDING)\]\s*$",
    re.MULTILINE,
)


def _field(text: str, label: str) -> str | None:
    matches = re.findall(
        rf"^\*\*{re.escape(label)}\*\*:\s*(.+?)\s*$", text, flags=re.MULTILINE
    )
    return matches[0].strip() if len(matches) == 1 else None


def _section(text: str, heading: str) -> str:
    match = re.search(
        rf"^## {re.escape(heading)}\s*$\n(?P<body>.*?)(?=^## |\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    return match.group("body") if match else ""


def _load_authorization(root: Path, errors: list[str]) -> dict[str, object]:
    path = root / "project_docs/active/status/phase_authorization.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Cannot read implementation authorization: {exc}")
        return {}
    if not isinstance(value, dict):
        errors.append("Phase authorization must be a JSON object.")
        return {}
    return value


def _validate_step_checklist(gate_text: str, errors: list[str]) -> None:
    """Enforce ordered WIP=1 checklist semantics for an executable gate."""
    scope = _section(gate_text, "Scope")
    current_step = _field(scope, "Current Step")
    matches = list(STEP_PATTERN.finditer(scope))
    if not matches:
        errors.append("Active gate Scope must contain an ordered state checklist.")
        return

    numbers = [int(match.group("number")) for match in matches]
    if numbers != list(range(1, len(numbers) + 1)):
        errors.append("Active gate checklist step numbers must be consecutive from 1.")

    active_indexes = [index for index, match in enumerate(matches) if match.group("state") == "IN PROGRESS"]
    if len(active_indexes) != 1:
        errors.append("Active gate checklist must enforce WIP=1 with exactly one [IN PROGRESS] item.")
        return

    active_index = active_indexes[0]
    for index, match in enumerate(matches):
        checked = match.group("checked").casefold() == "x"
        state = match.group("state")
        expected = "COMPLETED" if index < active_index else "IN PROGRESS" if index == active_index else "PENDING"
        if state != expected:
            errors.append(f"Checklist {match.group('label')} must be [{expected}], not [{state}].")
        if (state == "COMPLETED") != checked:
            errors.append(f"Checklist checkbox and state disagree for {match.group('label')}.")

    active_label = matches[active_index].group("label").strip()
    if current_step != active_label:
        errors.append("Current Step must exactly match the [IN PROGRESS] checklist item.")


def validate_active_gate(gate_directory: Path, repository_root: Path) -> list[str]:
    """Return every active-gate violation without mutating the repository."""
    errors: list[str] = []
    readme = gate_directory / "README.md"
    files = sorted(path for path in gate_directory.rglob("*") if path.is_file())
    if files != [readme]:
        extras = [str(path.relative_to(repository_root)) for path in files if path != readme]
        if not readme.exists():
            errors.append("Active gate is missing README.md.")
        if extras:
            errors.append("Active gate may contain only README.md: " + ", ".join(extras))
    if not readme.exists():
        return errors

    text = readme.read_text(encoding="utf-8", errors="replace")
    first_line = text.splitlines()[0] if text.splitlines() else ""
    if not re.fullmatch(r"Goal:\s+\S.+", first_line):
        errors.append("Active gate first line must be a non-empty Goal: statement.")
    for section in REQUIRED_SECTIONS:
        if len(re.findall(rf"^## {re.escape(section)}\s*$", text, flags=re.MULTILINE)) != 1:
            errors.append(f"Active gate requires exactly one '## {section}' section.")

    authorization = _load_authorization(repository_root, errors)

    if authorization.get("authorization_state") == "AUTHORIZED" and authorization.get("lifecycle_state") == "IN PROGRESS":
        scope = _section(text, "Scope")
        for label in STEP_FIELDS:
            if not _field(scope, label):
                errors.append(f"Authorized active gate is missing exactly one non-empty {label} field in Scope.")
        _validate_step_checklist(text, errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("gate_directory", nargs="?", default="project_docs/active/active_gate")
    parser.add_argument("repository_root", nargs="?", default=".")
    arguments = parser.parse_args()
    root = Path(arguments.repository_root).resolve()
    gate = (root / arguments.gate_directory).resolve()
    errors = validate_active_gate(gate, root)
    if errors:
        print("ACTIVE GATE INVALID:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"ACTIVE GATE VALID: {gate}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
