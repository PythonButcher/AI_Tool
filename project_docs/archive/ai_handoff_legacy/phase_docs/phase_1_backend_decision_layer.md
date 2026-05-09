> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 1 Backend Decision Layer

## Intent

Phase 1 adds an additive Decision Layer on top of the existing semantic model. The goal is to introduce decision-oriented backend objects without changing or breaking the current BI-style charting and dataset workflows.

## New Backend Modules

- `backend/services/decision_support.py`
  - Shared dataset-context resolution
  - Semantic summary helpers
  - Metric selection and metric resolver integration
  - Time-context and dimension helper logic
- `backend/services/decision_signal_service.py`
  - Generates `DecisionSignal` objects
- `backend/services/decision_brief_service.py`
  - Generates `DecisionBrief` objects and packages supporting signals
- `backend/services/recommendation_service.py`
  - Generates `Recommendation` objects from decision signals
- `backend/services/scenario_service.py`
  - Phase 1 scaffold for `Scenario` evaluation
- `backend/routes/decision.py`
  - Decision API blueprint mounted at `/api/decision`

## Reused Existing Systems

- `backend/services/dataset_context.py`
  - Reused through `resolve_dataset_bundle()`
- `backend/services/semantic_model.py`
  - Reused through `finalize_semantic_model()`
- `backend/services/metric_resolver.py`
  - Reused through `MetricResolver.resolve()`
- `backend/services/ml_logic.py`
  - Reused for anomaly-style dataset signal generation

## Phase 1 Output Philosophy

- Decision outputs are structured and deterministic where possible.
- Existing charting remains unchanged and continues to use simple metric + group-by workflows.
- Decision objects point back to semantic metric and dimension references instead of duplicating semantic definitions.
- Scenario evaluation is intentionally shallow in Phase 1 and should be treated as a scaffold, not a simulation engine.

## Compatibility

- No existing endpoint was removed or renamed.
- No existing semantic contracts were replaced.
- The Decision Layer is additive and does not require frontend adoption to keep the current product functional.
