# Phase 3 Backend To Frontend Handoff

## Status

Phase 3 introduces a unified orchestration endpoint on top of the existing Decision Layer.

The backend now supports a connected decision pipeline:

- signals -> brief -> recommendations -> scenario preview

This is additive. Existing decision endpoints still work exactly as before.

## New Endpoint

- `POST /api/decision/run`

## Purpose

This endpoint returns a single, cohesive `decision_bundle` so frontend, AI chat, or future automation clients can request one decision-oriented payload instead of calling multiple endpoints separately.

The bundle is designed to be predictable:

- one final signal set
- one brief generated from that signal set
- recommendations linked to those signals
- one lightweight scenario preview linked to the top recommendations

## Request Shape

The endpoint uses the same dataset-context pattern as the Phase 1 and Phase 2 endpoints:

- `dataset`
- `dataset_ref`
- `semantic_model`

Common optional fields:

- `metric_ids`
- `metric_names`
- `filters`
- `max_signals`
- `max_recommendations`
- `include_anomaly_detection`
- `include_scenario_preview`
- `max_preview_targets`

### Example Request

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "metric_ids": [
    "metric_revenue_sum",
    "metric_margin_pct"
  ],
  "filters": [
    {
      "field": "Region",
      "operator": "neq",
      "value": "Unknown"
    }
  ],
  "max_signals": 6,
  "max_recommendations": 3,
  "include_anomaly_detection": true,
  "include_scenario_preview": true,
  "max_preview_targets": 2
}
```

## Response Shape

Successful responses use:

```json
{
  "status": "success",
  "dataset": {},
  "semantic_model": {},
  "decision_bundle": {
    "signals": [],
    "brief": {},
    "recommendations": [],
    "scenario_preview": {}
  },
  "meta": {},
  "warnings": []
}
```

Error responses follow the existing Decision Layer pattern:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_DECISION_REQUEST",
    "message": "Human-readable message"
  }
}
```

## Example Response

```json
{
  "status": "success",
  "dataset": {
    "source": "datahub",
    "dataset_id": "sales_q1",
    "dataset_name": "Q1 Sales",
    "row_count": 1280,
    "column_count": 14
  },
  "semantic_model": {
    "version": 2,
    "dataset": {
      "id": "sales_q1",
      "name": "Q1 Sales"
    },
    "summary": {
      "metric_count": 6,
      "dimension_count": 5,
      "entity_count": 1
    }
  },
  "decision_bundle": {
    "signals": [
      {
        "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00",
        "signal_type": "metric_delta",
        "title": "Revenue increased in the latest day period",
        "severity": "critical",
        "importance_score": 91.4
      }
    ],
    "brief": {
      "brief_id": "brief_q1_sales_2026_04_04t150000_00_00",
      "title": "Revenue increased in the latest day period",
      "headline_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
      ],
      "themes": [
        "Growth opportunity",
        "Concentration risk"
      ]
    },
    "recommendations": [
      {
        "recommendation_id": "recommendation_optimize_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00",
        "recommendation_type": "optimize",
        "priority": "high",
        "based_on_signal_ids": [
          "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
        ],
        "actions": [
          {
            "action_type": "break_down_metric",
            "payload": {
              "metric_id": "metric_revenue_sum",
              "group_by": ["Region"],
              "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
            }
          }
        ]
      }
    ],
    "scenario_preview": {
      "status": "ready",
      "summary": "Prepared 1 scenario preview target from the top chart-compatible recommendations.",
      "based_on_recommendation_ids": [
        "recommendation_optimize_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00"
      ],
      "based_on_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
      ],
      "suggested_inputs": {
        "name": "Decision pipeline preview",
        "filters": [
          {
            "field": "Region",
            "operator": "neq",
            "value": "Unknown"
          }
        ],
        "group_by": ["Region"],
        "metric_targets": [
          {
            "metric_id": "metric_revenue_sum",
            "adjustment_type": "percent",
            "adjustment_value": -0.08
          }
        ]
      },
      "projections": [
        {
          "metric_ref": {
            "metric_id": "metric_revenue_sum",
            "label": "Revenue"
          },
          "adjustment": {
            "type": "percent",
            "value": -0.08
          },
          "baseline_value": 145000,
          "projected_value": 133400,
          "delta_value": -11600,
          "delta_pct": -0.08,
          "comparison_summary": {
            "direction": "down",
            "delta_value": -11600,
            "delta_pct": -0.08,
            "projected_group_count": 4
          }
        }
      ],
      "assumptions": [
        "Scenario projections apply direct metric adjustments only.",
        "No causal or multi-step simulation is performed yet."
      ],
      "generated_at": "2026-04-04T15:00:00+00:00"
    }
  },
  "meta": {
    "signal_count": 1,
    "recommendation_count": 1,
    "scenario_preview_status": "ready",
    "empty_dataset": false,
    "generated_at": "2026-04-04T15:00:00+00:00"
  },
  "warnings": []
}
```

## Decision Bundle Notes

### Signals

These are the final ranked and filtered signals for the run.

The bundle brief and bundle recommendations are built from this exact signal set, so frontend does not need to reconcile separate signal payloads from multiple endpoints.

### Brief

The bundle brief is now tied to the same final signals returned in `decision_bundle.signals`.

Use `brief.headline_signal_ids` to connect summary content back to concrete signal cards or drill-in interactions.

### Recommendations

Recommendations remain chart-compatible:

- `actions[].payload.metric_id`
- `actions[].payload.group_by`

Phase 3 adds additive `signal_id` references inside action payloads so frontend can preserve traceability when launching charts or inspectors.

### Scenario Preview

This is intentionally lightweight.

It is not a full scenario builder and should be treated as:

- a suggested set of scenario inputs
- a small set of projected metrics
- a preview tied to the top recommendations

If `scenario_preview.status` is:

- `ready`
  - preview data is available
- `not_applicable`
  - no compatible recommendations produced a preview
- `not_requested`
  - the caller disabled preview generation

## High-Level Frontend Consumption

Frontend can consume the new endpoint as a single decision-oriented page or panel payload.

A reasonable high-level flow would be:

1. Render `decision_bundle.brief` as the top summary block
2. Render `decision_bundle.signals` as ranked supporting evidence
3. Render `decision_bundle.recommendations` as actionable next steps
4. Treat `decision_bundle.scenario_preview` as an optional preview module below recommendations

Useful interaction patterns:

- click a brief headline signal to scroll or focus its signal card
- click a recommendation action to launch an existing chart flow using `metric_id` + `group_by`
- show scenario preview only when `status === "ready"`
- keep `warnings` visible even when the call succeeds

## Integration Cautions

- Do not assume `signals` is non-empty
- Do not assume `recommendations` is non-empty
- Do not assume `scenario_preview.status` is always `ready`
- Do not assume `projections` exists for every metric beyond the provided preview list
- Keep treating recommendation action payloads as extensible objects

## Gemini Decision

Frontend work required — Gemini should begin Phase 3 integration.

Gemini should build a high-level decision-pipeline consumption path around `POST /api/decision/run`, using `decision_bundle` as the primary data source instead of stitching together separate signal, brief, and recommendation calls.

Gemini should use:

- `decision_bundle.brief` for the top-level summary state
- `decision_bundle.signals` for ranked evidence and traceable detail views
- `decision_bundle.recommendations` for action rows that map into the current chart builder
- `decision_bundle.scenario_preview` for an optional lightweight preview section when available

Reasonable interaction patterns include:

- summary-first rendering with expandable evidence
- recommendation-driven chart launch shortcuts
- optional scenario-preview reveal when the backend provides one

Exact UI design is not prescribed here.
