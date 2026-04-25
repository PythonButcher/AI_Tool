# Phase 2: Centralized Semantic Metric Resolution

## Phase Goal

Phase 2 adds a backend metric resolution layer that can execute semantic metric definitions against the dataset currently active in the application, while preserving the existing dataset-first behavior everywhere else.

This phase does **not** migrate charts, AI flows, dashboards, exports, or reports to semantic execution yet. It establishes the shared backend capability and stable API surface those features can adopt in later phases.

## What Was Introduced

### 1. Shared dataset resolution layer

A new backend service was added at `backend/services/dataset_context.py`.

This service centralizes dataset lookup for semantic execution and related backend features. It can resolve:

- the current active in-memory dataset already used by the application
- an inline dataset payload supplied directly to an API request
- a dataset stored in Data Hub by dataset reference

It also centralizes the logic for:

- choosing cleaned data over uploaded data when appropriate
- loading warehouse-backed files from Data Hub
- inferring or reusing a semantic model for the resolved dataset

This gives the metric layer a single place to obtain a dataframe and the semantic model that describes it.

### 2. Centralized metric resolver service

A new backend service was added at `backend/services/metric_resolver.py`.

This is the main architectural capability introduced in Phase 2.

The resolver can now accept:

- a semantic metric definition, or a metric ID/name resolved from the semantic model
- a dataset reference or inline dataset
- an optional semantic model override
- grouping dimensions
- filter constraints
- basic sort and limit controls

The service resolves the request into a consistent result structure containing:

- resolved metric metadata
- dataset/source metadata
- normalized grouping definitions
- normalized filters
- aggregated rows
- summary values
- chart-ready label/value arrays
- execution metadata describing the resolved expression and aggregation

### 3. Stable semantic metric API endpoint

A new route module was added at `backend/routes/semantic_metrics.py` and registered in `backend/app.py`.

New endpoint:

- `POST /api/semantic-metrics/resolve`

This endpoint exposes the centralized metric execution service without changing any existing charting or AI endpoints.

It is intended as the future integration point for:

- semantic chart generation
- reusable dashboard KPI cards
- reporting pipelines
- export summaries
- AI reasoning over business metrics

### 4. Shared active-dataset helper reuse for semantic model routes

`backend/routes/semantic_model.py` now uses the shared active dataset resolver from `backend/services/dataset_context.py`.

This keeps the semantic model route aligned with the same dataset selection logic used by the new metric execution layer.

## Where Metric Resolution Logic Lives

Primary execution logic lives in:

- `backend/services/metric_resolver.py`

Dataset lookup and dataset/semantic model pairing live in:

- `backend/services/dataset_context.py`

API access lives in:

- `backend/routes/semantic_metrics.py`

## How It Interacts With The Phase 1 Semantic Model

Phase 1 introduced inferred semantic metrics whose expressions look like this conceptually:

- expression type: `column_aggregation`
- source column: dataset field
- default aggregation: `sum`, `avg`, and similar inferred choices

Phase 2 now executes those semantic metric definitions instead of treating them as descriptive metadata only.

Current supported semantic execution patterns include:

- column aggregation metrics inferred in Phase 1
- aggregations such as `sum`, `avg`/`mean`, `min`, `max`, `count`, and distinct count aliases
- grouping by semantic dimensions or direct field references
- request-level filters and metric-level filters
- active dataset execution or Data Hub dataset execution

This means a metric defined once in the semantic model can now be resolved into results consistently by a shared backend service.

## Current Application Behavior That Remains Unchanged

This phase intentionally preserves all existing dataset-first behavior.

The following paths were **not** migrated to the new resolver yet:

- standard frontend chart building still computes from raw rows in `frontend/frontend/src/utils/chartDataUtils.jsx`
- smart chart windows still map raw fields directly
- NLP charting still uses `backend/nlp_engine/chart_builder.py`
- AI `/charts` commands still use their current model-driven aggregation behavior
- `analysis.py` endpoints still compute summaries directly from the uploaded dataframe
- exports still serialize the cleaned dataset exactly as before
- cleaning and filtering flows still mutate/store datasets exactly as before

No existing logic was removed or simplified.

## How Future Features Can Use This Resolver

The new metric resolver gives later phases a clean migration path.

### Charts

Future chart flows can resolve a semantic metric plus semantic dimensions first, then translate the returned `rows` or `chart_ready` structure into chart payloads.

### AI

AI analysis flows can ask for a business metric by semantic ID rather than recomputing column aggregates ad hoc. This creates a consistent semantic source for KPI answers, comparisons, and trend narration.

### Dashboards

Dashboard cards and grouped KPI widgets can call the resolver directly using a metric ID, filters, and optional groupings.

### Reports and exports

Report builders and export services can request semantic summaries from the same resolver instead of building their own independent aggregation logic.

## Files Added Or Modified

### Added

- `backend/services/dataset_context.py`
- `backend/services/metric_resolver.py`
- `backend/routes/semantic_metrics.py`
- `Semantic Info/Phase 2 Metric Resolver.md`

### Modified

- `backend/app.py`
- `backend/routes/semantic_model.py`

## Compatibility Constraints Maintained

The implementation keeps the following guarantees:

- existing upload, API fetch, SQL preview, cleaning, filtering, AI, NLP charting, analysis, and export flows continue to work through their current dataset-driven logic
- semantic execution is additive and opt-in
- no current frontend components were forced onto semantic metric APIs
- no existing endpoint contracts were removed
- no existing aggregation code paths were deleted

## How This Prepares The Application For Business-Oriented BI Features

Phase 1 made semantic metrics available as metadata.

Phase 2 turns that metadata into an executable backend capability.

This is the first step toward a business-oriented BI architecture because it separates:

- **what** a business metric means
- from **where** different features happen to compute numbers today

With this layer in place, future phases can incrementally move charts, dashboards, AI summaries, exports, and reporting onto shared semantic execution without breaking the current application while the transition happens.

## Verification Notes

Verification completed:

- Python source compilation for the backend succeeded with `py -3 -m compileall backend`

Verification limitation:

- a deeper runtime exercise of the resolver was blocked in this environment because the available Python runtime does not have a working pandas installation wired to the project packages, so only compile-time validation was completed here
