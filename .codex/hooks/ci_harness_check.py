"""Run AI Tool's provider-neutral repository harness checks in CI order."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _run(command: list[str], *, environment: dict[str, str] | None = None) -> int:
    print("+ " + " ".join(command), flush=True)
    result = subprocess.run(command, cwd=ROOT, env=environment, check=False)
    if result.returncode:
        print(f"Harness command failed with exit code {result.returncode}.")
    return result.returncode


def main() -> int:
    compile_environment = os.environ.copy()
    compile_environment["PYTHONPYCACHEPREFIX"] = str(ROOT / ".codex_tmp_py" / "pycache")
    commands: tuple[tuple[list[str], dict[str, str] | None], ...] = (
        ([sys.executable, ".codex/hooks/agent_harness_check.py"], None),
        ([sys.executable, ".codex/hooks/check_active_gate.py", "project_docs/active/active_gate", "."], None),
        ([sys.executable, "-m", "unittest", "discover", "-s", ".codex/hooks/tests", "-p", "test_*.py"], None),
        ([sys.executable, "-m", "unittest", "tests.test_agent_harness_policy"], None),
        (
            [
                sys.executable,
                "-m",
                "py_compile",
                ".codex/hooks/agent_harness_check.py",
                ".codex/hooks/check_active_gate.py",
                ".codex/hooks/harness_validation.py",
                ".codex/hooks/pre_tool_use_policy.py",
                ".codex/hooks/mutation_policy.py",
                ".codex/hooks/ci_harness_check.py",
                ".gemini/skills/status-tracker-skill/scripts/update_status.py",
            ],
            compile_environment,
        ),
        (["git", "diff", "--check"], None),
    )
    for command, environment in commands:
        exit_code = _run(command, environment=environment)
        if exit_code:
            return exit_code
    print("Provider-neutral CI harness check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
