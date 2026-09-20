"""Authorization-aware PreToolUse mutation policy for AI Tool."""

from __future__ import annotations

import fnmatch
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
AUTHORIZATION_PATH = ROOT / "project_docs/active/status/phase_authorization.json"
MUTATION_TOOLS = {"apply_patch", "edit", "write"}
SHELL_TOOLS = {"bash", "shell", "exec_command", "powershell"}
DESTRUCTIVE_PATTERNS = (
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard can discard user work."),
    (r"\bgit\s+checkout\b[^\r\n]*\s--\s", "git checkout with path restoration can discard user work."),
    (r"\bgit\s+restore\b", "git restore can discard user work."),
    (r"\brm\s+-[^\r\n]*r[^\r\n]*f\b", "Recursive forced removal is blocked."),
    (r"\bRemove-Item\b(?=[^\r\n]*\b-Recurse\b)(?=[^\r\n]*\b-Force\b)", "Recursive forced removal is blocked."),
)
SHELL_MUTATION_PATTERN = re.compile(
    r"\b(Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|"
    r"git\s+(?:add|commit|mv|rm)|python(?:\.exe)?\b[^\r\n]*(?:open\s*\(|write_text|write_bytes))\b",
    re.IGNORECASE | re.DOTALL,
)
DIRECT_SOURCE_REDIRECTION = re.compile(
    r"(?:>|>>)\s*['\"]?(?:frontend[\\/]+frontend[\\/]+src|backend|tests)[\\/]",
    re.IGNORECASE,
)
UNSAFE_SCRIPT_WRITE = re.compile(
    r"(?:\bopen\s*\([^)]*,\s*['\"](?:w|a|x)[+bt]*['\"]|"
    r"\.open\s*\(\s*['\"](?:w|a|x)[+bt]*['\"]|\.write_(?:text|bytes)\s*\()",
    re.IGNORECASE | re.DOTALL,
)
FRONTEND_PATTERN = "frontend/frontend/src/**"
GENERATED_PATTERNS = (
    ".codex_tmp_py/**",
    "**/__pycache__/**",
    "**/node_modules/**",
    "**/site-packages/**",
    "frontend/frontend/dist/**",
)


def _deny(reason: str) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}, separators=(",", ":")))


def _load_event() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        _deny("Hook input was not valid JSON; mutation safety could not be evaluated.")
        return {}
    return value if isinstance(value, dict) else {}


def _flatten_strings(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        result: list[str] = []
        for item in value.values():
            result.extend(_flatten_strings(item))
        return result
    if isinstance(value, list):
        result = []
        for item in value:
            result.extend(_flatten_strings(item))
        return result
    return []


def _normalized(path: str) -> str:
    value = path.strip().strip("'\"").replace("\\", "/")
    if value.startswith("./"):
        value = value[2:]
    root_text = ROOT.as_posix().rstrip("/") + "/"
    if value.casefold().startswith(root_text.casefold()):
        value = value[len(root_text):]
    return value


def _paths_from_event(event: dict[str, Any], text: str) -> set[str]:
    paths: set[str] = set()
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        for key in ("file_path", "path", "target", "destination"):
            value = tool_input.get(key)
            if isinstance(value, str):
                paths.add(_normalized(value))
    for match in re.finditer(r"^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$", text, flags=re.MULTILINE):
        paths.add(_normalized(match.group(1)))
    path_pattern = re.compile(
        r"(?<![A-Za-z0-9_.-])((?:\.?[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+(?:\.[A-Za-z0-9_-]+)?)"
    )
    for match in path_pattern.finditer(text):
        paths.add(_normalized(match.group(1)))
    return {path for path in paths if path and not any(fnmatch.fnmatch(path, pattern) for pattern in GENERATED_PATTERNS)}


def _authorization() -> dict[str, Any] | None:
    try:
        value = json.loads(AUTHORIZATION_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _allowed(path: str, patterns: Iterable[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


def evaluate_event(event: dict[str, Any]) -> str | None:
    """Return a denial reason, or None when the event may continue."""
    tool_name = str(event.get("tool_name") or "").casefold()
    strings = _flatten_strings(event.get("tool_input"))
    text = "\n".join(strings)
    for pattern, reason in DESTRUCTIVE_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL):
            return reason
    mutation = tool_name in MUTATION_TOOLS or (
        tool_name in SHELL_TOOLS
        and bool(SHELL_MUTATION_PATTERN.search(text) or UNSAFE_SCRIPT_WRITE.search(text) or DIRECT_SOURCE_REDIRECTION.search(text))
    )
    if not mutation:
        return None
    if UNSAFE_SCRIPT_WRITE.search(text):
        return "Dynamic or direct Python writes are blocked because write mode truncates files; use apply_patch for reviewable repository edits."
    if DIRECT_SOURCE_REDIRECTION.search(text):
        return "Shell redirection into source or tests is blocked; use apply_patch for reviewable repository edits."
    paths = _paths_from_event(event, text)
    if any(Path(path).name.casefold() == "gemini.md" for path in paths) or re.search(r"\bGEMINI\.md\b", text, flags=re.IGNORECASE):
        return "Project policy forbids creating, editing, moving, restoring, or deleting any GEMINI.md file."
    authorization = _authorization()
    if authorization is None:
        return "Canonical phase authorization is missing or invalid; repository mutation is blocked."
    patterns_key = "review_only_allowed_paths" if authorization.get("authorization_state") == "REVIEW_ONLY" else "allowed_paths"
    patterns = authorization.get(patterns_key)
    if not isinstance(patterns, list) or not all(isinstance(item, str) for item in patterns):
        return f"Canonical {patterns_key} is invalid; repository mutation is blocked."
    frontend_paths = [path for path in paths if fnmatch.fnmatch(path, FRONTEND_PATTERN)]
    if frontend_paths and authorization.get("codex_frontend_edits_allowed") is not True:
        return "Codex frontend mutations are not authorized by the canonical phase record."
    outside = sorted(path for path in paths if not _allowed(path, patterns))
    if outside:
        return f"Mutation exceeds the canonical {patterns_key}: {', '.join(outside)}"
    protected = {
        "project_docs/active/active_gate/README.md",
        "project_docs/active/status/phase_authorization.json",
        "project_docs/active/status/accepted_change_snapshot.json",
    }
    if paths.intersection(protected) and authorization.get("authorization_state") != "AUTHORIZED":
        return "Active gate and authorization authority may change only during explicitly authorized implementation."
    return None


def main() -> int:
    event = _load_event()
    reason = evaluate_event(event)
    if reason:
        _deny(reason)
    return 0
