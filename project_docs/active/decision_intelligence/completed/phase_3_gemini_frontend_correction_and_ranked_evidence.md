# Phase 3 Gemini Frontend Handoff: Correction And Ranked Evidence

Owner: Gemini frontend

Status: Complete

## Backend Truth

Codex completed the Phase 3 backend slice on May 22, 2026. Existing endpoint names, existing action IDs, artifact types, readiness fields, and the `observational_analysis_only` boundary were preserved.

Decision frame corrections are deterministic and explicit. Backend service callers can use the correction service directly, and the Decision Chat action route can apply a correction payload through the existing `draft_workspace` action. The response can include additive `correction_result`, `trace`, corrected `decision_workspace`, recomputed `decision_readiness`, recomputed `allowed_next_actions`, and corrected session state.

Workspace analysis now includes additive `workspace_analysis.ranked_diagnostics` and `workspace_analysis.observational_boundary` while preserving existing `scoped_diagnostics` and `legacy_diagnostics`.

## Current Frontend Truth

Gemini has completed the Phase 3 implementation, including correction rendering and ranked observational diagnostics.

The correction panel is integrated into the existing `workspace_preview` renderer.

The ranked evidence renderer follows the exact backend `semantic_coverage` shape.

All invalid plain React style shorthand keys have been replaced with valid CSS properties. The frontend is contract-adherent and verified with build.

## Files To Inspect

Render correction results and ranked observational diagnostics without adding simulation, optimization, causal, autonomous-decisioning, or final-recommendation language.

Inspect these actual current frontend paths:

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspace.css`

If shared artifact rendering utilities exist for `workspace_analysis_summary`, use the existing local pattern instead of creating a separate one-off surface.

## Exact Backend Shapes

Correction fields arrive on a `workspace_preview` artifact:

`artifact.type`

Current value: `workspace_preview`

`artifact.correction_result`

Object with `status`, `correction_type`, `target_path`, `summary`, `previous_value`, `new_value`, `affected_readiness_fields`, `readiness_state`, and `allowed_next_actions`.

`artifact.trace`

Object with `source`, `timestamp`, `correction_type`, `target_path`, `reason`, `semantic_confidence`, `warnings`, `unresolved_mappings`, and `observational_boundary`.

Ranked diagnostics arrive on `workspace_analysis_summary` content:

`content.ranked_diagnostics[]`

Each item includes `evidence_rank`, `relevance_score`, `evidence_strength`, `semantic_coverage`, `data_sufficiency`, `limitations`, `observational_boundary`, and `source_diagnostic`.

`semantic_coverage`

Exact backend keys are `objective`, `temporal`, `levers`, `guardrails`, `segments`, and `semantic_confidences`.

`objective` and `temporal` are booleans.

`levers`, `guardrails`, and `segments` are arrays. Items can be objects, not strings. Render a readable label from `label`, `lever_id`, `constraint_id`, `segment_id`, `dimension_ref.label`, `dimension_ref.field`, or fallback JSON.

`semantic_confidences` is an array of numbers. Render each numeric value directly as a percent. Do not use `Object.entries` on it.

Do not read `semantic_coverage.covers_objective`. Do not read `semantic_coverage.temporal_grain`. Those are not backend contract fields.

The frontend should continue to respect backend-owned `decision_readiness`, `allowed_next_actions`, `blocked_state`, `capability_state`, and `unsupported_capabilities`.

## Acceptance Behavior

When a correction response is rendered, the user can see what changed, the target path, the previous and new value in a readable form, the updated readiness state, and any trace warnings. The corrected workspace state must be the state used by follow-up analysis and action rendering.

When workspace analysis is rendered, ranked diagnostics appear as observational evidence ranked by diagnostic relevance. The UI must make clear that the ranking is not a recommended action order and is not simulation, optimization, causal impact, autonomous decisioning, or a final recommendation.

Existing scoped diagnostics, legacy diagnostics, blockers, assumptions, open workspace, and readiness behavior must keep working.

## Verification

Run the frontend build and one focused browser flow that starts from a decision prompt, applies or inspects a corrected workspace response if the UI exposes correction controls, runs Analyze workspace, and verifies ranked diagnostics are visible with the observational-only boundary. If correction controls are not yet exposed, verify the rendering using a mocked or fixture-backed response consistent with the contract.

Update `project_docs/active/status/decision_intelligence_execution_status.md` with the exact frontend files changed, build result, browser verification result, and any remaining caveats.

## Gemini CLI Prompt

No active Gemini prompt remains for this completed Phase 3 handoff. The old Phase 4 dataset handoff is superseded. Use `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` for the active product direction.
