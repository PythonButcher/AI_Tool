# Phase 2.5 Gemini Frontend Handoff: Segment Dimensions

## Status

Complete. Gemini implemented the frontend slice and verified it against the May 14 acceptance prompt.

## Backend Truth

Codex changed the backend so prompt-first decision frames now carry explicit `decision_scope.segment_dimensions`.

For the May 14 acceptance prompt, the active backend frame is now:

Objective is `revenue`, direction `maximize`, horizon `Next quarter`.

Levers are `marketing_spend` and `discount_pct`.

Segments are `region` and `channel`, carried in `decision_scope.segment_dimensions`.

Guardrails are `gross_margin_pct above 30%` and `return_rate_pct below 4%`.

The backend no longer creates a false `channel mix` lever when the prompt only says `segmented by region and channel`. A mix lever is allowed only when the prompt explicitly asks to change or shift a mix.

Guardrail conditions now preserve numeric thresholds and may include additive `value_status`: `parsed`, `not_specified`, or `unparsed`. A hard guardrail with `value_status: "unparsed"` is not analysis-ready.

Backend verification passed with the bundled Python runtime:

`python -m unittest tests.test_semantic_role_strengthening`

`python -m unittest tests.test_decision_workspace_service`

`python -m unittest tests.test_decision_reliability_benchmark`

## Frontend Scope

Gemini should update the Decisions workspace UI so active segment dimensions are rendered as first-class decision-frame information.

Start with these files:

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspace.css`

Also inspect these existing paths before editing so the implementation stays consistent:

`frontend/frontend/src/features/ai/AIShell.jsx`

The AI Chat preview already receives segment items from the backend. The gap is the opened Decisions workspace view: it currently displays objective, strategic levers, guardrails, and scoped context, but it does not clearly render `decision_scope.segment_dimensions` as the active segmentation contract.

## Acceptance Behavior

In the opened Decisions workspace, the May 14 acceptance prompt should visibly show:

Objective: `revenue`

Strategic levers: `marketing_spend`, `discount_pct`

Segment dimensions: `region`, `channel`

Guardrails: `gross_margin_pct above 30%`, `return_rate_pct below 4%`

There must be no `channel mix` lever unless the prompt explicitly asks to change or shift channel mix.

Segment rendering should use the existing `SemanticRef` component where possible so confidence, role metadata, warnings, and readable fallback labels remain consistent with Phase 2 frontend work.

Guardrail rendering should not make a null or unparsed threshold look valid. If `condition.value_status` is `unparsed`, render it as needing review rather than silently showing an empty value.

Preserve the observational-analysis-only boundary. Do not introduce simulation, optimization, autonomous decisioning, or final recommendation language.

Do not change backend files.

## Verification Gemini Should Run

Run the frontend build:

`npm --prefix frontend\frontend run build`

Then run a browser check against the real app flow:

Upload or use a dataset with fields `revenue`, `marketing_spend`, `discount_pct`, `region`, `channel`, `gross_margin_pct`, and `return_rate_pct`.

Ask AI Chat:

How should we grow revenue next quarter using marketing_spend and discount_pct as controllable levers, segmented by region and channel, while keeping gross_margin_pct above 30% and return_rate_pct below 4%?

Open the Decisions workspace from the draft.

Verify the visible workspace shows the objective, both levers, both segments, both guardrails with thresholds, and no false `channel mix` lever.

Update `project_docs/active/status/decision_intelligence_execution_status.md` with what changed and what passed.

## Gemini Prompt

Implement the Phase 2.5 frontend segment-dimensions handoff. Read `GEMINI.md`, `project_docs/active/ai_hand_off/README.md`, this handoff file, `project_docs/active/status/decision_intelligence_execution_status.md`, and `project_docs/active/contracts/decision_objects.md`. Do not edit backend files. Update the Decisions workspace frontend so `decision_scope.segment_dimensions` renders as first-class active decision-frame information alongside objective, levers, and guardrails. Use existing `SemanticRef` patterns where possible. Preserve existing workflows and observational-analysis-only language. Make sure the May 14 prompt visibly shows objective `revenue`, levers `marketing_spend` and `discount_pct`, segments `region` and `channel`, guardrails `gross_margin_pct above 30%` and `return_rate_pct below 4%`, and no false `channel mix` lever. Run the frontend build, perform browser verification from AI Chat to the opened Decisions workspace, and update the active status doc truthfully with results.
