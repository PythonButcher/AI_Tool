# Phase 2 Semantic Role Strengthening Plan

## Purpose

This is the active next implementation plan after Phase 1 Decision Intelligence reliability foundation completion.

Phase 1 made decision framing measurable and added backend-owned readiness and capability boundaries. Phase 2 should improve the semantic grounding that feeds those decision frames, so the system can distinguish objective metrics, controllable levers, guardrails, segment dimensions, temporal fields, ambiguous mappings, and unsafe weak matches with explicit confidence.

## Current Status

Status: ready to start.

Owner: Codex for backend, contracts, tests, and documentation.

Frontend ownership remains Gemini. Do not change frontend files unless the user explicitly authorizes Codex frontend edits in the current session.

Primary council recommendation: `rec-semantic-model-role-strengthening`.

## Non-Goals

Do not add simulation, optimization, autonomous decisioning, final recommendations, or stronger ML output.

Do not make weak semantic mappings look certain.

Do not start with frontend rendering. Gemini can receive a later handoff only after backend fields and contracts stabilize.

Do not rename existing endpoint names, action IDs, artifact types, or current semantic model fields.

## Implementation Scope

The backend should add decision-aware semantic metadata while preserving existing semantic model compatibility.

The new metadata should be additive and should let downstream decision framing answer these questions:

- Is this metric a likely business objective?
- Is this field or metric a likely controllable lever?
- Is this metric suitable as a guardrail?
- Is this dimension suitable for segmentation or comparison?
- Is this field temporal, and what time grain is safest to infer?
- What aliases or business terms made the mapping plausible?
- How confident is the mapping, and what evidence supports that confidence?
- Which mappings were unresolved, ambiguous, or rejected because confidence was too low?

## Candidate Contract Shape

Use additive fields so existing frontend and backend consumers continue working.

For semantic metrics, add a nested object such as `decision_semantics` with role hints:

`objective_candidate`, `lever_candidate`, `guardrail_candidate`, `polarity`, `controllability`, `aliases`, `business_terms`, `confidence`, `confidence_reason`, and `unresolved_reasons`.

For semantic dimensions, add a similar `decision_semantics` object with:

`segment_candidate`, `comparison_candidate`, `temporal_candidate`, `grain`, `aliases`, `business_terms`, `confidence`, `confidence_reason`, and `unresolved_reasons`.

For prompt-level decision parsing, preserve existing extracted structures but add traceability where practical:

`semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, and `semantic_role_warnings`.

These names are planning defaults, not a locked schema. The implementation should inspect the existing semantic model shape before finalizing names in `project_docs/active/contracts/decision_objects.md`.

## Work Packages

### 1. Audit Current Semantic Flow

Inspect:

| Area | Path |
| --- | --- |
| Semantic model generation | `backend/services/semantic_model.py` |
| Semantic model route | `backend/routes/semantic_model.py` |
| Decision chat semantic matching | `backend/decision_engine/chat_service.py` |
| Workspace drafting and bindings | `backend/services/decision_workspace_service.py` |
| Existing reliability benchmark | `tests/decision_reliability_benchmark_cases.py`, `tests/test_decision_reliability_benchmark.py` |

Document the current semantic object shape before changing it.

### 2. Add Semantic Role Fixtures And Tests

Create or extend backend tests for:

| Case | Expected Behavior |
| --- | --- |
| Clear objective metric | High-confidence objective candidate resolves. |
| Clear controllable lever | Lever candidate resolves with controllability metadata. |
| Guardrail metric | Guardrail candidate resolves without being treated as the objective. |
| Segment-only prompt | Segment dimension is detected without inventing an objective. |
| Temporal field | Temporal candidate and safe grain are exposed. |
| Near-name collision | Backend reports ambiguity or low confidence instead of silently choosing. |
| No-safe-match | Backend leaves binding unresolved and reports why. |
| Weak semantic model | Decision frame remains truthful and requests clarification or review. |

The existing Phase 1 benchmark should remain the regression base. Add semantic-specific assertions without weakening readiness/capability checks.

### 3. Implement Additive Role Metadata

Add role inference with conservative confidence.

Prefer deterministic rules first: field names, metric names, data type, aggregation, semantic kind, existing aliases, and observed value patterns.

Confidence should be explicit and conservative. Low confidence should create unresolved or ambiguous mapping metadata, not a confident binding.

### 4. Use Roles In Decision Framing

Decision chat and workspace drafting should prefer semantic roles when resolving objectives, levers, guardrails, segments, and temporal context.

The resolver should still preserve existing behavior for older semantic models without role metadata.

When semantic role confidence is low or conflicting, the decision frame should surface missing inputs, blockers, assumptions, or review hints instead of silently overfitting the prompt.

### 5. Update Contracts And Status

Update `project_docs/active/contracts/decision_objects.md` with the final additive semantic role fields.

Update `project_docs/active/status/decision_intelligence_execution_status.md` with what was implemented and which tests passed.

If the backend fields become ready for frontend rendering, create a Gemini handoff under `project_docs/active/decision_intelligence/current/` and keep it short, concrete, and scoped.

## Acceptance Criteria

Phase 2 is complete when semantic model output includes additive decision role hints and confidence metadata, prompt-first decision framing uses those roles without breaking existing behavior, ambiguous or weak mappings are exposed instead of hidden, and targeted tests pass.

Required verification:

`python -m unittest tests.test_decision_reliability_benchmark`

`python -m unittest tests.test_decision_workspace_service`

Any new semantic role test module added in this phase.

If `tests.test_decision_chat_service` is still blocked by local Flask visibility, document that honestly instead of marking it passed.

## Start Prompt

Implement Phase 2 from `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`. Keep it backend-first. Add additive decision-aware semantic role metadata, conservative confidence, unresolved mapping details, and tests that protect against semantic false confidence. Update the decision object contract and active status docs truthfully. Do not edit frontend files unless explicitly authorized.
