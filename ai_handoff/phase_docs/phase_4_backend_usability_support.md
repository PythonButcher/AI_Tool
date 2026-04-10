# Phase 4 Backend Usability Support for Gemini

## Gemini Handoff

This file is specifically for Gemini.

Gemini should read this file before making any Phase 4 frontend usability or flow changes related to Decision Intelligence.

Gemini is the intended implementer for the frontend behavior described below.

## Section 1 - What Changed

`POST /api/decision/run` now returns additive readiness metadata without changing the existing decision bundle contract.

New response behavior:

- `readiness` is now included on successful responses
- `decision_bundle` is always present, including guided empty or partial states
- `warnings` are now intended to be human-readable and UI-safe
- `brief.period_context` is now included when the backend can derive comparison labels from the time context
- `brief.key_metrics[]` may now include `period_label` and `comparison_label`
- `scenario_preview.period_context` may now be included for scenario-level time context
- `scenario_preview.projections[]` may now include `baseline_label` and `projected_label`

New expectations:

- missing dataset no longer needs to surface as a blocking backend failure for `/api/decision/run`
- missing metrics now returns a valid success response with an empty decision experience
- frontend should treat readiness plus warnings as the source of truth for setup guidance

Additional product requirement:

- Decision Intelligence should be able to support time-aware business comparisons, including fiscal-period comparisons, as the system evolves
- frontend should not assume that generic "latest period" language is always sufficient for business users

Current backend reality:

- the new period/comparison fields are additive and safe to consume now
- current labels describe the existing sequential period comparison logic
- `fiscal_calendar` remains `null` until real fiscal-calendar support is implemented
- Decision services no longer accept implicit backend active-dataset fallback for the main app workflow
- no explicit dataset in the current UI context must be treated as `missing_requirements: ["dataset", "semantic_model", "metrics"]`

## Section 2 - Readiness Contract (CRITICAL)

`/api/decision/run` now includes:

```json
{
  "readiness": {
    "dataset_loaded": true,
    "semantic_ready": true,
    "decision_ready": true,
    "missing_requirements": []
  }
}
```

Field definitions:

- `dataset_loaded`
  - `true` when the request resolves to a dataset context
  - `false` when no dataset is currently available for the decision pipeline
- `semantic_ready`
  - `true` when the decision pipeline has a resolved semantic model context
  - this is separate from metric availability
- `decision_ready`
  - currently defined as `dataset_loaded && semantic_ready`
  - this is additive metadata and does not replace `missing_requirements`
- `missing_requirements`
  - array of setup gaps the frontend should translate into guidance
  - possible values: `dataset`, `semantic_model`, `metrics`

Important interpretation rule:

- `missing_requirements` is the detailed setup signal
- if `missing_requirements` includes `metrics`, frontend should still keep the user in a setup-guidance state even though `decision_ready` may be `true`

Example states:

### 1. Nothing loaded yet

```json
{
  "readiness": {
    "dataset_loaded": false,
    "semantic_ready": false,
    "decision_ready": false,
    "missing_requirements": ["dataset", "semantic_model", "metrics"]
  }
}
```

### 2. Dataset loaded, semantic context available, but no metrics

```json
{
  "readiness": {
    "dataset_loaded": true,
    "semantic_ready": true,
    "decision_ready": true,
    "missing_requirements": ["metrics"]
  }
}
```

### 3. Fully ready

```json
{
  "readiness": {
    "dataset_loaded": true,
    "semantic_ready": true,
    "decision_ready": true,
    "missing_requirements": []
  }
}
```

## Section 3 - Frontend Behavior Rules

These rules are specifically for Gemini to implement in the frontend.

Gemini should follow these rules:

- NEVER show blocking alerts for decision-readiness problems
- Use `readiness` and `warnings` to drive UI states
- Treat `missing_requirements` as the primary setup-guidance source
- The decision button should be disabled when the system is not ready for a full decision experience
- Show guidance instead of errors
- If `missing_requirements` includes `metrics`, keep the user in a guided setup state instead of attempting a full decision run

Recommended Gemini behavior:

- no dataset: disable decision experience and guide the user to load data
- no metrics: keep the user in a setup state and guide them to define metrics
- ready: enable the full decision flow

## Section 4 - UI State Mapping

Gemini should use this mapping directly when building Phase 4 UI states.

Map backend state to frontend state like this:

- `missing_requirements` contains `dataset`
  - show a "Load a dataset" setup state
  - do not show an error modal
- `missing_requirements` contains `semantic_model`
  - show a "Prepare semantic model" setup state
  - do not block the page with alerts
- `missing_requirements` contains `metrics`
  - show a "Define metrics" setup state
  - explain that Decision Intelligence requires at least one metric
- `missing_requirements` is empty
  - enable the full Decision Intelligence experience

Use warnings as helper copy, for example:

- `No dataset is currently loaded.`
- `Load a dataset to enable Decision Intelligence.`
- `No semantic metrics are defined.`
- `Decision Intelligence requires at least one metric.`

Time-intelligence note for Gemini:

- do not fabricate fiscal-year or fiscal-quarter comparisons in the frontend
- do not assume the current backend always has the business time context users want
- design the UI so it can absorb richer comparison context later without redoing the whole destination
- if backend comparison metadata is insufficient for a required fiscal/calendar workflow, report the gap back to Codex

## Section 5 - Decision Bundle Usage Reminder

Gemini should keep this usage model unchanged while implementing frontend flow improvements.

Keep using the existing `decision_bundle` structure:

- `brief` = summary
- `signals` = evidence
- `recommendations` = actions
- `scenario_preview` = optional

Notes:

- `decision_bundle` is always present on successful `/api/decision/run` responses
- empty or partial states are valid and should be rendered as guided UI states, not failures
- `period_context` is additive and should be treated as display metadata, not as a new source of filtering logic
- `period_label`, `comparison_label`, `baseline_label`, and `projected_label` should be preferred over frontend-invented fallback copy when present

Feature-preservation reminder:

- do not remove scenario preview, recommendations, or chart-launch actions to make the frontend simpler
- do not hide decision capability because time-intelligence support is still evolving

## Section 6 - Time Metadata Shape

Gemini should expect the following additive shape:

```json
{
  "decision_bundle": {
    "brief": {
      "time_context": {
        "dimension_id": "dimension_order_date",
        "field": "Order Date",
        "grain": "month",
        "current_value": "2026-03-31T00:00:00",
        "previous_value": "2026-02-28T00:00:00"
      },
      "period_context": {
        "label": "Mar 2026",
        "comparison_label": "Feb 2026",
        "current_label": "Mar 2026",
        "previous_label": "Feb 2026",
        "grain": "month",
        "comparison_type": "sequential_period",
        "calendar_type": "calendar",
        "fiscal_calendar": null
      },
      "key_metrics": [
        {
          "period_label": "Mar 2026",
          "comparison_label": "Feb 2026"
        }
      ]
    },
    "scenario_preview": {
      "period_context": {
        "label": "Mar 2026",
        "comparison_label": "Feb 2026",
        "fiscal_calendar": null
      },
      "projections": [
        {
          "baseline_label": "Current Context (Mar 2026)",
          "projected_label": "Projected Context (Mar 2026)"
        }
      ]
    }
  }
}
```

Interpretation rules:

- use the provided labels directly when present
- keep fallback UI copy for truly missing values only
- do not treat `fiscal_calendar: null` as an error state
- do not pretend sequential calendar/observed labels are the same thing as full fiscal intelligence

## Section 7 - Emergency No-Data Rule

This is now a hard product rule for Gemini:

- if the current app session has no explicit dataset rows, `Decisions` must not present a connected or ready state
- if the app has no explicit dataset rows, `Run Intelligence` must not produce a stale generic result from old backend memory
- if the app has no explicit dataset rows, the correct user-facing state is setup guidance

Gemini should preserve this behavior and verify it explicitly after any Decisions-related frontend work.
