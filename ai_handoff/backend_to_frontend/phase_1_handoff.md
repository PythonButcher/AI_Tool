# Phase 1 Backend Handoff

## Status

No frontend work required yet.

Phase 1 focused on backend foundations only. The Decision Layer now exists as an additive backend system that sits on top of the current semantic model and metric resolver without changing existing charting, dashboard, upload, or semantic endpoints.

## What Was Implemented

### Services

- `backend/services/decision_support.py`
  - Shared dataset-context resolution via existing `resolve_dataset_bundle()`
  - Shared semantic summary helpers
  - Shared metric selection and `MetricResolver.resolve()` integration
  - Shared time-context and dimension helper logic
- `backend/services/decision_signal_service.py`
  - Generates `DecisionSignal` objects
  - Current signal types:
    - `metric_delta`
    - `anomaly_rate`
    - `dimension_concentration`
    - `data_quality`
- `backend/services/decision_brief_service.py`
  - Generates `DecisionBrief` objects
  - Packages supporting signals alongside the brief
- `backend/services/recommendation_service.py`
  - Generates `Recommendation` objects derived from decision signals
- `backend/services/scenario_service.py`
  - Generates Phase 1 scaffold `Scenario` objects
  - Uses simple direct metric adjustments only

### Routes

- `backend/routes/decision.py`
- Registered in `backend/app.py`

### Shared Contract

- Source of truth: `ai_handoff/shared_contracts/decision_objects.md`

## Exact API Endpoints

- `POST /api/decision/signals/generate`
- `POST /api/decision/brief/generate`
- `POST /api/decision/recommendations/generate`
- `POST /api/decision/scenarios/evaluate`

## Common Request Behavior

All four endpoints support the same dataset-context pattern already used elsewhere in the backend:

- `dataset`
  - Inline dataset rows
- `dataset_ref`
  - Existing dataset reference, including Data Hub usage
- `semantic_model`
  - Optional explicit semantic model override

If those are omitted, the backend falls back to the current active dataset context, matching the existing backend behavior.

Common optional fields:

- `metric_ids`
- `metric_names`
- `filters`
- `group_by` for scenarios

## Common Response Shape

Successful responses use:

```json
{
  "status": "success",
  "request": {},
  "dataset": {},
  "semantic_model": {},
  "...payload_specific_key...": {},
  "meta": {},
  "warnings": []
}
```

Error responses use:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_DECISION_REQUEST",
    "message": "Human-readable message"
  }
}
```

## Request / Response Examples

### 1. `POST /api/decision/signals/generate`

Example request:

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "metric_ids": [
    "metric_revenue_sum"
  ],
  "filters": [
    {
      "field": "Region",
      "operator": "eq",
      "value": "East"
    }
  ],
  "max_signals": 5,
  "include_anomaly_detection": true
}
```

Example response:

```json
{
  "status": "success",
  "request": {
    "metric_ids": [
      "metric_revenue_sum"
    ],
    "metric_names": [],
    "filters": [
      {
        "field": "Region",
        "operator": "eq",
        "value": "East"
      }
    ],
    "max_signals": 5,
    "include_anomaly_detection": true
  },
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
  "signals": [
    {
      "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_03t235959_00_00",
      "signal_type": "metric_delta",
      "title": "Revenue increased in the latest observed period",
      "summary": "Revenue moved from 120000 to 145000 (+20.8%) between the two latest observed time values.",
      "severity": "medium",
      "status": "active",
      "direction": "up",
      "dataset": {
        "source": "datahub",
        "dataset_id": "sales_q1",
        "dataset_name": "Q1 Sales",
        "row_count": 1280,
        "column_count": 14
      },
      "metric_ref": {
        "metric_id": "metric_revenue_sum",
        "name": "Revenue",
        "label": "Revenue",
        "field": "Revenue",
        "default_aggregation": "sum",
        "format_hint": "currency"
      },
      "dimension_ref": null,
      "time_context": {
        "dimension_id": "dimension_order_date",
        "field": "Order Date",
        "grain": "observed_value",
        "current_value": "2026-03-31T00:00:00",
        "previous_value": "2026-03-30T00:00:00"
      },
      "evidence": {
        "kind": "metric_comparison",
        "current_value": 145000,
        "previous_value": 120000,
        "delta_value": 25000,
        "delta_pct": 0.2083,
        "row_count": 1280,
        "chart_hint": {
          "metric_id": "metric_revenue_sum",
          "group_by": [
            "Order Date"
          ]
        }
      },
      "confidence": 0.84,
      "importance_score": 72.5,
      "created_at": "2026-04-03T23:59:59+00:00"
    }
  ],
  "meta": {
    "signal_count": 1,
    "tracked_metric_count": 1,
    "empty_dataset": false,
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "warnings": []
}
```

### 2. `POST /api/decision/brief/generate`

Example request:

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "metric_ids": [
    "metric_revenue_sum",
    "metric_cost_sum"
  ]
}
```

Example response:

```json
{
  "status": "success",
  "request": {
    "metric_ids": [
      "metric_revenue_sum",
      "metric_cost_sum"
    ],
    "metric_names": [],
    "filters": []
  },
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
  "brief": {
    "brief_id": "brief_q1_sales_2026_04_03t235959_00_00",
    "title": "Decision brief for Q1 Sales",
    "summary": "Three actionable signals were detected across tracked metrics. Revenue increased in the latest observed period is the leading headline for this dataset slice.",
    "dataset": {
      "source": "datahub",
      "dataset_id": "sales_q1",
      "dataset_name": "Q1 Sales",
      "row_count": 1280,
      "column_count": 14
    },
    "time_context": {
      "dimension_id": "dimension_order_date",
      "field": "Order Date",
      "grain": "observed_value",
      "current_value": "2026-03-31T00:00:00",
      "previous_value": "2026-03-30T00:00:00"
    },
    "headline_signal_ids": [
      "signal_metric_delta_metric_revenue_sum_2026_04_03t235959_00_00"
    ],
    "key_metrics": [
      {
        "metric_ref": {
          "metric_id": "metric_revenue_sum",
          "name": "Revenue",
          "label": "Revenue",
          "field": "Revenue",
          "default_aggregation": "sum",
          "format_hint": "currency"
        },
        "current_value": 145000,
        "previous_value": 120000,
        "delta_value": 25000,
        "delta_pct": 0.2083,
        "status": "changed"
      }
    ],
    "themes": [
      "Performance change",
      "Anomaly monitoring"
    ],
    "confidence": 0.8,
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "supporting_signals": [],
  "meta": {
    "headline_signal_count": 1,
    "key_metric_count": 1,
    "empty_dataset": false,
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "warnings": []
}
```

### 3. `POST /api/decision/recommendations/generate`

Example request:

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "metric_ids": [
    "metric_revenue_sum"
  ],
  "max_recommendations": 3
}
```

Example response:

```json
{
  "status": "success",
  "request": {
    "max_recommendations": 3,
    "filters": [],
    "metric_ids": [
      "metric_revenue_sum"
    ],
    "metric_names": []
  },
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
  "recommendations": [
    {
      "recommendation_id": "recommendation_investigate_signal_metric_delta_metric_revenue_sum_2026_04_03t235959_00_00_2026_04_03t235959_00_00",
      "recommendation_type": "investigate",
      "priority": "medium",
      "status": "proposed",
      "title": "Investigate the latest Revenue shift",
      "summary": "Revenue moved from 120000 to 145000 (+20.8%) between the two latest observed time values.",
      "dataset": {
        "source": "datahub",
        "dataset_id": "sales_q1",
        "dataset_name": "Q1 Sales",
        "row_count": 1280,
        "column_count": 14
      },
      "based_on_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_03t235959_00_00"
      ],
      "metric_ref": {
        "metric_id": "metric_revenue_sum",
        "name": "Revenue",
        "label": "Revenue",
        "field": "Revenue",
        "default_aggregation": "sum",
        "format_hint": "currency"
      },
      "dimension_ref": {
        "dimension_id": "dimension_region",
        "name": "Region",
        "label": "Region",
        "field": "Region",
        "semantic_kind": "categorical",
        "data_type": "string"
      },
      "actions": [
        {
          "action_type": "break_down_metric",
          "label": "Break Revenue down by Region",
          "description": "Use a simple metric + group by breakdown to isolate the change driver.",
          "payload": {
            "metric_id": "metric_revenue_sum",
            "group_by": [
              "Region"
            ]
          }
        }
      ],
      "expected_outcome": "Identify the segment responsible for the latest change.",
      "confidence": 0.84,
      "created_at": "2026-04-03T23:59:59+00:00"
    }
  ],
  "supporting_signals": [],
  "meta": {
    "recommendation_count": 1,
    "empty_dataset": false,
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "warnings": []
}
```

### 4. `POST /api/decision/scenarios/evaluate`

Example request:

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "name": "Upside case",
  "metric_targets": [
    {
      "metric_id": "metric_revenue_sum",
      "adjustment_type": "percent",
      "adjustment_value": 0.08
    }
  ],
  "group_by": [
    "Region"
  ]
}
```

Example response:

```json
{
  "status": "success",
  "request": {
    "filters": [],
    "group_by": [
      "Region"
    ],
    "metric_targets": [
      {
        "metric_id": "metric_revenue_sum",
        "adjustment_type": "percent",
        "adjustment_value": 0.08
      }
    ]
  },
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
  "scenario": {
    "scenario_id": "scenario_upside_case_2026_04_03t235959_00_00",
    "name": "Upside case",
    "status": "scaffolded",
    "summary": "Scenario scaffold evaluated 1 metric targets using simple direct adjustments on semantic metric baselines.",
    "dataset": {
      "source": "datahub",
      "dataset_id": "sales_q1",
      "dataset_name": "Q1 Sales",
      "row_count": 1280,
      "column_count": 14
    },
    "parameters": {
      "filters": [],
      "group_by": [
        "Region"
      ],
      "metric_targets": [
        {
          "metric_id": "metric_revenue_sum",
          "adjustment_type": "percent",
          "adjustment_value": 0.08
        }
      ]
    },
    "baseline_metrics": [
      {
        "metric_ref": {
          "metric_id": "metric_revenue_sum",
          "name": "Revenue",
          "label": "Revenue",
          "field": "Revenue",
          "default_aggregation": "sum",
          "format_hint": "currency"
        },
        "summary_value": 145000,
        "rows": [
          {
            "group": {
              "Region": "East"
            },
            "value": 55000,
            "row_count": 320
          }
        ]
      }
    ],
    "projected_metrics": [
      {
        "metric_ref": {
          "metric_id": "metric_revenue_sum",
          "name": "Revenue",
          "label": "Revenue",
          "field": "Revenue",
          "default_aggregation": "sum",
          "format_hint": "currency"
        },
        "adjustment": {
          "type": "percent",
          "value": 0.08
        },
        "baseline_value": 145000,
        "projected_value": 156600,
        "delta_value": 11600
      }
    ],
    "assumptions": [
      "Phase 1 scenarios apply direct metric adjustments only.",
      "No causal or multi-step simulation is performed yet."
    ],
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "meta": {
    "metric_target_count": 1,
    "empty_dataset": false,
    "generated_at": "2026-04-03T23:59:59+00:00"
  },
  "warnings": []
}
```

## Edge Cases And Expected Behaviors

### Missing dataset context

- Behavior:
  - Returns `400`
  - Error payload uses `status: "error"`
- Typical message:
  - `"No active dataset is available."`

### Empty dataset

- Behavior:
  - Returns `200`
  - `warnings` explains that the dataset is empty
  - Lists such as `signals` or `recommendations` may be empty
  - Scenario still returns scaffold structure

### Missing semantic metric reference

- Behavior:
  - Returns `400`
  - Message identifies the missing metric reference

### Invalid filter or malformed arrays

- Behavior:
  - Returns `400`
  - Message names the invalid field such as `filters`, `metric_ids`, `group_by`, or `metric_targets`

### Scenario adjustments on non-numeric metrics

- Behavior:
  - Baseline metric resolution still runs
  - Projection values may be `null` if the summary value is not numeric

## Loading Expectations

- All four endpoints are synchronous in Phase 1.
- Frontend should treat them as standard request/response calls.
- No streaming or polling is required.
- Frontend should handle `warnings` even on successful responses.
- Frontend should not assume that `signals`, `supporting_signals`, or `recommendations` are non-empty.

## Error Expectations

- Success always uses `status: "success"`.
- Failure always uses `status: "error"` and an `error` object.
- Current error codes:
  - `INVALID_DECISION_REQUEST`
  - `DECISION_SIGNAL_GENERATION_FAILED`
  - `DECISION_BRIEF_GENERATION_FAILED`
  - `RECOMMENDATION_GENERATION_FAILED`
  - `SCENARIO_EVALUATION_FAILED`

## Assumptions Made

- Phase 1 should stay deterministic and lightweight.
- Existing semantic model inference remains the source for metrics and dimensions.
- Existing metric resolution remains the source for metric computations.
- Existing dataset-context resolution remains the source for active, inline, and Data Hub dataset selection.
- Scenario evaluation is intentionally scaffold-level and should not be interpreted as a simulation engine yet.

## Frontend Note

No frontend work required yet.

The backend foundation is now in place and documented. Gemini can wait until a later phase, or begin only when there is an explicit frontend task that needs to consume these decision objects.
