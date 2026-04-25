# Phase 3 Decision Orchestration

## Intent

Phase 3 turns the Decision Layer into a connected backend pipeline without replacing the Phase 1 or Phase 2 services.

Phase 1 established structure.

Phase 2 improved intelligence.

Phase 3 adds orchestration so the system behaves as:

- signals -> brief -> recommendations -> scenario preview

The goal is cohesion, reuse, and traceability, not a new reasoning engine.

## New Backend Module

- `backend/services/decision_pipeline_service.py`
  - Coordinates the full decision run
  - Reuses the existing decision signal, brief, recommendation, and scenario services
  - Produces a single `decision_bundle`

## New Endpoint

- `POST /api/decision/run`

This endpoint is additive.

Existing endpoints remain unchanged:

- `POST /api/decision/signals/generate`
- `POST /api/decision/brief/generate`
- `POST /api/decision/recommendations/generate`
- `POST /api/decision/scenarios/evaluate`

## How The Pipeline Works

### 1. Signal generation remains the entry point

The orchestration layer first calls the existing signal service and treats its ranked, deduplicated output as the canonical signal set for the run.

That means the pipeline inherits:

- Phase 2 semantic weighting
- signal ranking
- signal filtering
- signal deduplication

### 2. The brief is built from the final signal set

Phase 3 refactors the brief service so it can build a `DecisionBrief` from a supplied signal list.

This matters because the brief now reflects the exact filtered signals returned in the unified bundle instead of regenerating a separate signal run with different timestamps or ordering.

### 3. Recommendations are built from the same signal set

Phase 3 refactors the recommendation service so it can generate recommendations directly from the final signal set.

This preserves:

- signal ordering
- signal IDs
- dataset context
- semantic metric compatibility

It also improves cohesion by deduplicating redundant recommendations while keeping the strongest version and merging `based_on_signal_ids` when needed.

### 4. Scenario preview is derived from top recommendations

Phase 3 does not expand the scenario system into a simulation engine.

Instead, the pipeline:

- takes the top chart-compatible recommendations
- extracts metric targets and group-by hints
- deterministically suggests lightweight percent adjustments
- calls the existing scenario service
- returns only preview-oriented projections and assumptions

This keeps the preview bounded, synchronous, and compatible with the current metric + group-by mental model.

## Cross-Object Linking

Phase 3 strengthens traceability across objects:

- `DecisionBrief.headline_signal_ids` points to the exact pipeline signals
- `Recommendation.based_on_signal_ids` continues to reference source signals
- recommendation action payloads now also include additive `signal_id` fields
- `DecisionScenarioPreview.based_on_recommendation_ids` links preview generation to top recommendations
- `DecisionScenarioPreview.based_on_signal_ids` provides end-to-end traceability back to raw signals

This makes it possible for future frontend, chat, or automation features to move across the pipeline without guessing relationships.

## Ranking And Filtering At System Level

Phase 3 does not create a second ranking engine.

System-level behavior is intentionally simple:

- signals are ranked and deduplicated by the existing signal service
- the brief uses that final signal ordering
- recommendations are generated from the same ordered signal list
- redundant recommendations are collapsed at recommendation level
- scenario preview only uses the highest-priority chart-compatible recommendations

As a result:

- the brief reflects the same signals the client sees
- recommendations are less repetitive
- scenario preview is grounded in the strongest available recommendations

## Charting Compatibility

Phase 3 preserves the current chart-builder contract.

Recommendation actions still use:

- `payload.metric_id`
- `payload.group_by`

Phase 3 only adds traceability fields such as `signal_id`; it does not introduce nested query plans or workflow-specific action schemas.

Scenario preview selection also prefers recommendation actions that already conform to this chart-ready shape.

## Determinism And Scope

Phase 3 remains bounded and deterministic.

It does not introduce:

- autonomous agents
- recursive planning loops
- simulation graphs
- multi-step execution workflows

The orchestration layer is synchronous composition over existing backend services.

## Files Added Or Updated

- `backend/services/decision_pipeline_service.py`
- `backend/routes/decision.py`
- `backend/services/decision_brief_service.py`
- `backend/services/recommendation_service.py`
- `ai_handoff/shared_contracts/decision_objects.md`

## Compatibility Notes

- No existing endpoint was removed or renamed
- No existing response envelope was changed
- Phase 1 and Phase 2 routes continue to work as before
- All new fields are additive
