# Phase 4 Gemini Frontend Handoff: Canonical Active Dataset

Owner: Gemini frontend

Status: Active next

## Current Truth

Phase 3 correction results and ranked observational evidence are complete. The next roadmap item is Phase 4: Canonical Active Dataset Contract.

This is not the completed historical Phase 4 chat-contract work. This Phase 4 is the post-Phase-3 dataset-truth alignment slice from `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`.

## Goal

Make the app show and use one coherent active dataset truth across major surfaces: AI Chat, Decisions, charts, dashboards, workflows, filters, cleaning, uploads, and semantic model consumers.

The user should be able to tell which dataset is active, where it came from, whether it is cleaned/transformed, and whether a surface is using the global active dataset or an explicit override.

## Files To Inspect First

Read the docs first:

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`

Then inspect frontend state and dataset consumers. Likely starting points include:

`frontend/frontend/src/App.jsx`

`frontend/frontend/src/components/insights/DataPane.jsx`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/components/visualization/ChartPanel.jsx`

Use targeted searches for active dataset, selected dataset, uploaded data, cleaned data, semantic model, chart data, dashboard data, and workflow data before editing.

## Implementation Boundaries

Do not change backend files unless the user explicitly authorizes it.

Do not add simulation, optimization, causal claims, autonomous decisions, or final recommendations.

Do not rewrite the app shell. This is a state and visibility alignment slice.

Preserve existing AI Chat, Decisions, charts, dashboards, workflows, cleaning, uploads, and semantic model behavior.

If a backend contract is missing, document the gap and stop for Codex review instead of inventing a backend API.

## Acceptance Behavior

There is a clear active dataset identity visible where decisions or analysis depend on data.

Major surfaces use the same active dataset unless the UI clearly marks an explicit override.

Dataset metadata should include source, dataset ID where available, row count, column count, and transform or cleaning state where available.

Changing the active dataset should not silently leave AI Chat, Decisions, charts, dashboards, workflows, filters, cleaning, uploads, or semantic model consumers on stale data.

## Verification

Run `git diff --check`.

Run `npm --prefix frontend\frontend run build`.

Perform one focused browser flow that changes or confirms the active dataset and verifies that at least AI Chat, Decisions, and one visual/data surface display or consume the same active dataset truth.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully with files changed, verification performed, and any remaining backend-contract gaps.

## Gemini CLI Prompt

Start Phase 4 Canonical Active Dataset frontend work. Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md`, and `project_docs/active/ai_hand_off/phase_4_gemini_frontend_canonical_active_dataset.md` first. Do not change backend files. Inspect current frontend dataset state and consumers, then implement one coherent active dataset truth across AI Chat, Decisions, charts, dashboards, workflows, filters, cleaning, uploads, and semantic model consumers where the current frontend state supports it. Show dataset source, ID where available, row count, column count, and cleaning/transform state where available. Preserve existing behavior and clearly mark any explicit dataset override. If a backend contract is missing, document the gap and stop for Codex review instead of inventing an API. Run `git diff --check` and `npm --prefix frontend\frontend run build`, do one focused browser flow, and update the active status doc truthfully.
