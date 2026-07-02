# Phase 4 - Dashboard Canvas Layout And Sharing Skeleton Plan

## Purpose

Create a future dashboard workspace that feels more flexible than a traditional business intelligence dashboard without becoming a full collaboration platform yet. Users should be able to place charts and KPI cards on a canvas, resize them, pin them in place, keep slicers available for live exploration, and prepare dashboards for later sharing with people or teams.

This is the active implementation plan for the next dashboard slice. It builds on the completed charting and slicer work.

## Current Gate

Status: active; Antigravity frontend implementation handoff is needed.

Backend readiness target: no backend route or authentication work is required for the first slice. The implementation should use local-first dashboard state and preserve the existing `chartStudioDashboard:v1` persistence model.

Contract target: `project_docs/active/contracts/dashboard_canvas_state.md` defines the local dashboard canvas state, item layout metadata, sharing skeleton metadata, migration rules, and invariants for this slice.

Frontend readiness target: Antigravity implements the dashboard canvas, edit/view modes, layout persistence, item lock behavior, slicer access in view mode, and sharing skeleton metadata/UI placeholders. Codex must not edit frontend files unless the user explicitly authorizes Codex frontend edits in a future session.

Completion target: `npm --prefix frontend\frontend run build`, `git diff --check`, `python .codex/hooks/agent_harness_check.py`, and user browser acceptance pass. Browser acceptance remains user-controlled.

## Product Direction

The dashboard should become a canvas-like workspace, not only a list of chart windows. A user should be able to create or pin a visual, move it where it belongs, resize it to match the story they want to tell, and then lock the layout when the dashboard is ready to present.

Slicers should remain available after visuals are pinned. A locked dashboard should still allow slicer changes because filtering is part of dashboard use, not layout editing. The user should be able to switch between an edit mode for arranging visuals and a view mode for reading and slicing the dashboard.

Sharing should start as a skeleton. The first slice should define dashboard metadata, ownership placeholders, share target placeholders, and export/share-ready state, but it should not implement authentication, permissions, teams, invites, or backend account storage. Those belong in a later phase.

## Core Experience

The dashboard opens into a workspace with a persistent command surface, a slicer rail or drawer, and a canvas area. Charts and KPI cards live as canvas items with stable layout metadata. In edit mode, users can drag, resize, align, duplicate, remove, and lock items. In view mode, items stay fixed and the user interacts mainly with slicers, chart tooltips, dashboard actions, and presentation/export controls.

Pinned visuals should keep their chart spec, source metadata, slicer behavior, title, layout rectangle, and display settings. Pinning should not only add a chart to a generic list; it should create a dashboard item that can be placed and sized.

The first version can use local-first persistence. A later backend phase can sync dashboard definitions, sharing metadata, and saved versions once authentication and team concepts exist.

## Suggested State Shape

Extend the versioned dashboard state with layout and sharing-ready metadata while keeping the current local-first model.

The authoritative local state contract is `project_docs/active/contracts/dashboard_canvas_state.md`. Use that contract when implementing normalization, migration, persistence, and acceptance checks.

Dashboard state should include a dashboard id, name, description, mode, canvas settings, dashboard slicers, item ids, layout version, and sharing metadata placeholders. Each dashboard item should include its id, item type, chart spec or KPI config, source metadata, local slicers, layout rectangle, locked state, title, display options, and timestamps.

The layout rectangle should store grid coordinates or pixel coordinates consistently. Prefer grid coordinates if the app wants snap-to-grid behavior and responsive layouts. Store enough information to restore the same dashboard after reload.

Sharing metadata should be intentionally non-functional at first. It can include fields like owner label, visibility state, intended recipients, team placeholders, share status, and last exported timestamp. Do not imply real access control until backend auth exists.

## Implementation Slices

The first slice should create canvas layout behavior only. It should add edit and view modes, drag/resize support, item lock state, local persistence, and reload restoration. It should not add sharing controls beyond disabled or skeleton metadata.

The second slice should improve dashboard authoring controls. It should add duplicate, align, bring forward/send backward if needed, title editing, item settings, and stronger empty states.

The third slice should add the sharing skeleton. It should expose a share-ready panel with disabled or local-only controls for owner, intended recipients, visibility, export/share notes, and future backend requirements. It should clearly say that real sharing and permissions are not active yet.

The fourth slice should add review and export polish after the canvas is stable. This can include a presentation mode, dashboard summary metadata, and a share/export preview.

## Technical Constraints

Do not implement real authentication, team permissions, invite flows, or backend dashboard storage in the first version. Do not change the backend chart spec contract unless a backend slice explicitly owns that change.

Keep slicer behavior compatible with the Phase 3 contract. Dashboard slicers and chart-local slicers still combine through intersection logic. A chart with conflicting slicers should show a chart-local empty state that names both sides of the conflict.

Use an existing proven React drag/resize library if the project already has one or if adding one is acceptable in the implementation session. Do not hand-roll drag physics or resizing behavior unless the dependency choice is blocked.

## Acceptance Checks

The dashboard can enter edit mode, move and resize at least two pinned visuals, lock the layout, switch to view mode, apply slicers, reload the app, and restore the layout.

Pinned charts from chart windows and AI Chat become canvas items with layout metadata. Slicers remain accessible and do not require unlocking the dashboard.

The sharing skeleton is visibly future-facing and does not pretend real authentication or permissions exist.

Build must pass with `npm --prefix frontend\frontend run build`, `git diff --check`, and the project harness. Browser acceptance is required before this future slice can be called complete.
