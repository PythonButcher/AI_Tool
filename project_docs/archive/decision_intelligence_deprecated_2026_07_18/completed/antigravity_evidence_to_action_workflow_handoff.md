# Completed Reference - Antigravity Evidence-To-Action Workflow Handoff

This file is retained as a completed reference. It is not an active repair prompt.

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Completed. The Evidence-To-Action frontend integration preserves backend enabled states and AI Chat Evidence Board checks and Decision Map checks visibly expose backend `source_refs` and `truth_boundary` in addition to exact disabled reasons and backend labels.

## Completed Repair

`frontend/frontend/src/features/ai/DecisionCommandCenter.jsx` and `frontend/frontend/src/features/ai/DecisionOutputReview.jsx` now format object-shaped `check.source_refs` safely with `renderSourceRefs`. Source refs render for command-center checks, Evidence Board checks, and Decision Map node and edge checks.

`frontend/frontend/src/features/business/decision/graph/InspectorPanel.jsx` now respects backend `enabled` and `disabled_reason` for graph follow-up actions.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and this handoff before editing source.

Backend readiness level: `backend_contract_ready`. Use the backend fields directly. Do not infer action availability from labels, node types, edge types, or missing frontend defaults when backend metadata exists.

Target files to inspect first: `frontend/frontend/src/features/ai/DecisionCommandCenter.jsx`, `frontend/frontend/src/features/ai/DecisionOutputReview.jsx`, `frontend/frontend/src/features/business/decision/graph/InspectorPanel.jsx`, `frontend/frontend/src/utils/decisionPdfExport.js`, and nearby CSS files for the same components if styling changes are needed. Keep the implementation inside the existing AI Chat decision output and Decision Graph surfaces.

Use these exact backend fields. `decision_output.command_center.allowed_next_checks[]` and `disabled_next_checks[]` now include `enabled`, `status`, `reason`, `disabled_reason`, `action_type`, `source_refs`, `limitations`, and `truth_boundary`. `decision_output.evidence_board.items[].next_checks[]` and `source_refs` expose per-evidence checks. `decision_output.decision_map.nodes[].next_checks`, `decision_output.decision_map.edges[].next_checks`, and their `source_refs` expose map-item checks. `decision_graph.edges[].followup_actions[]` now include backend labels, descriptions, source refs, limitations, disabled reasons, and truth boundary. `/api/decision/graph/actions` responses include `enabled`, `disabled_reason`, and `source_refs`.

Render enabled checks as user-approved follow-up controls only. Disabled checks must remain visible or explainable with the backend `disabled_reason` or `reason`, not hidden in a way that makes capability look missing. Preserve the observational-only boundary in labels, tooltips, or compact details where users inspect a check. Current source-level blocker: `DecisionCommandCenter.jsx` and `DecisionOutputReview.jsx` treat `check.source_refs` as an array using `.length` and `.join()`, but backend `source_refs` are objects. Render object-shaped `source_refs` with `Object.entries` or an equivalent safe formatter for command-center checks, Evidence Board checks, and Decision Map node/edge checks. Scenario Compare must stay disabled for user hypothesis graph edges and for missing metric targets, using the backend reason.

Acceptance checks: AI Chat decision output shows command-center allowed and disabled checks from `command_center` without falling back to `readiness.allowed_next_actions` when command-center checks exist, and it does not override backend `enabled: true` just because a check is informational or has no click handler. Evidence Board items expose their backend `next_checks` with disabled reasons, source-aware detail from object-shaped `source_refs`, and the observational `truth_boundary`. Decision Map nodes or edges expose backend `next_checks`, object-shaped source refs, and truth boundary without implying causality. Decision Graph follow-up buttons use backend labels and disabled reasons, and blocked action responses render `disabled_reason` and `source_refs`. Existing AI Chat answers, charts, exploration, artifact inspection, saved DecisionAssets, command-center save/export behavior, and PDF export remain compatible.

Verification command: run `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Browser acceptance should cover an AI Chat decision output with analyzed Evidence Board items, a compact Decision Map item, a Decision Graph observed edge, and a Decision Graph user hypothesis edge where Scenario Compare is disabled with the backend reason.

Ownership constraints: Antigravity owns React/CSS implementation, browser verification, frontend build, and truthful frontend status updates. Codex owns backend truth, contracts, tests, architecture, review, and handoff coordination. Do not edit backend source unless the frontend integration proves a backend contract bug.
