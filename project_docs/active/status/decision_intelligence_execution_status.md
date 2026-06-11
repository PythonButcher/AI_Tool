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

Phase 8 is fully verified and complete. 

Current gate is **Phase 9: Redefine The Decisions Window**.

Use this status file as the single current source of truth. Use `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` for implementation details only, and use `project_docs/active/contracts/decision_objects.md` when payload details are needed.

## Latest Verified Slice

Phase 8 Scenario Compare frontend blockers are repaired and verified.

Verified evidence:
- `AIShell.jsx` securely passes `decision_output.scenario_compare` into `ScenarioPreview`.
- `ScenarioPreview.jsx` securely handles the `not_applicable` state by showing summary and limitations instead of fabricated projections.
- The prior adjustment-chip blocker is repaired: `ScenarioPreview.jsx` now strictly parses `inputs.metric_targets[].adjustment_type` and `adjustment_value` into clean, signed percent or absolute labels.
- Rendered `decision_output.scenario_compare` inside `AIShell.jsx` and rewrote `ScenarioPreview.jsx` to correctly map the new data contract (inputs, baseline, comparison, projections, assumptions, limitations, source_scenario_ids).
- Fixed adjustment chip mapping to securely parse `inputs.metric_targets[].adjustment_type` and `adjustment_value` into clean, signed percent or absolute labels.
- Fixed projection delta mapping to avoid NaN% issues by guarding against missing `delta_pct` and falling back to `delta_value` or a conservative 'Delta unavailable' state.
- Removed forecast-like wording (e.g. "expected change") and explicitly implemented bounded terminology ("direct adjustment delta" or "sensitivity delta") within projection values.
- The "not_applicable" state explicitly renders the unavailable summary and limitations without fabricating charts or empty spaces.
- Explicitly described Scenario Compare as "Direct Adjustment Comparison" in the UI to prevent it from being misinterpreted as a forecast or simulation.
- Designed UI within `AIShell.css` ensuring visual harmony with the decision output layout.
- `npm --prefix frontend\frontend run build` completed successfully.
- `git diff --check` passed cleanly.
- Browser verification confirmed bounded state renders correctly.

## Status File Discipline

Keep this file short. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave only the current gate, the latest verified fact, and the archive pointer here.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
