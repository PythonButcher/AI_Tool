# Decision Objects Contract

This document is the current contract reference for backend and frontend integration of the Decision Layer.

All timestamps use ISO-8601 UTC strings. Optional fields may be `null`. All objects below are additive and sit on top of the existing semantic model, metric resolver, and dataset context systems.

## Shared Nested Objects

### Dataset Summary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `source` | `string` | Yes | `active`, `inline`, or `datahub` |
| `dataset_id` | `string \| null` | No | Present when known |
| `dataset_name` | `string` | Yes | Human-readable dataset label |
| `row_count` | `integer` | Yes | Row count for the resolved dataset |
| `column_count` | `integer` | Yes | Column count for the resolved dataset |

### Metric Reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_id` | `string` | Yes | Semantic metric identifier |
| `name` | `string` | Yes | Metric name |
| `label` | `string` | Yes | Display label |
| `field` | `string \| null` | No | Backing field when applicable |
| `default_aggregation` | `string \| null` | No | `sum`, `mean`, `count`, etc. |
| `format_hint` | `string \| null` | No | `number`, `currency`, `percentage`, `date`, or `null` |

### Dimension Reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dimension_id` | `string` | Yes | Semantic dimension identifier |
| `name` | `string` | Yes | Dimension name |
| `label` | `string` | Yes | Display label |
| `field` | `string` | Yes | Backing dataset field |
| `semantic_kind` | `string \| null` | No | `categorical`, `temporal`, etc. |
| `data_type` | `string \| null` | No | `string`, `datetime`, `number`, etc. |

### Time Context

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dimension_id` | `string \| null` | No | Temporal dimension identifier |
| `field` | `string \| null` | No | Temporal field name |
| `grain` | `string \| null` | No | Phase 2 may infer `day`, `week`, `month`, `quarter`, `year`, or fall back to `observed_value` |
| `current_value` | `string \| number \| null` | No | Latest observed grouped value |
| `previous_value` | `string \| number \| null` | No | Previous observed grouped value |

### Period Context

Business-facing label metadata derived from `time_context`. This object is additive and intended for UI copy.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | `string \| null` | No | Business-facing current context label such as `Mar 2026`, `Q1 2026`, or a generic observed-period label |
| `comparison_label` | `string \| null` | No | Business-facing comparison label such as `Feb 2026`, `Q4 2025`, or `Previous period` |
| `current_label` | `string \| null` | No | Explicit formatted label for the current value when available |
| `previous_label` | `string \| null` | No | Explicit formatted label for the previous value when available |
| `grain` | `string \| null` | No | Echoes the inferred grain from `time_context` |
| `comparison_type` | `string \| null` | No | Current implementation uses `sequential_period` when a prior comparison exists |
| `calendar_type` | `string \| null` | No | `calendar` when labels were derived from calendar-aware values, otherwise `observed_value` or `null` |
| `fiscal_calendar` | `object \| null` | No | Reserved for future fiscal-calendar metadata. Current implementation returns `null` unless backend fiscal support is explicitly added. |

## DecisionSignal

Represents a detected change, anomaly, concentration, or data-quality condition that matters for decision-making.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `signal_id` | `string` | Yes | Stable generated identifier |
| `signal_type` | `string` | Yes | `metric_delta`, `anomaly_rate`, `dimension_concentration`, `data_quality` |
| `title` | `string` | Yes | Short headline |
| `summary` | `string` | Yes | Human-readable explanation |
| `severity` | `string` | Yes | `low`, `medium`, `high`, `critical` |
| `status` | `string` | Yes | Phase 1 uses `active` |
| `direction` | `string` | Yes | `up`, `down`, `flat`, `mixed`, `unknown` |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `metric_ref` | `Metric Reference \| null` | No | Present for metric-linked signals |
| `dimension_ref` | `Dimension Reference \| null` | No | Present for dimension-linked signals |
| `time_context` | `Time Context \| null` | No | Present for time-based change signals |
| `evidence` | `object` | Yes | Machine-friendly evidence payload |
| `confidence` | `number` | Yes | `0.0` to `1.0` |
| `importance_score` | `number` | Yes | `0` to `100` |
| `created_at` | `string` | Yes | ISO timestamp |

### `evidence` expectations

- `metric_delta`
  - `kind`: `metric_comparison`
  - `current_value`, `previous_value`, `delta_value`, `delta_pct`
  - `row_count`
  - Optional `semantic_context`: metric semantics such as `metric_type`, `aggregation`, `format_hint`, `business_weight`, `related_metrics`, `time_grain`
  - `chart_hint`: `{ "metric_id": string, "group_by": string[] }`
- `anomaly_rate`
  - `kind`: `dataset_anomaly_scan`
  - `anomaly_count`, `anomaly_rate`, `numeric_field_count`, `row_count`
  - Optional `semantic_context`: scan metadata such as `numeric_fields_scanned`, `scan_scope`
- `dimension_concentration`
  - `kind`: `dimension_distribution`
  - `top_value`, `top_count`, `top_share`, `distinct_count`, `row_count`
  - Optional `semantic_context`: dimension metadata such as `importance_score`, `unique_count`, `null_rate`, `top_share`
- `data_quality`
  - `kind`: `field_null_rate`
  - `field`, `null_count`, `null_rate`, `row_count`
  - Optional `semantic_context`: field metadata such as `field_role`, `field_format_hint`, `is_metric_backed`

### Example

```json
{
  "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_03t235959z",
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
      "group_by": ["Order Date"]
    }
  },
  "confidence": 0.84,
  "importance_score": 72.5,
  "created_at": "2026-04-03T23:59:59+00:00"
}
```

## DecisionBrief

Represents a high-level summary of what matters in a dataset or resolved slice.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `brief_id` | `string` | Yes | Stable generated identifier |
| `title` | `string` | Yes | Short brief title |
| `summary` | `string` | Yes | High-level summary paragraph |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `time_context` | `Time Context \| null` | No | Highest-confidence temporal context when available |
| `period_context` | `Period Context \| null` | No | Business-facing label and comparison metadata derived from `time_context` |
| `headline_signal_ids` | `string[]` | Yes | Ordered signal identifiers that anchor the brief |
| `key_metrics` | `object[]` | Yes | Metric snapshots for quick orientation |
| `themes` | `string[]` | Yes | High-level categories surfaced from signals |
| `confidence` | `number` | Yes | `0.0` to `1.0` |
| `generated_at` | `string` | Yes | ISO timestamp |

### `key_metrics` item schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_ref` | `Metric Reference` | Yes | Referenced semantic metric |
| `current_value` | `number \| string \| null` | No | Current resolved summary value |
| `previous_value` | `number \| string \| null` | No | Previous value when time comparison exists |
| `delta_value` | `number \| null` | No | Current minus previous |
| `delta_pct` | `number \| null` | No | Decimal ratio |
| `period_label` | `string \| null` | No | Business-facing current-period label for the metric card |
| `comparison_label` | `string \| null` | No | Business-facing comparison label for the metric card |
| `status` | `string` | Yes | `changed`, `steady`, `baseline_only` |

### Example

```json
{
  "brief_id": "brief_q1_sales_2026_04_03t235959z",
  "title": "Decision brief for Q1 Sales",
  "summary": "Three actionable signals were detected across tracked metrics. Revenue improved in the latest period, but anomaly activity and regional concentration suggest follow-up analysis.",
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
  "period_context": {
    "label": "Mar 31, 2026",
    "comparison_label": "Mar 30, 2026",
    "current_label": "Mar 31, 2026",
    "previous_label": "Mar 30, 2026",
    "grain": "observed_value",
    "comparison_type": "sequential_period",
    "calendar_type": "observed_value",
    "fiscal_calendar": null
  },
  "headline_signal_ids": [
    "signal_metric_delta_metric_revenue_sum_2026_04_03t235959z",
    "signal_anomaly_rate_q1_sales_2026_04_03t235959z"
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
      "period_label": "Mar 31, 2026",
      "comparison_label": "Mar 30, 2026",
      "status": "changed"
    }
  ],
  "themes": [
    "Performance change",
    "Anomaly monitoring",
    "Concentration risk"
  ],
  "confidence": 0.8,
  "generated_at": "2026-04-03T23:59:59+00:00"
}
```

## Recommendation

Represents a suggested next action derived from one or more decision signals.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `recommendation_id` | `string` | Yes | Stable generated identifier |
| `recommendation_type` | `string` | Yes | `investigate`, `monitor`, `validate`, `optimize` |
| `priority` | `string` | Yes | `low`, `medium`, `high` |
| `status` | `string` | Yes | Phase 1 uses `proposed` |
| `title` | `string` | Yes | Short action-oriented headline |
| `summary` | `string` | Yes | Human-readable recommendation |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `based_on_signal_ids` | `string[]` | Yes | Traceability back to DecisionSignal objects |
| `metric_ref` | `Metric Reference \| null` | No | Present when tied to a metric |
| `dimension_ref` | `Dimension Reference \| null` | No | Present when tied to a dimension |
| `actions` | `object[]` | Yes | Structured next-step hints |
| `expected_outcome` | `string` | Yes | High-level expected result |
| `confidence` | `number` | Yes | `0.0` to `1.0` |
| `created_at` | `string` | Yes | ISO timestamp |

### `actions` item schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action_type` | `string` | Yes | Example: `break_down_metric`, `review_anomalies`, `audit_field_quality` |
| `label` | `string` | Yes | Short display label |
| `description` | `string` | Yes | Explains why to do it |
| `payload` | `object` | Yes | Machine-friendly parameters for future workflow/UI use. Phase 2 should keep chart-ready actions simple: `metric_id` plus `group_by` remain the primary keys, with optional additive context such as `signal_id`. |

### Example

```json
{
  "recommendation_id": "recommendation_investigate_metric_revenue_sum_2026_04_03t235959z",
  "recommendation_type": "investigate",
  "priority": "high",
  "status": "proposed",
  "title": "Investigate the latest revenue shift",
  "summary": "Revenue changed materially in the latest observed period. Break the metric down by a business dimension to isolate the drivers.",
  "dataset": {
    "source": "datahub",
    "dataset_id": "sales_q1",
    "dataset_name": "Q1 Sales",
    "row_count": 1280,
    "column_count": 14
  },
  "based_on_signal_ids": [
    "signal_metric_delta_metric_revenue_sum_2026_04_03t235959z"
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
      "label": "Break revenue down by Region",
      "description": "Use a simple metric + group by breakdown to identify which segment moved.",
      "payload": {
        "metric_id": "metric_revenue_sum",
        "group_by": ["Region"]
      }
    }
  ],
  "expected_outcome": "Identify the segment responsible for the latest change.",
  "confidence": 0.84,
  "created_at": "2026-04-03T23:59:59+00:00"
}
```

## Scenario

Represents a Phase 1 what-if evaluation scaffold. The object is intentionally lightweight and designed for later expansion.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `scenario_id` | `string` | Yes | Stable generated identifier |
| `name` | `string` | Yes | Scenario label |
| `status` | `string` | Yes | Phase 1 uses `scaffolded` |
| `summary` | `string` | Yes | High-level explanation of the evaluation |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `parameters` | `object` | Yes | Echoed scenario inputs |
| `baseline_metrics` | `object[]` | Yes | Resolved current-state metric outputs |
| `projected_metrics` | `object[]` | Yes | Simple projected outputs based on input adjustments |
| `assumptions` | `string[]` | Yes | Explicit Phase 1 assumptions |
| `generated_at` | `string` | Yes | ISO timestamp |

### `baseline_metrics` item schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_ref` | `Metric Reference` | Yes | Metric being evaluated |
| `summary_value` | `number \| string \| null` | No | Baseline summary value |
| `rows` | `object[]` | Yes | Grouped metric rows from the metric resolver |

### `projected_metrics` item schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_ref` | `Metric Reference` | Yes | Metric being evaluated |
| `adjustment` | `object` | Yes | `{ "type": "percent" \| "absolute", "value": number }` |
| `baseline_value` | `number \| null` | No | Numeric baseline when coercible |
| `projected_value` | `number \| null` | No | Numeric projection when coercible |
| `delta_value` | `number \| null` | No | `projected_value - baseline_value` |
| `delta_pct` | `number \| null` | No | Decimal ratio when `baseline_value` is non-zero |
| `projected_rows` | `object[]` | No | Optional grouped projections when `group_by` was provided |
| `comparison_summary` | `object \| null` | No | Optional comparison rollup such as direction, `delta_pct`, projected group count, and largest group change |

### `projected_rows` item schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `group` | `object` | Yes | Group key/value pairs copied from the baseline rows |
| `baseline_value` | `number \| null` | No | Numeric grouped baseline |
| `projected_value` | `number \| null` | No | Numeric grouped projection |
| `delta_value` | `number \| null` | No | Projected minus baseline |
| `delta_pct` | `number \| null` | No | Decimal ratio when baseline is non-zero |
| `row_count` | `integer` | Yes | Row count for the grouped slice |

### Example

```json
{
  "scenario_id": "scenario_upside_case_2026_04_03t235959z",
  "name": "Upside case",
  "status": "scaffolded",
  "summary": "Scenario scaffold evaluated 2 metric targets using simple direct adjustments on semantic metric baselines.",
  "dataset": {
    "source": "datahub",
    "dataset_id": "sales_q1",
    "dataset_name": "Q1 Sales",
    "row_count": 1280,
    "column_count": 14
  },
  "parameters": {
    "filters": [],
    "group_by": ["Region"],
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
}
```

## DecisionScenarioPreview

Represents a Phase 3 lightweight scenario suggestion generated from the connected decision pipeline. It reuses the existing scenario service but returns only preview-oriented inputs and projection summaries.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `string` | Yes | `ready`, `not_applicable`, or `not_requested` |
| `summary` | `string` | Yes | Short explanation of whether a preview was prepared |
| `based_on_recommendation_ids` | `string[]` | Yes | Ordered recommendation identifiers used to prepare the preview |
| `based_on_signal_ids` | `string[]` | Yes | Ordered signal identifiers traced through the recommendations |
| `period_context` | `Period Context \| null` | No | Shared business-facing time/comparison context for the preview when available |
| `suggested_inputs` | `object` | Yes | Lightweight scenario input proposal for future UI or automation use |
| `projections` | `object[]` | Yes | Condensed projected metric outputs derived from the existing scenario service |
| `assumptions` | `string[]` | Yes | Explicit scenario-preview assumptions |
| `generated_at` | `string` | Yes | ISO timestamp |

### `suggested_inputs` schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | `string` | Yes | Suggested scenario label |
| `filters` | `object[]` | Yes | Echoed pipeline filters |
| `group_by` | `string[]` | Yes | Shared chart-compatible grouping fields chosen from recommendation actions |
| `metric_targets` | `object[]` | Yes | Suggested scenario targets |

### `suggested_inputs.metric_targets[]` schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_id` | `string` | Yes | Semantic metric identifier |
| `adjustment_type` | `string` | Yes | Phase 3 uses `percent` |
| `adjustment_value` | `number` | Yes | Deterministic lightweight adjustment inferred from top signals/recommendations |

### `projections[]` schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_ref` | `Metric Reference` | Yes | Metric being previewed |
| `adjustment` | `object` | Yes | Existing scenario-style adjustment object |
| `baseline_value` | `number \| null` | No | Baseline summary value |
| `baseline_label` | `string \| null` | No | Business-facing label for the baseline comparison frame |
| `projected_value` | `number \| null` | No | Projected summary value |
| `projected_label` | `string \| null` | No | Business-facing label for the projected comparison frame |
| `delta_value` | `number \| null` | No | Projected minus baseline |
| `delta_pct` | `number \| null` | No | Decimal ratio when baseline is non-zero |
| `comparison_summary` | `object \| null` | No | Reused comparison rollup from the scenario service |

## DecisionBundle

Represents the Phase 3 unified decision-pipeline output.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `signals` | `DecisionSignal[]` | Yes | Final ranked and filtered signals for the pipeline run |
| `brief` | `DecisionBrief` | Yes | Brief generated from the final filtered signals |
| `recommendations` | `Recommendation[]` | Yes | Recommendations derived from the same signal set |
| `scenario_preview` | `DecisionScenarioPreview` | Yes | Lightweight preview generated from top recommendations or a predictable no-op object |

### Example

```json
{
  "signals": [
    {
      "signal_id": "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00",
      "signal_type": "metric_delta"
    }
  ],
  "brief": {
    "brief_id": "brief_q1_sales_2026_04_04t150000_00_00",
    "headline_signal_ids": [
      "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
    ]
  },
  "recommendations": [
    {
      "recommendation_id": "recommendation_optimize_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00",
      "based_on_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
      ]
    }
  ],
  "scenario_preview": {
    "status": "ready",
    "based_on_recommendation_ids": [
      "recommendation_optimize_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00"
    ],
    "based_on_signal_ids": [
      "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
    ],
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
    "suggested_inputs": {
      "name": "Decision pipeline preview",
      "filters": [],
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
        "baseline_label": "Current Context (Mar 2026)",
        "projected_value": 133400,
        "projected_label": "Projected Context (Mar 2026)",
        "delta_value": -11600,
        "delta_pct": -0.08
      }
    ],
    "assumptions": [
      "Scenario projections apply direct metric adjustments only."
    ],
    "generated_at": "2026-04-04T15:00:00+00:00"
  }
}
```
