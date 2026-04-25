# Phase 2 Decision Enhancement

## Intent

Phase 2 strengthens the Phase 1 Decision Layer without changing its public endpoint structure.

Phase 1 established the contract and scaffolding.

Phase 2 makes those same objects more business-aware by using more of the semantic model and field-profile metadata that already exists in the backend.

## What Changed

### 1. Shared semantic enrichment

`backend/services/decision_support.py` now provides reusable helpers for:

- metric-type classification
  - `total`
  - `rate`
  - `volume`
  - `extrema`
- metric business weighting using:
  - aggregation behavior
  - format hints
  - simple related-metric derivation
- dimension profiling using:
  - distinct count
  - null rate
  - concentration/top share
  - semantic kind
- inferred time grain in `time_context`
  - `day`
  - `week`
  - `month`
  - `quarter`
  - `year`
  - fallback `observed_value`
- improved theme derivation
  - `Growth opportunity`
  - `Performance risk`
  - `Operational anomaly`
  - `Concentration risk`
  - `Data quality risk`

These helpers are intentionally internal and additive. Existing contracts remain valid.

### 2. Better signal quality

`backend/services/decision_signal_service.py` now:

- scores metric deltas with metric-type-aware thresholds
  - rate-like metrics are treated as more sensitive than pure totals
- uses more meaningful importance scoring
  - change magnitude
  - confidence
  - business weight
  - severity
  - time awareness
- assigns severity more clearly
  - metric deltas can now reach `critical`
  - concentration, anomaly, and data-quality signals use more explicit breakpoints
- filters low-value signals more aggressively
  - small changes are dropped earlier
  - weak concentration signals are filtered using both top share and dimension usefulness
  - tiny anomaly rates are ignored
- deduplicates signals by type/reference and keeps the strongest version
- adds optional semantic metadata inside `signal.evidence.semantic_context`

No signal fields were removed or renamed.

### 3. Stronger decision briefs

`backend/services/decision_brief_service.py` now:

- chooses the headline from the highest-ranked signal rather than using a generic dataset title
- generates a more coherent executive-summary-style paragraph
- uses stronger theme labels derived from signal meaning, not just signal type
- selects key metrics by signal relevance first, then fills from the requested metric set
- uses `steady` when a metric has comparison context but the change is not material
- computes brief confidence from the top supporting signals

The brief object shape is unchanged.

### 4. Recommendation intelligence upgrade

`backend/services/recommendation_service.py` now:

- maps signals to more specific next steps
- keeps actions chart-friendly
  - `payload.metric_id`
  - `payload.group_by`
- uses the semantic/time/dimension context to suggest:
  - breakdowns
  - time comparisons
  - segment comparisons
- improves recommendation priority using both severity and importance score
- preserves traceability with `based_on_signal_ids`

Recommendations remain structured and usable by the current metric + group-by chart flow.

### 5. Moderate scenario expansion

`backend/services/scenario_service.py` now:

- preserves multiple metric targets
- adds grouped projections when `group_by` is provided
- adds clearer projected-vs-baseline comparison metadata
- adds explicit scenario assumptions for grouped and percent-based adjustments

New scenario fields are additive:

- `projected_metrics[].delta_pct`
- `projected_metrics[].projected_rows`
- `projected_metrics[].comparison_summary`

This is still not a simulation engine.

## Behavioral Notes

### Signal semantics are richer but deterministic

Phase 2 still avoids autonomous reasoning or multi-step planning. The system remains bounded and predictable:

- semantic model drives metric and dimension interpretation
- metric resolver still computes values
- anomaly detection remains dataset-level and lightweight

### Charting compatibility is preserved

Recommendation actions were kept intentionally simple.

Phase 2 does not introduce complex query plans or nested exploration payloads. The current frontend chart builder can still work with the same mental model:

- choose a metric
- choose one or more group-by fields

### Contract compatibility

Phase 2 does not:

- remove endpoints
- rename endpoints
- remove fields from decision objects
- change top-level response envelopes

All changes are additive or behavioral.

## New Assumptions

- format hints and aggregation behavior are useful proxies for business importance
- moderate-cardinality dimensions are usually more decision-useful than very high-cardinality ones
- grouped scenario projections should apply the same requested adjustment to each returned grouped row
- a stronger headline should come from the highest-ranked signal, not from dataset naming

## Files Changed

- `backend/services/decision_support.py`
- `backend/services/decision_signal_service.py`
- `backend/services/decision_brief_service.py`
- `backend/services/recommendation_service.py`
- `backend/services/scenario_service.py`
- `ai_handoff/shared_contracts/decision_objects.md`

## Verification

Validated with:

- `python -m py_compile backend\\services\\decision_support.py backend\\services\\decision_signal_service.py backend\\services\\decision_brief_service.py backend\\services\\recommendation_service.py backend\\services\\scenario_service.py backend\\routes\\decision.py`

Runtime service execution could not be completed inside this workspace because the bundled local Python environment is missing a usable `pandas` package entrypoint despite having partial site-packages contents.
