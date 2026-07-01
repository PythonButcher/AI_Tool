# Completed Reference - Phase 3 Antigravity Charting Slicer UI Handoff

This handoff is complete as of user acceptance on 2026-06-30. It is retained as a completed reference, not an active frontend-agent handoff.

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Repair the dashboard-first charting and slicer UI until the dashboard command surface, slicers, and pin-to-dashboard actions are obvious, usable, and acceptable in browser review, without changing backend APIs.

## Review Finding

The current UI is not accepted. The dashboard still collapses into a floating blue `Filters` button positioned from `CanvasContainer.jsx`, which makes the dashboard feel like a pop-out filter tool instead of a chart workspace. Slicers remain hard to understand, and the pin-to-dashboard affordance is too difficult to notice.

Treat this as a frontend repair pass, not a backend task and not a complete charting rewrite.

## Backend Truth

Codex has implemented deterministic `content.chartSpec` on AI Chat chart artifacts in `backend/decision_engine/chat_service.py`. The contract is documented in `project_docs/active/contracts/decision_objects.md` under `AI Chat Chart Spec`. Existing chart artifact fields remain compatible and must continue rendering: `content.chartType`, `content.chartData`, `content.fieldsUsed`, `content.filtersApplied`, and `content.meta`.

`content.chartSpec` is optional. If it is missing or invalid, render the chart normally and hide pin/open chart-spec actions. Do not invent backend APIs or change backend payloads.

## UI Scope

Antigravity owns the React/CSS implementation. Codex must not edit frontend files unless explicitly authorized in a future session.

Target files to inspect first:

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/context/WindowContext.jsx`

`frontend/frontend/src/features/dashboard/DashboardSlicerPanel.jsx`

`frontend/frontend/src/features/dashboard/DashboardSlicerPanel.css`

`frontend/frontend/src/features/charts/SmartChartWindow.jsx`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/utils/dashboardFilterUtils.js`

The dashboard section needs the strongest design attention. It should feel like a clear chart workspace for business and personal users, not a hidden filter drawer or a loose floating button.

## Required Repair

Replace the floating `Filters` button behavior with a durable dashboard command surface. A user should immediately understand they are in a chart/dashboard workspace, see the dashboard name, see active slicer count and applied state, and have obvious actions for Add Chart, Add KPI, Slicers, and Metrics without a random button floating in blank space.

Make slicers clearer and more deliberate. The panel or rail should show applied slicers as readable chips, distinguish draft changes from applied slicers, provide searchable value selection for categorical slicers, keep Apply/Clear behavior obvious, and communicate row/data impact or empty-state impact where possible. Date, categorical, numeric, and text slicer states should be visually distinct enough that users do not have to infer what kind of filter they are editing.

Make pinning discoverable across chart windows and AI Chat. Pin to Dashboard and Open Chart Window should be visually prominent actions with icons, clear labels, and feedback after activation. A user should not have to hunt inside a mini action strip or inspector edge to know pinning exists.

Preserve and tighten the existing chart/slicer behavior. Dashboard slicers and chart-local slicers use intersection logic. If both constrain the same field and no rows overlap, show a clear empty state naming the conflicting field and both selected sides. Slicer edits should continue using draft state plus explicit Apply so semantic queries are not spammed.

Fix source-level cleanup found during review. `WindowContext.jsx` should not leave stale minimized or locked state after `removeDashboardItem`. Inline button styling in `CanvasContainer.jsx` should move into the dashboard CSS system. The current `CanvasContainer.jsx` diff also has trailing whitespace around the floating toggle button and must pass `git diff --check`. The new dashboard panel must be responsive and must not overlap dashboard charts, blank-state content, or workspace controls.

Keep local-first persistence with `chartStudioDashboard:v1`. On first load, read the old `businessMonitoringDashboard` key only if the new key is missing, save the migrated v1 state, and leave the old key intact.

## Acceptance Checks

Build succeeds with `npm --prefix frontend\frontend run build`.

Manual browser checks must show the dashboard no longer opens or collapses into a random floating `Filters` button. The first dashboard viewport must make chart creation, slicers, active slicer state, and pinning paths clear. Checks must cover creating raw and semantic charts, applying dashboard slicers, applying chart-local slicers, resolving slicer conflicts, pinning from Explore, pinning from AI Chat, and reloading to confirm v1 local persistence.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully after implementation. Do not mark the phase complete unless browser behavior has been accepted by the user.

## Codex Source Review Findings To Fix

The repair is directionally improved but not complete. Fix these source-level blockers before asking for browser acceptance.

Treat the remaining work as cleanup and product hardening, not another redesign. The command bar, slicer panel, pin actions, and conflict states are the right direction, but they need to behave like stable dashboard workspace chrome. Remove the overlay risk, remove unused code, move new inline styles into the CSS system, and make the visible layout feel intentional before declaring the repair ready.

`frontend/frontend/src/features/dashboard/DashboardCommandBar.css` still positions the command bar as an absolute overlay at `top: 16px` with fixed height. `frontend/frontend/src/features/dashboard/DashboardSlicerPanel.css` also positions the slicer panel as an absolute overlay at `top: 16px` with a higher z-index. The result can still overlap the command bar and dashboard charts. The dashboard command surface should reserve layout space or otherwise create a deliberate workspace chrome that does not cover charts, blank-state content, or slicer controls.

`frontend/frontend/src/components/layout/CanvasContainer.jsx` imports `FaFilter` and destructures `isSlicerPanelOpen` and `toggleSlicerPanel` without using them. Clean these up.

`frontend/frontend/src/features/dashboard/DashboardCommandBar.jsx` imports `FaPlus` and `FaChevronDown` and destructures `isSlicerPanelOpen` without using them. Clean these up.

`frontend/frontend/src/features/ai/AIShell.jsx` imports `FaTimes` and `FaMagic` and adds `sessionReadiness` state without using them. Clean these up.

`frontend/frontend/src/features/charts/SmartChartWindow.jsx` still uses inline styles for the pin action and conflict details. Move the new chart action styling into the existing CSS system. `git diff --check` currently fails on trailing whitespace in this file and must pass.

The build passed with warnings, but build success alone is not enough. The final repair must pass `git diff --check`, `npm --prefix frontend\frontend run build`, and user-visible browser acceptance for the dashboard command surface, slicer panel, pin actions, conflict state, and reload persistence.

Do not implement the future dashboard canvas/share skeleton in this repair pass. That idea is documented separately at `project_docs/active/decision_intelligence/future/dashboard_canvas_layout_and_sharing_skeleton_plan.md` and should become a later slice only after the current charting/slicer repair is accepted.
