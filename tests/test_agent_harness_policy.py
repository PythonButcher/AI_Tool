"""Focused regressions for the repository's catastrophic-write guard."""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / ".codex" / "hooks" / "pre_tool_use_policy.py"


def run_hook(command: str) -> dict:
    event = {"tool_name": "Bash", "tool_input": {"command": command}}
    result = subprocess.run(
        [sys.executable, str(HOOK)],
        input=json.dumps(event),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=ROOT,
        check=False,
    )
    return json.loads(result.stdout) if result.stdout.strip() else {}


class AgentHarnessPolicyTests(unittest.TestCase):
    def test_blocks_dynamic_python_open_write(self):
        result = run_hook("python -c \"for f in files: open(f, 'w').write(open(f).read())\"")
        output = result["hookSpecificOutput"]
        self.assertEqual(output["permissionDecision"], "deny")
        self.assertIn("truncates", output["permissionDecisionReason"])

    def test_blocks_dynamic_pathlib_write(self):
        result = run_hook("python -c \"target.write_text(content)\"")
        self.assertEqual(result["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_blocks_literal_frontend_python_write(self):
        result = run_hook("python -c \"open('frontend/frontend/src/App.jsx', 'w').write(content)\"")
        self.assertEqual(result["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_allows_read_only_command(self):
        self.assertEqual(run_hook("git status --short"), {})


if __name__ == "__main__":
    unittest.main()
