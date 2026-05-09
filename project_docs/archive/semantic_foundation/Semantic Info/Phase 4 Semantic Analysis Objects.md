> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 4 Semantic Analysis Objects

## Summary
Phase 4 makes semantic metrics and semantic dimensions first-class analysis inputs in the frontend while preserving the existing dataset-first workflow. The semantic model and Phase 2 metric resolver remain the foundation. Raw dataset columns still work exactly as before, but users can now discover, select, and drag business definitions through the same general chart-building experience.

## How Semantic Metrics and Dimensions Are Now Surfaced in the UI
When a dataset is loaded, the UI now shows two parallel kinds of analysis inputs:

- Raw dataset columns
- Semantic business definitions

The main additions are:

### 1. Floating analysis input panel
`frontend/frontend/src/components/insights/FieldsPanel.jsx`

The old raw-only fields panel is now an `Analysis Inputs` panel that includes:

- `Business metrics`
- `Business dimensions`
- existing grouped raw fields (`Numeric`, `Temporal`, `Categorical`)

Semantic objects are:

- clearly labeled as `Metric` or `Dimension`
- visually differentiated from raw fields
- searchable alongside raw fields
- draggable through the same DnD system used for raw columns

This keeps the raw dataset workflow intact while making business definitions visible in the same discovery surface users already use.

### 2. Dataset exploration / semantic summary panel
`frontend/frontend/src/components/insights/SemanticModelPanel.jsx`

The semantic summary card now does more than summarize counts. Users can:

- click a semantic metric chip to open a semantic chart with that metric preselected
- click a semantic dimension chip to seed grouping into a semantic chart
- still use the existing `New semantic chart` action

This improves discoverability in the dataset exploration area without replacing existing dataset information content.

### 3. Chart builder / chart window
`frontend/frontend/src/features/charts/SmartChartWindow.jsx`

The chart window still supports both modes:

- `Raw fields`
- `Semantic objects`

Semantic mode now feels more native because the chart builder can:

- select semantic metrics and dimensions from dropdowns
- accept dragged semantic objects from the analysis panel
- display semantic-specific drop targets inside the chart window
- switch a chart into semantic mode when a semantic object is dropped onto it

## Components Modified or Introduced
### Modified
- `frontend/frontend/src/App.jsx`
  - Extended the global drag-end handler so semantic drags can populate chart semantic config.
  - Preserved the raw field drop logic.
- `frontend/frontend/src/components/insights/DatasetInfo.jsx`
  - Semantic chart creation now accepts seeded metric or dimension selections.
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
  - Upgraded from raw-only field discovery to combined raw + semantic analysis input discovery.
- `frontend/frontend/src/components/insights/FieldsPanel.css`
  - Added styling for semantic analysis objects and mixed-source panel presentation.
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
  - Added semantic object quick-start chart interactions.
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
  - Added button-like chip styling for semantic object chart seeding.
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
  - Added semantic drag/drop targets and more explicit semantic chart builder controls.

### Added
- `frontend/frontend/src/utils/semanticObjectUtils.js`
  - Normalizes semantic metrics and dimensions for UI labels, search, drag payloads, and type mapping.

## How Semantic Objects Integrate With Existing Field Selection and Chart Workflows
The integration is additive and follows the current UX rather than introducing a separate chart engine.

### Field selection
The analysis input panel now contains both:

- raw columns for dataset-first analysis
- semantic metrics and semantic dimensions for business-first analysis

Users can search both kinds in one place.

### Drag-and-drop chart creation
The existing drag-and-drop column workflow is still unchanged for raw charts.

New behavior:

- dragging a raw field still maps to X/Y chart roles exactly as before
- dragging a semantic metric or dimension now targets semantic chart roles
- dropping a semantic metric on a chart sets `semanticConfig.metricId`
- dropping a semantic dimension on a chart sets `semanticConfig.groupBy`
- charts can move into semantic mode through that drop interaction without affecting raw mapping state

### Click-to-start semantic charting
The dataset semantic panel provides a lower-friction chart entry point by letting users click inferred metrics or dimensions directly.

## How Backward Compatibility Was Maintained
Backward compatibility was preserved intentionally:

- Raw field drag-and-drop behavior was not removed or rewritten.
- Chart rendering still uses the existing chart window and `ChartComponent`.
- Raw chart mappings still use the same `mapping['X-Axis']` and `mapping['Y-Axis']` structure.
- Semantic chart state remains isolated in `dataSourceMode` and `semanticConfig`.
- Existing cleaning, AI, exports, filters, and dataset preview flows were left operational.
- Semantic additions do not remove any dataset-first UI or paths.

The result is that users can now build charts in either style:

- raw column first
- business definition first

## How Charts Resolve Semantic Metrics Through the Resolver
Semantic charts continue using the Phase 3 integration with the Phase 2 resolver.

`frontend/frontend/src/features/charts/SmartChartWindow.jsx` still calls:

- `POST /api/semantic-metrics/resolve`

The request continues to send:

- `metric_id`
- optional `group_by`
- active dataset rows
- the semantic model
- sorting instructions

The resolver response is still transformed by:

- `frontend/frontend/src/utils/semanticChartUtils.js`

The chart is still rendered by the existing chart rendering stack, so Phase 4 improves selection and discoverability rather than replacing rendering infrastructure.

## Files Modified or Added
### Modified
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/insights/DatasetInfo.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.css`
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`

### Added
- `frontend/frontend/src/utils/semanticObjectUtils.js`

## Validation
Frontend build completed successfully:

- `npm --prefix frontend/frontend run build`

The build still reports pre-existing warnings in unrelated files such as `CanvasContainer.jsx`, `MenuBar.jsx`, `WindowContext.jsx`, workflow files, and other existing components, but the Phase 4 implementation compiled successfully.

## Remaining Limitations
This phase keeps the work incremental and safe, so some limits remain:

- Semantic charts still support one metric and one optional grouping dimension at a time.
- Semantic dimensions can seed grouping, but there is not yet a richer semantic composition workflow across multiple roles.
- The chart engine is still primarily organized around raw chart types rather than semantic chart templates.
- Semantic filtering and semantic-first recommendations are not yet integrated into broader exploration workflows.
- AI-generated chart flows still do not prefer semantic business definitions by default.

## Future Phase Opportunities
Later phases could build on this work by:

- adding semantic-first chart recommendations
- supporting multi-metric semantic charting
- introducing semantic-aware filtering and drill paths
- surfacing business terms and relationships alongside metrics and dimensions
- making AI chart generation semantic-first when a semantic model is available
