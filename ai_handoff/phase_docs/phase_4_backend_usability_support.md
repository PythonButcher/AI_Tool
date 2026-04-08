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

New expectations:

- missing dataset no longer needs to surface as a blocking backend failure for `/api/decision/run`
- missing metrics now returns a valid success response with an empty decision experience
- frontend should treat readiness plus warnings as the source of truth for setup guidance

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
