# Phase 3 Correction And Ranked Observational Evidence Plan

## Purpose

Phase 3 builds on the completed reliability and semantic-role foundation. The system can now identify decision objects with more explicit role metadata, confidence, trace reasons, and unresolved mapping details. The next step is to let users correct the frame before analysis and to make `Analyze workspace` return richer observational evidence without drifting into recommendations, simulation, optimization, or autonomous decisioning.

## Current Status

Status: active next Codex-owned backend slice.

Owner: Codex for backend actions, contracts, tests, and documentation. Gemini owns frontend implementation after the backend contract stabilizes and Codex prepares a scoped handoff.

Phase 2 backend is complete. Phase 2 frontend integration is functionally in place, but the latest Codex review found small Gemini-owned cleanup items: compact semantic refs should visibly surface role metadata, and modified frontend files should pass `git diff --check`. These cleanup items do not change the Phase 3 backend contract.

## What Phase 2 Enables Now

Users and agents can now inspect whether a mapped semantic object is acting as an objective, lever, guardrail, segment, comparison, or temporal field. Metric and dimension refs can carry confidence, aliases, business terms, polarity, controllability, and unresolved review reasons.

Prompt-first decision drafting can now expose why a term was mapped, how confident the mapping is, and which prompt terms could not be safely resolved. This means Phase 3 can add correction actions against concrete frame elements instead of asking the frontend to infer intent from plain labels.

## Non-Goals

Do not add simulation, optimization, causal impact claims, autonomous decisioning, or final recommendations.

Do not rank evidence as a recommended action order. Ranked observational evidence should mean evidence priority and diagnostic relevance, not “do this.”

Do not make weak semantic mappings look certain. Corrections should preserve traceability and should not erase unresolved mapping history.

Do not start with frontend implementation. Backend contracts and tests should stabilize first.

## Implementation Scope

Phase 3 has two backend-first tracks.

### 1. Decision Frame Correction Loop

Add deterministic correction actions for the current draft workspace frame. Corrections should be additive and session-state compatible with the existing Decision Chat action system.

Correction actions should support objective metric, objective direction, time horizon, lever binding, lever controllability, guardrail binding, guardrail condition, segment dimension, and explicit removal or replacement of a mistaken mapping.

Each correction should return updated workspace state, a short correction summary, updated readiness, updated allowed next actions, and trace metadata showing what changed. Corrections should use the same semantic confidence and unresolved-mapping language introduced in Phase 2.

### 2. Ranked Observational Evidence

Strengthen `Analyze workspace` output so it returns ordered diagnostics with evidence, scope, semantic coverage, assumptions, blockers, data-quality caveats, and limitations.

Evidence should be ranked by diagnostic relevance to the corrected decision frame. The ranking should be explainable with fields such as relevance score, evidence strength, semantic coverage, data sufficiency, and limitation notes. The response must remain observational and should not choose an option for the user.

## Candidate Contract Shape

Use additive fields and preserve existing endpoint names, action IDs, artifact types, and compatibility fields.

For correction actions, add or extend action payloads with:

| Field | Type | Notes |
| --- | --- | --- |
| `correction_type` | `string` | `objective_metric`, `objective_direction`, `time_horizon`, `lever_binding`, `lever_controllability`, `guardrail_binding`, `guardrail_condition`, `segment_dimension`, or `remove_mapping` |
| `target_path` | `string` | Stable object path such as `decision_scope.objective.metric_ref` or `decision_scope.levers[0].binding` |
| `replacement` | `object` | New metric ref, dimension ref, field binding, condition, or scalar value |
| `reason` | `string \| null` | Optional user or system reason for the correction |

For correction responses, add:

| Field | Type | Notes |
| --- | --- | --- |
| `correction_result` | `object` | Summary of applied change, previous value, new value, and affected readiness fields |
| `decision_workspace` | `object` | Updated workspace, preserving existing shape |
| `decision_readiness` | `object` | Updated readiness/capability truth |
| `allowed_next_actions` | `string[]` | Backend-approved next action IDs |
| `trace` | `object` | Correction source, timestamp, target path, semantic confidence, warnings, and unresolved details |

For ranked observational evidence, add:

| Field | Type | Notes |
| --- | --- | --- |
| `ranked_diagnostics` | `object[]` | Ordered diagnostics scoped to the current decision frame |
| `evidence_rank` | `integer` | 1-based rank within this analysis response |
| `relevance_score` | `number` | 0.0 to 1.0 diagnostic relevance to the current frame |
| `evidence_strength` | `string` | `strong`, `moderate`, `weak`, or `insufficient` |
| `semantic_coverage` | `object` | Which objective, lever, guardrail, segment, and temporal refs contributed |
| `limitations` | `string[]` | Caveats, missing data, unresolved mappings, or weak confidence |
| `observational_boundary` | `string` | Current value should remain `observational_analysis_only` |

Final field names should be confirmed against the existing chat action and workspace analysis code before updating `project_docs/active/contracts/decision_objects.md`.

## Work Packages

### 1. Audit Existing Action And Analysis Flow

Inspect:

| Area | Path |
| --- | --- |
| Chat action routing | `backend/decision_engine/chat_service.py` |
| Workspace creation and readiness | `backend/services/decision_workspace_service.py` |
| Existing decision support analysis | `backend/services/decision_support.py` |
| Reliability benchmark | `tests/test_decision_reliability_benchmark.py` |
| Workspace tests | `tests/test_decision_workspace_service.py` |
| Contract docs | `project_docs/active/contracts/decision_objects.md` |

### 2. Add Correction Fixtures And Tests

Add tests for correcting a wrong objective, replacing a lever binding, marking a lever non-controllable, adding or replacing a guardrail, correcting a segment dimension, correcting a time horizon, removing an unsafe mapping, and verifying readiness updates after each correction.

Tests should also protect against stale state by ensuring corrected workspace state is used by follow-up analysis and by scoped chat actions.

### 3. Implement Backend Correction Actions

Add backend-owned correction behavior through the existing action system where practical. Keep actions deterministic and explicit. Do not let free-form correction text mutate arbitrary workspace fields without a validated target path and replacement shape.

### 4. Add Ranked Observational Evidence

Extend workspace analysis with ranked diagnostics that explain what evidence matters and why. Use Phase 2 semantic roles and confidence as part of the ranking, but keep the language diagnostic rather than prescriptive.

### 5. Update Contracts, Status, And Gemini Handoff

Update `project_docs/active/contracts/decision_objects.md` with final correction and ranked-evidence fields.

Update `project_docs/active/status/decision_intelligence_execution_status.md` with exactly what was implemented and which tests passed.

After backend fields stabilize, create a scoped Gemini handoff under `project_docs/active/decision_intelligence/current/` that names the frontend files to inspect, the new fields to render, and the no-simulation/no-recommendation language boundary.

## Acceptance Criteria

Phase 3 is complete when users can correct key decision-frame elements through backend-owned actions, corrected state drives later analysis, and `Analyze workspace` returns ranked observational diagnostics with evidence, confidence, limitations, semantic coverage, and readiness-aware boundaries.

Required verification:

`python -m unittest tests.test_decision_reliability_benchmark`

`python -m unittest tests.test_decision_workspace_service`

Any new Phase 3 correction or ranked-evidence test module.

If route-level chat tests remain blocked by local dependency visibility, document that honestly instead of marking them passed.

## Start Prompt

Implement Phase 3 from `project_docs/active/decision_intelligence/current/phase_3_correction_and_observational_evidence_plan.md`. Keep it backend-first. Add deterministic decision-frame correction actions and ranked observational evidence, preserving existing endpoint names, action IDs, artifact types, readiness fields, and the observational-analysis-only boundary. Use Phase 2 semantic role confidence and unresolved mapping trace where it helps correction and evidence ranking. Update backend tests, `project_docs/active/contracts/decision_objects.md`, and active status docs truthfully. Do not edit frontend files unless explicitly authorized.
