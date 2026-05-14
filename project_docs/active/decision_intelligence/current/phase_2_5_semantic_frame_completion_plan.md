# Phase 2.5 Semantic Frame Completion Plan

## Purpose

Phase 2 added the semantic-role metadata needed for decision-aware drafting, but the May 14, 2026 PDF review showed that the product behavior is not yet complete. The backend can attach semantic roles, confidence, reasons, polarity, controllability, and warnings to metrics and dimensions, but the active decision frame can still lose, under-parse, or misclassify prompt terms.

Phase 2.5 exists to button up that gap before Phase 3 correction and ranked observational evidence. This is a backend-first reliability slice focused on making the prompt-first decision frame match the user's stated objective, levers, guardrails, segments, and thresholds.

## Current Status

Status: queued after PDF export acceptance.

The preceding branch, `project_docs/active/pdf_export_unification_plan.md`, is still active. The first shared export implementation exists, but Decisions workspace export fidelity is not accepted because the generated PDF does not yet match the visible workspace window closely enough. Phase 2.5 should start only after PDF export remediation is accepted.

Phase 3 correction and ranked observational evidence remains planned, but it is deferred until Phase 2.5 is complete. Phase 3 should not be started while the current prompt-first frame can misclassify segmentation dimensions as levers or drop guardrail thresholds.

## Review Evidence

The review used the active test dataset:

`D:/Data Bank/AI Tool Test Data/decision_intelligence_prompt_first_demo_clean_large.csv`

The test prompt was:

`How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?`

The exported PDFs showed that Decision Chat correctly routed to `decide`, generated a workspace preview, opened the Decisions workspace, and exposed Phase 2 semantic metadata in the raw workspace export. The raw contract included `decision_semantics`, `semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, `semantic_role_warnings`, aliases, polarity, controllability, and role confidence.

However, the active decision frame was not correct:

`gross_margin_pct above 30%` was detected in prompt matches but did not become an active guardrail.

`return_rate_pct below 4%` became an active guardrail, but its condition had `operator: "lte"` and `value: null`; the threshold value was lost.

`region and channel` was not handled consistently as segmentation. The preview showed only `channel` as the segment, the workspace scoped context included `region`, and the draft also introduced `channel mix` as a controllable lever even though the prompt said `segmented by region and channel`.

The chat preview said no unresolved mappings were reported even though the active frame was missing or misclassifying important prompt terms. That makes the frame look more reliable than it is.

## Product Goal

For clear prompt-first decision statements, the active decision frame should preserve the user's stated semantic roles without requiring a correction loop. If the user names objective, levers, guardrails, segments, and thresholds clearly, those items should appear in the active workspace preview and Decisions workspace with appropriate role metadata, confidence, reasons, and warnings.

Phase 2.5 does not add simulation, optimization, autonomous decisioning, or final recommendation. It does not add the full Phase 3 correction loop. It makes the initial frame reliable enough that Phase 3 can build correction and ranked evidence on a sane state.

## Implementation Scope

### 1. Fix prompt-first frame extraction

Inspect `backend/services/decision_workspace_service.py`, especially prompt-first drafting, prompt match selection, lever extraction, constraint extraction, segment extraction, condition parsing, and readiness evaluation.

The exact May 14 test prompt must produce this active frame:

Objective: `revenue`, direction `maximize`, horizon `Next quarter`.

Levers: `marketing_spend` and `discount_pct`.

Segments: `region` and `channel`.

Guardrails: `gross_margin_pct above 30%` and `return_rate_pct below 4%`.

`channel` must not become a controllable `channel mix` lever when it appears only inside `segmented by region and channel`.

### 2. Preserve guardrail thresholds

Guardrail condition parsing must preserve both operator and value. For the test prompt, `gross_margin_pct above 30%` should become a guardrail condition with a greater-than or greater-than-or-equal operator and the threshold value preserved. `return_rate_pct below 4%` should become a less-than or less-than-or-equal condition with the threshold value preserved.

Use the existing contract shape where possible. If the current condition object represents percentages as `value: 30, unit: "%"`, preserve that convention consistently. Do not allow `analysis_ready` when a required hard guardrail has a null threshold value because parsing failed.

### 3. Keep segment clauses out of lever extraction

Segment-clause parsing should be role-aware. Terms introduced by phrases such as `segmented by`, `broken down by`, `by region and channel`, or `compare across` should bind to segment or comparison dimensions, not to controllable levers.

The system can still support a true mix lever when the user explicitly says something like `change channel mix`, `shift channel mix`, or `optimize channel allocation`, but not when the term appears only in segmentation language.

### 4. Make unresolved or omitted mappings truthful

If a prompt term is detected but not included in the active frame, the backend should either include it in the correct role or surface a truthful unresolved or frame-omission detail. The UI and PDF export should not claim "No unresolved mappings" when a clearly detected term such as `gross_margin_pct` was not included in the active guardrails.

Preserve Phase 2 traceability fields on active bindings: `semantic_binding_confidence`, `semantic_binding_reason`, `semantic_role_source`, and `semantic_role_warnings`.

### 5. Tighten readiness semantics

Readiness should be based on the active frame, not only on partial prompt matches. A decision with a hard guardrail whose threshold value failed to parse should be blocked or limited until resolved. A frame that drops one of two explicitly requested guardrails should not look fully reliable without warning.

### 6. Use the accepted PDF export for review

Phase 2.5 should rely on the app-wide PDF export system after it is accepted. Do not rebuild PDF export inside Phase 2.5. Use the accepted export only to verify that AI Chat and Decisions workspace output match the active backend frame.

## Tests To Add

Add backend tests around the exact May 14 prompt and at least two nearby variants. Tests should assert the active workspace object, not just prompt matches.

Required assertions for the exact prompt:

The draft mode is `decide` or prompt-first workspace creation.

The active objective metric is `revenue`.

The active levers are exactly the intended controllable levers: `marketing_spend` and `discount_pct`.

The active segment dimensions include both `region` and `channel`.

The active guardrails include both `gross_margin_pct` and `return_rate_pct`.

Both guardrail conditions preserve non-null threshold values and the correct direction.

`channel mix` is not added as a lever unless the prompt explicitly asks to shift or change channel mix.

`readiness_state` is not `analysis_ready` when a hard guardrail is missing a threshold value.

Phase 2 semantic trace fields are present on active objective, lever, guardrail, and segment refs when available.

## Files To Inspect First

`backend/services/decision_workspace_service.py`

`backend/decision_engine/chat_service.py`

`backend/services/semantic_model.py`

`tests/test_decision_workspace_service.py`

`tests/test_decision_reliability_benchmark.py`

`tests/test_semantic_role_strengthening.py`

`project_docs/active/contracts/decision_objects.md`

## Acceptance Criteria

Phase 2.5 is complete when the exact May 14 prompt produces a correct active decision frame in both AI Chat `workspace_preview` and the opened Decisions workspace:

Objective `revenue`.

Levers `marketing_spend` and `discount_pct`.

Segments `region` and `channel`.

Guardrails `gross_margin_pct above 30%` and `return_rate_pct below 4%`.

No false `channel mix` lever.

No null threshold values for parsed guardrails.

Truthful unresolved or omission details if any term cannot be safely bound.

Existing observational-analysis-only boundary remains intact.

Required verification:

`python -m unittest tests.test_semantic_role_strengthening`

`python -m unittest tests.test_decision_workspace_service`

`python -m unittest tests.test_decision_reliability_benchmark`

Any new Phase 2.5 test module or new test cases added for prompt-first semantic frame completion.

If local interpreter dependency issues block one of these commands, use the bundled Python runtime where appropriate and document exactly what passed and what was blocked.

## Documentation Updates Required

When Phase 2.5 is implemented, update:

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/contracts/decision_objects.md` if condition, omission, or unresolved mapping fields change

This plan if acceptance criteria or field names change during implementation

Do not mark Phase 3 active again until this status file truthfully says Phase 2.5 is complete.

## Stored Start Prompt For Later

Start by reading AGENTS.md, project_docs/INDEX.md, project_docs/active/README.md, project_docs/active/status/decision_intelligence_execution_status.md, and project_docs/active/decision_intelligence/current/phase_2_5_semantic_frame_completion_plan.md. Implement Phase 2.5 backend-first after confirming app-wide PDF export remediation is accepted. The goal is to fix prompt-first semantic frame extraction so the exact May 14 real-dataset prompt preserves objective revenue, levers marketing_spend and discount_pct, segments region and channel, and guardrails gross_margin_pct above 30% plus return_rate_pct below 4% with non-null threshold values. Do not add a false channel mix lever when channel appears only in segmentation language. Preserve existing endpoint names, action IDs, artifact types, readiness fields, semantic trace fields, and the observational-analysis-only boundary. Update backend tests, project_docs/active/contracts/decision_objects.md if fields change, and active status docs truthfully. Do not edit frontend files unless explicitly authorized.
