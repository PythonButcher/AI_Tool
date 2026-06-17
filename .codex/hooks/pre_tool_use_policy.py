"""Repo-local Codex PreToolUse policy.

The script reads Codex hook JSON from stdin and emits Codex-compatible JSON only
when it needs to deny a tool call or add model-visible context. Silent success
means the normal Codex permission flow should continue.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any


DESTRUCTIVE_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"\bgit\s+reset\s+--hard\b", "git reset --hard is destructive and requires explicit user intent."),
    (r"\bgit\s+checkout\s+--\b", "git checkout -- can discard user changes and is blocked by project policy."),
    (r"\brm\s+-[^\n]*r[^\n]*f\b", "recursive forced removal is blocked by the harness policy."),
    (r"\bRemove-Item\b(?=.*\b-Recurse\b)(?=.*\b-Force\b)", "recursive forced removal is blocked by the harness policy."),
)

MUTATING_GEMINI_PATTERNS: tuple[str, ...] = (
    r"\bGEMINI\.md\b",
    r"\*\s*GEMINI\.md",
)

FRONTEND_SOURCE_PATTERN = r"frontend[\\/]+frontend[\\/]+src"


def _load_event() -> dict[str, Any]:
    """Load hook input while allowing a simple manual self-test path."""
    if "--self-test" in sys.argv:
        return {"tool_name": "Bash", "tool_input": {"command": "git status --short"}}

    raw = sys.stdin.read().strip()
    if not raw:
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        _deny("PreToolUse", "Hook input was not valid JSON; refusing to evaluate an unsafe tool call.")
        sys.exit(0)

    return payload if isinstance(payload, dict) else {}


def _tool_command(event: dict[str, Any]) -> str:
    """Extract the command-like field used by Bash and apply_patch hooks."""
    tool_input = event.get("tool_input")
    if isinstance(tool_input, dict):
        command = tool_input.get("command")
        if isinstance(command, str):
            return command
    if isinstance(tool_input, str):
        return tool_input
    return ""


def _deny(event_name: str, reason: str) -> None:
    """Emit the current Codex hook denial shape."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            },
            separators=(",", ":"),
        )
    )


def _context(event_name: str, message: str) -> None:
    """Emit additional developer context without approving or denying the call."""
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": event_name,
                    "additionalContext": message,
                }
            },
            separators=(",", ":"),
        )
    )


def _matches(pattern: str, text: str) -> bool:
    """Run case-insensitive regex matching with a compact call site."""
    return re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL) is not None


def main() -> int:
    event = _load_event()
    tool_name = str(event.get("tool_name") or "")
    command = _tool_command(event)
    haystack = f"{tool_name}\n{command}"

    # The root project rule forbids Codex from modifying any GEMINI.md file.
    if any(_matches(pattern, haystack) for pattern in MUTATING_GEMINI_PATTERNS):
        if tool_name.lower() in {"apply_patch", "edit", "write"} or _matches(
            r"\b(Set-Content|Add-Content|Remove-Item|Move-Item|Copy-Item|New-Item|Out-File|git\s+checkout)\b",
            command,
        ):
            _deny("PreToolUse", "Project policy forbids Codex from modifying any GEMINI.md file.")
            return 0

    for pattern, reason in DESTRUCTIVE_PATTERNS:
        if _matches(pattern, command):
            _deny("PreToolUse", reason)
            return 0

    # Frontend source is Gemini-owned for Decision Intelligence unless the user
    # explicitly authorizes Codex frontend edits in the current session.
    if _matches(FRONTEND_SOURCE_PATTERN, command):
        _context(
            "PreToolUse",
            "This tool call appears to touch frontend source. Re-read the frontend guardrail and confirm current-session authorization before editing.",
        )
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
