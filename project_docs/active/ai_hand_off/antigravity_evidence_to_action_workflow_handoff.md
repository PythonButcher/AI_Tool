# Antigravity Evidence-To-Action Workflow Handoff

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Integrate backend-owned Evidence-To-Action next-check metadata into AI Chat Decision Intelligence so Evidence Board items, Decision Map items, command-center checks, and Decision Graph follow-up actions render exact enabled states, disabled reasons, source refs, and observational truth boundaries.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and this handoff before editing source.

Backend readiness level: `backend_contract_ready`. Use the backend fields directly. Do not infer action availability from labels, node types, edge types, or missing frontend defaults when backend metadata exists.

Target files to inspect first: `frontend/frontend/src/features/ai/DecisionOutputReview.jsx`, `frontend/frontend/src/features/business/decision/graph/InspectorPanel.jsx`, `frontend/frontend/src/utils/decisionPdfExport.js`, and nearby CSS files for the same components if styling changes are needed. Keep the implementation inside the existing AI Chat decision output and Decision Graph surfaces.

Use these exact backend fields. `decision_output.command_center.allowed_next_checks[]` and `disabled_next_checks[]` now include `enabled`, `status`, `reason`, `disabled_reason`, `action_type`, `source_refs`, `limitations`, and `truth_boundary`. `decision_output.evidence_board.items[].next_checks[]` and `source_refs` expose per-evidence checks. `decision_output.decision_map.nodes[].next_checks`, `decision_output.decision_map.edges[].next_checks`, and their `source_refs` expose map-item checks. `decision_graph.edges[].followup_actions[]` now include backend labels, descriptions, source refs, limitations, disabled reasons, and truth boundary. `/api/decision/graph/actions` responses include `enabled`, `disabled_reason`, and `source_refs`.

Render enabled checks as user-approved follow-up controls only. Disabled checks must remain visible or explainable with the backend `disabled_reason` or `reason`, not hidden in a way that makes capability look missing. Preserve the observational-only boundary in labels, tooltips, or compact details where users inspect a check. Scenario Compare must stay disabled for user hypothesis graph edges and for missing metric targets, using the backend reason.

Acceptance checks: AI Chat decision output shows command-center allowed and disabled checks from `command_center` without falling back to `readiness.allowed_next_actions` when command-center checks exist. Evidence Board items expose their backend `next_checks` with disabled reasons and source-aware detail. Decision Map nodes or edges expose backend `next_checks` without implying causality. Decision Graph follow-up buttons use backend labels and disabled reasons, and blocked action responses render `disabled_reason` and `source_refs`. Existing AI Chat answers, charts, exploration, artifact inspection, saved DecisionAssets, command-center save/export behavior, and PDF export remain compatible.

Verification command: run `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Browser acceptance should cover an AI Chat decision output with analyzed Evidence Board items, a compact Decision Map item, a Decision Graph observed edge, and a Decision Graph user hypothesis edge where Scenario Compare is disabled with the backend reason.

Ownership constraints: Antigravity owns React/CSS implementation, browser verification, frontend build, and truthful frontend status updates. Codex owns backend truth, contracts, tests, architecture, review, and handoff coordination. Do not edit backend source unless the frontend integration proves a backend contract bug.
