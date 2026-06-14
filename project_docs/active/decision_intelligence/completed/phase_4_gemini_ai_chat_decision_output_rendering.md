# Phase 4 Gemini Handoff: AI Chat Decision Output Rendering

> COMPLETED REFERENCE ONLY: This handoff is no longer active. Current work starts from `project_docs/active/status/decision_intelligence_execution_status.md`.

## Purpose

Render the backend-owned `decision_output` artifact inside the existing AI Chat results pane. This is frontend-owned Phase 4 work. Keep AI Chat as the primary work surface and preserve existing answer, chart, exploration, workspace preview, workspace analysis summary, artifact inspection, and export behavior.

## Verified Backend State

Codex Phase 3 backend is complete and Anti Gravity reviewed it with verdict: Complete.

`decision_output` is documented in `project_docs/active/contracts/decision_objects.md` under `AI Chat Decision Output`. It is returned additively. Decision prompts return `workspace_preview` first and append `decision_output`. `analyze_workspace` returns `workspace_analysis_summary` first and appends `decision_output`. Correction responses through the existing `draft_workspace` action keep `workspace_preview` first and append updated `decision_output`.

The focused backend suite passed at 27/27 with `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service`. Compile verification passed for `backend/services/decision_output_service.py`, `backend/decision_engine/chat_service.py`, and `tests/test_decision_chat_service.py`.

## Backend Contract To Render

Render artifacts by `artifact.type` and `render_hint`, not artifact position. `decision_output` may be `artifacts[1]` or later, and is also available as top-level `body.decision_output`.

Core fields to render are `summary`, `dataset_trust`, `frame`, `readiness`, `correction_state`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, and `source_refs`.

`evidence_board.status` is `not_analyzed` before analysis and `analyzed` after `analyze_workspace`. `scenario_compare.status` is currently `not_applicable` when no scenario preview exists. `decision_map` always has `nodes` and `edges`, including unknown nodes for incomplete frames. Every truth boundary remains `observational_analysis_only`.

Do not present the output as a final recommendation. Do not imply simulation, optimization, causal proof, autonomous decisioning, forecast certainty, or unsupported prediction.

## Likely Frontend Files

Start with `frontend/frontend/src/features/ai/AIShell.jsx` and `frontend/frontend/src/features/ai/AIShell.css`.

Reuse existing business decision renderers where practical: `frontend/frontend/src/features/business/decision/SemanticRef.jsx`, `frontend/frontend/src/features/business/decision/DecisionSignals.jsx`, and `frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`.

Review export integration in `frontend/frontend/src/utils/decisionPdfExport.js` and `frontend/frontend/src/utils/appPdfExport.js`, but do not rewrite export unless the render path is stable enough to extend safely in this slice.

## Acceptance Checks

A complete decision prompt in AI Chat shows a structured `decision_output` in the right-side results pane without forcing the user into the Decisions window.

An incomplete decision prompt shows Dataset Trust, the draft frame, missing inputs, blocked readiness, and unknown/missing nodes without crashing or hiding the gap.

Running `analyze_workspace` updates the visible decision output with an analyzed Evidence Board while preserving the existing workspace analysis summary artifact behavior.

A correction action updates the visible decision output correction state and readiness while preserving the existing workspace preview compatibility path.

Normal answer and chart prompts still render through their existing AI Chat paths. Semantic metric charts must render even when `artifact.source` is `semantic_metric`; `chart_engine` is only the fallback for raw chart artifacts without an explicit content source.

Run `npm --prefix frontend\frontend run build`, `git diff --check`, and one focused browser flow covering a normal answer or chart plus a decision prompt. Update `project_docs/active/status/decision_intelligence_execution_status.md` with only verified frontend facts.

## Paste-Ready Gemini Prompt

Start Phase 4 frontend work for AI Chat Decision Output Unification in the AI_Tool repo. First read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and this completed reference file only if historical Phase 4 handoff details are needed.

The backend `decision_output` contract is ready. Implement frontend rendering for that artifact in the existing AI Chat results pane. Preserve existing answer, chart, exploration, workspace preview, workspace analysis summary, artifact inspection, and export behavior. Render by `artifact.type` and `render_hint`, not by artifact position. `decision_output` may be appended after the existing compatibility artifact and is also available as top-level `body.decision_output`.

Start in `frontend/frontend/src/features/ai/AIShell.jsx` and `frontend/frontend/src/features/ai/AIShell.css`. Reuse existing decision display pieces where practical, especially SemanticRef, DecisionSignals, and ScenarioPreview. Render Dataset Trust, Executive Brief, Decision Frame, Readiness, Evidence Board, Decision Map, Scenario Compare, Advanced Gates, and Export sections without implying final recommendations, simulation, optimization, causal proof, autonomous decisions, forecasts, or unsupported prediction certainty.

Before finishing, verify a normal answer or chart still works, verify a complete decision prompt renders the structured decision output, verify incomplete frames show missing inputs safely, and run `npm --prefix frontend\frontend run build` plus `git diff --check`. Update the active status doc only with verified frontend facts.
