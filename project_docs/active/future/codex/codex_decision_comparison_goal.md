# Codex Decision Comparison Goal

Status: Deferred. Promote with the preparation plan only after the active Decision Intelligence gate authorizes this work.

Goal: Establish the smallest truthful backend and contract foundation for user-controlled decision comparison inside AI Chat.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/contracts/decision_objects.md`, `project_docs/active/codex_harness_engineering.md`, and `project_docs/active/future/codex/decision_comparison_preparation_plan.md` before changing source.

Audit `backend/decision_engine/chat_service.py`, `backend/services/decision_workspace_service.py`, `backend/services/decision_output_service.py`, `backend/services/scenario_service.py`, `backend/routes/decision.py`, `tests/test_decision_chat_service.py`, and `tests/test_decision_workspace_service.py`. Trace the exact current shapes and ownership of `decision_output.frame`, `decision_output.evidence_board`, `decision_output.scenario_compare`, `decision_output.advanced_readiness`, `decision_output.source_refs`, workspace decision scope, constraints, and scenario-evaluation requests. Inspect the current frontend readers only as needed to classify integration gaps.

Define and implement one bounded additive backend slice only after the audit proves the gap. The contract must support at least two user-named alternatives, user-controlled comparison criteria and guardrails, evidence-linked trade-offs with explicit unknowns, and multiple direct-adjustment sensitivity cases. Preserve canonical dataset identity and source refs. Keep user judgments distinct from observed evidence. Never manufacture weights, scores, projections, causal effects, optimized selections, or final recommendations.

Document any public request, response, session, workspace, or decision-output change in `project_docs/active/contracts/decision_objects.md`. Add focused regressions for valid comparison input, missing evidence, dataset traceability, multiple sensitivity cases, unsupported or misleading advanced claims, and compact row-free session state. Preserve existing conversational analysis, normal answers and charts, artifacts, exports, and saved-snapshot semantics.

Acceptance requires a source-backed classification of the current path, a minimal additive contract, passing focused tests for the implemented slice, and a clear readiness classification of `backend_not_ready`, `backend_contract_ready`, or `frontend_repair_only`. If frontend work is proven necessary, create one focused handoff under `project_docs/active/ai_hand_off/`; do not edit React or CSS without explicit user authorization. Do not edit any `GEMINI.md` file.

Run the focused tests selected by the audit, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Stop after the backend slice, contract, tests, status truth, and any necessary focused frontend handoff are complete.
