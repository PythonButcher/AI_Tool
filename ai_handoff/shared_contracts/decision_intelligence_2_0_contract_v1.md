# Decision Intelligence 2.0 Contract V1

## Status Notice

This contract remains important as historical V2 backend context.

Decision Intelligence V2 is closed as-is.

Use this file as a baseline reference, but treat any further completion or extension work as **V3** work.

## Purpose

This file defines the first backend and product contract for Decision Intelligence 2.0.

This contract replaces the old idea that the primary Decision Intelligence workflow should begin with a broad dataset scan.

The new primary workflow begins by creating a scoped decision workspace.

That workspace is built from:

- a decision prompt
- an objective
- candidate levers
- constraints

This contract is additive.

The current Phase 3 decision endpoints remain available, but they are now legacy implementation inputs rather than the target DI 2.0 product model.

## What This First Contract Covers

This first contract is intentionally narrow.

It covers:

- scoped decision workspace creation
- objective normalization
- lever normalization
- constraint normalization
- relevant metric and dimension scoping
- explicit assumptions, unknowns, and readiness

It does not yet define:

- full simulation execution
- final trade-off path outputs
- goal-seeking execution
- long-lived saved decision records

## Primary Endpoint

- `POST /api/decision/workspaces`

## V3 Additive Continuation Endpoint

V3 now adds a backend continuation path for scoped observational diagnostics:

- `POST /api/decision/workspaces/analyze`

This continuation path is additive and intentionally narrower than the historical V2 simulation draft.

It accepts either:

- the same scoped workspace creation request shape defined in this file
- or a payload containing `dataset` / `dataset_ref`, optional `semantic_model`, and an existing normalized `decision_workspace`

It returns the standard top-level dataset and semantic metadata plus:

- `decision_workspace`
- `workspace_analysis`

`workspace_analysis` is expected to contain:

- `analysis_mode: "scoped_observational"`
- `status` aligned to the workspace status (`ready`, `needs_input`, or `limited`)
- `summary`
- `truthfulness_note`
- `scoped_diagnostics`
- `legacy_diagnostics`
- `generated_at`

Interpretation rules for this continuation path:

- `scoped_diagnostics` must be grounded in the scoped workspace metrics, filters, and available temporal evidence
- `legacy_diagnostics` must remain filtered, additive, and secondary
- this endpoint must not claim simulation, trade-off execution, recommendation completion, or goal-seeking completion

## V3 Additive Prompt-First Intake Extension

The same primary workspace endpoint now also supports a lighter prompt-first intake path:

- `POST /api/decision/workspaces`

This is still the scoped decision workspace contract.

It is **not** Phase 4 chat-first Decision Intelligence.

Prompt-first mode exists so frontend can begin with:

- one plain-English decision prompt
- a few optional helper prompts
- backend-drafted decision structure

Prompt-first request additions:

- `intake_mode: "prompt_first"`
- `decision_intake.what_matters`
- `decision_intake.what_to_avoid`
- `decision_intake.additional_context`

In prompt-first mode:

- `objective` may be omitted
- `levers` may be omitted
- `constraints` may be omitted
- backend drafts any omitted structure from the prompt, helper text, and semantic context

Precedence rule:

- explicit `objective`, `levers`, and `constraints` supplied by the caller always win over drafted values

Response addition:

- `decision_workspace.drafting`

This object is intended to help frontend render a draft-preview and guided refinement layer before the user enters deeper workspace editing.

## Status

- additive to the current backend
- intended to become the primary DI 2.0 entry contract

## Prompt-First Drafting Notes

Current backend drafting behavior is intentionally additive and heuristic, but it now follows these Phase 3.6 rules:

- objective drafting should prioritize the leading goal clause or `decision_intake.what_matters`
- lever drafting should prioritize the explicit lever/change clause or `decision_intake.additional_context`
- guardrail drafting should prioritize `decision_intake.what_to_avoid` plus prompt phrases such as `without`, `protect`, `avoid`, and `keep`
- drafted levers should not re-use the chosen objective metric or drafted guardrail metric

This note is here so frontend and backend both treat prompt-first drafting as clause-aware guidance, not as a single full-prompt metric ranking.
- current `POST /api/decision/run` remains supported as a legacy decision-bundle endpoint during migration
- V3 now also includes a scoped observational analysis continuation path through `POST /api/decision/workspaces/analyze`

## Shared Objects Reused From The Existing Decision Contract

This contract should continue reusing these shared nested objects where applicable:

- `Dataset Summary`
- `Metric Reference`
- `Dimension Reference`
- `Time Context`
- `Period Context`

Source:

- `ai_handoff/shared_contracts/decision_objects.md`

## Contract Version

Responses for this contract should include:

- `contract_version: "di_2_0_v1"`

This is required so frontend can distinguish the scoped-workspace contract from the current legacy decision bundle.

## Request Shape

Successful callers create a scoped workspace by sending:

```json
{
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "decision_prompt": "How should we grow Q3 revenue without hurting gross margin?",
  "objective": {
    "statement": "Increase revenue next quarter while protecting gross margin",
    "metric_id": "metric_revenue_sum",
    "direction": "maximize",
    "target": {
      "operator": "gte",
      "value": 0.15,
      "unit": "ratio"
    },
    "time_horizon": {
      "kind": "relative_period",
      "label": "Next quarter",
      "grain": "quarter"
    }
  },
  "levers": [
    {
      "lever_id": "price",
      "label": "Average selling price",
      "lever_type": "numeric_input",
      "binding": {
        "metric_id": "metric_avg_order_value"
      },
      "desired_change": "increase"
    },
    {
      "lever_id": "discounting",
      "label": "Discounting",
      "lever_type": "policy_choice",
      "binding": {
        "field": "Discount Rate"
      },
      "desired_change": "decrease"
    }
  ],
  "constraints": [
    {
      "constraint_id": "margin_floor",
      "label": "Gross margin floor",
      "constraint_type": "metric_guardrail",
      "binding": {
        "metric_id": "metric_margin_pct"
      },
      "condition": {
        "operator": "gte",
        "value": 0.32,
        "unit": "ratio"
      },
      "hardness": "hard"
    }
  ],
  "filters": [
    {
      "field": "Region",
      "operator": "neq",
      "value": "Unknown"
    }
  ],
  "scope_preferences": {
    "max_candidate_metrics": 8,
    "max_candidate_dimensions": 6,
    "include_diagnostics": false
  }
}
```

## Top-Level Request Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dataset` | `object[] \| object \| null` | No | Inline dataset, following the existing dataset-context pattern |
| `dataset_ref` | `object \| null` | No | Existing dataset reference, following the existing dataset-context pattern |
| `semantic_model` | `object \| null` | No | Optional explicit semantic model override |
| `intake_mode` | `string \| null` | No | `structured` or `prompt_first`. Default remains structured when explicit scope fields are present. |
| `decision_intake` | `Decision Intake \| null` | No | Optional helper-prompt answers for prompt-first drafting. |
| `decision_prompt` | `string` | Yes | The business problem being framed |
| `objective` | `Objective Input \| null` | Conditional | Required for structured requests. Optional in prompt-first mode, where backend drafts it if omitted. |
| `levers` | `Lever Input[] \| null` | Conditional | Required for structured requests. Optional in prompt-first mode, where backend may draft candidate levers if omitted. |
| `constraints` | `Constraint Input[] \| null` | Conditional | Required for structured requests. Optional in prompt-first mode, where backend may draft guardrails if omitted. |
| `filters` | `object[]` | No | Existing metric-resolver filter shape. These narrow the workspace scope, not the decision meaning. |
| `scope_preferences` | `Scope Preferences \| null` | No | Workspace scoping hints only. These do not change the business meaning of the decision. |

## Decision Intake

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `what_matters` | `string \| null` | No | Plain-English success framing to help backend draft the objective. |
| `what_to_avoid` | `string \| null` | No | Plain-English guardrail prompt used to draft possible constraints. |
| `additional_context` | `string \| null` | No | Extra business context used for candidate lever or scope drafting. |

## Scope Preferences

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `max_candidate_metrics` | `integer` | No | Default `8`, max `20` |
| `max_candidate_dimensions` | `integer` | No | Default `6`, max `12` |
| `include_diagnostics` | `boolean` | No | Default `false`. When `true`, backend may attach supplemental diagnostic notes, but diagnostics must remain secondary to the decision scope. |

## Time Horizon

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `string` | Yes | `relative_period`, `absolute_range`, or `open_ended` |
| `label` | `string` | Yes | Business-facing label such as `Next quarter` or `Holiday season` |
| `start` | `string \| null` | No | ISO-8601 date or datetime when known |
| `end` | `string \| null` | No | ISO-8601 date or datetime when known |
| `grain` | `string \| null` | No | `day`, `week`, `month`, `quarter`, `year`, or `null` |

## Value Condition

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `operator` | `string` | Yes | `gte`, `lte`, `eq`, `between`, `in`, or `not_in` |
| `value` | `number \| string \| boolean \| null` | No | Primary threshold value |
| `secondary_value` | `number \| string \| null` | No | Required when `operator` is `between` |
| `values` | `array \| null` | No | Used for `in` or `not_in` |
| `unit` | `string \| null` | No | Example: `ratio`, `currency`, `units`, `days`, `headcount` |

## Binding Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_id` | `string \| null` | No | Preferred when the item maps to a semantic metric |
| `metric_name` | `string \| null` | No | Additive metric lookup fallback |
| `dimension_id` | `string \| null` | No | Preferred when the item maps to a semantic dimension |
| `dimension_name` | `string \| null` | No | Additive dimension lookup fallback |
| `field` | `string \| null` | No | Dataset-field fallback when no semantic object exists yet |

## Objective Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `objective_id` | `string \| null` | No | Optional client-stable identifier |
| `statement` | `string` | Yes | Human-readable objective statement |
| `metric_id` | `string \| null` | No | Direct metric binding shortcut |
| `metric_name` | `string \| null` | No | Additive metric lookup fallback |
| `direction` | `string` | Yes | `maximize`, `minimize`, `maintain`, or `achieve_target` |
| `target` | `Value Condition \| null` | No | Used when the objective has a measurable threshold |
| `time_horizon` | `Time Horizon \| null` | No | Business-facing decision horizon |

## Lever Bounds

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `min_value` | `number \| string \| null` | No | Minimum allowable setting |
| `max_value` | `number \| string \| null` | No | Maximum allowable setting |
| `allowed_values` | `array \| null` | No | Used for categorical or policy-style levers |
| `unit` | `string \| null` | No | Example: `ratio`, `currency`, `days` |

## Lever Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `lever_id` | `string \| null` | No | Optional client-stable identifier |
| `label` | `string` | Yes | Business-facing lever name |
| `description` | `string \| null` | No | Optional clarifying text |
| `lever_type` | `string` | Yes | `numeric_input`, `policy_choice`, `allocation`, `timing`, `mix`, or `custom` |
| `binding` | `Binding Input \| null` | No | Optional semantic or field binding |
| `desired_change` | `string \| null` | No | `increase`, `decrease`, `tighten`, `loosen`, `shift`, `set`, or `test` |
| `current_value` | `number \| string \| boolean \| null` | No | Current known setting when available |
| `bounds` | `Lever Bounds \| null` | No | Optional allowable range or allowed values |
| `controllable` | `boolean` | No | Default `true`. If `false`, backend should warn that the item may be a context factor rather than a real lever. |

## Constraint Input

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `constraint_id` | `string \| null` | No | Optional client-stable identifier |
| `label` | `string` | Yes | Business-facing constraint label |
| `description` | `string \| null` | No | Optional clarifying text |
| `constraint_type` | `string` | Yes | `metric_guardrail`, `operating_limit`, `capacity_limit`, `time_limit`, `policy_rule`, or `custom` |
| `binding` | `Binding Input \| null` | No | Optional semantic or field binding |
| `condition` | `Value Condition` | Yes | Required guardrail rule |
| `hardness` | `string` | Yes | `hard` or `soft` |
| `rationale` | `string \| null` | No | Optional explanation of why the limit exists |

## Response Shape

Successful responses use:

```json
{
  "status": "success",
  "contract_version": "di_2_0_v1",
  "dataset": {},
  "semantic_model": {},
  "decision_workspace": {},
  "meta": {},
  "warnings": []
}
```

Error responses use:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_DECISION_WORKSPACE_REQUEST",
    "message": "Human-readable message"
  }
}
```

## Binding Resolution

Backend must normalize any objective, lever, or constraint binding into the following structure.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `binding_type` | `string` | Yes | `metric`, `dimension`, `field`, or `none` |
| `status` | `string` | Yes | `resolved`, `partial`, or `unresolved` |
| `metric_ref` | `Metric Reference \| null` | No | Present when resolved to a metric |
| `dimension_ref` | `Dimension Reference \| null` | No | Present when resolved to a dimension |
| `field` | `string \| null` | No | Present when bound directly to a dataset field |
| `reason` | `string \| null` | No | Human-readable explanation when resolution is partial or unresolved |

## Normalized Objective

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `objective_id` | `string \| null` | No | Echoed or generated identifier |
| `statement` | `string` | Yes | Human-readable objective |
| `direction` | `string` | Yes | Same value as the request |
| `target` | `Value Condition \| null` | No | Normalized target |
| `time_horizon` | `Time Horizon \| null` | No | Normalized horizon |
| `metric_ref` | `Metric Reference \| null` | No | Resolved primary metric when available |
| `resolution_status` | `string` | Yes | `resolved`, `partial`, or `unresolved` |
| `reason` | `string \| null` | No | Explains any unresolved state |

## Normalized Lever

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `lever_id` | `string \| null` | No | Echoed or generated identifier |
| `label` | `string` | Yes | Human-readable lever name |
| `description` | `string \| null` | No | Optional clarifying text |
| `lever_type` | `string` | Yes | Same value as the request |
| `binding` | `Binding Resolution` | Yes | Resolved binding information |
| `desired_change` | `string \| null` | No | Desired movement |
| `current_value` | `number \| string \| boolean \| null` | No | Echoed current state |
| `bounds` | `Lever Bounds \| null` | No | Echoed normalized bounds |
| `controllable` | `boolean` | Yes | Echoed or defaulted |

## Normalized Constraint

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `constraint_id` | `string \| null` | No | Echoed or generated identifier |
| `label` | `string` | Yes | Human-readable constraint name |
| `description` | `string \| null` | No | Optional clarifying text |
| `constraint_type` | `string` | Yes | Same value as the request |
| `binding` | `Binding Resolution` | Yes | Resolved binding information |
| `condition` | `Value Condition` | Yes | Normalized rule |
| `hardness` | `string` | Yes | `hard` or `soft` |
| `rationale` | `string \| null` | No | Optional explanation |

## Scoped Decision Context

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `relevant_metrics` | `Metric Reference[]` | Yes | Metrics directly relevant to the objective, levers, constraints, or immediate comparison needs |
| `relevant_dimensions` | `Dimension Reference[]` | Yes | Dimensions relevant to segmentation or comparison inside this workspace |
| `comparison_dimensions` | `Dimension Reference[]` | Yes | Small comparison set the workspace should start from |
| `applied_filters` | `object[]` | Yes | Normalized slice filters used to scope the workspace |
| `time_context` | `Time Context \| null` | No | Highest-confidence temporal context for the scoped workspace |
| `period_context` | `Period Context \| null` | No | Business-facing time labels for the scoped workspace |
| `notes` | `string[]` | Yes | Scope notes such as why a metric or dimension was included or excluded |

## Assumption

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assumption_id` | `string` | Yes | Stable generated identifier |
| `label` | `string` | Yes | Short assumption statement |
| `category` | `string` | Yes | `data`, `business`, `timeframe`, `scope`, or `modeling` |
| `status` | `string` | Yes | `active` |
| `materiality` | `string` | Yes | `low`, `medium`, or `high` |

## Unknown

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `unknown_id` | `string` | Yes | Stable generated identifier |
| `label` | `string` | Yes | Short unknown or missing-information statement |
| `category` | `string` | Yes | `data_gap`, `binding_gap`, `constraint_gap`, `baseline_gap`, or `modeling_gap` |
| `severity` | `string` | Yes | `low`, `medium`, or `high` |
| `blocks_simulation` | `boolean` | Yes | `true` when this gap should prevent simulation or trade-off execution |

## Workspace Readiness

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `scope_complete` | `boolean` | Yes | `true` when the objective exists and at least one controllable lever is present |
| `objective_ready` | `boolean` | Yes | `true` when the objective is resolved enough to evaluate |
| `lever_ready` | `boolean` | Yes | `true` when at least one lever is controllable and not fully unresolved |
| `constraint_ready` | `boolean` | Yes | `true` when all declared hard constraints are structurally valid |
| `can_run_simulation` | `boolean` | Yes | Structural truth flag. `true` when the workspace has enough resolved structure for future simulation work, even though V2 simulation surfaces are not part of this contract |
| `missing_inputs` | `string[]` | Yes | Concrete missing items such as `objective.metric_id` or `at_least_one_resolved_lever` |

## Decision Workspace

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `workspace_id` | `string` | Yes | Stable generated identifier |
| `workspace_type` | `string` | Yes | `scoped_decision` |
| `status` | `string` | Yes | `ready`, `needs_input`, or `limited`. `needs_input` is for missing scope structure, `limited` is for materially unresolved scope, and `ready` is for structurally valid V1 workspaces |
| `title` | `string` | Yes | Short workspace title |
| `decision_prompt` | `string` | Yes | Echoed business problem |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `decision_scope` | `object` | Yes | Contains normalized `objective`, `levers`, and `constraints` |
| `scope_summary` | `string` | Yes | Human-readable description of the scoped workspace |
| `scoped_context` | `Scoped Decision Context` | Yes | Relevant metrics, dimensions, time context, and notes |
| `assumptions` | `Assumption[]` | Yes | Explicit assumptions the workspace currently depends on |
| `unknowns` | `Unknown[]` | Yes | Explicit gaps and blockers |
| `readiness` | `Workspace Readiness` | Yes | Controls whether frontend should treat the workspace as runnable |
| `drafting` | `Workspace Drafting` | Yes | Additive Phase 3.5 metadata describing prompt-first helper inputs, source ownership, prompt matches, and clarification hints. |
| `created_at` | `string` | Yes | ISO-8601 UTC timestamp |

## Workspace Drafting

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `intake_mode` | `string` | Yes | `structured` or `prompt_first` |
| `helper_prompts` | `object` | Yes | Echoes `decision_intake.what_matters`, `what_to_avoid`, and `additional_context` when provided |
| `source_summary` | `object` | Yes | Indicates whether `objective`, `levers`, and `constraints` came from `user_input`, `system_draft`, or `none` |
| `prompt_matches.metrics` | `Metric Reference[]` | Yes | Ranked semantic metrics that matched the intake text strongly enough to help draft the workspace |
| `prompt_matches.dimensions` | `Dimension Reference[]` | Yes | Ranked semantic dimensions that matched the intake text strongly enough to help draft the workspace |
| `clarification_hints` | `string[]` | Yes | Suggested follow-up prompts frontend can surface before advanced editing |

## Example Response

```json
{
  "status": "success",
  "contract_version": "di_2_0_v1",
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
  "decision_workspace": {
    "workspace_id": "decision_workspace_q3_revenue_margin_2026_04_12t150000_00_00",
    "workspace_type": "scoped_decision",
    "status": "ready",
    "title": "Q3 revenue growth with margin guardrails",
    "decision_prompt": "How should we grow Q3 revenue without hurting gross margin?",
    "dataset": {
      "source": "datahub",
      "dataset_id": "sales_q1",
      "dataset_name": "Q1 Sales",
      "row_count": 1280,
      "column_count": 14
    },
    "decision_scope": {
      "objective": {
        "objective_id": "objective_growth",
        "statement": "Increase revenue next quarter while protecting gross margin",
        "direction": "maximize",
        "target": {
          "operator": "gte",
          "value": 0.15,
          "unit": "ratio"
        },
        "time_horizon": {
          "kind": "relative_period",
          "label": "Next quarter",
          "grain": "quarter",
          "start": null,
          "end": null
        },
        "metric_ref": {
          "metric_id": "metric_revenue_sum",
          "name": "Revenue",
          "label": "Revenue",
          "field": "Revenue",
          "default_aggregation": "sum",
          "format_hint": "currency"
        },
        "resolution_status": "resolved",
        "reason": null
      },
      "levers": [
        {
          "lever_id": "price",
          "label": "Average selling price",
          "description": null,
          "lever_type": "numeric_input",
          "binding": {
            "binding_type": "metric",
            "status": "resolved",
            "metric_ref": {
              "metric_id": "metric_avg_order_value",
              "name": "Average Order Value",
              "label": "Average Order Value",
              "field": "Order Value",
              "default_aggregation": "mean",
              "format_hint": "currency"
            },
            "dimension_ref": null,
            "field": null,
            "reason": null
          },
          "desired_change": "increase",
          "current_value": null,
          "bounds": null,
          "controllable": true
        }
      ],
      "constraints": [
        {
          "constraint_id": "margin_floor",
          "label": "Gross margin floor",
          "description": null,
          "constraint_type": "metric_guardrail",
          "binding": {
            "binding_type": "metric",
            "status": "resolved",
            "metric_ref": {
              "metric_id": "metric_margin_pct",
              "name": "Gross Margin %",
              "label": "Gross Margin %",
              "field": "Gross Margin %",
              "default_aggregation": "mean",
              "format_hint": "percentage"
            },
            "dimension_ref": null,
            "field": null,
            "reason": null
          },
          "condition": {
            "operator": "gte",
            "value": 0.32,
            "secondary_value": null,
            "values": null,
            "unit": "ratio"
          },
          "hardness": "hard",
          "rationale": null
        }
      ]
    },
    "scope_summary": "This workspace is focused on revenue growth next quarter, with price and discount policy as candidate levers and gross margin as a hard guardrail.",
    "scoped_context": {
      "relevant_metrics": [
        {
          "metric_id": "metric_revenue_sum",
          "name": "Revenue",
          "label": "Revenue",
          "field": "Revenue",
          "default_aggregation": "sum",
          "format_hint": "currency"
        },
        {
          "metric_id": "metric_margin_pct",
          "name": "Gross Margin %",
          "label": "Gross Margin %",
          "field": "Gross Margin %",
          "default_aggregation": "mean",
          "format_hint": "percentage"
        }
      ],
      "relevant_dimensions": [
        {
          "dimension_id": "dimension_region",
          "name": "Region",
          "label": "Region",
          "field": "Region",
          "semantic_kind": "categorical",
          "data_type": "string"
        }
      ],
      "comparison_dimensions": [
        {
          "dimension_id": "dimension_region",
          "name": "Region",
          "label": "Region",
          "field": "Region",
          "semantic_kind": "categorical",
          "data_type": "string"
        }
      ],
      "applied_filters": [
        {
          "field": "Region",
          "operator": "neq",
          "value": "Unknown"
        }
      ],
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
      "notes": [
        "Broad dataset scanning was not used as the primary workflow.",
        "The scoped metric set was limited to the objective, hard constraints, and likely lever-adjacent metrics.",
        "Legacy decision-bundle diagnostics remain available through /api/decision/run but were not used to define this scoped workspace."
      ]
    },
    "assumptions": [
      {
        "assumption_id": "assumption_next_quarter",
        "label": "The objective horizon refers to the next quarter relative to the current business context.",
        "category": "timeframe",
        "status": "active",
        "materiality": "medium"
      }
    ],
    "unknowns": [
      {
        "unknown_id": "unknown_discount_binding",
        "label": "Discounting is represented as a raw field and not yet a semantic metric.",
        "category": "binding_gap",
        "severity": "medium",
        "blocks_simulation": false
      }
    ],
    "readiness": {
      "scope_complete": true,
      "objective_ready": true,
      "lever_ready": true,
      "constraint_ready": true,
      "can_run_simulation": true,
      "missing_inputs": []
    },
    "created_at": "2026-04-12T15:00:00+00:00"
  },
  "meta": {
    "relevant_metric_count": 2,
    "relevant_dimension_count": 1,
    "unknown_count": 1,
    "generated_at": "2026-04-12T15:00:00+00:00"
  },
  "warnings": []
}
```

## Interpretation Rules

These rules are part of the contract.

### 1. Scoped Means Scoped

`decision_workspace.scoped_context.relevant_metrics` and `relevant_dimensions` must only include items needed for this decision.

They are not allowed to behave like:

- top dataset metrics
- general dataset overview
- a hidden full-dataset scan result

**Backend Note**: Dimensional scoping should ideally be driven by the decision prompt or lever bindings (e.g., if a lever is "Ad Spend by Region", "Region" is a required dimension), rather than just selecting the first N dimensions from the dataset.

### 2. The Objective Is The Anchor

The workspace objective must be treated as the primary anchor for scoping.

If the objective is unresolved, the workspace must not pretend the decision is fully ready.

### 3. Levers Must Be Controllable

If an item is not actually controllable, backend should not silently treat it as a lever.

It should either:

- return `controllable: false`
- or surface a warning or unknown explaining the issue

### 4. Constraints Must Stay Honest

Constraints must be returned as actual limits or guardrails.

Backend must not fabricate convenient placeholder constraints to make the workspace look more complete than it is.

### 5. Assumptions And Unknowns Must Be First-Class

Assumptions are not the same as unknowns.

The contract must keep them separate.

The UI should be able to show:

- what the workspace is assuming
- what the workspace still does not know
- whether those gaps block deeper modeling

### 6. Ready Does Not Mean Simulated

`decision_workspace.status: "ready"` only means the scoped workspace is structurally valid enough for a user to work inside it.

It does not mean:

- trade-offs are computed
- scenarios are executed
- a recommendation path already exists

Additional status interpretation:

- `needs_input` means the workspace does not yet have enough declared scope structure, especially around controllable levers
- `limited` means the workspace exists, but unresolved objective, lever, or hard-constraint gaps still materially limit it
- `ready` means the workspace has no remaining V1 missing inputs

Additional readiness interpretation:

- `readiness.can_run_simulation: true` is only a structural signal that the workspace is modeled enough for future simulation work
- it must not be interpreted as proof that the V2 simulation UI or endpoints already exist

### 7. Broad Scan Is Legacy

The current signal pipeline may still exist in code, but this contract must not use ranked dataset-wide signals as the primary product frame.

Any reused diagnostics must remain secondary.

The additive legacy path remains:

- `POST /api/decision/run`

But it is not the primary DI 2.0 workspace model and should not define the scoped workspace response.

## Backend Reuse Vs Replace

### Reuse Directly

These are strong backend foundations and should remain part of DI 2.0:

- `backend/services/dataset_context.py`
  - reuse dataset loading and `resolve_dataset_bundle()`
- `backend/services/semantic_model.py`
  - reuse semantic-model inference, normalization, and user-defined metric support
- `backend/services/metric_resolver.py`
  - reuse as the core quantitative resolution engine
- `backend/services/decision_support.py`
  - reuse helpers for:
  - `resolve_decision_context()`
  - `build_metric_ref()`
  - `build_dimension_ref()`
  - `normalize_filters()`
  - `build_period_context()`
  - `build_time_context()`

### Reuse Selectively

These are useful, but only as subordinate pieces:

- `select_metrics()` in `decision_support.py`
  - keep as a base utility, but replace the current selection strategy with objective / lever / constraint-aware scoping
- `list_candidate_dimensions()` and `select_breakdown_dimensions()`
  - reuse as candidate-comparison helpers, not as the source of decision structure
- `detect_anomalies()` from `backend/services/ml_logic.py`
  - optional diagnostic input only, never the main decision engine

### Replace As The Primary DI Experience

These services reflect the old broad-scan paradigm and should no longer define the product:

- `backend/services/decision_signal_service.py`
  - replace as the primary decision entrypoint
- `backend/services/decision_brief_service.py`
  - replace the current signal-summary brief with a scoped-decision workspace brief
- `backend/services/recommendation_service.py`
  - replace current chart-launch recommendations with real decision-path logic later
- `backend/services/scenario_service.py`
  - replace the direct-adjustment scaffold as the DI 2.0 simulation model
- `backend/services/decision_pipeline_service.py`
  - deprecate as the main DI surface once the workspace contract is live

### Route Strategy

`backend/routes/decision.py` should be extended, not broken.

The correct near-term path is:

- keep legacy endpoints intact
- add the new scoped workspace endpoint
- migrate frontend to the new contract
- retire old primary usage only after the new flow is stable

## Immediate Codex Follow-Up

The next backend implementation slice should be:

- add `POST /api/decision/workspaces`
- build normalization for objective, levers, and constraints
- build scoped metric and dimension selection from those inputs
- return explicit assumptions, unknowns, and readiness

That is the correct next execution step after this contract.
