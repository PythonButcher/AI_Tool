# Decision Intelligence Execution Status

This is the short active status file. It should stay readable in under two minutes. Implementation history belongs in archive, not in this active gate document.

Detailed history:

`project_docs/archive/decision_intelligence_status_history_2026_06_01.md`

Full older preserved status history:

`project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md`

## Current Truth

Decision Intelligence V3 is active.

AI Chat is the primary work surface. Existing AI Chat behavior must remain: normal answers, charting, exploration, decide mode, artifact inspection, and exports.

Decision Intelligence is being unified into AI Chat's results pane. The Decisions window is not deleted, but its intended role is secondary after the AI Chat output flow is clear.

Completed foundations: AI Chat answer/chart protection, Dataset Trust, backend `decision_output`, frontend `decision_output` rendering, chat-native corrections, Evidence Board rendering, Decision Graph backend data foundation, Interactive Decision Graph Workspace, User Hypotheses and Graph-To-Action Flow, and Scenario Compare in the AI Chat decision output.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth now belongs inside Dataset Trust in the unified AI Chat decision output flow.

## Current Project Gate

Current gate: ready for the next Decision Intelligence slice. Use this status file as the single current source of truth. Use `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` for implementation details only, and use `project_docs/active/contracts/decision_objects.md` when payload details are needed.

Latest completed slice: Scenario Compare is folded into the AI Chat decision output. Backend and frontend implementation are complete by source review and build verification.

## Latest Verified Slice

Phase 8 Scenario Compare rendering in the AI Chat decision output is implemented and verified.

Verified evidence:
- `AIShell.jsx` passes `decision_output.scenario_compare` into `ScenarioPreview`.
- `ScenarioPreview.jsx` handles the `not_applicable` state by showing summary and limitations instead of fabricated projections.
- The prior adjustment-chip blocker is repaired: `ScenarioPreview.jsx` now maps `inputs.metric_targets[].adjustment_type` and `inputs.metric_targets[].adjustment_value`.
- Projection deltas now use bounded `sensitivity delta` wording instead of forecast-like `expected change`.
- `ScenarioPreview.jsx` guards nullable `delta_pct`, falls back to `delta_value`, and renders `Delta unavailable` when neither delta is numeric.
- `npm --prefix frontend\frontend run build` completed successfully with existing repo warnings.
- `git diff --check` passed with line-ending warnings only.
- Codex did not run browser verification in this review.

Prior verified slice:

Phase 8 backend Scenario Compare contract work is verified.

Verified evidence:
- `decision_output.scenario_compare` now normalizes supported scenario previews into a display-ready object with `status`, `summary`, `inputs`, `baseline`, `comparison`, `projections`, `assumptions`, `limitations`, `source_scenario_ids`, and `truth_boundary`.
- Missing, skipped, or projection-less scenario data returns a conservative `not_applicable` object instead of fabricated projections.
- Decision Chat can attach an existing bounded `scenario_preview` from request or session state to the composed `decision_output`; chat does not run scenario evaluation directly.
- Decision Pipeline scenario previews now carry `source_scenario_ids` traced from the existing scenario service response.
- Scenario Compare language remains bounded to direct adjustment or sensitivity comparison and explicitly denies forecast, optimizer, simulation, causal model, autonomous decision, and final recommendation semantics.
- `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service tests.test_decision_pipeline_service tests.test_decision_phase_3_correction tests.test_decision_graph_service tests.test_decision_reliability_benchmark tests.test_decision_workspace_service` passed at 72/72.

Prior verified slice:

Gemini applied a new UI polish pass to the Decision Graph Workspace based on user direction, reverting the previous extreme flat enterprise aesthetic in favor of a modern, slightly rounded, bordered, and softly shadowed panel style matching a provided reference.

Verified evidence:
- Replaced stark flat variables in `DecisionGraphWorkspace.css` with a refined color palette matching the modern UI reference (e.g. `indigo` accent colors, slightly softer backgrounds).
- Re-introduced `border-radius: 8px`, `border: 1px solid var(--graph-line)`, and subtle `box-shadow` to the main panels, headers, and nodes to restore depth and separation.
- Ensured dark mode theme variables (`[data-theme='dark']`) correctly handle these re-introduced borders and shadows, maintaining readability and visual hierarchy in dark mode.
- `npm --prefix frontend\frontend run build` completed successfully.
- Maintained all existing features and component structures as requested, purely applying CSS UI polish.

Prior verified slice:

Gemini applied an extreme flat, cohesive enterprise UI overhaul to the Decision Graph based on further user direction.

Verified evidence:
- Completely rewrote `GraphHeader.jsx` to be a pure flat text-driven header with zero pill backgrounds or boxes, matching Google Cloud Platform aesthetics.
- Flattened the UI completely by removing all box-shadows, borders, and border-radiuses (`border-radius: 0`), resulting in stark, flush rectangles.
- Removed margins between buttons (`variable-option`) so they sit perfectly flush against each other without lines.
- Stripped inline gradients from `VariableTray.jsx` (e.g., the Add Hypothesis button) and made all buttons stark, full-width solid colored blocks.
- Adopted an edge-to-edge container layout driven strictly by background color contrast (`#f1f3f4` vs `#ffffff`), enforcing the "no lines" requirement.
- Removed a CSS grid transition (`grid-template-columns`) from the workspace grid that was causing ResizeObserver loops and breaking the window's draggable resize behavior when expanded.
- Restored `flex-shrink: 0` to the header to prevent vertical layout collapse during resize events.
- Fixed an issue where the flat design overhaul hardcoded light mode colors in the CSS, breaking the app's dark theme capability. The UI now fully supports native `#202124` / `#ffffff` theme swapping.
- Completely rewrote `VariableTray.jsx` from scratch. Replaced the old "chunky blocks" and chip displays with a modern, sleek Material 3 list view featuring flat rows, native checkboxes, subtle hover states, and a clean search input to perfectly match Google's enterprise aesthetics.
- `npm --prefix frontend\frontend run build` completed successfully.

Prior verified slice:

Phase 7.3 User Hypotheses And Graph-To-Action Flow was implemented and verified.

Verified evidence:
- `decision_graph` schema version is now `di_phase7_3_decision_graph_v1`.
- `/api/decision/graph/build` accepts additive `user_hypotheses` and returns directional `relationship_type: "user_hypothesis"` edges with `evidence_basis: "user_stated_hypothesis"`, `causal_status: "user_hypothesis_not_validated"`, `reliability_label: "user_hypothesis_unvalidated"`, unvalidated metrics, data sufficiency, limitations, and per-edge follow-up action availability.
- Graph build responses include `graph_state` so selected variables, selected evidence, filters, and accepted user hypotheses can be carried in frontend session state or a saved decision asset without implying server-side persistence.
- `/api/decision/graph/actions` returns safe planning responses for `breakdown`, `monitor`, `explain_evidence`, `explain_missing_data`, and `send_to_scenario_compare`; it returns request semantics and does not execute causal validation, monitoring automation, or scenario evaluation.
- Scenario Compare planning is blocked for unvalidated user hypothesis edges until an observed metric edge is selected.
- `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_graph_service tests.test_decision_chat_service tests.test_decision_reliability_benchmark` passed at 44/44.
- Gemini reported `npm --prefix frontend\frontend run build`, `git diff --check`, and focused browser verification passed.
- Codex targeted source review verified the production `Add Hypothesis` control, persisted `userHypotheses` state, full `decision_graph` context passed to `/api/decision/graph/actions`, visually distinct user hypothesis edges, and explicit user-hypothesis inspector copy that does not describe hypotheses as observed associations.

Prior verified slice:

Phase 7.2 Interactive Decision Graph Workspace was finalized after a Codex UI modernization pass.

Verified evidence:
- The user explicitly authorized Codex frontend work for this graph feature after rejecting the first visual implementations.
- Replaced the rejected dark-panel visual treatment with a light analytical workspace using a structured header, build-scope tray, canvas stage, compact graph nodes/edges, and explanatory inspector.
- Preserved the backend `decision_graph` contract: `node.node_id`, `edge.source_node_id`, `edge.target_node_id`, `evidence_board`, and `frame` wiring remain intact.
- Replaced circular node placement with deterministic lane layout for evidence, dimensions, metrics, and other variables.
- Replaced oversized edge labels with compact relationship badges and kept evidence coverage visually distinct from observed associations without causal arrows.
- Inspector now explains selected nodes/edges before showing evidence basis, data sufficiency, metrics, top groups, and limitations.
- Added a dedicated `[data-theme='dark']` style layer so the graph header, panels, canvas, nodes, edge labels, inspector sections, controls, and states adapt to the app dark theme instead of showing light surfaces inside a dark shell.
- `npm --prefix frontend\frontend run build` passed with existing repo warnings.
- `git diff --check` passed with line-ending warnings only.
- User visual acceptance was given on 2026-06-08 as "good enough."

## Status File Discipline

Keep this file short. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave only the current gate, the latest verified fact, and the archive pointer here.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
