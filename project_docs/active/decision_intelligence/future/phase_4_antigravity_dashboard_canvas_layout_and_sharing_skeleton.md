# Future Reference - Antigravity Dashboard Canvas Layout And Sharing Skeleton Handoff

This file is retained as a deferred dashboard handoff. It is not an active Antigravity prompt.

Automation note: this file is intended for Antigravity's `auto-handoff-execution` skill. The `Goal:` line below is the execution prompt.

Goal: Implement the dashboard canvas layout and sharing skeleton so pinned charts and KPI cards can be arranged, resized, locked, persisted locally, sliced in view mode, and prepared for future sharing without adding real authentication or backend sharing APIs.

## Active Documentation To Read First

Read these files before editing source:

`project_docs/INDEX.md`

`project_docs/active/README.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/active/decision_intelligence/future/phase_4_dashboard_canvas_layout_and_sharing_skeleton_plan.md`

`project_docs/active/contracts/dashboard_canvas_state.md`

`project_docs/active/contracts/decision_objects.md`

## Ownership And Constraints

Antigravity owns the React/CSS implementation, browser verification, frontend build, and frontend status update. Codex owns backend truth, contracts, architecture, review, and handoff coordination.

Do not change backend APIs for this slice. Do not implement real authentication, team permissions, invite flows, backend dashboard persistence, or actual share links. Sharing is a local-only skeleton that makes the later auth/share phase easier.

Keep the existing charting and slicer behavior intact. Dashboard slicers and chart-local slicers still combine with intersection logic, and slicer conflicts must still render on the affected chart.

Use the existing `chartStudioDashboard:v1` local-first persistence as the base. If a state migration is needed, make it non-destructive and preserve old dashboard data where possible.

Use `project_docs/active/contracts/dashboard_canvas_state.md` as the source of truth for the local state shape, migration rules, and invariants. Do not invent a different persisted shape unless you update that contract and explain why.

The frontend already has `react-grid-layout` in `frontend/frontend/package.json`. Prefer it for grid layout, drag, resize, and responsive behavior unless source review shows a better existing local pattern. Do not hand-roll drag and resize behavior unless there is a concrete blocker.

## Target Files To Inspect First

`frontend/frontend/src/context/WindowContext.jsx`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/features/dashboard/DashboardCommandBar.jsx`

`frontend/frontend/src/features/dashboard/DashboardCommandBar.css`

`frontend/frontend/src/features/dashboard/DashboardSlicerPanel.jsx`

`frontend/frontend/src/features/dashboard/DashboardSlicerPanel.css`

`frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`

`frontend/frontend/src/features/dashboard/KpiCardWindow.css`

`frontend/frontend/src/features/charts/SmartChartWindow.jsx`

`frontend/frontend/src/features/charts/SmartChartWindow.css`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/utils/dashboardFilterUtils.js`

Create new dashboard-specific files if they make the implementation cleaner. Likely candidates are a dashboard canvas component, dashboard canvas item wrapper, dashboard layout utilities, and a sharing skeleton panel. Keep naming clear and local to `features/dashboard/` unless a shared utility is genuinely needed.

## Product Goal

The dashboard should feel like a flexible canvas workspace rather than a stack of loose windows. A user should be able to pin or create visuals, place them where they want, resize them to fit the story, lock the layout, switch to view mode, keep using slicers, reload the app, and see the same arrangement restored.

The experience should have two clear modes.

Edit mode is for authoring. Users can move visuals, resize them, duplicate if supported safely, remove visuals, lock individual visuals or the full layout, and open item settings where the existing chart/KPI configuration already supports it.

View mode is for consuming and sharing. Visuals stay fixed. Slicers remain available because filtering is part of dashboard reading, not layout editing. The dashboard should still show active slicer state and conflict states clearly.

Sharing skeleton means users can see and edit share-ready metadata, but the app must not pretend real sharing exists. Use copy such as local draft, sharing not connected, permissions coming later, or similar product language that is clear without being noisy.

## Required State Model

Extend dashboard persistence so every dashboard item can carry layout metadata. Use an additive shape that safely normalizes older `chartStudioDashboard:v1` items that do not have layout yet.

The authoritative field list is in `project_docs/active/contracts/dashboard_canvas_state.md`. The summary below is included for convenience, but the contract wins if wording differs.

Dashboard-level state should support at least:

`mode`: `edit` or `view`.

`canvas`: grid settings such as columns, row height, margin, compact behavior, and layout version.

`sharing`: local-only skeleton metadata such as owner label, visibility status, intended recipients, team placeholders, share notes, last exported/shared timestamp, and a clear flag that real sharing is not enabled.

Dashboard item state should support at least:

`layout`: item grid coordinates and dimensions, such as `x`, `y`, `w`, and `h`.

`locked`: whether the item can move or resize in edit mode.

`title`: display title.

`display`: local visual preferences that are safe to persist, such as compact header, show legend where supported, or presentation size if already supported by existing chart components.

`sourceMetadata`: enough local metadata to distinguish AI Chat, chart window, dashboard-created, semantic, or raw source when available.

Do not break existing dashboard items. Normalize missing layout by assigning deterministic default positions that avoid stacking all visuals on top of each other.

## Required UI Behavior

Add a dashboard canvas area under the command surface. It should reserve space for dashboard chrome and slicers; do not rely on random absolute overlays that cover charts.

Pinned charts from AI Chat and chart windows should become canvas items with layout metadata immediately. New dashboard charts and KPI cards should also become canvas items.

Edit mode should make move/resize affordances clear but not visually chaotic. Use handles, subtle outlines, or a toolbar pattern that fits the app. Avoid a design where every chart looks like a modal piled on another modal.

View mode should hide layout controls and keep charts readable. Slicers should remain accessible without unlocking the dashboard.

The command bar should expose mode switching, Add Chart, Add KPI, Slicers, Share or Share Draft, and a clear layout lock state. Exact wording and visual treatment are open to Antigravity's design judgment as long as the workflow is obvious.

The slicer panel can remain a rail or drawer, but it must not cover essential controls or make the canvas impossible to inspect. If it overlays on small screens, the behavior should be intentional and reversible.

The sharing skeleton should be visibly future-facing. It can be a panel, drawer, modal, or command bar popover. It should let users prepare metadata like dashboard description, owner label, intended people/team labels, and notes. It should clearly state that real permission enforcement and live sharing are not active in this slice.

## Suggested Implementation Order

Start by normalizing dashboard state and layout metadata in `WindowContext.jsx`. This makes the rest of the UI predictable.

Then introduce a canvas renderer around existing `SmartChartWindow` and `KpiCardWindow` dashboard items. Preserve existing chart and KPI internals as much as possible.

Then add edit/view mode and lock behavior. Keep this simple at first; the goal is reliable placement and resizing, not every advanced layout command.

Then wire pin-to-dashboard and add chart/KPI flows so newly added items receive sensible default layout rectangles.

Then add the sharing skeleton UI and local metadata persistence.

Finally, polish empty states, responsive behavior, and browser verification.

## Suggested Component And Utility Breakdown

This breakdown is guidance, not a mandate. Use it if it fits the existing code better than alternatives.

`DashboardCanvas.jsx` can own the `react-grid-layout` or `ResponsiveGridLayout` integration. It should receive dashboard items, dashboard mode, dashboard filters, and item actions from context or props, then render charts and KPI cards inside grid cells.

`DashboardCanvasItem.jsx` can provide consistent item chrome: item title, locked state indicator, edit-mode handles, duplicate/remove actions, and any per-item settings entry point. It should avoid wrapping cards in decorative nested cards. The item wrapper should feel like canvas workspace chrome, not a second modal.

`DashboardShareSkeleton.jsx` can own local-only sharing metadata. It should support description, owner label, intended people/team labels, visibility placeholder, and share notes. It must clearly communicate that real sharing, permissions, auth, and live links are not connected yet.

`dashboardCanvasUtils.js` can hold pure helpers such as `normalizeDashboardCanvasState`, `normalizeDashboardItemLayout`, `createDefaultDashboardLayout`, `findNextCanvasSlot`, and `normalizeSharingMetadata`. Keep migration and layout math testable and separate from React rendering where practical.

`WindowContext.jsx` should remain the source of dashboard state updates. Add small actions for dashboard mode, canvas settings, sharing metadata, item layout updates, item lock toggles, and item duplication only if duplication is implemented safely.

## Migration And Default Layout Guidance

Existing dashboard items may not have `layout`, `locked`, `display`, or `sourceMetadata`. Normalize them on load without deleting old fields.

Default item placement should be deterministic. Do not place every migrated chart at `x: 0, y: 0`. A simple first pass can place items in rows, such as two medium cards per row on desktop and one per row on narrow layouts. Prefer grid coordinates compatible with `react-grid-layout`.

New pinned charts should receive a useful default size, such as a medium chart area. KPI cards should receive a smaller default rectangle. The exact grid units are Antigravity's choice, but charts and KPIs should not start as identical sizes if that makes the dashboard feel careless.

Local persistence should still write one versioned dashboard object. If the state shape changes, include a layout version or migration marker inside the dashboard state so later migrations are possible.

Do not remove the old `businessMonitoringDashboard` fallback behavior if it still exists. Do not destructively clear `chartStudioDashboard:v1` when parsing or migration fails.

## Existing Behavior To Preserve

The Dashboard destination must still render existing dashboard charts and KPI cards.

Add Chart, Add KPI, Pin to Dashboard from AI Chat, and Pin to Dashboard from chart windows must still create visible dashboard items.

Raw chart mapping, semantic chart configuration, KPI configuration, dashboard slicers, chart-local slicer conflicts, and local persistence must continue to work.

Window minimization, locking, and removal behavior should not leave stale minimized or locked state for deleted dashboard items.

The dashboard command bar and slicer panel should remain discoverable. If their layout changes to support the canvas, the result should feel more stable than the current overlay approach.

## Sharing Skeleton Copy And Behavior

Use honest product language. Good examples are `Sharing draft`, `Local sharing setup`, `Permissions are not connected yet`, and `Authentication will be added in a later phase`.

Avoid labels that imply a working network feature, such as `Invite sent`, `Public link copied`, `Team access granted`, or `Shared with organization`.

The sharing skeleton should store metadata locally, reload correctly, and be easy to extend later. It should not call a backend endpoint or create fake share links.

## Acceptance Checks

`npm --prefix frontend\frontend run build` passes.

`git diff --check` passes.

`python .codex/hooks/agent_harness_check.py` passes.

State normalization and migration behavior matches `project_docs/active/contracts/dashboard_canvas_state.md`.

Manual browser checks must cover:

Create or pin at least two visuals onto the dashboard canvas.

Move both visuals in edit mode.

Resize both visuals in edit mode.

Lock at least one visual or lock the layout, then confirm it cannot be accidentally moved.

Switch to view mode and confirm layout controls are hidden while slicers remain usable.

Apply a dashboard slicer and confirm pinned charts/KPIs update.

Trigger or verify chart-local slicer conflict behavior still renders on the affected chart.

Reload the app and confirm layout, dashboard items, slicers, mode, lock state, and sharing skeleton metadata persist locally.

Open the sharing skeleton and confirm it does not imply real authentication, real permission enforcement, or live sharing.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully after implementation. Do not mark this phase complete unless browser behavior has been accepted by the user.

## Room For Design Judgment

You may choose the exact command layout, icon set, edit handles, canvas spacing, sharing skeleton surface, and visual polish. Keep the experience professional and dashboard-oriented: dense enough for repeated business use, clear enough for personal users, and not styled like a marketing page.

If any part of this handoff is too large to implement safely in one pass, stop before broadening scope and report the proposed slice breakdown. The first acceptable fallback is a working canvas foundation with edit/view mode, local layout persistence, and slicer access, followed by a separate sharing skeleton pass.
