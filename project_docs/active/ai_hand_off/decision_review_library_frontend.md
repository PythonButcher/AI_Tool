# Decision Review Library Frontend Handoff

Status: active Gemini/Antigravity frontend handoff.

## Backend Readiness

Backend readiness level: `backend_contract_ready` for active AI Chat `decision_output` review.

Backend readiness level: `backend_not_ready` for durable saved decision library persistence.

No backend code changes are required for the first frontend slice. The required active review artifact already comes from the existing AI Chat contract, and focused backend verification passed:

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_chat_service`

Result: 29 tests passed.

## Active Docs

Read these before implementation:

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/active/contracts/decision_objects.md`

`project_docs/active/decision_intelligence/current/decisions_window_future_role.md`

## Backend Contract To Use

Use the existing AI Chat routes only:

`POST /api/decision/chat/turns`

Request fields currently used by AI Chat:

`user_message`, `dataset`, `semantic_model`, `conversation_history`, `session_state`, `resolved_datasets`

Response fields relevant to this work:

`status`, `assistant_message`, `artifacts`, `suggested_actions`, `mode`, `session_state`, `capability_state`, `decision_readiness`, `dataset_trust`, `decision_output`

`decision_output` fields to render or carry:

`type`, `render_hint`, `inspectable`, `default_view`, `schema_version`, `title`, `summary`, `dataset_trust`, `frame`, `readiness`, `correction_state`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, `source_refs`, `truth_boundary`

`POST /api/decision/chat/actions`

Use this route only for existing AI Chat actions such as `analyze_workspace`, `draft_workspace`, and correction flows. Do not create a new frontend dependency on legacy `/api/decision/run` for the review-library slice.

There is no durable saved-decision route yet. Do not invent one. If current-session history is shown, label it as current-session only.

## Target Frontend Files

Inspect and update only the files needed for this slice:

`frontend/frontend/src/App.jsx`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/components/layout/DestinationHome.jsx`

`frontend/frontend/src/components/layout/MenuBar.jsx`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/business/decision/DecisionPanel.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/features/business/decision/DecisionSignals.jsx`

`frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`

`frontend/frontend/src/features/business/decision/decisionApi.js`

`frontend/frontend/src/utils/decisionPdfExport.js`

Create a focused new component only if it keeps the implementation cleaner, such as a `DecisionReviewLibrary` or `DecisionReviewPanel` under `frontend/frontend/src/features/business/decision/`.

## Implementation Direction

Make the Decisions destination a secondary Decision Review Library.

The current AI Chat decision output should remain the source of truth for active decision work. Prefer lifting the active `decision_output` artifact from `AIShell.jsx` into parent state through a callback, then passing it into the Decisions destination review surface. Do not fetch saved assets from a non-existent backend route.

When an active `decision_output` exists, the Decisions destination should provide a larger review path for that asset using the contract fields above. Reuse existing renderers where practical. If no active `decision_output` exists, the destination should point the user to AI Chat to create or refine one.

Remove or demote Decisions-first continuation behavior. The Decisions ribbon and destination home should not lead with the legacy `Analyze` path. Do not make `/api/decision/run` the primary route for this slice.

Preserve useful old renderers and continuity behavior. Do not delete `DecisionPanel.jsx`, `DecisionWorkspaceView.jsx`, `DecisionSignals.jsx`, `ScenarioPreview.jsx`, or `decisionPdfExport.js` unless an equivalent replacement is wired and verified.

Rewrite overpromising old copy. Avoid final recommendation, strategic recommendation, optimizer, forecast, potential outcome, simulation, decision rule, causal proof, autonomous decision, or prediction-certainty language unless it is explicitly framed as unsupported or observational-only.

## Acceptance Checks

The user can complete the active decision flow in AI Chat without opening Decisions.

The Decisions destination is review-oriented and no longer presents legacy Analyze as the primary next step.

With an active AI Chat `decision_output`, opening Decisions shows a larger review path or a clear current-decision review entry.

Without an active AI Chat `decision_output`, opening Decisions directs the user to AI Chat instead of pretending saved durable assets exist.

Existing normal AI Chat answer and chart behavior still works.

Existing AI Chat `decision_output` behavior still works, including Dataset Trust, Decision Frame, Evidence Board, Decision Map, Scenario Compare, Advanced Gates, corrections/actions, Decision Graph launch, and export affordances.

No UI copy implies unsupported simulation, optimization, causal proof, prediction certainty, autonomous decisions, or final recommendations.

Run and report:

`npm --prefix frontend\frontend run build`

`git diff --check`

One browser check for a normal AI Chat answer or chart.

One browser check for an AI Chat decision output.

One browser check for the Decisions destination showing secondary review behavior.

Update `project_docs/active/status/decision_intelligence_execution_status.md` with the actual frontend result and verification outcome.
