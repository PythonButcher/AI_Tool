"""Executable repository controls for AI Tool's agent harness."""

from __future__ import annotations

import ast
import fnmatch
import hashlib
import json
import re
import subprocess
from pathlib import Path
from typing import Any, Iterable

from check_active_gate import validate_active_gate


ROOT = Path(__file__).resolve().parents[2]
AUTHORIZATION_RELATIVE = "project_docs/active/status/phase_authorization.json"
ACCEPTED_SNAPSHOT_RELATIVE = "project_docs/active/status/accepted_change_snapshot.json"
STATUS_RELATIVE = "project_docs/active/status/project_execution_status.md"
GATE_RELATIVE = "project_docs/active/active_gate/README.md"
REQUIRED_PATHS = (
    "AGENTS.md",
    "project_docs/INDEX.md",
    "project_docs/active/README.md",
    "project_docs/active/rules/DOCUMENTATION_GOVERNANCE.md",
    "project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md",
    "project_docs/active/status/README.md",
    STATUS_RELATIVE,
    AUTHORIZATION_RELATIVE,
    GATE_RELATIVE,
    "project_docs/active/ai_hand_off/README.md",
    "project_docs/active/agent_harness/README.md",
    "project_docs/active/agent_harness/harness_blueprint.md",
    "project_docs/active/agent_harness/hooks.md",
    "project_docs/active/agent_harness/templates/ANTIGRAVITY_FRONTEND_HANDOFF_TEMPLATE.md",
    ".agents/skills/auto-handoff-execution/SKILL.md",
    ".agents/skills/project-phase-transition/SKILL.md",
    ".gemini/skills/status-tracker-skill/SKILL.md",
    ".gemini/skills/status-tracker-skill/references/status_schema.md",
    ".gemini/skills/status-tracker-skill/scripts/update_status.py",
    ".codex/hooks/agent_harness_check.py",
    ".codex/hooks/check_active_gate.py",
    ".codex/hooks/ci_harness_check.py",
    ".codex/hooks/pre_tool_use_policy.py",
)
STATUS_FIELDS = (
    "Current Gate",
    "Roadmap Phase",
    "Phase Identity",
    "Phase State",
    "What This State Means",
    "Current Milestone",
    "Automatic Continuation",
    "Current Owner",
    "Backend Readiness",
    "Frontend Readiness",
    "Required Action",
    "Active Gate",
    "Authorization Record",
    "Roadmap",
    "Active Handoff",
    "Latest Verification",
)
LIFECYCLE_STATES = {
    "NOT STARTED",
    "IN PROGRESS",
    "AWAITING USER ACCEPTANCE",
    "BLOCKED",
    "COMPLETE",
}
CONTINUATION_STATES = {"CONTINUE", "WAIT_FOR_AGENT", "WAIT_FOR_USER", "BLOCKED", "COMPLETE"}
BACKEND_READINESS = {"implementation_required", "backend_not_ready", "backend_contract_ready", "complete"}
FRONTEND_READINESS = {
    "blocked_harness_phase",
    "blocked_contract_and_api_first",
    "backend_contract_ready",
    "frontend_repair_only",
    "not_applicable",
}
GENERATED_ARTIFACT_PATTERNS = (
    ".codex_tmp_py/**",
    "**/__pycache__/**",
    "**/*.pyc",
    "**/node_modules/**",
    "**/site-packages/**",
    "frontend/frontend/dist/**",
    "frontend/dist/**",
    "**/.pytest_cache/**",
    "**/coverage/**",
)
CRITICAL_SOURCE_MIN_LINES = {
    "frontend/frontend/src/features/ai/AIShell.jsx": 500,
    "frontend/frontend/src/components/data_management/AutoMLPanel.jsx": 100,
    "frontend/frontend/src/components/data_management/FileExport.jsx": 20,
}
FRONTEND_SOURCE_PREFIX = "frontend/frontend/src/"


def _read(root: Path, relative: str) -> str:
    return (root / relative).read_text(encoding="utf-8", errors="replace")


def _field(text: str, name: str) -> str | None:
    matches = re.findall(rf"^- \*\*{re.escape(name)}\*\*:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    return matches[0].strip() if len(matches) == 1 else None


def _unquote(value: str | None) -> str:
    return value.strip().strip("`") if value else ""


def is_generated_artifact(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if normalized.startswith("./"):
        normalized = normalized[2:]
    return any(fnmatch.fnmatch(normalized, pattern) for pattern in GENERATED_ARTIFACT_PATTERNS)


def paths_outside_patterns(paths: Iterable[str], patterns: Iterable[str]) -> list[str]:
    allowed = tuple(patterns)
    return sorted(
        normalized
        for path in paths
        if not is_generated_artifact(normalized := path.replace("\\", "/").removeprefix("./"))
        and not any(fnmatch.fnmatch(normalized, pattern) for pattern in allowed)
    )


def _git_paths(root: Path, baseline: str | None = None) -> set[str]:
    commands = [["git", "diff", "--name-only"]]
    if baseline:
        commands.append(["git", "diff", "--name-only", baseline])
    commands.append(["git", "ls-files", "--others", "--exclude-standard"])
    paths: set[str] = set()
    for command in commands:
        result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
        if result.returncode == 0:
            paths.update(line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip())
    return paths


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _accepted_snapshot_paths(
    root: Path, authorization: dict[str, Any], errors: list[str]
) -> set[str]:
    """Return accepted uncommitted paths only while their bytes still match."""
    relative = authorization.get("accepted_change_snapshot")
    if authorization.get("authorization_state") != "REVIEW_ONLY":
        return set()
    if relative != ACCEPTED_SNAPSHOT_RELATIVE:
        errors.append("REVIEW_ONLY authorization must name the canonical accepted-change snapshot.")
        return set()
    snapshot_path = root / ACCEPTED_SNAPSHOT_RELATIVE
    try:
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Cannot read accepted-change snapshot: {exc}")
        return set()
    digests = snapshot.get("sha256") if isinstance(snapshot, dict) else None
    if not isinstance(digests, dict) or not digests:
        errors.append("Accepted-change snapshot requires a non-empty sha256 map.")
        return set()
    accepted = {ACCEPTED_SNAPSHOT_RELATIVE}
    for relative_path, expected in digests.items():
        if not isinstance(relative_path, str) or not isinstance(expected, str):
            errors.append("Accepted-change snapshot entries must map paths to SHA-256 strings.")
            continue
        path = root / relative_path
        if not path.is_file() or not re.fullmatch(r"[0-9a-f]{64}", expected) or _sha256(path) != expected:
            errors.append(f"Accepted harness file changed after acceptance: {relative_path}")
            continue
        accepted.add(relative_path)
    return accepted


def load_authorization(root: Path, errors: list[str]) -> dict[str, Any]:
    try:
        value = json.loads(_read(root, AUTHORIZATION_RELATIVE))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"Cannot read phase authorization record: {exc}")
        return {}
    if not isinstance(value, dict):
        errors.append("Phase authorization record must contain a JSON object.")
        return {}
    return value


def check_authorization(root: Path, authorization: dict[str, Any], errors: list[str]) -> None:
    required = {
        "schema_version",
        "canonical_phase",
        "authorization_state",
        "lifecycle_state",
        "authority_kind",
        "diff_baseline",
        "allowed_paths",
        "review_only_allowed_paths",
        "codex_frontend_edits_allowed",
    }
    missing = sorted(required.difference(authorization))
    if missing:
        errors.append("Authorization record is missing fields: " + ", ".join(missing))
    canonical = authorization.get("canonical_phase")
    if not isinstance(canonical, dict) or not all(isinstance(canonical.get(key), str) and canonical.get(key) for key in ("id", "name")):
        errors.append("Authorization canonical_phase requires non-empty id and name strings.")
    state = authorization.get("authorization_state")
    lifecycle = authorization.get("lifecycle_state")
    if state not in {"REVIEW_ONLY", "AUTHORIZED"}:
        errors.append("Authorization state must be REVIEW_ONLY or AUTHORIZED.")
    if lifecycle not in LIFECYCLE_STATES:
        errors.append(f"Authorization has unsupported lifecycle state: {lifecycle!r}.")
    if state == "REVIEW_ONLY" and lifecycle != "NOT STARTED":
        errors.append("REVIEW_ONLY authorization requires NOT STARTED lifecycle.")
    user_authorization = authorization.get("user_implementation_authorization")
    if state == "AUTHORIZED":
        if lifecycle not in {"IN PROGRESS", "AWAITING USER ACCEPTANCE", "BLOCKED", "COMPLETE"}:
            errors.append("AUTHORIZED work requires an implementation lifecycle state.")
        if not isinstance(user_authorization, dict):
            errors.append("AUTHORIZED work requires a user implementation-authorization record.")
        else:
            for field in ("approved_by", "approved_at", "evidence", "instruction"):
                if not isinstance(user_authorization.get(field), str) or not user_authorization.get(field, "").strip():
                    errors.append(f"User implementation authorization requires {field}.")
            if user_authorization.get("approved_by") != "User":
                errors.append("Implementation authorization must be approved by User.")
    elif user_authorization is not None:
        errors.append("REVIEW_ONLY authorization must not claim user implementation authorization.")
    for field in ("allowed_paths", "review_only_allowed_paths"):
        value = authorization.get(field)
        if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
            errors.append(f"Authorization {field} must be a non-empty string list.")
    if not isinstance(authorization.get("codex_frontend_edits_allowed"), bool):
        errors.append("codex_frontend_edits_allowed must be a boolean.")
    baseline = authorization.get("diff_baseline")
    if not isinstance(baseline, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", baseline):
        errors.append("Authorization diff_baseline must be a full Git commit hash.")


def check_authorized_diff(root: Path, authorization: dict[str, Any], errors: list[str]) -> None:
    baseline = authorization.get("diff_baseline")
    changed = _git_paths(root, baseline if isinstance(baseline, str) else None)
    accepted = _accepted_snapshot_paths(root, authorization, errors)
    changed.difference_update(accepted)
    patterns_key = "review_only_allowed_paths" if authorization.get("authorization_state") == "REVIEW_ONLY" else "allowed_paths"
    patterns = authorization.get(patterns_key)
    if isinstance(patterns, list):
        outside = paths_outside_patterns(changed, patterns)
        if outside:
            errors.append(f"Changed paths exceed {patterns_key}: " + ", ".join(outside))
    protected = sorted(path for path in changed if Path(path).name.casefold() == "gemini.md")
    if protected:
        errors.append("Protected GEMINI.md changes detected: " + ", ".join(protected))


def check_execution_status(root: Path, authorization: dict[str, Any], errors: list[str]) -> tuple[str, str, str, str]:
    try:
        text = _read(root, STATUS_RELATIVE)
    except OSError as exc:
        errors.append(f"Cannot read execution status: {exc}")
        return "", "", "", ""
    values: dict[str, str] = {}
    for name in STATUS_FIELDS:
        value = _field(text, name)
        if value is None:
            errors.append(f"Execution status requires exactly one {name} field.")
        else:
            values[name] = value
    if len(re.findall(r"^## Current Gate:\s+\S.+$", text, flags=re.MULTILINE)) != 1:
        errors.append("Execution status must contain exactly one current-gate heading.")
    if re.search(r"^## Phase\s+", text, flags=re.MULTILINE | re.IGNORECASE):
        errors.append("Execution status must not contain a competing phase heading.")
    lifecycle = _unquote(values.get("Phase State"))
    continuation = _unquote(values.get("Automatic Continuation"))
    owner = _unquote(values.get("Current Owner"))
    backend = _unquote(values.get("Backend Readiness"))
    frontend = _unquote(values.get("Frontend Readiness"))
    if lifecycle not in LIFECYCLE_STATES:
        errors.append(f"Execution status has unsupported Phase State: {lifecycle!r}.")
    if continuation not in CONTINUATION_STATES:
        errors.append(f"Execution status has unsupported Automatic Continuation: {continuation!r}.")
    if backend not in BACKEND_READINESS:
        errors.append(f"Execution status has unsupported Backend Readiness: {backend!r}.")
    if frontend not in FRONTEND_READINESS:
        errors.append(f"Execution status has unsupported Frontend Readiness: {frontend!r}.")
    expected_continuation = None
    if lifecycle == "IN PROGRESS" and owner.casefold() == "codex":
        expected_continuation = "CONTINUE"
    elif owner.casefold() == "antigravity":
        expected_continuation = "WAIT_FOR_AGENT"
    elif owner.casefold() == "user" or lifecycle == "AWAITING USER ACCEPTANCE":
        expected_continuation = "WAIT_FOR_USER"
    elif lifecycle == "BLOCKED":
        expected_continuation = "BLOCKED"
    elif lifecycle == "COMPLETE":
        expected_continuation = "COMPLETE"
    if expected_continuation and continuation != expected_continuation:
        errors.append(f"Owner/lifecycle requires Automatic Continuation `{expected_continuation}`.")
    canonical = authorization.get("canonical_phase")
    canonical_id = canonical.get("id") if isinstance(canonical, dict) else None
    if canonical_id and _unquote(values.get("Phase Identity")) != canonical_id:
        errors.append("Execution status Phase Identity does not match canonical authorization.")
    if authorization.get("lifecycle_state") != lifecycle:
        errors.append("Execution status lifecycle does not match phase authorization.")
    return lifecycle, owner, frontend, values.get("Current Milestone", "")


def check_gate_and_milestone(root: Path, authorization: dict[str, Any], milestone: str, errors: list[str]) -> None:
    errors.extend(validate_active_gate(root / "project_docs/active/active_gate", root))
    if authorization.get("authorization_state") == "AUTHORIZED" and authorization.get("lifecycle_state") == "IN PROGRESS":
        gate_text = _read(root, GATE_RELATIVE)
        match = re.search(r"^\*\*Current Step\*\*:\s*(.+?)\s*$", gate_text, flags=re.MULTILINE)
        current_step = match.group(1).strip() if match else ""
        if milestone != current_step:
            errors.append("Execution status Current Milestone must exactly match the active gate Current Step.")


def check_handoffs(root: Path, owner: str, frontend_readiness: str, errors: list[str]) -> None:
    directory = root / "project_docs/active/ai_hand_off"
    handoffs = sorted(path for path in directory.glob("*.md") if path.name.casefold() != "readme.md") if directory.exists() else []
    status_text = _read(root, STATUS_RELATIVE) if (root / STATUS_RELATIVE).exists() else ""
    active_handoff = _field(status_text, "Active Handoff") or ""
    if owner.casefold() == "antigravity":
        if frontend_readiness not in {"backend_contract_ready", "frontend_repair_only"}:
            errors.append("Antigravity ownership requires backend_contract_ready or frontend_repair_only readiness.")
        if len(handoffs) != 1:
            errors.append("Antigravity ownership requires exactly one bounded active handoff.")
    elif handoffs and "returned for Codex review" not in active_handoff:
        errors.append("An implementation handoff may remain with Codex/User only when status records it as returned for Codex review.")
    if frontend_readiness == "frontend_repair_only" and handoffs:
        text = handoffs[0].read_text(encoding="utf-8", errors="replace")
        if "REPAIR REQUIRED" not in text or not re.search(r"^## Repair Blocker\s*$", text, flags=re.MULTILINE):
            errors.append("frontend_repair_only requires REPAIR REQUIRED and a Repair Blocker section.")
    if len(handoffs) == 1 and owner.casefold() == "antigravity":
        errors.extend(validate_frontend_handoff_worktree(root, handoffs[0], require_changes=False))
    elif len(handoffs) == 1 and "returned for Codex review" in active_handoff:
        errors.extend(validate_frontend_handoff_worktree(root, handoffs[0], require_changes=True))


def _git_lines(root: Path, command: list[str]) -> list[str]:
    result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def _handoff_frontend_targets(handoff: Path) -> list[str]:
    text = handoff.read_text(encoding="utf-8", errors="replace")
    return sorted(
        {
            value.replace("\\", "/")
            for value in re.findall(r"`([^`]+)`", text)
            if value.replace("\\", "/").startswith(FRONTEND_SOURCE_PREFIX)
        }
    )


def validate_frontend_handoff_worktree(
    root: Path,
    handoff: Path,
    *,
    require_changes: bool,
) -> list[str]:
    """Verify bounded frontend work without editing or restoring any file."""
    errors: list[str] = []
    text = handoff.read_text(encoding="utf-8", errors="replace")
    targets = _handoff_frontend_targets(handoff)
    if not targets:
        return ["Active frontend handoff must name at least one frontend source target."]
    if len(targets) > 5:
        errors.append("Active frontend handoff is too broad; limit frontend source targets to five files.")

    for relative in targets:
        path = root / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"Frontend handoff target is missing or empty: {relative}")
            continue
        baseline = subprocess.run(
            ["git", "show", f"HEAD:{relative}"],
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if baseline.returncode == 0 and len(baseline.stdout) and path.stat().st_size < len(baseline.stdout) // 2:
            errors.append(f"Frontend handoff target shrank by more than 50% from HEAD: {relative}")

    changed_frontend = set(_git_lines(root, ["git", "diff", "HEAD", "--name-only", "--", FRONTEND_SOURCE_PREFIX]))
    changed_frontend.update(
        _git_lines(root, ["git", "ls-files", "--others", "--exclude-standard", "--", FRONTEND_SOURCE_PREFIX])
    )
    outside = sorted(changed_frontend.difference(targets))
    if outside:
        errors.append("Frontend changes exceed the active handoff targets: " + ", ".join(outside))
    changed_targets = sorted(changed_frontend.intersection(targets))
    if require_changes and not changed_targets:
        errors.append("Frontend handoff return has no durable source diff; completion cannot be claimed.")
    if require_changes and "**Required Change Coverage**: all target files" in text:
        missing = sorted(set(targets).difference(changed_targets))
        if missing:
            errors.append("Required frontend target changes are missing: " + ", ".join(missing))

    if "**Inline Styles**: forbidden" in text and changed_targets:
        diff = subprocess.run(
            ["git", "diff", "HEAD", "--unified=0", "--", *changed_targets],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        ).stdout
        if any(
            line.startswith("+") and not line.startswith("+++") and re.search(r"\bstyle\s*=\s*\{\{", line)
            for line in diff.splitlines()
        ):
            errors.append("Active frontend handoff forbids newly added inline style objects; use the target stylesheet.")

    if require_changes and changed_targets:
        whitespace = subprocess.run(
            ["git", "diff", "HEAD", "--check", "--", *changed_targets],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
        if whitespace.returncode:
            errors.append("Frontend handoff diff has whitespace errors; repair them with reviewable edits, never bulk rewrites.")
    return errors


def check_required_paths(root: Path, errors: list[str]) -> None:
    for relative in REQUIRED_PATHS:
        if not (root / relative).exists():
            errors.append(f"Missing required harness path: {relative}")


def check_python_syntax(root: Path, errors: list[str]) -> None:
    scripts = list((root / ".codex/hooks").glob("*.py"))
    scripts.extend((root / ".gemini/skills").glob("*/scripts/*.py"))
    for path in scripts:
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError as exc:
            errors.append(f"Python syntax error in {path.relative_to(root)}:{exc.lineno}: {exc.msg}")


def check_skill_manifests(root: Path, errors: list[str]) -> None:
    for skill_root in (root / ".agents/skills", root / ".gemini/skills"):
        if not skill_root.exists():
            errors.append(f"Missing skill root: {skill_root.relative_to(root)}")
            continue
        for directory in sorted(path for path in skill_root.iterdir() if path.is_dir()):
            manifest = directory / "SKILL.md"
            if not manifest.exists():
                errors.append(f"Skill is missing SKILL.md: {directory.relative_to(root)}")
                continue
            text = manifest.read_text(encoding="utf-8", errors="replace")
            frontmatter = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, flags=re.DOTALL)
            if not frontmatter:
                errors.append(f"Skill has malformed frontmatter: {manifest.relative_to(root)}")
                continue
            name = re.search(r"^name:\s*([a-z0-9-]+)\s*$", frontmatter.group(1), flags=re.MULTILINE)
            description = re.search(r"^description:\s*\S.+$", frontmatter.group(1), flags=re.MULTILINE)
            if not name or name.group(1) != directory.name:
                errors.append(f"Skill name must match directory: {manifest.relative_to(root)}")
            if not description:
                errors.append(f"Skill needs a non-empty description: {manifest.relative_to(root)}")


def check_navigation_and_stale_paths(root: Path, errors: list[str]) -> None:
    status = _read(root, STATUS_RELATIVE) if (root / STATUS_RELATIVE).exists() else ""
    for field in ("Active Gate", "Authorization Record", "Roadmap"):
        value = _field(status, field)
        paths = re.findall(r"`([^`]+)`", value or "")
        if len(paths) != 1 or not (root / paths[0]).exists():
            errors.append(f"Execution status {field} must link exactly one existing path.")
    index = _read(root, "project_docs/INDEX.md") if (root / "project_docs/INDEX.md").exists() else ""
    for relative in (GATE_RELATIVE, AUTHORIZATION_RELATIVE, "project_docs/active/rules/DOCUMENTATION_GOVERNANCE.md"):
        if relative not in index:
            errors.append(f"Project index is missing active link: {relative}")
    stale = "project_docs/active/status/decision_intelligence_execution_status.md"
    for path in list((root / ".agents/skills").glob("**/*")) + list((root / ".gemini/skills").glob("**/*")):
        if path.is_file() and path.suffix in {".md", ".py", ".yaml", ".yml"} and stale in path.read_text(encoding="utf-8", errors="replace"):
            errors.append(f"Stale status path remains in {path.relative_to(root)}.")


def check_critical_source_sizes(root: Path, errors: list[str]) -> None:
    for relative, minimum in CRITICAL_SOURCE_MIN_LINES.items():
        path = root / relative
        if not path.exists():
            errors.append(f"Critical frontend source is missing: {relative}")
        elif len(path.read_text(encoding="utf-8", errors="replace").splitlines()) < minimum:
            errors.append(f"Critical frontend source is unexpectedly small: {relative}")


def run_repository_checks(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    check_required_paths(root, errors)
    check_python_syntax(root, errors)
    authorization = load_authorization(root, errors)
    check_authorization(root, authorization, errors)
    lifecycle, owner, frontend, milestone = check_execution_status(root, authorization, errors)
    check_gate_and_milestone(root, authorization, milestone, errors)
    check_handoffs(root, owner, frontend, errors)
    check_authorized_diff(root, authorization, errors)
    check_skill_manifests(root, errors)
    check_navigation_and_stale_paths(root, errors)
    check_critical_source_sizes(root, errors)
    return errors
