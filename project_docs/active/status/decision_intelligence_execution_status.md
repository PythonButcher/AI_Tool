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

Completed foundations: Phase 1 reliability, Phase 2 Dataset Trust backend, Phase 2.5 semantic frame cleanup, Phase 3 backend `decision_output`, Phase 4 frontend `decision_output` rendering, Phase 5 chat-native corrections closed for planning purposes by user direction, and Phase 6 Evidence Board rendering.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth now belongs inside Dataset Trust in the unified AI Chat decision output flow.

## Current Project Gate

Phase 6 Evidence Board rendering alignment is complete. `decision_output.evidence_board` frontend rendering now correctly consumes the backend contract, including coverage keys, data sufficiency metrics, and source diagnostic traces.

Current gate: Phase 7.2 Interactive Decision Graph Workspace frontend UI is complete.

Next gate: User validation and feedback on the Interactive Decision Graph Workspace layout and interactions.

## Active Plan

Read:

`project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`

The active work is to unite existing work, not start a separate dashboard project.

## Ownership

Codex owns backend truth, contracts, tests, architecture, documentation, cleanup planning, review, and project gate facilitation.

Gemini owns frontend implementation unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Workstreams

| Workstream | Status |
| --- | --- |
| AI Chat answer/chart/explore behavior | Keep and protect |
| Decision chat contract and actions | Complete foundation |
| Workspace drafting and correction | Complete foundation |
| Ranked observational evidence | Complete foundation |
| Dataset Trust inside AI Chat output | Complete and verified on frontend |
| Unified AI Chat decision output artifact | Complete and verified on frontend |
| Chat-native corrections in AI Chat | Closed for planning purposes by user direction |
| Evidence Board inside decision output | Complete and verified end-to-end |
| Decision Graph Builder | Phase 7.2 frontend workspace complete; pending user validation |
| Decisions window required-continuation flow | Superseded direction |
| Legacy recommendations, Autopilot, AutoML prominence | Prune or rewrite after replacement path exists |

## Latest Verified Slice

Phase 7.1/7.2 Interactive Decision Graph Workspace frontend aligned with backend contract and runtime errors resolved.

Verified evidence:
- Node mappings now correctly use `node.node_id`.
- Edge mappings now correctly use `edge.source_node_id` and `edge.target_node_id`.
- `evidence_board` and `frame` are now dynamically passed into the workspace context when launching from AI Chat `decision_output`.
- Visually differentiated `evidence_coverage` (solid blue) from `observed_association` (dashed gray) while maintaining non-causal restrictions.
- Expanded edge metrics in the inspector to include sample sizes, correlation, data sufficiency, and top groups.
- `git diff --check` and `npm run build` executed and verified with no errors.

## Status File Discipline

Keep this file short. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave only the current gate, the latest verified fact, and the archive pointer here.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| 5 | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` |
