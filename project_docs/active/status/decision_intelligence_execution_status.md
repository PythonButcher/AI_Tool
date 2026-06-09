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

Completed foundations: Phase 1 reliability, Phase 2 Dataset Trust backend, Phase 2.5 semantic frame cleanup, Phase 3 backend `decision_output`, Phase 4 frontend `decision_output` rendering, Phase 5 chat-native corrections closed for planning purposes by user direction, Phase 6 Evidence Board rendering, Phase 7.1 Decision Graph backend data foundation, and Phase 7.2 Interactive Decision Graph Workspace.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth now belongs inside Dataset Trust in the unified AI Chat decision output flow.

## Current Project Gate

Phase 7.1 Decision Graph backend data foundation is complete. The backend contract and endpoints support variable candidates, selected variables, graph nodes, evidence coverage edges, observed association edges, edge metrics, data sufficiency, limitations, reliability labels, and the observational reliability boundary.

Phase 7.2 Interactive Decision Graph Workspace is complete. The workspace is integrated with the `decision_graph` backend contract, opens from AI Chat, builds selected-variable graphs, distinguishes evidence coverage from observed association edges, shows inspector metrics and limitations, and has an accepted Codex UI modernization with dark-theme support.

Phase 7.3 User Hypotheses And Graph-To-Action Flow is complete for current planning purposes. Backend contract and tests are verified. Gemini reported frontend build, diff, and focused browser verification; Codex targeted source review accepted the prior frontend blockers as fixed.

Current gate: ready for the next Decision Intelligence slice. No active Gemini handoff is open for this flow.

## Latest Verified Slice

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
| 5 | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` |
