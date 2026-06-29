# Phase 3 Antigravity Charting Slicer UI Handoff

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Implement the dashboard-first charting and slicer UI against the backend `content.chartSpec` contract without changing backend APIs.

## Backend Truth

Codex has implemented deterministic `content.chartSpec` on AI Chat chart artifacts in `backend/decision_engine/chat_service.py`. The contract is documented in `project_docs/active/contracts/decision_objects.md` under `AI Chat Chart Spec`.

Existing chart artifact fields remain compatible and must continue rendering: `content.chartType`, `content.chartData`, `content.fieldsUsed`, `content.filtersApplied`, and `content.meta`.

`content.chartSpec` is optional. If it is missing or invalid, the frontend should render the chart normally and hide pin/open chart-spec actions.

## UI Scope

Antigravity owns the React/CSS implementation. Codex must not edit frontend files unless explicitly authorized in a future session.

Target files to inspect first:

`frontend/frontend/src/context/WindowContext.jsx`

`frontend/frontend/src/features/dashboard/DashboardFilterBar.jsx`

`frontend/frontend/src/features/charts/SmartChartWindow.jsx`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/utils/dashboardFilterUtils.js`

The dashboard section needs the strongest design attention. It should feel like a clear chart workspace for business and personal users, not just a hidden filter toolbar.

## Required Behavior

Create a shared frontend chart spec and slicer model that can represent raw charts, semantic charts, dashboard-pinned charts, and AI Chat chart artifacts.

Use local-first persistence with a versioned key such as `chartStudioDashboard:v1`. On first load, read the old `businessMonitoringDashboard` key only if the new key is missing, save the migrated v1 state, and leave the old key intact.

Replace the current dashboard filter interaction with a clear slicer experience. Slicer edits should use a draft state and an explicit Apply button so semantic queries are not refetched on every click. Clear and Remove may update immediately because they are deliberate actions.

Dashboard slicers and chart-local slicers use intersection logic. If both constrain the same field and no rows overlap, show a clear empty state naming the conflict instead of dropping either slicer.

Charts should expose local slicers, duplicate, and pin-to-dashboard actions. AI Chat chart inspector should expose Pin to Dashboard and Open Chart Window only when `content.chartSpec.schemaVersion === "chart_spec_v1"`.

## Acceptance Checks

Build succeeds with `npm --prefix frontend\frontend run build`.

Manual browser checks cover creating raw and semantic charts, applying dashboard slicers, applying chart-local slicers, resolving slicer conflicts, pinning from Explore, pinning from AI Chat, and reloading to confirm v1 local persistence.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully after implementation. Do not mark the phase complete unless browser behavior has been accepted.
