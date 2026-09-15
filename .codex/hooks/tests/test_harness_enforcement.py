"""Focused positive and negative tests for AI Tool harness enforcement."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


HOOKS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOKS))

import check_active_gate  # noqa: E402
import harness_validation  # noqa: E402
import mutation_policy  # noqa: E402


def valid_authorization() -> dict[str, object]:
    return {
        "schema_version": 1,
        "canonical_phase": {"id": "phase-test", "name": "Test Phase"},
        "authorization_state": "AUTHORIZED",
        "lifecycle_state": "IN PROGRESS",
        "authority_kind": "direct_user_instruction",
        "diff_baseline": "a" * 40,
        "allowed_paths": ["backend/**"],
        "review_only_allowed_paths": ["project_docs/active/reviews/**"],
        "codex_frontend_edits_allowed": False,
        "user_implementation_authorization": {
            "approved_by": "User",
            "approved_at": "2026-09-14",
            "evidence": "direct_user_instruction",
            "instruction": "Begin the named test phase.",
        },
    }


def status_text(**overrides: str) -> str:
    values = {
        "Current Gate": "Test Gate",
        "Roadmap Phase": "Phase 0 — Test Phase",
        "Phase Identity": "`phase-test`",
        "Phase State": "`IN PROGRESS`",
        "What This State Means": "Work is active.",
        "Current Milestone": "Step 1: Test enforcement",
        "Automatic Continuation": "`CONTINUE`",
        "Current Owner": "Codex",
        "Backend Readiness": "`implementation_required`",
        "Frontend Readiness": "`blocked_harness_phase`",
        "Required Action": "Execute the gate.",
        "Active Gate": "`project_docs/active/active_gate/README.md`",
        "Authorization Record": "`project_docs/active/status/phase_authorization.json`",
        "Roadmap": "`project_docs/active/agent_harness/README.md`",
        "Active Handoff": "None",
        "Latest Verification": "Focused test passed.",
    }
    values.update(overrides)
    fields = "\n".join(f"- **{name}**: {value}" for name, value in values.items())
    return f"# Status\n\n## Current Gate: Test Gate\n\n{fields}\n\n## Completion Rule\n\nAll checks pass.\n"


def gate_text(current: str = "Step 1: Test enforcement", second_state: str = "PENDING") -> str:
    second_checkbox = "x" if second_state == "COMPLETED" else " "
    return (
        "Goal: Exercise one test phase.\n\n## User Outcome\nSafe work.\n\n## Scope\n\n"
        "**Phase Identity**: `phase-test`\n\n"
        f"**Current Step**: {current}\n\n"
        "**Target Files**: `backend/test.py`\n\n**Step Acceptance**: Tests pass.\n\n"
        "**Step Verification**: `python -m unittest`\n\n**Next Step**: Step 2: Finish checks\n\n"
        "**Continuation Rule**: Continue automatically while Codex remains the owner and the next step is executable.\n\n"
        "**Stop Condition**: Stop at acceptance.\n\n"
        "- [ ] **Step 1: Test enforcement** — [IN PROGRESS]\n"
        f"- [{second_checkbox}] **Step 2: Finish checks** — [{second_state}]\n\n"
        "## Contracts\nContract.\n\n## Acceptance\nPass.\n\n## Verification\nRun tests.\n\n"
        "## Owner And Control Return\nCodex.\n"
    )


class AuthorizationTests(unittest.TestCase):
    def test_valid_direct_user_authorization(self) -> None:
        errors: list[str] = []
        harness_validation.check_authorization(Path("."), valid_authorization(), errors)
        self.assertEqual(errors, [])

    def test_invalid_authorization_is_rejected(self) -> None:
        authorization = valid_authorization()
        authorization["authorization_state"] = "ASSUMED"
        authorization["codex_frontend_edits_allowed"] = "no"
        errors: list[str] = []
        harness_validation.check_authorization(Path("."), authorization, errors)
        self.assertTrue(any("REVIEW_ONLY or AUTHORIZED" in error for error in errors))
        self.assertTrue(any("must be a boolean" in error for error in errors))

    def test_review_only_diff_boundary_and_generated_exclusion(self) -> None:
        changed = {
            "project_docs/active/reviews/proposal.md",
            "backend/service.py",
            "frontend/frontend/node_modules/react/index.js",
            ".codex_tmp_py/site-packages/demo.py",
        }
        outside = harness_validation.paths_outside_patterns(changed, ["project_docs/active/reviews/**"])
        self.assertEqual(outside, ["backend/service.py"])

    def test_accepted_snapshot_rejects_changed_bytes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            accepted = root / "accepted.md"
            accepted.write_text("changed", encoding="utf-8")
            snapshot = root / harness_validation.ACCEPTED_SNAPSHOT_RELATIVE
            snapshot.parent.mkdir(parents=True)
            snapshot.write_text(
                json.dumps({"schema_version": 1, "sha256": {"accepted.md": "0" * 64}}),
                encoding="utf-8",
            )
            authorization = {
                "authorization_state": "REVIEW_ONLY",
                "accepted_change_snapshot": harness_validation.ACCEPTED_SNAPSHOT_RELATIVE,
            }
            errors: list[str] = []
            accepted_paths = harness_validation._accepted_snapshot_paths(root, authorization, errors)
        self.assertNotIn("accepted.md", accepted_paths)
        self.assertTrue(any("changed after acceptance" in error for error in errors))


class ActiveGateTests(unittest.TestCase):
    def test_current_step_must_match_single_in_progress_item(self) -> None:
        errors: list[str] = []
        check_active_gate._validate_step_checklist(gate_text("Step 9: Drift"), errors)
        self.assertTrue(any("Current Step" in error for error in errors))

    def test_checklist_rejects_multiple_in_progress_items(self) -> None:
        errors: list[str] = []
        check_active_gate._validate_step_checklist(gate_text(second_state="IN PROGRESS"), errors)
        self.assertTrue(any("WIP=1" in error for error in errors))

    def test_phase_identity_must_match_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            gate = root / "project_docs/active/active_gate"
            status = root / "project_docs/active/status"
            gate.mkdir(parents=True)
            status.mkdir(parents=True)
            gate.joinpath("README.md").write_text(gate_text().replace("phase-test", "wrong"), encoding="utf-8")
            status.joinpath("phase_authorization.json").write_text(json.dumps(valid_authorization()), encoding="utf-8")
            errors = check_active_gate.validate_active_gate(gate, root)
        self.assertTrue(any("Phase Identity" in error for error in errors))


class StatusAndHandoffTests(unittest.TestCase):
    def _status_root(self, text: str) -> tempfile.TemporaryDirectory[str]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        path = root / harness_validation.STATUS_RELATIVE
        path.parent.mkdir(parents=True)
        path.write_text(text, encoding="utf-8")
        return temporary

    def test_codex_in_progress_requires_continue(self) -> None:
        temporary = self._status_root(status_text(**{"Automatic Continuation": "`WAIT_FOR_USER`"}))
        with temporary:
            errors: list[str] = []
            harness_validation.check_execution_status(Path(temporary.name), valid_authorization(), errors)
        self.assertTrue(any("requires Automatic Continuation `CONTINUE`" in error for error in errors))

    def test_antigravity_owner_requires_ready_handoff(self) -> None:
        temporary = self._status_root(status_text(**{"Current Owner": "Antigravity", "Automatic Continuation": "`WAIT_FOR_AGENT`"}))
        with temporary:
            root = Path(temporary.name)
            (root / "project_docs/active/ai_hand_off").mkdir(parents=True)
            errors: list[str] = []
            harness_validation.check_handoffs(root, "Antigravity", "blocked_harness_phase", errors)
        self.assertTrue(any("requires backend_contract_ready" in error for error in errors))
        self.assertTrue(any("exactly one" in error for error in errors))

    def test_repair_requires_visible_blocker(self) -> None:
        temporary = self._status_root(status_text(**{"Active Handoff": "`project_docs/active/ai_hand_off/repair.md`"}))
        with temporary:
            root = Path(temporary.name)
            handoffs = root / "project_docs/active/ai_hand_off"
            handoffs.mkdir(parents=True)
            handoffs.joinpath("repair.md").write_text("Goal: Repair UI.\n", encoding="utf-8")
            errors: list[str] = []
            harness_validation.check_handoffs(root, "Antigravity", "frontend_repair_only", errors)
        self.assertTrue(any("REPAIR REQUIRED" in error for error in errors))


class MutationPolicyTests(unittest.TestCase):
    def test_frontend_read_is_allowed(self) -> None:
        event = {"tool_name": "Read", "tool_input": {"file_path": "frontend/frontend/src/App.jsx"}}
        self.assertIsNone(mutation_policy.evaluate_event(event))

    def test_frontend_mutation_is_denied_without_permission(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            authorization = Path(temporary) / "authorization.json"
            value = valid_authorization()
            value["allowed_paths"] = ["frontend/frontend/src/**"]
            authorization.write_text(json.dumps(value), encoding="utf-8")
            event = {"tool_name": "apply_patch", "tool_input": "*** Update File: frontend/frontend/src/App.jsx"}
            with mock.patch.object(mutation_policy, "AUTHORIZATION_PATH", authorization):
                reason = mutation_policy.evaluate_event(event)
        self.assertIn("frontend mutations are not authorized", reason or "")

    def test_gemini_file_is_always_protected(self) -> None:
        event = {"tool_name": "Write", "tool_input": {"file_path": "GEMINI.md", "content": "x"}}
        self.assertIn("GEMINI.md", mutation_policy.evaluate_event(event) or "")


class NavigationAndSkillTests(unittest.TestCase):
    def test_missing_active_links_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            status = root / harness_validation.STATUS_RELATIVE
            status.parent.mkdir(parents=True)
            status.write_text(status_text(), encoding="utf-8")
            (root / "project_docs/INDEX.md").parent.mkdir(parents=True, exist_ok=True)
            (root / "project_docs/INDEX.md").write_text("No active links.\n", encoding="utf-8")
            errors: list[str] = []
            harness_validation.check_navigation_and_stale_paths(root, errors)
        self.assertTrue(any("missing active link" in error for error in errors))

    def test_stale_status_path_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / ".agents/skills/demo").mkdir(parents=True)
            (root / ".gemini/skills").mkdir(parents=True)
            (root / ".agents/skills/demo/SKILL.md").write_text(
                "project_docs/active/status/decision_intelligence_execution_status.md", encoding="utf-8"
            )
            errors: list[str] = []
            harness_validation.check_navigation_and_stale_paths(root, errors)
        self.assertTrue(any("Stale status path" in error for error in errors))

    def test_malformed_skill_manifest_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / ".agents/skills/broken").mkdir(parents=True)
            (root / ".gemini/skills").mkdir(parents=True)
            (root / ".agents/skills/broken/SKILL.md").write_text("# Missing frontmatter\n", encoding="utf-8")
            errors: list[str] = []
            harness_validation.check_skill_manifests(root, errors)
        self.assertTrue(any("malformed frontmatter" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
