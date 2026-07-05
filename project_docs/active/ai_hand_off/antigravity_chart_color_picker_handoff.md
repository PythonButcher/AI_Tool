# Antigravity Chart Color Picker Handoff

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Implement a robust, subtle, clean, modern chart color picker for chart windows and dashboard chart items, using local frontend state only, while preserving existing chart rendering, dashboard persistence, slicer behavior, and export behavior.

Documentation status: complete. This handoff and the related local dashboard appearance contract are ready for implementation review and browser acceptance tracking.

## Active Documentation To Read First

Read these files before editing source:

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/active/contracts/dashboard_canvas_state.md`

`project_docs/active/contracts/decision_objects.md`

## Ownership And Backend Readiness

Antigravity owns the React/CSS implementation, design decisions, browser verification, frontend build, and truthful status update. Codex owns backend truth, contracts, architecture, review, and handoff coordination.

Backend readiness level: `frontend_repair_only`. No backend route, database migration, authentication, chart API, or decision-object contract change is required for this slice. Chart color choices are local presentation preferences layered onto existing Chart.js datasets.

Do not change backend APIs. Do not require new fields from `/api/nlp/chart`, AI Chat chart artifacts, semantic metric resolution, or decision output. Existing dataset colors from backend/chart data may be used as the initial state, but the picker must work even when datasets have no colors.

Use `DashboardCanvasItem.display` for persisted dashboard item appearance. The local dashboard contract now allows optional `display.paletteId`, `display.seriesColors`, and `display.customColors`. For non-dashboard chart windows, use existing chart/window state patterns in `WindowContext.jsx` so color choices remain local and do not mutate backend truth.

## Target Files To Inspect First

`frontend/frontend/src/features/charts/ChartComponent.jsx`

`frontend/frontend/src/features/charts/ChartComponentAI.jsx`

`frontend/frontend/src/features/charts/SmartChartWindow.jsx`

`frontend/frontend/src/features/charts/SmartChartWindow.css`

`frontend/frontend/src/features/dashboard/DashboardCanvasItem.jsx`

`frontend/frontend/src/features/dashboard/DashboardCanvasItem.css`

`frontend/frontend/src/context/WindowContext.jsx`

`frontend/frontend/src/utils/dashboardCanvasUtils.js`

`frontend/frontend/src/utils/chartDataUtils.jsx`

`frontend/frontend/src/utils/semanticChartUtils.js`

Create a small chart-specific picker component and styling file if that is cleaner than expanding existing chart files. Keep it near `features/charts/` unless there is a clear shared-use reason.

## Plan

Start with the chart rendering boundary. `ChartComponent.jsx` currently applies default blue styling when datasets have no `backgroundColor`; this is the right place to accept a local appearance object and merge palette choices into Chart.js dataset colors. Keep that merge deterministic and defensive so malformed colors or missing series labels fall back to the app default.

Then add a compact picker entry point to `SmartChartWindow.jsx`. Antigravity has design freedom on the surface: it can be a small swatch button in the chart toolbar, a popover from item chrome, or another quiet control that fits the existing app. The picker should be discoverable without turning every chart into a settings panel.

Then persist dashboard chart choices through `DashboardCanvasItem.display` and `WindowContext.updateDashboardItem`. Use `paletteId` for built-in palettes, `seriesColors` for per-series overrides, and `customColors` for ordered palette colors when a chart has many categories or slices. Keep migration additive in `dashboardCanvasUtils.js`; old dashboard items should normalize to default appearance and continue rendering.

Then support non-dashboard chart windows using existing chart state. A user should be able to customize a chart window without pinning it first. If the existing chart state is not persisted across reload for normal windows, do not invent backend persistence; keep the behavior local and document that dashboard-pinned charts are the durable path.

Then make the design polished. The picker should offer a few refined preset palettes, a subtle custom color affordance, accessible contrast around selected swatches, keyboard/focus behavior, and an obvious reset-to-default action. It should avoid loud rainbow UI, huge panels, nested cards, or text-heavy explanation. The experience should feel like a professional chart authoring control inside an analytical workspace.

Finally verify that exports and AI Chat chart rendering still work. If `ChartComponentAI.jsx` is too separate to support full picker editing in this slice, preserve its current rendering and make sure pinned/opened dashboard charts can be customized. Do not broaden into a full AI artifact editing project unless the source structure makes it small and safe.

## Required Behavior

The picker must allow at least one built-in palette selection and per-series or per-slice color overrides for charts where multiple datasets or categories are visible.

Color choices must apply immediately to the rendered chart without requiring a reload.

Dashboard chart color choices must persist in `chartStudioDashboard:v1` and restore after reload.

Reset must return the chart to the app default palette without deleting the chart, slicers, layout, semantic configuration, or dashboard item metadata.

Dashboard slicers, chart-local slicer conflicts, chart type switching, semantic metric charts, raw field charts, pin-to-dashboard, and dashboard layout behavior must keep working.

The UI should remain subtle and modern. Antigravity can decide whether the picker appears in each chart window toolbar, dashboard item chrome, a chart settings popover, or another creative placement, as long as it is easy to find and does not clutter normal chart reading.

## Design Guidance

Prefer a small swatch-triggered popover with preset palette rows, compact individual swatches, and a custom color input for advanced edits. Use the app theme tokens for borders, focus, hover, and text. Keep rounded corners at the project’s normal radius and avoid decorative gradients or oversized panels.

Use color names only where they help accessibility or tooltips. The primary interaction should be visual swatches, not long text. Make selected states clear for keyboard users and make reset/close actions familiar.

Use balanced palettes suitable for business charts, including at least one app-default palette, one categorical palette, one sequential palette, and one higher-contrast palette. Do not make the whole UI read as a single purple/blue theme.

For pie and doughnut charts, apply custom colors across slices. For bar and line charts, apply colors by dataset where possible and by category only if the current Chart.js data shape supports it cleanly. If a chart type cannot safely support per-point colors, keep palette-level selection and avoid fragile special cases.

## Acceptance Checks

`npm --prefix frontend\frontend run build` passes.

`git diff --check` passes.

`python .codex/hooks/agent_harness_check.py` passes.

Manual browser checks must cover a normal chart window, a pinned dashboard chart, a semantic chart, and a pie or doughnut chart.

In the browser, choose a palette, override at least one series or slice color, switch chart types, apply a dashboard slicer, reload the app, and confirm dashboard chart colors persist with the chart still rendering correctly.

Open or render an AI Chat chart and confirm the existing AI chart path is not broken. If editable AI chart colors are not included, document that the first durable customization path is opening or pinning the chart.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully only after implementation and verification. Do not mark any frontend gate complete without user browser acceptance.

## Scope Control

This is a frontend-only chart authoring polish slice. If full coverage across every AI artifact, export surface, and chart renderer becomes too large, deliver the bounded core first: `SmartChartWindow`, `ChartComponent`, dashboard item persistence, and no regressions to AI chart rendering. Stop before adding backend work or broad artifact editing.
