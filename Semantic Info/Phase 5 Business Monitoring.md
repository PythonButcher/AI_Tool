# Phase 5 Business Monitoring

## Summary
Phase 5 introduces the first business monitoring workflow on top of the semantic BI foundation built in Phases 1 through 4. Users can now create KPI cards driven by semantic metrics, place KPI cards and charts together on a persistent dashboard canvas, and apply shared dashboard-global filters that update all dashboard items together.

The implementation stays additive. Existing dataset-first exploration, raw chart creation, floating chart windows, and semantic chart workflows continue to work as before.

## What Phase 5 Introduced

### 1. KPI cards driven by the semantic metric resolver
A new dashboard KPI card component was added:

- `frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.css`

KPI cards now:

- resolve a semantic metric through `POST /api/semantic-metrics/resolve`
- display a large formatted business value
- support selection of a semantic metric from the inferred semantic model
- support drag-and-drop of semantic metrics from the Analysis Inputs panel
- optionally compare the current value to the previous period when the dashboard has a valid global date filter

Comparison logic reuses the existing resolver. The KPI card issues a second resolver request using a shifted previous-period date range instead of adding a separate KPI aggregation path.

### 2. Dashboard canvas on the existing window/layout system
Phase 5 introduces a dashboard layer on top of the current canvas and window architecture instead of replacing it.

Primary changes:

- `frontend/frontend/src/context/WindowContext.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/MenuBar.css`

The dashboard now has:

- persistent dashboard state
- persistent dashboard item definitions
- dashboard KPI items
- dashboard chart items
- dashboard visibility controls from the main menu bar
- reuse of the existing `WindowFrame` layout and resize behavior for dashboard items

Dashboard items are rendered as stable windows inside the existing canvas, which means KPI cards and charts can live together in one saved arrangement without disrupting exploratory windows.

### 3. Global dashboard filters
A new dashboard filter bar was added:

- `frontend/frontend/src/features/dashboard/DashboardFilterBar.jsx`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.css`
- `frontend/frontend/src/utils/dashboardFilterUtils.js`

Global dashboard filters now support:

- a shared date dimension
- shared start and end dates
- shared dimension filters with selectable values

The filter bar is orchestration only. It does not introduce a new metric engine.

Semantic dashboard items use the existing resolver filter contract. Raw dashboard charts apply the same dashboard filters on the frontend before local chart aggregation. This keeps semantic and raw workflows compatible while still giving the user one dashboard-level filter experience.

## How KPI Cards Work

KPI cards are semantic-first dashboard items.

### Configuration
Users can create KPI cards from:

- the Business Definitions panel in `DatasetInfo`
- the dashboard toolbar
- direct metric drops from the semantic Analysis Inputs panel

### Data resolution
Each KPI card sends the selected semantic metric plus current dashboard filters to:

- `POST /api/semantic-metrics/resolve`

The card uses the returned semantic summary value as the primary KPI value.

### Comparison behavior
If the dashboard has:

- a selected temporal dimension
- a start date
- an end date

then the KPI card computes a previous-period filter range and makes a second resolver request. The card then shows:

- previous-period value
- absolute change
- percent change when possible

If there is no usable global date filter, the KPI card remains valid and simply omits the comparison result.

## How Dashboard Canvas And Layout Work

Phase 5 does not add a separate page-level dashboard builder. Instead, it extends the current canvas into a business monitoring surface.

### Dashboard state
Dashboard state now lives in:

- `frontend/frontend/src/context/WindowContext.jsx`

It stores:

- dashboard metadata
- dashboard visibility
- dashboard-global filters
- dashboard item definitions for KPI cards and dashboard charts

### Layout persistence
The dashboard reuses the existing window layout persistence already stored in local state/local storage for positions and sizes. Dashboard item definitions are also stored in local storage so users can reopen the same dashboard later.

### Item types
Dashboard canvas items can now be:

- KPI cards
- dashboard charts

Dashboard charts reuse:

- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`

This means the dashboard can host either:

- raw-field charts
- semantic charts

without needing a second chart engine.

## How Global Filters Interact With The Resolver

Global filters are translated by:

- `frontend/frontend/src/utils/dashboardFilterUtils.js`

### Semantic dashboard items
For semantic charts and KPI cards, the dashboard filter state is converted into resolver-compatible filters and passed into:

- `POST /api/semantic-metrics/resolve`

This keeps semantic execution centralized in the existing backend metric resolver.

### Raw dashboard charts
For raw dashboard charts, the same dashboard filter state is applied to the active dataset rows in the frontend before chart aggregation occurs. This preserves backward compatibility with raw chart behavior while still making raw charts participate in dashboard-global filters.

## Files Modified Or Added

### Modified
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/insights/DatasetInfo.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/MenuBar.css`
- `frontend/frontend/src/context/WindowContext.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`

### Added
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.jsx`
- `frontend/frontend/src/features/dashboard/DashboardFilterBar.css`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.css`
- `frontend/frontend/src/utils/dashboardFilterUtils.js`
- `Semantic Info/Phase 5 Business Monitoring.md`

## How Backward Compatibility Was Preserved

Backward compatibility was maintained deliberately:

- existing raw-field chart windows still work
- existing semantic chart windows still work
- dataset upload, cleaning, preview, filtering, AI, and export flows were not replaced
- the backend metric resolver remains the only semantic metric execution path
- no new KPI-specific backend aggregation route was introduced
- dashboard items are additive and separate from exploratory chart windows

The result is that the application now supports both:

- exploratory analysis workflows
- business monitoring workflows

without forcing one to replace the other.

## Validation

Validation completed:

- `npm --prefix frontend/frontend run build`

Build result:

- production frontend build succeeded
- warnings remained in pre-existing unrelated files such as `WindowFrame.jsx`, `RawDataViewer.jsx`, whiteboard/workflow files, and `useWindowInteraction.js`
- no new build-blocking errors remained after Phase 5 integration fixes

## Remaining Limitations

This phase intentionally stops at first-useful dashboard monitoring.

Current limitations:

- dashboard persistence is frontend-local rather than backed by a dedicated backend dashboard store
- KPI cards currently support one semantic metric at a time
- previous-period comparison depends on a valid global date range
- dashboard charts are window-based rather than grid-snapped BI tiles
- alerts, subscriptions, drill-through, reporting pipelines, and AI explanations are not part of this phase

## Result

With Phase 5 complete, the application now supports the first real BI monitoring loop:

- load data
- infer or use semantic business definitions
- create KPI cards and charts
- monitor them together on a persistent dashboard canvas
- update the full dashboard through shared global filters

This is the point where the product starts behaving like a lightweight BI platform instead of only an analysis workspace.
