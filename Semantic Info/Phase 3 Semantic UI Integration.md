# Phase 3 Semantic UI Integration

## Summary
Phase 3 introduces the first frontend-visible semantic integration without replacing the existing dataset-first workflows. Users can now see inferred business definitions for the active dataset and can create charts that resolve semantic metrics through the centralized Phase 2 metric resolver endpoint.

## Frontend Components Updated or Added
### Updated components
- `frontend/frontend/src/components/insights/DatasetInfo.jsx`
  - Now renders a semantic summary panel above the existing dataset overview and statistical content.
  - Adds a `New semantic chart` entry point that opens a chart window directly in semantic mode.
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
  - Now supports two chart input modes:
    - `raw` mode for the existing field-drop workflow
    - `semantic` mode for semantic metric + optional grouping dimension selection
  - Calls the Phase 2 metric resolver when semantic mode is active and a metric has been selected.
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
  - Passes semantic chart state into chart windows.
  - Shows semantic chart windows with a semantic-aware title so the new mode is visible in the canvas.
- `frontend/frontend/src/context/WindowContext.jsx`
  - Extends chart window state with additive semantic properties:
    - `dataSourceMode`
    - `semanticConfig`
- `frontend/frontend/src/context/DataContext.jsx`
  - Exports `normalizeDatasetRows` so semantic charting can use the same dataset normalization behavior as the rest of the frontend.

### New components and utilities
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
  - New summary card for semantic entities, dimensions, metrics, dataset grain, and chart entry point.
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
  - Styling for the semantic summary card.
- `frontend/frontend/src/utils/semanticChartUtils.js`
  - Converts resolver responses into Chart.js-ready datasets.
  - Formats semantic summary values for the chart status copy.

## How Semantic Metrics Are Now Visible in the UI
When a dataset is loaded, the existing dataset information area now includes a `Business Definitions` panel. That panel shows:
- inferred entity count
- inferred dimension count
- inferred metric count
- dataset name and grain
- sample semantic metrics
- sample semantic dimensions

This makes the semantic layer visible immediately after dataset load, even before the user opens any chart builder.

## How the Frontend Interacts with the Phase 2 Metric Resolver
Semantic chart mode in `SmartChartWindow.jsx` calls:
- `POST /api/semantic-metrics/resolve`

The frontend sends:
- `metric_id`
- optional `group_by`
- the active dataset rows
- the semantic model from `DataContext`
- a sort preference

The resolver response is converted into Chart.js data using `buildSemanticChartData()` in `semanticChartUtils.js`. The resulting chart is rendered by the existing `ChartComponent`, so semantic charts reuse the current chart rendering stack rather than introducing a second visualization system.

## Backward Compatibility Decisions
To keep this phase low-risk and additive:
- Raw field drag-and-drop charting was left intact.
- Existing chart mappings still use `mapping['X-Axis']` and `mapping['Y-Axis']` exactly as before.
- Semantic charting is opt-in through a separate `dataSourceMode` on chart state.
- Existing cleaning, filtering, analysis, export, and AI flows were not refactored.
- The semantic model summary was added to the current dataset information UI instead of replacing existing field or preview components.
- Semantic charts still render through the same chart window and `ChartComponent` used by raw charts.

## How Semantic Charting Works Beside Column-Based Charting
Each chart window now has two modes:
- `Raw fields`
  - Existing workflow.
  - Users drag dataset columns to X and Y roles.
- `Semantic metric`
  - New workflow.
  - Users choose a semantic metric and optional semantic dimension from dropdown controls.
  - The chart window resolves business-level data through the centralized backend metric resolver.

Because the chart window state now stores `dataSourceMode` and `semanticConfig` separately from `mapping`, raw-column and semantic chart definitions can coexist without interfering with each other.

## Files Modified or Added
### Modified
- `frontend/frontend/src/components/insights/DatasetInfo.jsx`
- `frontend/frontend/src/components/insights/DatasetInfo.css`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/context/DataContext.jsx`
- `frontend/frontend/src/context/WindowContext.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`

### Added
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
- `frontend/frontend/src/utils/semanticChartUtils.js`

## Validation
A production frontend build completed successfully with warnings only:
- `npm --prefix frontend/frontend run build`

The warnings were existing general lint warnings in the project and did not block the build.

## Current Limitations
This phase intentionally stops short of replacing the dataset-first UI.

Current limitations:
- Field selectors and the floating fields panel still expose raw dataset columns only.
- Semantic dimensions are selectable in the chart window, but not yet draggable as first-class semantic objects.
- Semantic charts currently support a single metric and one optional grouping dimension at a time.
- Semantic mode is chart-window scoped and does not yet flow into every chart creation surface.
- Semantic chart suggestions are inferred from the existing semantic model and are not yet ranked or recommended by business intent.

## Future Phase Considerations
Later phases can build on this work by:
- adding semantic objects directly into field selectors and drag/drop surfaces
- enabling multi-metric semantic charting
- using business terms and relationships in chart recommendations
- allowing AI chart generation to target semantic metrics first
- expanding semantic-aware filtering and dashboard composition
