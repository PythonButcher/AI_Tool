# Phase 1 UI Shell Refactor

## What changed

- Replaced the old dropdown-heavy top bar with a ribbon-style shell in `Home`, `Explore`, `Visualise`, `Business`, `AI`, `Dashboard`, and `Settings` tabs.
- Added a left workflow rail with sliding drawers for `Data`, `Explore`, `Visualise`, `Business`, `AI`, `Dashboard`, and `Whiteboard`.
- Moved the old floating `FieldsPanel` into the `Explore` drawer and refactored it into a docked field explorer.
- Split the field explorer into:
  - `Raw Fields`
  - `Business Fields`
- Preserved the existing drag payloads for raw fields and semantic objects so chart building and KPI/dashboard drops still use the same contracts.
- Kept theme support intact by reusing the app’s existing CSS variables and light/dark mode colors.

## How to use it

1. Use the ribbon tabs to switch top-level workflows and reveal grouped commands.
2. Use the left workflow rail to open the drawer for the task you are working on.
3. Open `Explore` to search fields and drag from either `Raw Fields` or `Business Fields`.
4. Open `Visualise` to launch the chart gallery or quick-add a chart window.
5. Open `Business`, `AI`, or `Dashboard` for the Phase 1 shell placements of semantic, AI, and dashboard actions.

## Phase 1 boundaries

- This phase focuses on shell/layout refactoring and wiring only.
- Existing dataset loading, field dragging, chart creation, dashboard toggling, and theme switching were preserved.
- Deeper semantic workflow expansion, richer AI behavior, and fuller dashboard management remain deferred to later phases.
