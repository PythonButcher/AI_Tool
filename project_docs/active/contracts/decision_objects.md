# Decision Objects Contract

This document is the current contract reference for backend and frontend integration of AI Chat BI results and the isolated Decision Layer compatibility services.

Active product boundary: the BI-first AI Chat frontend consumes only the BI Result Contract below. It does not consume or render the later Decision Layer compatibility objects, which must not be reintroduced into AI Chat without explicit user approval and a new active plan.

All timestamps use ISO-8601 UTC strings. Optional fields may be `null`. All objects below are additive and sit on top of the existing semantic model, metric resolver, and dataset context systems.

## AI Chat BI Result Contract

`POST /api/decision/chat/turns` returns `contract_version: "ai_chat_bi_result_v1"`. Analytical turns add top-level `bi_grounding`, `analytics_refinement`, and typed `suggested_actions`. Every returned `answer` or `chart` artifact carries its own `bi_grounding`; the top-level value matches the primary answer or chart. Other artifact types retain their existing compatibility contracts.

### BI Grounding

`bi_grounding` is normalized backend truth for the exact result shown. It is derived from the resolved dataset, Dataset Trust, semantic metric resolver output, normalized filters, and artifact mapping. The frontend must not infer these fields from chart labels or chat copy.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | `string` | Yes | Current value is `ai_chat_bi_grounding_v1`. |
| `dataset` | `Dataset Summary \| null` | Yes | Canonical dataset identity and full source row/column counts. |
| `row_count` | `integer` | Yes | Rows used by this result after filters. |
| `source_row_count` | `integer` | Yes | Rows in the resolved dataset before result filters. |
| `freshness` | `object` | Yes | `state` reuses Dataset Trust stale state; `as_of` is an ISO timestamp when the dataset reference proves one, otherwise `null`. |
| `cleaning` | `object` | Yes | `state` is `cleaned`, `raw`, `transformed`, or `unknown`. |
| `metric_definition` | `object \| null` | Yes | Semantic or deterministic raw-field metric definition with identity, source field, default aggregation, format hint, and expression where available. |
| `aggregation` | `string \| null` | Yes | Actual result aggregation, including request-local structured overrides. |
| `dimensions` | `object[]` | Yes | Grouping dimensions with `id`, `name`, `label`, `field`, `semantic_kind`, and `data_type`. |
| `filters` | `object[]` | Yes | At most eight normalized resolver filters with `field`, `operator`, `value`, and `values`. |
| `time_period` | `object \| null` | Yes | Normalized `field`, `start`, and `end` derived from temporal filters. |
| `output_type` | `string \| null` | Yes | `answer` or `chart` on artifact grounding; may be `null` only when a non-result response has top-level dataset context. |

Freshness and cleaning remain conservative. Unknown backend evidence stays `unknown`; the service does not convert missing metadata into a positive trust claim. `row_count` and `source_row_count` distinguish the filtered evidence basis from the source dataset size.

### Analytics Refinement

A client can send `analytics_refinement` on a later turn to apply a structured follow-up to the compact `session_state.analytics_state`. The request must also include `user_message` and the prior `session_state`. A refinement without prior structured analytics state is rejected with HTTP 400. The backend validates every operation and re-runs the deterministic resolver; clients must not patch a prior chart locally and present it as a new grounded result.

| Operation | Required `arguments` | Behavior |
| --- | --- | --- |
| `remove_filter` | `field` or `dimension_id` | Removes all carried filters for the resolved semantic field. |
| `set_aggregation` | `aggregation` | Applies `sum`, `mean`, `count`, `min`, `max`, or `nunique` as a request-local metric override without mutating the semantic model. |
| `set_group_by` | `dimension_id`, `field`, or `dimension` | Replaces the current grouping with a dimension verified against the current semantic model. Optional `output_preference: "chart"` requests chart output. |
| `set_time_period` | `field` or `dimension_id`, plus `start` and `end` | Replaces filters on the temporal field with normalized `gte` and `lte` filters. |
| `set_output` | `output` | Selects `answer` or `chart` for the re-run result. |

Successful analytical responses return `analytics_refinement` with `schema_version: "ai_chat_analytics_refinement_v1"`, the normalized `applied` operation or `null`, compact `current_state`, and `payload_expectations`. `current_state` contains metric identity, aggregation, up to four grouping fields, up to eight filters, normalized time period, and output preference. It never contains dataset rows, chart data, or conversation transcripts.

The same compact state is stored under `session_state.analytics_state` and `session_state.last_analytic_context` with `schema_version: "ai_chat_analytics_state_v1"`. The enclosing session uses `schema_version: "ai_chat_bi_session_state_v1"`; `session_state.dataset_context` retains only canonical identity, counts, and a deterministic fingerprint.

### Typed Suggested Actions

Analytical `suggested_actions` are bounded guided-exploration instructions derived from the current semantic model and applied state. They use `kind: "analytics_refinement"` and include a validated `analytics_refinement` object that the client may send to `/api/decision/chat/turns` with the current session state. Current suggestions can include a temporal trend, breakdown by an unused categorical dimension, removal of an applied filter, and an alternate aggregation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action_id` | `string` | Yes | Stable typed ID such as `show_trend_by_order_date`, `breakdown_by_region`, `remove_filter_region`, or `set_aggregation_mean`. |
| `label` / `description` | `string` | Yes | Backend-authored user-facing copy. |
| `kind` | `string` | Yes | Current analytics value is `analytics_refinement`. |
| `intent` | `string` | Yes | Current analytics value is `refine_analytics`. |
| `priority` | `string` | Yes | `primary` or `secondary`. |
| `enabled` | `boolean` | Yes | True only after the refinement operation validates against the backend contract. |
| `disabled_reason` / `availability_reason` | `string \| null` | Yes | Explicit availability metadata retained from the shared action contract. |
| `analytics_refinement` | `object` | Analytics only | Exact normalized operation and arguments for a later turn. |
| `payload_expectations` | `object` | Yes | Names the turn endpoint, required request fields, and produced BI contract fields. |

## Shared Nested Objects

### Decision Readiness State

Additive readiness metadata returned by Decision Chat responses and Decision Workspace objects. These fields are the backend-owned truth source for whether a decision frame is structurally ready, what action is allowed next, and which capabilities are explicitly unsupported.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `readiness_state` | `string` | Yes | `analysis_ready`, `blocked`, `limited`, or `not_applicable` on non-decision chat responses |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only` |
| `structural_readiness` | `object` | Yes | Flags for `ready_for_observational_analysis`, `ready_for_recommendation`, `ready_for_simulation`, `ready_for_optimization`, `ready_for_autonomous_decisioning`, and `missing_inputs` |
| `blocked_state` | `object` | Yes | Includes `is_blocked`, `blocked_action_ids`, `blocking_missing_inputs`, and `blocking_unknown_ids` |
| `allowed_next_actions` | `string[]` | Yes | Backend-approved action IDs such as `analyze_workspace`, `show_blockers`, `open_workspace`, and `show_assumptions`. `open_workspace` is a compatibility id only; frontend code must use backend-provided action labels/descriptions and must not infer old Decisions-window navigation from the id. |
| `capability_state` | `object` | Yes | Capability map described below |
| `unsupported_capabilities` | `string[]` | Yes | Current values include `simulation`, `optimization`, `autonomous_decisioning`, and `final_recommendation` |
| `not_ready_for_recommendation` | `boolean` | Yes | Current Decision Intelligence output remains observational and should not be rendered as a final recommendation |

Legacy compatibility note: existing fields such as `can_run_simulation` and `blocks_simulation` remain available for older frontend code. They must not be interpreted as a current runtime simulation feature. New code should prefer `capability_state.simulation.status == "unsupported"` and `truth_boundary == "observational_analysis_only"`.

Action compatibility note: `open_workspace` may still appear in backend action ids for older clients and saved state. Current user-facing metadata should describe AI Chat decision review, decision output inspection, blockers, assumptions, analysis, graph tooling, or export. It must not be presented as a required jump from AI Chat into the old Decisions window.

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

### Decision Chat Trustworthy Interaction

`POST /api/decision/chat/turns` and `POST /api/decision/chat/actions` resolve one canonical dataset before governance, routing, workspace work, or action execution. An explicit dataset mention is carried in `resolved_datasets` and must be paired with a matching `dataset_ref`/`datasetRef`. A request with multiple named datasets, a named dataset without a reference, or a name/reference mismatch is refused with HTTP 400 before analysis. When a Data Hub reference is selected, the backend loads that referenced dataset and its registered or inferred semantic model instead of relabeling unrelated inline rows or reusing the active dataset's semantic model.

Turn request fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `user_message` | `string` | Yes | Current user turn. |
| `dataset` | `object[] \| object` | Conditional | Inline rows for the active dataset. May be omitted when a resolvable Data Hub `dataset_ref` is supplied. |
| `dataset_ref` / `datasetRef` | `object` | Conditional | Canonical identity metadata. Public fields include `source`, `dataset_id`, `dataset_name`, transform state, and stale state. Local file paths are not copied into Decision Chat session state. |
| `resolved_datasets` / `resolvedDatasets` | `string[] \| object[]` | No | Dataset mention resolution hints. Release 1 permits one unique dataset. It must match `dataset_ref.dataset_name` or `dataset_ref.dataset_id`. |
| `requested_mode` / `requestedMode` | `string` | No | User-controlled `auto`, `ask`/`ask_data`, `explore`, or `decide`. An explicit non-Auto selection has precedence over keyword routing. |
| `conversation_history` | `object[]` | No | Bounded continuity corroboration. The backend accepts at most the latest 10 entries with `role: "user" | "assistant"` and non-empty `content`, truncates accepted content to 2,000 characters per entry for request-time comparison, and never returns or persists raw history. History cannot restore or override metric, filter, workspace, Dataset Trust, or dataset identity state. |
| `clarification_response` / `clarificationResponse` | `object` | No | Focused answer with `choice_id` / `choiceId` or `text` / `value`. The current backend accepts only an exact choice ID or metric label from the current semantic model. The same exact answer may be sent as `user_message` through the normal chat input. |
| `session_state` | `object` | No | Current structured state. `active_mode` is backend carry-forward; it is not treated as a fresh explicit selection unless the request also supplies `requested_mode`. Conversational analytics use `last_analytic_context` / `analytics_state`; pending decision questions use `clarification_state`. |

Successful turn and action responses include top-level `resolved_datasets`, an array containing the canonical `Dataset Summary` actually used, or an empty array when no dataset was resolved. The same identity appears in `dataset_trust.dataset`.

`mode_context` includes `current_mode`, `reason_code`, `reason`, `selection_source`, `requires_confirmation`, `confirmation_modes`, and `available_modes`. Auto routing that detects both chart/comparison and decision/trade-off intent returns `current_mode: "ask"`, `reason_code: "ambiguous_chart_decision_comparison"`, `requires_confirmation: true`, and `confirmation_modes: ["explore", "decide"]`; it does not execute either workflow. Explicit mode selection returns `reason_code: "explicit_mode_override"`.

Every `suggested_actions[]` item includes `action_id`, `enabled`, `disabled_reason`, `availability_reason`, and `payload_expectations`. Decision tool actions are enabled only when their `action_id` is present in the backend action-handler catalog and current prerequisites pass. Analytics refinement actions are enabled only when their typed operation validates against the BI refinement contract and are sent through `/api/decision/chat/turns`, not the decision action route. Disabled actions carry a plain-language `disabled_reason`. `open_workspace` executes through `/api/decision/chat/actions` against `session_state.draft_workspace` and returns the current AI Chat decision-review artifact; clients must not locate it by scanning older chat messages.

Returned `session_state.dataset_context` contains `schema_version`, a SHA-256 `fingerprint`, and a `Dataset Summary`. It never contains raw dataset rows. On a turn, a fingerprint change clears prior workspace, decision, scenario, analytic, clarification, and action state before new work runs. A terse referential follow-up such as `Show it as a chart` is then refused until the user names a metric or dimension for the new dataset. On an action request, a fingerprint change is refused so a stale workspace cannot execute against another dataset. `New Chat` must clear the persisted session state, messages, active result, and dataset context together.

### AI Chat Conversational Continuity

Successful turn responses include `conversation_context`, a compact `di_conversation_context_v1` object with `accepted_turn_count`, `accepted_roles`, `has_prior_user_turn`, `history_alignment`, `used_for_continuity`, `authoritative_source: "structured_session_state"`, and `raw_history_persisted: false`. The object reports how bounded role/content history corroborated a turn; it does not contain message content.

Semantic metric turns store the same compact state under `session_state.last_analytic_context` and `session_state.analytics_state`. Public fields are `schema_version`, `source: "semantic_metric"`, `metric_id`, `metric_name`, `aggregation`, `group_by`, `filters`, `time_period`, `output_preference: "answer" | "chart"`, `last_user_message`, and `continuity_source`. `continuity_source` is `new_request`, `structured_session_state`, or `structured_state_with_bounded_history`. Metric and dimension references are re-resolved against the current semantic model on every turn. Categorical refinements use exact values present in the current dataset. Period refinements support explicit ISO date ranges, named month plus year, `Q1` through `Q4` plus year, and validated structured ranges. Filters are bounded to eight and are executed by the existing metric resolver.

Semantic answer and chart artifacts include additive `content.result_context` with `schema_version: "di_conversational_result_context_v1"`, an `evidence` object containing `metric_id`, `group_by`, normalized `filters`, `filtered_row_count`, and `source_row_count`, an `uncertainty` array, `truth_boundary: "observational_analysis_only"`, and `next_action`. Concise assistant copy must identify the grounded row basis and keep the result descriptive and observational.

When a decision workspace is missing its objective metric, turn and action responses may include `clarification_state` and the turn session stores the pending state. The current schema is `di_clarification_v1`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `string` | Yes | `pending` for an unanswered question or `resolved` on the turn that applies the answer. |
| `question_id` | `string` | Yes | Current value is `objective_metric`. |
| `missing_input` | `string` | Pending | Current value is `objective.metric_id_or_metric_name`. |
| `prompt` | `string` | Pending | Focused backend-authored question. |
| `response_kind` | `string` | Pending | Current value is `single_choice_or_exact_text`. |
| `choices` | `object[]` | Pending | At most six current semantic metrics with `choice_id`, `label`, and `description`. |
| `accepts_text` / `text_constraint` | `boolean` / `string` | Pending | Text is accepted only when it exactly matches a current choice ID, label, or metric name. |
| `correction_type` / `target_path` | `string` | Pending | Current values are `objective_metric` and `decision_scope.objective.metric_ref`. |
| `choice_id` / `summary` | `string` | Resolved | Applied choice and correction summary. |
| `next_question` | `object \| null` | Resolved | Next pending clarification when one is safely supported, otherwise `null`. |

Clarification answers execute through the existing deterministic workspace correction service. They update `decision_output.frame`, `decision_output.correction_state`, readiness, and session draft state without rebuilding unrelated levers, segments, constraints, or time horizon. Caller-supplied internal trust evidence is not accepted, and chat history is never treated as the source of a correction.

### AI Chat Artifact Source

Decision Chat artifacts keep a compact `source` label that describes the backend path that produced the artifact. For chart artifacts, an explicit `content.meta.source` is authoritative and is copied to top-level `artifact.source`. Charts produced by semantic metric analytics use `source: "semantic_metric"` and `content.meta.source: "semantic_metric"` because the metric resolver supplied the grouped values and semantic lineage. Raw chart artifacts that do not provide `content.meta.source` fall back to `chart_engine`.

Frontend code should render by `artifact.type` and `render_hint` first. It may use `source` for lineage, badges, diagnostics, or source-specific affordances, but should not require `source === "chart_engine"` to render a chart.

### AI Chat Chart Spec

Phase 3 adds optional `content.chartSpec` to chart artifacts. This is an additive, deterministic, pin-ready chart definition for Explore, Dashboard, and AI Chat surfaces. Existing chart artifact fields remain compatible and required for rendering: `content.chartType`, `content.chartData`, `content.fieldsUsed`, `content.filtersApplied`, and `content.meta`.

The backend builds `content.chartSpec` from interpreted raw fields or semantic metric resolver output. It must not rely on unconstrained LLM output. If a future LLM-assisted chart planner is added, its output must be schema-validated before it reaches the frontend; invalid chart specs should be omitted rather than passed through.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | `string` | Yes | Current value is `chart_spec_v1`. |
| `title` | `string` | Yes | Display title used when pinning or opening a chart window. |
| `chartType` | `string` | Yes | Current supported values follow existing Chart.js wrappers: `Bar`, `Line`, `Pie`, `Doughnut`, `Scatter`, and `Histogram` where supported. |
| `sourceMode` | `string` | Yes | `raw` or `semantic`. |
| `source` | `string` | Yes | Backend source label such as `chart_engine` or `semantic_metric`. |
| `rawMapping` | `object` | Yes | Raw field bindings with keys `x`, `y`, `time`, and `secondaryValue`; values may be `null`. |
| `semanticConfig` | `object` | Yes | Semantic bindings with `metricId`, optional `metricName`, `groupBy`, and optional `groupByField`. Empty strings are allowed for raw charts. |
| `aggregation` | `string` | Yes | Aggregation used or intended for the chart. |
| `sortLimit` | `object` | Yes | Optional `sort` and `limit` metadata for ranked charts. |
| `slicers` | `object[]` | Yes | Chart-local slicers derived from current filters; empty when no filters are applied. |
| `inheritedSlicers` | `object[]` | Yes | Dashboard-level slicers inherited at render time; AI Chat artifacts return an empty array. |
| `pin` | `object` | Yes | Pin metadata. AI Chat returns `pinned: false` and `sourceArtifact: "ai_chat"`. |

Slicer conflict behavior is intersection-based. Dashboard slicers and chart-local slicers are combined with `AND` semantics. If two slicers constrain the same field and no rows can satisfy both, the frontend should render a clear empty state that names the conflicting field instead of dropping either slicer.

`SlicerSpec` maps to existing resolver filters. Date and numeric ranges use `gte` and `lte`, categorical selection uses `eq` or `in`, and supported text matching uses `contains`, `starts_with`, or `ends_with`.

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
| `scenario_compare` | `Decision Output Scenario Compare` | Yes | Bounded scenario preview when available, otherwise a `not_applicable` object with limitations. It is not a forecast, optimizer, simulation, causal model, autonomous decision, or final recommendation. |
| `advanced_readiness` | `Advanced Readiness` | Yes | Source-backed readiness diagnostics for prediction, optimization, causal analysis, and automated decisioning. This evaluates prerequisites only and does not run or enable an advanced capability. |
| `advanced_gates` | `object[]` | Yes | Unsupported or gated capabilities such as simulation, optimization, autonomous decisioning, and final recommendation with backend reasons. |
| `command_center` | `Decision Output Command Center` | Yes | AI Chat-native command surface composed from existing `decision_output` truth. It supplies display order, stale or rerun state, allowed next checks, disabled next checks with reasons, export readiness, limitations, and source refs without changing artifact type or export semantics. |
| `export_sections` | `object[]` | Yes | Backend-owned PDF-ready sections for Executive Brief, Dataset Trust, Goal, Drivers, Limits, Breakdowns, Evidence Board, Decision Map Summary, Scenario Compare, Advanced Readiness, Assumptions and Unknowns, and Truth Boundary. |
| `source_refs` | `object` | Yes | Trace refs back to workspace ID/status, analysis presence, ranked diagnostic IDs, correction status, and scenario status. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

#### Decision Output Export Sections

`decision_output.export_sections` is the backend-owned source for the AI Chat decision PDF. Frontend export code should render these sections directly instead of rebuilding the asset from raw workspace internals.

Each export section includes:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `section_id` | `string` | Yes | Stable section identifier. Current order is `executive_brief`, `dataset_trust`, `goal`, `drivers`, `limits`, `breakdowns`, `evidence_board`, `decision_map_summary`, `scenario_compare`, `advanced_readiness`, `assumptions_unknowns`, and `truth_boundary`. |
| `title` | `string` | Yes | Human-readable section title. |
| `summary` | `string` | Yes | Same content as `body`, kept for compatibility with older clients that used summary-style section data. |
| `body` | `string` | Yes | Paragraph rendered by the current PDF exporter. This must be populated for every section. |
| `keyValues` | `object[]` | No | Optional label/value rows for dataset metadata, readiness, map counts, scenario method, and truth boundary fields. |
| `items` | `string[]` | No | Optional bullet text for warnings, limitations, assumptions, and boundary notes. |
| `cards` | `object[]` | No | Optional titled detail cards for Goal, Drivers, Limits, Breakdowns, Evidence Board items, Scenario Compare projection rows, Assumptions, and Unknowns. |
| `emptyText` | `string` | No | Fallback text when a section has no cards or items. |
| `source_refs` | `object` | Yes for current live sections | Immutable trace to the decision-output source path, workspace context, and applicable evidence or scenario IDs. Saved assets preserve this trace as part of their snapshot. |
| `truth_boundary` | `string` | Yes for current live sections | Current value is `observational_analysis_only`. |

The `advanced_readiness` export section is built from `decision_output.advanced_readiness`. It carries the overall state and state counts, capability states, backend reasons, safe evidence summaries, missing requirements, limitations, and the observational truth boundary. The frontend must render this section rather than reconstructing readiness from unrelated fields.

Live and saved export readiness is true only when every canonical backend section is present once and every section has a non-empty ID, title, and body. A non-empty partial section list is not export-ready.

Export sections must read as a shareable AI Chat decision asset. They must not present final recommendations, optimization, causal proof, simulation, prediction certainty, or autonomous decisioning. The Truth Boundary section must explicitly state the observational-only limitation and unsupported capabilities.

Current live section labels preserve their stable `section_id`s while qualifying important boundaries for executive readers: the Executive Brief is observational, the Decision Map is non-causal, Scenario Compare is sensitivity-only, and Advanced Readiness is preparation-only. Clients must retain the backend-provided title and must not remove those qualifiers.

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
| `source_refs` | `object` | Yes | Exact refs for this evidence item: `source`, `source_path`, `source_diagnostic_id`, optional `metric_id`, optional `dimension_id`, and optional backing `field`. |
| `next_checks` | `object[]` | Yes | Backend-owned Evidence-To-Action checks for this evidence item. Current check IDs are `explain_evidence`, `breakdown`, `monitor`, and `send_to_scenario_compare`. |
| `observational_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Evidence next-check item fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `check_id` | `string` | Yes | Stable check ID such as `explain_evidence`, `breakdown`, `monitor`, or `send_to_scenario_compare`. |
| `label` | `string` | Yes | Backend-owned display label. |
| `description` | `string` | Enabled only | Short explanation of the enabled follow-up check. |
| `enabled` | `boolean` | Yes | Whether the user can approve this check for the current evidence source. |
| `status` | `string` | Yes | `ready` for enabled checks, `disabled` for unavailable checks. |
| `disabled_reason` | `string` | Disabled only | Exact backend reason the check is unavailable. |
| `action_id` | `string` | No | Backend action ID when the check maps to an action request. Informational review checks may omit it. |
| `action_type` | `string` | Yes | `backend_action` when `action_id` is present, otherwise `informational_review`. |
| `source_refs` | `object` | Yes | Source path and diagnostic/metric/dimension refs needed to run or explain the check without frontend inference. |
| `limitations` | `string[]` | Yes | Observational-only and source-specific limitations. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Reliability boundary: Evidence Board items are not recommendations, optimized actions, causal proof, simulations, forecasts, or autonomous decisions. Titles and summaries should describe observed diagnostic evidence only. Limitations may mention unsupported capabilities only to explicitly deny them.

#### Decision Output Map

`decision_map` is a presentation contract, not a causal diagram. It can contain node types `dataset`, `goal`, `driver`, `limit`, `breakdown`, `evidence`, `unknown`, and `advanced_gate`. Edge types include `declared_relationship`, `observed_association`, `constraint`, `breakdown`, and `missing_evidence`. Every edge includes `causal_status: "not_causal_claim"`.

Phase 7 shifts graph work from this compact read-only `decision_output.decision_map` toward a separate user-guided `decision_graph` builder contract. `decision_map` remains the current compact display object inside `decision_output`; `decision_graph` is the backend data foundation for the future interactive builder.

Every map node and map edge includes `source_refs` and `next_checks`. Map item checks use the same enabled and disabled shape as Evidence Board checks. `explain_evidence` is available for map items because the backend can explain source path and boundary. `explain_missing_data` is enabled only for missing, blocked, unsupported, insufficient, or warning-bearing items. `breakdown`, `monitor`, and `send_to_scenario_compare` are disabled on compact Decision Map items unless a future backend payload supplies a complete observed metric target and, where needed, a breakdown dimension. Disabled states must include `disabled_reason`; clients must not infer availability from node or edge type alone.

#### Decision Output Scenario Compare

Phase 8 folds the existing bounded scenario preview into `decision_output.scenario_compare` as a display-ready object. The backend accepts an already-built `scenario_preview` from the chat payload or session state and normalizes it; chat does not run scenario evaluation directly. The existing decision pipeline creates that preview through `backend/services/scenario_service.py`, which applies direct percent or absolute adjustments to observed semantic metric baselines.

`scenario_compare` must be rendered as a direct adjustment or sensitivity comparison only. It must not be described as a forecast, optimizer, simulation, causal model, autonomous decision, or final recommendation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `string` | Yes | `ready` when a supported scenario preview with projection data is available; otherwise `not_applicable`. |
| `summary` | `string` | Yes | Business-facing summary. Ready summaries describe bounded Scenario Compare using direct adjustments on observed baselines. |
| `inputs` | `object` | Yes | Normalized suggested inputs with `name`, `filters`, `group_by`, and `metric_targets`. Empty values are returned when not applicable. |
| `baseline` | `object` | Yes | `status`, `metrics`, and `period_context`. Each metric includes `metric_ref`, `baseline_value`, and `baseline_label`. |
| `comparison` | `object` | Yes | Display metadata with `method: "direct_adjustment_sensitivity"`, `status`, `summary`, `target_count`, `group_by`, recommendation/signal trace IDs, and `period_context`. |
| `projections` | `object[]` | Yes | Normalized direct-adjustment projection rows from the existing scenario preview. Current fields include `metric_ref`, `adjustment`, `baseline_value`, `baseline_label`, `projected_value`, `projected_label`, `delta_value`, `delta_pct`, and `comparison_summary`. |
| `assumptions` | `string[]` | Yes | Includes source scenario assumptions plus explicit direct-adjustment-only and unsupported-capability boundary text. |
| `limitations` | `string[]` | Yes | Includes direct adjustment/sensitivity boundary and cautions against treating the comparison as a decision rule. |
| `source_scenario_ids` | `string[]` | Yes | Trace IDs from the underlying scenario service response when available. Empty when not applicable. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Unavailable scenario data is not fabricated. If no preview is attached, the preview is not ready, or projection rows are missing, `scenario_compare.status` is `not_applicable`, `projections` is empty, `baseline.status` and `comparison.status` are `not_available`, and `limitations` explain that no scenario projection data was available.

#### Advanced Readiness

`decision_output.advanced_readiness` is the backend-owned ML trust-gate contract. It explains whether the current data, semantics, route-verified governance result, and observational evidence are sufficient to prepare for a separately approved advanced workflow. It does not perform prediction, optimization, causal effect estimation, simulation, or automated decisioning.

The current schema version is `di_advanced_readiness_v1`. Live Decision Chat emits `limited`, `blocked`, or `not_evaluated`. `limited` means preparation may continue but a required validation step is absent. `blocked` means a prerequisite or runtime capability is missing. `not_evaluated` means the backend lacks enough context to assess readiness honestly. `supported` is reserved for compatibility in `state_counts` and remains zero; the live product does not yet bind a trusted model evaluation to the exact governed dataset used by a Decision Output.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | `string` | Yes | Current value is `di_advanced_readiness_v1`. |
| `overall_state` | `string` | Yes | Conservative rollup: `limited`, `blocked`, or `not_evaluated`. Mixed limited and blocked capabilities roll up to `limited`. |
| `summary` | `string` | Yes | Plain-language count and review instruction. |
| `capabilities` | `Advanced Readiness Capability[]` | Yes | Exactly one item each for `prediction`, `optimization`, `causal_analysis`, and `automated_decisioning`. |
| `state_counts` | `object` | Yes | Counts for `supported`, `limited`, `blocked`, and `not_evaluated`. `supported` is retained as a compatibility counter and is currently always `0`. |
| `limitations` | `string[]` | Yes | Global reminders that readiness is not execution or an outcome guarantee. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Advanced Readiness Capability fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `capability` | `string` | Yes | `prediction`, `optimization`, `causal_analysis`, or `automated_decisioning`. |
| `state` | `string` | Yes | Live values are `limited`, `blocked`, or `not_evaluated`. |
| `reasons` | `object[]` | Yes | Stable `code` and plain-language `message` entries explaining the classification. |
| `evidence` | `object[]` | Yes | Safe evidence entries with `code`, `label`, `value`, and exact backend `source_path`. No raw dataset values are included. |
| `missing_requirements` | `object[]` | Yes | `requirement_id` and plain-language `description` entries describing what prevents stronger readiness. |
| `allowed_next_actions` | `object[]` | Yes | Safe preparation or review actions with `action_id`, `label`, and `description`. These identifiers do not authorize unsupported execution. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Prediction readiness reuses Dataset Trust row count and semantic readiness, the decision goal metric binding, route-verified `governance_readiness`, and the ML runtime minimum of ten dataset rows. It is `limited` when data and target preparation can proceed but governance or target-matched model validation evidence is absent. Existing AutoML responses are not consumed as Advanced Readiness evidence because Decision Chat has no trusted dataset-lineage join to prove that a model run belongs to the exact dataset snapshot in the Decision Output.

Optimization remains `blocked` while `readiness.capability_state.optimization` is unsupported. Causal analysis remains `blocked` while Evidence Board output is observational and there is no validated causal identification method. Automated decisioning remains `blocked` while `readiness.capability_state.autonomous_decisioning` is unsupported and human approval is required.

`advanced_gates` remains unchanged for compatibility. New clients should use `advanced_readiness` for detailed prerequisites while continuing to respect every legacy unsupported gate.

#### Decision Output Command Center

The command center belongs inside the existing `decision_output` artifact as `decision_output.command_center`. Codex chose this additive section instead of a wrapper artifact because current AI Chat rendering, artifact inspection, export, and saved-asset paths already recognize `type: "decision_output"`. A wrapper would force frontend artifact routing to unwrap another object before existing behavior could work. The existing `decision_output` remains canonical; `command_center` is a compact control state derived from `frame`, `dataset_trust`, `readiness`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, `source_refs`, and `truth_boundary`.

The command center must not become a raw field dump. Frontend code should use it for the command-center header, section order, next-check buttons, disabled states, export readiness, and limitations, then render section bodies from the existing `decision_output` fields named by the contract.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | `string` | Yes | Current value is `di_command_center_v1`. |
| `surface` | `string` | Yes | Current value is `ai_chat_decision_command_center`. |
| `status` | `string` | Yes | `ready`, `limited`, or `blocked`. `limited` covers unknown or possibly stale data and outputs where analysis has not populated the Evidence Board. |
| `section_order` | `string[]` | Yes | Ordered section IDs for the command-center view. Current values mirror `export_sections.section_id` order and should be rendered with existing section content, not copied as raw JSON. |
| `stale_state` | `string` | Yes | Copied from `dataset_trust.stale_state`: `current`, `possibly_stale`, `unknown`, or `not_applicable`. |
| `rerun_state` | `object` | Yes | Includes `status`, optional `action_id`, and `reason`. Current statuses include `analysis_not_run`, `current_analysis_available`, `possibly_stale_analysis_available`, and `blocked`. |
| `allowed_next_checks` | `object[]` | Yes | Enabled check controls. Each item includes `check_id`, `label`, `description`, `enabled: true`, `status: "ready"`, `source`, `action_type`, `source_refs`, `limitations`, `truth_boundary`, and optional backend `action_id` such as `analyze_workspace`. |
| `disabled_next_checks` | `object[]` | Yes | Disabled controls with explicit reasons. Each item includes `check_id`, `label`, `enabled: false`, `status: "disabled"`, `source`, `reason`, `disabled_reason`, `action_type`, `source_refs`, `limitations`, `truth_boundary`, and optional `action_id`. Unsupported capabilities and live saved-asset refresh belong here. |
| `export_readiness` | `object` | Yes | Includes `ready`, `status`, `section_count`, `section_order`, and `reason`. This describes whether existing `export_sections` are usable; it does not add a new export payload. |
| `limitations` | `string[]` | Yes | Conservative limitations for observational-only support, Dataset Trust warnings, unavailable Evidence Board or Scenario Compare state, unsupported advanced gates, and immutable saved snapshots. |
| `source_refs` | `object` | Yes | Compact refs for `workspace_id`, `workspace_status`, `workspace_analysis_present`, `ranked_diagnostic_ids`, and `scenario_status`. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Allowed next checks are user-approved investigations or review actions, not recommendations or autonomous actions. Current check IDs may include `review_decision_frame`, `run_observational_analysis`, `review_evidence_board`, `review_decision_map`, `review_scenario_compare`, `export_decision_output`, and `save_decision_snapshot`. Disabled check IDs may include `unsupported_simulation`, `unsupported_optimization`, `unsupported_autonomous_decisioning`, `unsupported_final_recommendation`, and `live_saved_asset_refresh`.

Reliability boundary: The command center does not introduce final recommendations, predictions, simulations, optimizers, causal proof, autonomous decisions, live saved-asset refresh, or unsupported ML behavior. Scenario Compare remains bounded direct adjustment only. Saved DecisionAssets remain immutable historical snapshots; when `command_center` is present in a saved asset, it is part of the snapshot and must not be presented as live state.

### DecisionAsset

A `DecisionAsset` is an immutable saved AI Chat Decision Review. It is an observational snapshot of the supplied `decision_output`, not a live dataset view, refresh, final recommendation, forecast, simulation, optimizer, causal result, or autonomous decision. Saving does not re-run governance because it does not load or process a dataset. The stored `dataset_trust` and `truth_boundary` remain the source-of-record snapshot; clients must not present them as current data freshness or a new governance evaluation.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `asset_id` | `string` | Yes | Backend-generated stable identifier prefixed `decision_asset_`. |
| `schema_version` | `string` | Yes | Current value is `di_decision_asset_v1`. |
| `title` | `string` | Yes | Normalized display title. A missing or blank caller title falls back to `decision_output.title`. |
| `created_at` | `string` | Yes | Backend-generated ISO-8601 UTC timestamp. |
| `archived_at` | `string \| null` | Yes | Backend-generated ISO-8601 UTC timestamp when archived, otherwise `null`. Archiving changes library visibility only; it does not mutate the saved `decision_output`. |
| `lifecycle_state` | `string` | Yes | `active` or `archived`. Deleted assets are removed and return 404. |
| `decision_output` | `AI Chat Decision Output` | Yes | Exact sanitized immutable snapshot of the current output. It preserves `dataset_trust`, `advanced_readiness`, `command_center`, `source_refs`, `export_sections`, and `truth_boundary`. |
| `graph_state` | `Decision Graph State` | No | Optional contract-safe `decision_graph_build_state` carry-forward object. It is absent when no graph state was supplied. |
| `snapshot_notice` | `string` | Yes | UI copy that the asset is a saved immutable observational snapshot and not a live refresh or final decision. |
| `review_metadata` | `object` | Yes | Stable review summary derived only from the saved snapshot. Includes `snapshot_kind`, `dataset_label`, `source_label`, `row_count`, `column_count`, `readiness_state`, `truth_boundary`, `evidence_status`, `evidence_item_count`, `scenario_status`, `export_section_count`, `export_section_ids`, `command_center_status`, and `graph_state_summary`. |
| `provenance` | `object` | Yes | Saved-snapshot provenance with `source: "saved_decision_output_snapshot"`, saved `source_refs`, saved Dataset Trust dataset summary when present, dataset source label, and truth boundary. |
| `snapshot_export` | `object` | Yes | Export readiness for the stored snapshot. Includes `ready`, `source: "saved_decision_asset_snapshot"`, `section_count`, `section_order`, and the export endpoint template. |

Routes:

| Route | Request | Response |
| --- | --- | --- |
| `POST /api/decision/assets` | `title` optional, `decision_output` required, `graph_state` optional | HTTP 201 and complete `DecisionAsset`. |
| `GET /api/decision/assets` | Optional `limit`, default `25`, minimum `1`, maximum `50`; optional filters `readiness_state`, `truth_boundary`, `dataset_label`, `query`, `has_graph_state`, `created_from`, `created_to`, `archived_state`, and `include_archived` | HTTP 200 with newest-first `assets` summaries. Defaults to active assets only. |
| `POST /api/decision/assets/compare` | `asset_ids` array with 2 to 4 saved asset IDs | HTTP 200 with historical snapshot comparison. |
| `GET /api/decision/assets/<asset_id>` | Asset ID path parameter | HTTP 200 and complete `DecisionAsset`; HTTP 404 when absent. |
| `GET /api/decision/assets/<asset_id>/export` | Asset ID path parameter | HTTP 200 with saved export payload; HTTP 404 when absent. |
| `POST /api/decision/assets/<asset_id>/archive` | Asset ID path parameter | HTTP 200 with archived `DecisionAsset`; HTTP 404 when absent. |
| `POST /api/decision/assets/<asset_id>/restore` | Asset ID path parameter | HTTP 200 with restored active `DecisionAsset`; HTTP 404 when absent. |
| `DELETE /api/decision/assets/<asset_id>` | Asset ID path parameter | HTTP 200 with `{ "status": "deleted", "asset_id": string }`; HTTP 404 when absent. |

List summaries contain `asset_id`, `title`, `created_at`, `dataset_label`, `readiness_state`, `truth_boundary`, `archived_at`, `lifecycle_state`, `snapshot_notice`, `review_metadata`, `provenance`, and `snapshot_export`. The list endpoint may filter by stored columns, graph-state presence, and lifecycle state, but it must not load current datasets or refresh saved artifacts. `query` searches stored title and dataset label only. `archived_state` accepts `active`, `archived`, or `all`; `include_archived=true` is an alias for all lifecycle states.

Saved export payloads use schema version `di_decision_asset_export_v1` and return saved `export_sections`, saved `dataset_trust`, saved `source_refs`, saved `truth_boundary`, `review_metadata`, `provenance`, `created_at`, title, and snapshot notice. Export source is `saved_decision_asset_snapshot`; export must not rebuild from the current workspace, current active dataset, or current Data Hub state.

Saved comparison payloads use schema version `di_decision_asset_comparison_v1` and `comparison_kind: "historical_snapshot_comparison"`. Each comparison item exposes the saved asset ID, title, created time, dataset label, readiness state, truth boundary, saved Dataset Trust, saved source refs, evidence status and item count, scenario status, export snapshot summary, graph state summary, and snapshot notice. `differences` are descriptive stored-artifact differences such as dataset labels, readiness states, truth boundaries, evidence item counts, export section counts, and created-at range. Comparison must not be presented as live A/B analysis, causal proof, simulation, optimization, or a final recommendation.

The create service rejects payloads that are not current `decision_output` artifacts, do not use `truth_boundary: "observational_analysis_only"`, have invalid Dataset Trust or graph state, include raw dataset rows, chat transcripts, Data Hub/file paths, non-JSON values, or exceed the bounded snapshot size. Assets cannot be edited, shared, or refreshed in this slice. Archive and restore affect library visibility only and preserve the immutable saved snapshot. Delete is user-directed removal of the saved asset record and must use a confirmation UI.

### Decision Graph

Phase 7.3 extends the backend-owned `decision_graph` contract for variable discovery, cold graph generation, user hypothesis edges, and safe graph-to-action planning. It is separate from `decision_output.decision_map`.

Routes:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/decision/graph/candidates` | `POST` | Return graph-eligible semantic metrics and dimensions from the resolved dataset context. |
| `/api/decision/graph/build` | `POST` | Return graph nodes and edges for selected variables, selected evidence, user hypotheses, and a graph mode. |
| `/api/decision/graph/actions` | `POST` | Plan a safe follow-up action from a selected graph node or edge. This route returns request semantics; it does not execute causal validation, monitoring automation, or scenario evaluation. |

Request fields for both routes reuse existing dataset context inputs: `dataset`, `dataset_ref`, and `semantic_model`. Graph build also accepts:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `graph_mode` | `string` | No | `evidence_coverage`, `observed_association`, or `mixed`. Default is `mixed`. |
| `selected_variables` | `object \| object[] \| string[]` | Build yes | Preferred object keys are `metric_ids` and `dimension_ids`. A list may contain variable IDs or objects with `variable_id`. |
| `selected_evidence_ids` | `string[]` | No | Filters Evidence Board items by `source_diagnostic_id`, `evidence_id`, or rank. If omitted, all provided Evidence Board items are eligible. |
| `evidence_board` | `Decision Output Evidence Board` | No | Source for evidence coverage edges. May also be passed as `decision_output.evidence_board`. |
| `frame` | `Decision Output Frame` | No | Helps map Evidence Board role coverage to selected variables, especially goal coverage. May also be passed as `decision_output.frame` or derived from a workspace decision scope. |
| `filters` | `object[]` | No | Existing metric-resolver style filters applied before observed association metrics are computed. |
| `user_hypotheses` | `object[]` | No | User-stated directional hypothesis edges. Each item should include `source_variable_id` and `target_variable_id`; camelCase aliases and node IDs are accepted. Hypothesis endpoints must be selected graph variables. |

Candidate response fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `string` | Yes | `decision_graph_candidates`. |
| `schema_version` | `string` | Yes | Current value is `di_phase7_3_decision_graph_v1`. |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset summary. |
| `variable_candidates` | `Decision Graph Variable[]` | Yes | Eligible and ineligible metric and dimension candidates. |
| `data_sufficiency` | `object` | Yes | Dataset-level row count and candidate counts. |
| `limitations` | `string[]` | Yes | Conservative notes about candidate availability. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Graph response fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `string` | Yes | `decision_graph`. |
| `render_hint` | `string` | Yes | `decision_graph`. |
| `schema_version` | `string` | Yes | Current value is `di_phase7_3_decision_graph_v1`. |
| `graph_mode` | `string` | Yes | Normalized graph mode used. |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset summary. |
| `selected_variables` | `Decision Graph Variable[]` | Yes | Variables resolved from the request. Unknown IDs are returned with `eligible: false`. |
| `variable_candidates` | `Decision Graph Variable[]` | Yes | Full candidate list for the same dataset context. |
| `nodes` | `Decision Graph Node[]` | Yes | Selected variable nodes plus evidence nodes when coverage mode is used. |
| `edges` | `Decision Graph Edge[]` | Yes | Evidence coverage, observed association, and/or user hypothesis edges. |
| `graph_state` | `Decision Graph State` | Yes | Carry-forward build state for UI session state or saved decision assets. The endpoint returns the object but does not persist it server-side. |
| `data_sufficiency` | `object` | Yes | Graph-level sufficiency including row count, selected variable count, and edge count. |
| `limitations` | `string[]` | Yes | Graph-level limitations. |
| `reliability_labels` | `object` | Yes | Legend for evidence coverage, observed association, and user hypothesis edge reliability labels. |
| `available_graph_actions` | `object[]` | Yes | Backend-known follow-up action types: `breakdown`, `monitor`, `explain_evidence`, `explain_missing_data`, and `send_to_scenario_compare`. Each item includes the observational `truth_boundary`. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Decision Graph Variable fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `variable_id` | `string` | Yes | Metric ID or dimension ID. |
| `variable_type` | `string` | Yes | `metric`, `dimension`, or `unknown`. |
| `label` | `string` | Yes | Display label from the semantic model or selected ID fallback. |
| `field` | `string \| null` | Yes | Backing field when available. |
| `ref` | `Metric Reference \| Dimension Reference \| null` | Yes | Semantic reference when resolved. |
| `eligible` | `boolean` | Yes | Whether the backend can inspect the variable in the current dataset. |
| `data_type` | `string` | Yes | `numeric`, `categorical`, `temporal`, `numeric_dimension`, or `unknown`. |
| `semantic_role` | `string` | Yes | Conservative role such as `objective_candidate`, `driver_candidate`, `limit_candidate`, `breakdown_candidate`, `temporal`, `metric`, or `dimension`. |
| `data_sufficiency` | `object` | Yes | Row count, non-null count, missing count, status, and summary. |
| `limitations` | `string[]` | Yes | Variable-level limitations. |

Decision Graph Edge fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `edge_id` | `string` | Yes | Stable generated edge identifier. |
| `source_node_id` | `string` | Yes | Source graph node ID. |
| `target_node_id` | `string` | Yes | Target graph node ID. |
| `relationship_type` | `string` | Yes | `evidence_coverage`, `observed_association`, or `user_hypothesis`. |
| `evidence_basis` | `string` | Yes | `ranked_diagnostic_coverage`, `dataset_observed_association`, or `user_stated_hypothesis`. |
| `causal_status` | `string` | Yes | Backend-generated coverage and observed association edges use `not_causal_claim`. User hypothesis edges must use `user_hypothesis_not_validated`. |
| `reliability_label` | `string` | Yes | `observed_supported`, `observed_limited`, `observed_insufficient`, or `user_hypothesis_unvalidated`. |
| `label` | `string` | Yes | Short display label. |
| `summary` | `string` | Yes | Short backend-owned edge explanation. |
| `metrics` | `object` | Yes | Edge metrics. Observed associations include `method`, `strength`, `direction`, endpoint variable IDs, sample size, and method-specific values such as `correlation`, `top_groups`, `trend_correlation`, or `cramers_v`. Coverage edges include `evidence_strength` and source diagnostic trace. User hypotheses include `method: "user_stated_hypothesis"`, `direction: "user_proposed_directional"`, `validation_status: "not_validated"`, endpoint variable IDs, and optional rationale. |
| `data_sufficiency` | `object` | Yes | `status`, row/sample counts where available, and summary. |
| `limitations` | `string[]` | Yes | Edge-level limitations. |
| `followup_actions` | `object[]` | Yes | Per-edge action availability. Each item includes `action_id`, `label`, `description`, `enabled`, `status`, `source_refs`, `limitations`, and `truth_boundary`; disabled items also include `disabled_reason`. Scenario Compare is not enabled for `user_hypothesis` edges until observational evidence is selected. |

User hypothesis edge semantics:

`relationship_type: "user_hypothesis"` means the user proposed a directional relationship between two selected graph variables. It is a stated assumption for follow-up inspection only. It is never causal proof, never an observed backend association, and never a decision rule. The required causal field is `causal_status: "user_hypothesis_not_validated"` and the required evidence basis is `evidence_basis: "user_stated_hypothesis"`.

Decision Graph State fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schema_version` | `string` | Yes | Current value is `di_phase7_3_decision_graph_v1`. |
| `state_kind` | `string` | Yes | `decision_graph_build_state`. |
| `persistence` | `string` | Yes | `client_session_or_saved_decision_asset`; this route does not persist graph state server-side. |
| `graph_mode` | `string` | Yes | The normalized graph mode used for the build. |
| `selected_variables` | `object` | Yes | Object with `metric_ids` and `dimension_ids` arrays. |
| `selected_evidence_ids` | `string[]` | Yes | Evidence IDs selected for coverage edges. Empty when none were provided. |
| `user_hypotheses` | `object[]` | Yes | Accepted user hypothesis carry-forward items with `hypothesis_id`, endpoint variable IDs, label, summary, optional rationale, `causal_status`, and `validation_status`. |
| `filters` | `object[]` | Yes | Filters copied from the build request. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |
| `limitations` | `string[]` | Yes | Includes a note that the endpoint returns state for carry-forward but does not persist it server-side. |

Graph action request fields for `/api/decision/graph/actions`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action_id` | `string` | Yes | `breakdown`, `monitor`, `explain_evidence`, `explain_missing_data`, or `send_to_scenario_compare`. Aliases such as `break_down_metric` and `scenario_compare` are normalized. |
| `decision_graph` | `Decision Graph` | No | Full graph response used to resolve `edge_id` or `node_id`. May also be passed as `graph`. |
| `target_edge` | `Decision Graph Edge` | No | Selected edge object. Required when `edge_id` is not provided. |
| `edge_id` | `string` | No | Selected edge ID resolved against `decision_graph.edges`. |
| `target_node` | `Decision Graph Node` | No | Selected node object. Required when `node_id` is not provided and there is no target edge. |
| `node_id` | `string` | No | Selected node ID resolved against `decision_graph.nodes`. |
| `filters` | `object[]` | No | Optional filters copied into prepared follow-up request payloads. |

Graph action response fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `string` | Yes | `decision_graph_action_response`. |
| `render_hint` | `string` | Yes | `decision_graph_action_response`. |
| `schema_version` / `contract_version` | `string` | Yes | Current value is `di_phase7_3_decision_graph_v1`. |
| `action_id` | `string` | Yes | Normalized action ID. |
| `action_status` | `string` | Yes | `ready`, `needs_input`, `needs_metric`, or `needs_observed_metric_edge`. |
| `enabled` | `boolean` | Yes | Whether the planned graph action is ready for user approval. |
| `disabled_reason` | `string \| null` | Yes | Backend-owned blocked reason when `enabled` is false. User hypothesis Scenario Compare responses must state that user hypotheses are not observationally validated metric evidence. |
| `target` | `object` | Yes | Resolved target node or edge summary, including relationship type and causal status when an edge is selected. |
| `source_refs` | `object` | Yes | Exact source refs for the selected graph node or edge, including edge ID, relationship type, evidence basis, node IDs, and variable IDs when available. |
| `summary` | `string` | Yes | Backend-owned summary of what the follow-up can safely do. |
| `request_payload` | `object` | Yes | Prepared request semantics for a future UI or AI Chat handoff. It may include a route hint, but this route does not execute the follow-up. |
| `response_semantics` | `object` | Yes | Declares `executes_analysis: false` and `causal_claim: false`; Scenario Compare responses also declare `scenario_semantics: "direct_adjustment_only"`. |
| `explanation` | `string[]` | Yes | Plain-language guidance for the UI or AI Chat explanation. |
| `limitations` | `string[]` | Yes | Reliability and missing-data caveats copied from the selected graph item plus graph-action boundary notes. |
| `truth_boundary` | `string` | Yes | Current value is `observational_analysis_only`. |

Implemented first-pass observed association methods:

| Variable pair | Method |
| --- | --- |
| Numeric metric to numeric metric | `pearson_correlation` with correlation, direction, sample size, and missing pair count. |
| Categorical dimension to numeric metric | `group_mean_difference` with top groups, group count, sample size, and top-bottom delta. |
| Temporal dimension to numeric metric | `observed_time_trend` with trend correlation, first/last values, delta, and sample size. |
| Categorical dimension to categorical dimension | `distribution_association` with Cramer's V when enough rows exist. |

Reliability boundary: `decision_graph` is descriptive graph data only. It must not render as causal proof, optimization, simulation, prediction certainty, autonomous decisioning, or final recommendations. User hypothesis edges are user-stated assumptions and must stay visually and contractually separate from observed associations.

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

Represents a suggested follow-up check derived from one or more decision signals. The legacy field name remains `Recommendation` for API compatibility, but current payloads are observational review aids, not final recommendations, optimized actions, causal findings, or autonomous decisions.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `recommendation_id` | `string` | Yes | Stable generated identifier |
| `recommendation_type` | `string` | Yes | Current emitted values are `investigate`, `monitor`, or `validate`. Legacy saved objects may contain `optimize`, but new runtime output should not use it. |
| `priority` | `string` | Yes | `low`, `medium`, `high` |
| `status` | `string` | Yes | Phase 1 uses `proposed` |
| `title` | `string` | Yes | Short action-oriented headline |
| `summary` | `string` | Yes | Human-readable follow-up check summary |
| `dataset` | `Dataset Summary` | Yes | Resolved dataset context |
| `based_on_signal_ids` | `string[]` | Yes | Traceability back to DecisionSignal objects |
| `metric_ref` | `Metric Reference \| null` | No | Present when tied to a metric |
| `dimension_ref` | `Dimension Reference \| null` | No | Present when tied to a dimension |
| `actions` | `object[]` | Yes | Structured next-check hints |
| `expected_outcome` | `string` | Yes | High-level review result to look for; this is not a promised business outcome |
| `confidence` | `number` | Yes | `0.0` to `1.0` |
| `confidence_scope` | `string` | Yes for current runtime output | Explains that `confidence` reflects supporting signal evidence, not an outcome probability or action confidence. |
| `source_refs` | `object` | Yes for current runtime output | Trace to the supporting DecisionSignal source and its stable signal ID. |
| `limitations` | `string[]` | Yes for current runtime output | Explicit follow-up-check boundary, including that the object is not a final recommendation or causal finding. |
| `truth_boundary` | `string` | Yes for current runtime output | Current value is `observational_analysis_only`. |
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

Represents a Phase 3 lightweight scenario suggestion generated from the connected decision pipeline. It reuses the existing scenario service but returns only preview-oriented inputs and direct-adjustment projection summaries.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `status` | `string` | Yes | `ready`, `not_applicable`, or `not_requested` |
| `summary` | `string` | Yes | Short explanation of whether a preview was prepared |
| `based_on_recommendation_ids` | `string[]` | Yes | Ordered legacy recommendation identifiers used to prepare the preview; treat these as follow-up-check references in current UI copy |
| `based_on_signal_ids` | `string[]` | Yes | Ordered signal identifiers traced through the follow-up checks |
| `period_context` | `Period Context \| null` | No | Shared business-facing time/comparison context for the preview when available |
| `suggested_inputs` | `object` | Yes | Lightweight scenario input proposal for future UI or automation use |
| `projections` | `object[]` | Yes | Condensed projected metric outputs derived from the existing scenario service |
| `assumptions` | `string[]` | Yes | Explicit scenario-preview assumptions |
| `source_scenario_ids` | `string[]` | Yes | Trace IDs from the `evaluate_scenario` response used to build the preview. Empty when no scenario preview is generated. |
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
| `adjustment_value` | `number` | Yes | Deterministic lightweight adjustment inferred from top signals and follow-up checks |

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
| `recommendations` | `Recommendation[]` | Yes | Legacy field name for follow-up checks derived from the same signal set |
| `scenario_preview` | `DecisionScenarioPreview` | Yes | Lightweight preview generated from top follow-up checks or a predictable no-op object |

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
      "recommendation_id": "recommendation_investigate_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00",
      "based_on_signal_ids": [
        "signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00"
      ]
    }
  ],
  "scenario_preview": {
    "status": "ready",
    "based_on_recommendation_ids": [
      "recommendation_investigate_signal_metric_delta_metric_revenue_sum_2026_04_04t150000_00_00_2026_04_04t150000_00_00"
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
    "source_scenario_ids": [
      "scenario_decision_pipeline_preview_2026_04_04t150000_00_00"
    ],
    "generated_at": "2026-04-04T15:00:00+00:00"
  }
}
```
