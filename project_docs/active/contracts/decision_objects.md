# Decision Objects Contract

This document is the current contract reference for backend and frontend integration of the Decision Layer.

All timestamps use ISO-8601 UTC strings. Optional fields may be `null`. All objects below are additive and sit on top of the existing semantic model, metric resolver, and dataset context systems.

## Shared Nested Objects

### Decision Readiness State

Additive readiness metadata returned by Decision Chat responses and Decision Workspace objects. These fields are the backend-owned truth source for whether a decision frame is structurally ready, what action is allowed next, and which capabilities are explicitly unsupported.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `readiness_state` | `string` | Yes | `analysis_ready`, `blocked`, `limited`, or `not_applicable` on non-decision chat responses |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only` |
| `structural_readiness` | `object` | Yes | Flags for `ready_for_observational_analysis`, `ready_for_recommendation`, `ready_for_simulation`, `ready_for_optimization`, `ready_for_autonomous_decisioning`, and `missing_inputs` |
| `blocked_state` | `object` | Yes | Includes `is_blocked`, `blocked_action_ids`, `blocking_missing_inputs`, and `blocking_unknown_ids` |
| `allowed_next_actions` | `string[]` | Yes | Backend-approved action IDs such as `analyze_workspace`, `show_blockers`, `open_workspace`, and `show_assumptions` |
| `capability_state` | `object` | Yes | Capability map described below |
| `unsupported_capabilities` | `string[]` | Yes | Current values include `simulation`, `optimization`, `autonomous_decisioning`, and `final_recommendation` |
| `not_ready_for_recommendation` | `boolean` | Yes | Current Decision Intelligence output remains observational and should not be rendered as a final recommendation |

Legacy compatibility note: existing fields such as `can_run_simulation` and `blocks_simulation` remain available for older frontend code. They must not be interpreted as a current runtime simulation feature. New code should prefer `capability_state.simulation.status == "unsupported"` and `truth_boundary == "observational_analysis_only"`.

### Capability State

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `observational_analysis` | `Capability Item` | Yes | Supported; available only when the decision frame is structurally ready |
| `workspace_open` | `Capability Item` | Yes | Supported when a draft workspace exists |
| `simulation` | `Capability Item` | Yes | Unsupported in the current runtime |
| `optimization` | `Capability Item` | Yes | Unsupported in the current runtime |
| `autonomous_decisioning` | `Capability Item` | Yes | Unsupported in the current runtime |
| `final_recommendation` | `Capability Item` | Yes | Unsupported; current output is decision support, not final recommendation |
| `requested_capabilities` | `string[]` | Chat only | Echoes detected unsupported or sensitive capability requests from the user message |
| `unsupported_requested_capabilities` | `string[]` | Chat only | Intersection of requested capabilities and backend-unsupported capabilities |
| `truth_boundary` | `string` | Chat only | Current value is `observational_analysis_only` |

### Capability Item

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `supported` | `boolean` | Yes | Whether the backend supports the capability |
| `available` | `boolean` | Yes | Whether the capability can be used in the current frame |
| `status` | `string` | Yes | `allowed`, `blocked`, `unsupported`, or `not_applicable` |
| `reason` | `string` | Yes | Human-readable reason suitable for UI tooltips or diagnostics |

### Dataset Summary

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `source` | `string` | Yes | `active`, `inline`, or `datahub` |
| `dataset_id` | `string \| null` | No | Present when known |
| `dataset_name` | `string` | Yes | Human-readable dataset label |
| `row_count` | `integer` | Yes | Row count for the resolved dataset |
| `column_count` | `integer` | Yes | Column count for the resolved dataset |

### Dataset Trust

Phase 2 of AI Chat Decision Output Unification adds `dataset_trust` additively to Decision Chat turn and action responses and to the artifacts in those responses. `dataset_trust` is backend-owned source truth for the data that powered the response. It must stay conservative: when the backend cannot prove source, freshness, or cleaning state, it returns `unknown` and a warning instead of guessing.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dataset` | `Dataset Summary \| null` | Yes | Resolved dataset summary when the backend can identify row and column counts. `null` when no dataset was provided or resolved. |
| `source_label` | `string` | Yes | Business-facing source label such as `Active dataset`, `Uploaded data`, `Cleaned data`, `Inline payload`, `Data Hub`, or `No dataset`. |
| `row_count` | `integer` | Yes | Row count used for the response. `0` when no dataset is available. |
| `column_count` | `integer` | Yes | Column count used for the response. `0` when no dataset is available. |
| `semantic_ready` | `boolean` | Yes | Whether the provided semantic model has at least metric or dimension context. This is readiness for semantic grounding, not proof that every decision role is complete. |
| `transform_state` | `string` | Yes | `cleaned`, `raw`, `transformed`, or `unknown`. Inline payloads default to `raw`; active or Data Hub datasets default to `unknown` unless the payload proves more. |
| `stale_state` | `string` | Yes | `current`, `possibly_stale`, `unknown`, or `not_applicable`. Inline payloads default to `not_applicable`; active or Data Hub datasets default to `unknown` unless the payload proves more. |
| `warnings` | `string[]` | Yes | Short caveats explaining missing dataset, inferred source, unproven semantic readiness, unknown transform state, or unknown stale state. |

Current placement:

`DecisionChatService.handle_turn` returns top-level `dataset_trust`, adds the same object to each returned artifact, and adds it under `session_state.context_summary.dataset_trust` and `session_state.decision_state.dataset_trust` when those state objects exist. `draft_workspace_preview` also receives `dataset_trust` when a draft workspace exists.

`DecisionChatService.handle_action` returns top-level `dataset_trust`, adds the same object to each returned artifact, and stores it in returned session state. Chat turn and action error responses include `dataset_trust` when the request fails before a normal response can be built.

### AI Chat Artifact Source

Decision Chat artifacts keep a compact `source` label that describes the backend path that produced the artifact. For chart artifacts, an explicit `content.meta.source` is authoritative and is copied to top-level `artifact.source`. Charts produced by semantic metric analytics use `source: "semantic_metric"` and `content.meta.source: "semantic_metric"` because the metric resolver supplied the grouped values and semantic lineage. Raw chart artifacts that do not provide `content.meta.source` fall back to `chart_engine`.

Frontend code should render by `artifact.type` and `render_hint` first. It may use `source` for lineage, badges, diagnostics, or source-specific affordances, but should not require `source === "chart_engine"` to render a chart.

### AI Chat Decision Output

Phase 3 of AI Chat Decision Output Unification adds a backend-owned `decision_output` artifact. It is additive and does not replace existing `workspace_preview` or `workspace_analysis_summary` artifacts during the transition. AI Chat decision prompt responses keep `workspace_preview` first for compatibility and append `decision_output`. `analyze_workspace` action responses keep `workspace_analysis_summary` first and append `decision_output`. Correction responses through the existing `draft_workspace` action keep `workspace_preview` first and append an updated `decision_output`. Phase 6 normalizes ranked diagnostics into a display-ready Evidence Board inside this artifact.

`decision_output` is display-ready enough for the AI Chat output pane. Frontend code should not reverse-engineer raw workspace internals for the primary decision output sections when these fields are present.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `string` | Yes | Current value is `decision_output`. |
| `render_hint` | `string` | Yes | Current value is `decision_output`. |
| `inspectable` | `boolean` | Yes | Current value is `true`; artifact inspection should remain available. |
| `default_view` | `string` | Yes | Current value is `inspector`. |
| `schema_version` | `string` | Yes | Current value is `di_phase3_decision_output_v1`. |
| `title` | `string` | Yes | Business-facing title derived from the current workspace title. |
| `summary` | `string` | Yes | Executive brief text. For analyzed workspaces this comes from `workspace_analysis.summary` when available; otherwise it summarizes readiness or missing inputs. |
| `dataset_trust` | `Dataset Trust` | Yes | Same Dataset Trust object returned top-level and attached to artifacts. |
| `frame` | `Decision Output Frame` | Yes | Goal, Drivers, Limits, Breakdowns, Assumptions, Unknowns, and scope summary composed from the current workspace. |
| `readiness` | `Decision Readiness State` | Yes | Existing readiness object adapted for display. The truth boundary remains `observational_analysis_only`. |
| `correction_state` | `object` | Yes | Latest correction result when a correction was applied, or latest workspace correction-history item when a later action such as `analyze_workspace` is using previously corrected state. `status` is `updated` when either source exists and `not_applied` when the workspace has no correction state. |
| `evidence_board` | `Decision Output Evidence Board` | Yes | Normalized view of `workspace_analysis.ranked_diagnostics`, or `not_analyzed` when analysis has not run. |
| `decision_map` | `Decision Output Map` | Yes | Read-only map of dataset, frame, evidence, missing inputs, and advanced gates. Edges are explicitly non-causal. |
| `scenario_compare` | `object` | Yes | Bounded scenario preview when available, otherwise a `not_applicable` object with limitations. It is not a forecast, optimizer, or causal simulation. |
| `advanced_gates` | `object[]` | Yes | Unsupported or gated capabilities such as simulation, optimization, autonomous decisioning, and final recommendation with backend reasons. |
| `export_sections` | `object[]` | Yes | Concise export-ready sections for Executive Brief, Dataset Trust, Decision Frame, Evidence Board, Decision Map, Scenario Compare, and Truth Boundary. |
| `source_refs` | `object` | Yes | Trace refs back to workspace ID/status, analysis presence, ranked diagnostic IDs, correction status, and scenario status. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

#### Decision Output Frame

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `goal` | `object` | Yes | Existing `decision_scope.objective` object. |
| `drivers` | `object[]` | Yes | Existing `decision_scope.levers` objects. |
| `limits` | `object[]` | Yes | Existing `decision_scope.constraints` objects. |
| `breakdowns` | `object[]` | Yes | Existing `decision_scope.segment_dimensions` objects. |
| `assumptions` | `object[]` | Yes | Existing workspace assumptions. |
| `unknowns` | `object[]` | Yes | Existing workspace unknowns. |
| `scope_summary` | `string \| null` | No | Existing workspace scope summary. |

#### Decision Output Evidence Board

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `string` | Yes | `not_analyzed` before analysis, `analyzed` after ranked diagnostics are available. |
| `summary` | `string` | Yes | Business-facing analysis summary, instruction to run analysis, or a conservative note that analysis ran without ranked diagnostics. |
| `items` | `object[]` | Yes | Normalized ranked diagnostic items. Empty when not analyzed. |
| `observational_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Evidence Board item fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `rank` | `integer` | Yes | Evidence order copied from `evidence_rank` or generated from list order. |
| `title` | `string` | Yes | Human-readable evidence title. |
| `summary` | `string` | Yes | Diagnostic summary text, falling back to the source diagnostic summary or a conservative diagnostic-status summary. |
| `covers` | `object` | Yes | Goal, Drivers, Limits, Breakdowns, context role coverage, and temporal coverage derived from semantic coverage. Current keys are `goal`, `drivers`, `limits`, `breakdowns`, `context_roles`, and `temporal`. |
| `strength` | `string` | Yes | `strong`, `moderate`, `weak`, or `insufficient`. |
| `data_sufficiency` | `object` | Yes | Normalized sufficiency object. Current keys include `status`, `row_count`, `has_period_comparison`, and `summary`. `status` is `sufficient`, `limited`, or `insufficient` when the backend can determine it. |
| `limitations` | `string[]` | Yes | Always includes an observational-only caveat. Weak, insufficient, or limited items include an additional caution that the item is for review, not a decision rule. |
| `source_diagnostic_id` | `string \| null` | Yes | Trace back to `workspace_analysis.ranked_diagnostics` or its nested `source_diagnostic`. Present as `null` only when no diagnostic ID exists. |
| `observational_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Reliability boundary: Evidence Board items are not recommendations, optimized actions, causal proof, simulations, forecasts, or autonomous decisions. Titles and summaries should describe observed diagnostic evidence only. Limitations may mention unsupported capabilities only to explicitly deny them.

#### Decision Output Map

`decision_map` is a presentation contract, not a causal diagram. It can contain node types `dataset`, `goal`, `driver`, `limit`, `breakdown`, `evidence`, `unknown`, and `advanced_gate`. Edge types include `declared_relationship`, `observed_association`, `constraint`, `breakdown`, and `missing_evidence`. Every edge includes `causal_status: "not_causal_claim"`.

### Decision Semantics For Metrics

Additive role metadata attached to semantic model metrics and echoed on `Metric Reference` objects when available. Older semantic models remain valid; the backend finalizer can infer conservative defaults from names, fields, format hints, aggregation, and existing metadata.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `objective_candidate` | `boolean` | Yes | Whether this metric is plausibly a business objective or success measure |
| `lever_candidate` | `boolean` | Yes | Whether this metric is plausibly a controllable lever |
| `guardrail_candidate` | `boolean` | Yes | Whether this metric is plausibly a threshold, constraint, or guardrail |
| `polarity` | `string` | Yes | `increase_is_good`, `decrease_is_good`, `context_dependent`, or `unknown` |
| `controllability` | `string` | Yes | `controllable`, `outcome`, or `unknown` in the current implementation |
| `aliases` | `string[]` | Yes | Names, labels, fields, and normalized business aliases used as matching evidence |
| `business_terms` | `string[]` | Yes | Matched business-role keywords such as `revenue`, `discount`, `margin`, or `risk` |
| `confidence` | `number` | Yes | Conservative `0.0` to `1.0` confidence for the role metadata, not a model-quality guarantee |
| `confidence_reason` | `string` | Yes | Short explanation of the evidence used for the confidence score |
| `unresolved_reasons` | `string[]` | Yes | Reasons the role should be reviewed, including low evidence or multiple plausible roles |

### Decision Semantics For Dimensions

Additive role metadata attached to semantic model dimensions and echoed on `Dimension Reference` objects when available.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `segment_candidate` | `boolean` | Yes | Whether this dimension is suitable for segmentation or slicing |
| `comparison_candidate` | `boolean` | Yes | Whether this dimension is suitable for comparison |
| `temporal_candidate` | `boolean` | Yes | Whether this dimension is temporal |
| `grain` | `string \| null` | No | `day`, `week`, `month`, `quarter`, `year`, `observed_value`, or `null` when not temporal |
| `aliases` | `string[]` | Yes | Names, labels, fields, and normalized business aliases used as matching evidence |
| `business_terms` | `string[]` | Yes | Matched temporal or business terms |
| `confidence` | `number` | Yes | Conservative `0.0` to `1.0` confidence for the dimension role metadata |
| `confidence_reason` | `string` | Yes | Short explanation of the evidence used for the confidence score |
| `unresolved_reasons` | `string[]` | Yes | Reasons the role should be reviewed |

### Metric Reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `metric_id` | `string` | Yes | Semantic metric identifier |
| `name` | `string` | Yes | Metric name |
| `label` | `string` | Yes | Display label |
| `field` | `string \| null` | No | Backing field when applicable |
| `default_aggregation` | `string \| null` | No | `sum`, `mean`, `count`, etc. |
| `format_hint` | `string \| null` | No | `number`, `currency`, `percentage`, `date`, or `null` |
| `decision_semantics` | `Decision Semantics For Metrics \| null` | No | Additive role metadata when the semantic model has been finalized by Phase 2 backend code |
| `semantic_binding_confidence` | `number \| null` | No | Prompt-specific binding confidence when the ref was selected from prompt text |
| `semantic_binding_reason` | `string \| null` | No | Prompt-specific binding reason |
| `semantic_role_source` | `string \| null` | No | `decision_semantics`, `lexical_match`, `raw_field`, or `unresolved` |
| `semantic_role_warnings` | `string[]` | No | Prompt-specific warnings such as role mismatch, ambiguity, or low-confidence evidence |

### Dimension Reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dimension_id` | `string` | Yes | Semantic dimension identifier |
| `name` | `string` | Yes | Dimension name |
| `label` | `string` | Yes | Display label |
| `field` | `string` | Yes | Backing dataset field |
| `semantic_kind` | `string \| null` | No | `categorical`, `temporal`, etc. |
| `data_type` | `string \| null` | No | `string`, `datetime`, `number`, etc. |
| `decision_semantics` | `Decision Semantics For Dimensions \| null` | No | Additive role metadata when the semantic model has been finalized by Phase 2 backend code |
| `semantic_binding_confidence` | `number \| null` | No | Prompt-specific binding confidence when the ref was selected from prompt text |
| `semantic_binding_reason` | `string \| null` | No | Prompt-specific binding reason |
| `semantic_role_source` | `string \| null` | No | `decision_semantics`, `lexical_match`, `raw_field`, or `unresolved` |
| `semantic_role_warnings` | `string[]` | No | Prompt-specific warnings such as role mismatch, ambiguity, or low-confidence evidence |

### Prompt Semantic Binding Trace

Prompt-first decision workspace drafting now preserves semantic binding traceability. The fields are additive and may appear on `decision_scope.objective`, lever or constraint `binding` objects, and prompt match refs under `decision_workspace.drafting.prompt_matches`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `semantic_binding_confidence` | `number \| null` | No | Prompt-specific confidence for the selected semantic object; unresolved bindings use `0.0` or `null` depending on whether an attempted binding existed |
| `semantic_binding_reason` | `string \| null` | No | Human-readable evidence summary |
| `semantic_role_source` | `string \| null` | No | `decision_semantics`, `lexical_match`, `raw_field`, or `unresolved` |
| `semantic_role_warnings` | `string[]` | No | Warnings when metadata is weak, ambiguous, role-conflicting, or raw-field-only |
| `unresolved_mappings` | `object[]` | No | Present under `drafting.prompt_matches`; each item includes `mapping_type`, `status`, `reason`, `candidate_labels`, and optional `confidence` |

### Decision Workspace Scope Additions

Phase 2.5 adds explicit segment bindings to the active decision frame instead of representing every `by region/channel` phrase as a dimension-backed lever.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `decision_scope.segment_dimensions` | `Segment Dimension[]` | No | Additive list of segmentation dimensions explicitly requested by prompt-first drafting or supplied by a client. Existing `decision_scope.objective`, `levers`, and `constraints` remain unchanged. |

### Segment Dimension

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `segment_id` | `string` | Yes | Stable generated identifier |
| `label` | `string` | Yes | Display label such as `region` or `channel` |
| `segment_role` | `string` | Yes | Current value is usually `segment` |
| `binding` | `Binding` | Yes | Dimension binding with `dimension_ref` and Phase 2 semantic trace fields when available |

### Guardrail Condition Threshold Status

Prompt-first guardrail conditions keep the existing `operator`, `value`, `secondary_value`, `values`, and `unit` fields. Phase 2.5 adds `value_status` so readiness can distinguish a qualitative guardrail from a failed numeric threshold parse.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `value_status` | `string \| null` | No | `parsed` when a numeric threshold was preserved, `not_specified` when the prompt gave a qualitative guardrail, or `unparsed` when threshold language was present but no numeric value could be parsed. Hard guardrails with `value_status: "unparsed"` are not analysis-ready. |

### Decision Frame Correction

Phase 3 adds deterministic backend-owned correction behavior for an existing draft workspace. The current action-route integration preserves existing endpoint names and action IDs by applying correction payloads through the existing Decision Chat action endpoint when `action` is `draft_workspace`. Backend service callers may also use the workspace correction service directly. Corrections are explicit; the backend does not mutate arbitrary workspace fields from free-form text.

Correction request payload fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `correction_type` | `string` | Yes | `objective_metric`, `objective_direction`, `time_horizon`, `lever_binding`, `lever_controllability`, `guardrail_binding`, `guardrail_condition`, `segment_dimension`, or `remove_mapping` |
| `target_path` | `string` | Yes | Stable object path such as `decision_scope.objective.metric_ref`, `decision_scope.levers[0].binding`, `decision_scope.constraints[0].condition`, or `decision_scope.segment_dimensions` |
| `replacement` | `object \| boolean \| string \| number \| null` | Conditional | Required except for `remove_mapping`. The shape depends on correction type and may contain metric, dimension, field, condition, horizon, direction, or controllability values. |
| `reason` | `string \| null` | No | Optional user or system reason for auditability. |

Correction response fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `correction_result` | `object` | Yes | Includes `status`, `correction_type`, `target_path`, `summary`, `previous_value`, `new_value`, `affected_readiness_fields`, `readiness_state`, and `allowed_next_actions` |
| `decision_workspace` | `object` | Yes | Updated workspace with recomputed `decision_scope`, `scoped_context`, `assumptions`, `unknowns`, `readiness`, `status`, and additive `correction_history` |
| `decision_readiness` | `Decision Readiness State` | Yes | Recomputed readiness and capability truth after the correction |
| `allowed_next_actions` | `string[]` | Yes | Recomputed backend-approved action IDs. Existing IDs are preserved. |
| `trace` | `object` | Yes | Includes correction source, timestamp, target path, semantic confidence when available, warnings, unresolved mapping placeholders, and `observational_boundary: "observational_analysis_only"` |

The action-route response may include additive top-level `correction_result` and `trace` fields and a corrected workspace preview artifact. Existing action IDs, artifact types, readiness fields, and session-state carry-forward remain compatible.

### Ranked Observational Diagnostics

Phase 3 strengthens workspace analysis with `workspace_analysis.ranked_diagnostics` while preserving existing `scoped_diagnostics` and `legacy_diagnostics`. Ranking is diagnostic relevance to the current decision frame only. It is not a recommended action order, optimization result, simulation, causal claim, or final recommendation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `workspace_analysis.observational_boundary` | `string` | Yes | Current value is `observational_analysis_only` |
| `workspace_analysis.ranked_diagnostics` | `object[]` | Yes | Ordered diagnostic evidence derived from the same scoped workspace analysis |
| `evidence_rank` | `integer` | Yes | 1-based rank within the analysis response |
| `relevance_score` | `number` | Yes | `0.0` to `1.0` score based on frame role relevance, evidence availability, and readiness |
| `evidence_strength` | `string` | Yes | `strong`, `moderate`, `weak`, or `insufficient` |
| `semantic_coverage` | `object` | Yes | Shows whether the diagnostic covers the objective and lists covered levers, guardrails, segments, temporal context, and semantic confidences |
| `data_sufficiency` | `object` | Yes | Includes sufficiency status, row count when available, and whether a period comparison exists |
| `limitations` | `string[]` | Yes | Caveats, unresolved or weak semantic evidence, readiness limitations, and the explicit diagnostic-only ranking boundary |
| `source_diagnostic` | `object` | Yes | Original scoped diagnostic object for compatibility and traceability |

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
