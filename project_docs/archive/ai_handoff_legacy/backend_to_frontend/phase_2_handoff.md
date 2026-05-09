> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 2 Backend To Frontend Handoff

## Status

No frontend work required yet.

Phase 2 is still backend-focused. Existing decision endpoints remain compatible, but their outputs are now more useful and more opinionated.

## What Changed From Phase 1

### Signals are more business-aware

`DecisionSignal` generation now uses more semantic context:

- metric type awareness
  - totals vs rates vs counts
- format hints
  - currency
  - percentage
  - number
- dimension usefulness
  - cardinality
  - null rate
  - concentration
- inferred time grain where a temporal comparison exists

This affects ranking, severity, and summaries, but not the top-level shape of the response.

### Importance and severity are stronger

`importance_score` is now more meaningful because it blends:

- magnitude
- confidence
- semantic/business weight
- severity
- time-awareness bonus where available

Low-value signals are filtered more aggressively than in Phase 1.

### Briefs read more like summaries

`DecisionBrief` now:

- uses the highest-ranked signal as the title/headline
- produces a more coherent summary paragraph
- surfaces stronger themes
- selects key metrics based on signal relevance first

### Recommendations are more actionable

`Recommendation` objects still map cleanly to charting, but actions are now more specific:

- breakdown suggestions
- time-comparison suggestions
- secondary segment comparison suggestions when helpful

The backend intentionally kept action payloads simple for the existing chart builder.

### Scenarios are clearer

`Scenario` now includes additive projection details:

- summary-level `delta_pct`
- grouped `projected_rows` when `group_by` was provided
- `comparison_summary` for easier projected-vs-baseline interpretation

## Endpoint Behavior

The endpoints are unchanged:

- `POST /api/decision/signals/generate`
- `POST /api/decision/brief/generate`
- `POST /api/decision/recommendations/generate`
- `POST /api/decision/scenarios/evaluate`

All remain synchronous request/response endpoints.

## Additive Field Notes

### DecisionSignal

Inside `signal.evidence`, Phase 2 may now include:

- `semantic_context`

Examples:

- metric signals
  - `metric_type`
  - `aggregation`
  - `format_hint`
  - `business_weight`
  - `related_metrics`
  - `time_grain`
- concentration signals
  - `importance_score`
  - `unique_count`
  - `null_rate`
  - `top_share`
- anomaly signals
  - `numeric_fields_scanned`
  - `scan_scope`
- data quality signals
  - `field_role`
  - `field_format_hint`
  - `is_metric_backed`

Frontend can treat all of these as optional.

### DecisionBrief

No new required fields.

Behavioral changes:

- `title` is now more likely to be the strongest signal headline
- `themes` are more semantic and less generic
- `key_metrics[].status` may now more often use `steady` when the metric has comparison context but not a meaningful change

### Recommendation

No new required fields.

Action payloads remain intentionally chart-ready:

- `metric_id`
- `group_by`

Optional additive payload keys may appear, such as:

- `signal_id`

Frontend should continue to treat `actions.payload` as an extensible object.

### Scenario

New optional fields under `projected_metrics[]`:

- `delta_pct`
- `projected_rows`
- `comparison_summary`

Frontend can ignore these for now without breaking.

## Updated Example Snippets

### 1. Signals

```json
{
  "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_04t120000_00_00",
  "signal_type": "metric_delta",
  "title": "Revenue increased in the latest day period",
  "summary": "Revenue moved from 1820 to 3200 (+75.8%) between the two latest observed time values. This is treated as a total metric with sum aggregation.",
  "severity": "critical",
  "importance_score": 91.4,
  "time_context": {
    "dimension_id": "dimension_order_date",
    "field": "Order Date",
    "grain": "day",
    "current_value": "2026-03-03T00:00:00",
    "previous_value": "2026-03-02T00:00:00"
  },
  "evidence": {
    "kind": "metric_comparison",
    "current_value": 3200,
    "previous_value": 1820,
    "delta_value": 1380,
    "delta_pct": 0.7582,
    "row_count": 10,
    "semantic_context": {
      "metric_type": "total",
      "aggregation": "sum",
      "format_hint": "currency",
      "business_weight": 0.9,
      "time_grain": "day"
    },
    "chart_hint": {
      "metric_id": "metric_revenue_sum",
      "group_by": ["Order Date"]
    }
  }
}
```

### 2. Brief

```json
{
  "brief": {
    "title": "Revenue increased in the latest day period",
    "summary": "Revenue increased in the latest day period. 2 high-priority signals were surfaced in this slice, with themes centered on Growth opportunity, Concentration risk.",
    "themes": [
      "Growth opportunity",
      "Concentration risk",
      "Data quality risk"
    ]
  }
}
```

### 3. Recommendations

```json
{
  "recommendations": [
    {
      "recommendation_type": "optimize",
      "priority": "high",
      "title": "Break down the latest Revenue increase",
      "based_on_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_04t120000_00_00"
      ],
      "actions": [
        {
          "action_type": "break_down_metric",
          "label": "Break Revenue down by Region",
          "payload": {
            "metric_id": "metric_revenue_sum",
            "group_by": ["Region"]
          }
        },
        {
          "action_type": "compare_metric_over_time",
          "label": "Review Revenue over time",
          "payload": {
            "metric_id": "metric_revenue_sum",
            "group_by": ["Order Date"]
          }
        }
      ]
    }
  ]
}
```

### 4. Scenarios

```json
{
  "scenario": {
    "projected_metrics": [
      {
        "metric_ref": {
          "metric_id": "metric_revenue_sum",
          "label": "Revenue"
        },
        "adjustment": {
          "type": "percent",
          "value": 0.1
        },
        "baseline_value": 16030,
        "projected_value": 17633,
        "delta_value": 1603,
        "delta_pct": 0.1,
        "projected_rows": [
          {
            "group": {
              "Region": "East"
            },
            "baseline_value": 14480,
            "projected_value": 15928,
            "delta_value": 1448,
            "delta_pct": 0.1,
            "row_count": 7
          }
        ],
        "comparison_summary": {
          "direction": "up",
          "delta_value": 1603,
          "delta_pct": 0.1,
          "projected_group_count": 2,
          "largest_group_change": {
            "group": {
              "Region": "East"
            },
            "delta_value": 1448
          }
        }
      }
    ]
  }
}
```

## Frontend Guidance

Frontend can continue treating these responses exactly as it did in Phase 1.

If and when the frontend adopts the richer outputs later, the best incremental uses would be:

- display stronger signal ordering directly from backend ranking
- surface signal `severity` and `importance_score`
- optionally show `time_context.grain`
- optionally use `recommendation.actions` as chart-launch shortcuts
- optionally use scenario `projected_rows` for grouped what-if tables or charts

None of this is required to keep the app functional.

## Integration Notes

- Do not assume every signal has `semantic_context`
- Do not assume every recommendation action has extra keys beyond `metric_id` and `group_by`
- Do not assume `projected_rows` exists when `group_by` is empty
- Do not assume all `key_metrics` are materially changed; some may now be `steady`

## Gemini Decision

No frontend work required yet.
