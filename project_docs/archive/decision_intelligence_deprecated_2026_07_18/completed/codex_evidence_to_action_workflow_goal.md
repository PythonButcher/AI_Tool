# Completed Reference - Codex Evidence-To-Action Workflow Goal

This file is retained as a completed reference. It is not an active goal prompt.

Original title: Codex Evidence-To-Action Workflow Goal

Goal: Build the Evidence-To-Action Workflow backend contract for AI Chat Decision Intelligence so evidence, map items, and graph items expose user-approved next checks with exact enabled states, disabled reasons, source refs, and observational truth boundaries.

Original active prompt read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, the Evidence-To-Action plan now retained at `project_docs/active/decision_intelligence/completed/phase_6_evidence_to_action_workflow_plan.md`, and `project_docs/active/agent_council/outputs/next-implementation-cycle-priorities/2026-06-28-next-implementation-cycle-priorities-summary.md`.

Inspect `backend/services/decision_output_service.py`, `backend/decision_engine/chat_service.py`, `backend/services/decision_graph_service.py`, `backend/services/scenario_service.py`, `tests/test_decision_chat_service.py`, `tests/test_decision_graph_service.py`, and `tests/test_decision_reliability_benchmark.py` before planning edits. Inspect frontend files only enough to confirm whether a real frontend gap exists; do not edit frontend implementation files unless explicitly authorized in the session.

Use existing contract fields first: `decision_output.command_center.allowed_next_checks`, `decision_output.command_center.disabled_next_checks`, `evidence_board.items`, `decision_map`, `scenario_compare`, `source_refs`, `truth_boundary`, `decision_graph.edges`, `decision_graph.followup_actions`, and graph action responses. Add only the minimum fields needed to connect evidence to supported next checks without making the frontend infer backend truth.

Preserve product truth: next checks are user-approved investigations, not final recommendations, predictions, simulations, optimizers, causal proof, autonomous decisions, live saved-asset refresh, or unsupported ML behavior. Scenario Compare remains bounded direct adjustment only. User hypothesis edges must remain separate from observed associations and must not unlock Scenario Compare unless observational evidence supports the action.

Acceptance checks: supported next checks have backend-owned labels, action IDs or explicit informational status, source refs, and limitations; unsupported checks have disabled reasons; Scenario Compare is disabled for missing metric targets and unvalidated user hypotheses; existing AI Chat answers, charts, exploration, artifact inspection, saved DecisionAssets, and exports remain compatible; no frontend agent needs to infer backend truth. If frontend work is needed after backend verification, create a bounded Gemini or Antigravity handoff naming exact fields, allowed actions, disabled states, acceptance checks, build command, and manual browser checklist.

Verification commands: run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and focused backend tests touched by the work. If graph action behavior changes, run `python -m unittest tests.test_decision_graph_service`. If chat or `decision_output` behavior changes, run `python -m unittest tests.test_decision_chat_service`. If unsupported capability behavior changes, run `python -m unittest tests.test_decision_reliability_benchmark`.
