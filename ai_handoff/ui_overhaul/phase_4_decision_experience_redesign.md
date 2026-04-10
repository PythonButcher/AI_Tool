# Phase 4: Decision Experience Redesign

## Audience

This file is written for Gemini as the frontend execution handoff for Phase 4 of the UI overhaul.

Codex should continue owning:

- backend logic and contracts
- architecture review
- markdown handoff maintenance inside `ai_handoff/`

Gemini should treat this phase as frontend work only unless Codex explicitly reopens backend changes.

## Execution Standard For Gemini

Quality is preferred over speed for this phase.

Explicitly:

- do not rush
- do not optimize for clearing the task quickly
- read the affected files carefully before editing
- verify behavior more than once before considering the work complete
- preserve capability unless Codex or the user explicitly approves removal

Gemini must not remove, weaken, or silently replace working product features in order to make this phase easier.

If a surface is crowded or confusing, improve hierarchy and guidance without cutting core workflows unless there is explicit approval.

## Status

Phase 4 is now active.

The repo already contains the first implementation pieces needed for this phase:

- the `Decisions` destination exists in the new shell
- `POST /api/decision/run` is live
- additive `readiness` metadata is live
- a basic `DecisionPanel` already renders `brief`, `signals`, `recommendations`, and `scenario_preview`
- chart handoff from recommendation actions is already wired

That means Gemini should not start from zero.

This phase is now about turning that partially integrated implementation into a coherent product experience.

## Why Phase 4 Is Needed Even Though Decision UI Already Exists

The current implementation proves that Decision Intelligence works.

It does **not** yet satisfy the overhaul goal from `phase_0_ui_overhaul_master_plan.md`:

- Decision Intelligence is still something the user has to remember to go find.
- The readiness model exists, but it is not yet shaping the broader workflow clearly enough.
- The decision surface is technically connected, but not yet understandable enough for normal product use.
- Setup guidance is still too passive.
- Supporting evidence is still rendered too much like developer output instead of product-grade decision guidance.

The purpose of Phase 4 is not to invent a new backend or a new decision system.

The purpose is to make the existing system understandable, actionable, and naturally reachable inside the destination-based product shell.

## New Requirement: Time Intelligence Must Be Supported

Decision Intelligence should be treated as time-aware business tooling, not just generic metric analysis.

That means Gemini should design this phase with the expectation that users will often need comparisons such as:

- fiscal year versus prior fiscal year
- fiscal quarter versus prior fiscal quarter
- current period versus same period last fiscal year
- calendar versus fiscal comparison context when both matter

This is now an active product requirement for the decision experience.

Important boundary:

- Gemini should not invent backend time-intelligence logic that does not exist
- Gemini should not fake fiscal comparisons in the frontend
- Gemini should not hide or avoid the issue by simplifying the decision UX

Instead, Gemini should make the frontend decision experience ready for time intelligence by:

- using labels and layout that can accommodate comparison context cleanly
- avoiding hard-coded wording that assumes only generic "latest period" comparisons
- leaving space in the UX for fiscal/calendar comparison explanation when the backend provides it
- surfacing uncertainty honestly when the current backend cannot yet express the comparison the user would expect

If Gemini finds that a desired fiscal comparison requires backend support, it should document the gap clearly and hand it back to Codex rather than weakening the product.

## Current Implemented Baseline In Code

Gemini should begin from the code reality below instead of re-auditing the entire app:

### Shell and state

- `frontend/frontend/src/App.jsx`
  - owns `decisionBundle`, `decisionReadiness`, `decisionWarnings`, and `handleRunDecision`
- `frontend/frontend/src/components/layout/SideBar.jsx`
  - exposes the `Decisions` drawer and current "Run Intelligence" action
- `frontend/frontend/src/components/layout/DestinationHome.jsx`
  - exposes the current `Decisions` destination landing state
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
  - renders `DecisionPanel` as a destination-owned window

### Decision UI

- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/features/business/decision/DecisionBrief.jsx`
- `frontend/frontend/src/features/business/decision/DecisionSignals.jsx`
- `frontend/frontend/src/features/business/decision/DecisionRecommendations.jsx`
- `frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.css`

### Backend support already available

- `backend/services/decision_pipeline_service.py`
- `ai_handoff/phase_docs/phase_4_backend_usability_support.md`
- `ai_handoff/backend_to_frontend/phase_4_handoff.md`

Current additive time fields now available from the backend:

- `decision_bundle.brief.period_context`
- `decision_bundle.brief.key_metrics[].period_label`
- `decision_bundle.brief.key_metrics[].comparison_label`
- `decision_bundle.scenario_preview.period_context`
- `decision_bundle.scenario_preview.projections[].baseline_label`
- `decision_bundle.scenario_preview.projections[].projected_label`

Do not redesign this phase as if readiness, bundle orchestration, or recommendation-driven chart launch still need to be invented.

## Current UX Gaps Visible In The Repo

These are the main product gaps Phase 4 should solve.

## 1. Decision readiness exists, but it is not yet the dominant user story

The backend already returns:

- `readiness.dataset_loaded`
- `readiness.semantic_ready`
- `readiness.decision_ready`
- `readiness.missing_requirements`

The current UI uses those fields, but mostly only after the user enters the decision flow directly.

What is still missing:

- clearer pre-run orientation
- stronger next-step guidance
- better visibility of readiness before the user feels blocked
- more explicit connection between missing requirements and the exact place to fix them
- better communication of what comparison logic the engine is actually using today

## 2. The current setup guidance is too passive

The present setup states are better than blocking alerts, but they still behave more like placeholder messages than guided product states.

The user should not just read:

- load a dataset
- prepare semantic model
- define metrics

The user should understand:

- why this requirement matters
- what Decision Intelligence will use once the requirement is satisfied
- where to go next in the current destination model

## 3. Decision output is still too implementation-shaped

The current `DecisionPanel` is technically correct but still too close to raw payload rendering:

- evidence still reads too much like backend JSON
- the relationship between brief, signals, recommendations, and scenario preview is not visually taught strongly enough
- the surface still feels like a report panel more than an embedded decision workflow

Gemini should preserve the data, but the presentation needs to become more human-readable and more obviously sequenced.

Nested evidence structures must be rendered cleanly.

Gemini should not stop at flattening top-level keys if nested evidence still reads like inline JSON.

## 4. Decision Intelligence still feels too isolated from normal work

The dedicated `Decisions` destination is correct and should remain.

But Phase 4 must also make Decision Intelligence feel reachable from relevant workflows instead of feeling like a separate concept silo.

This does **not** mean every surface should become a decision surface.

It means the product should make the relationship obvious between:

- prepared data
- semantic definitions
- monitoring/dashboard signals
- exploratory charts
- decision-oriented next steps

## 5. Terminology still needs tightening inside this flow

The shell direction already moved toward clearer destination names.

Phase 4 should continue that clarity inside the decision experience:

- use destination-aware language
- avoid old shell labels or stale UI vocabulary
- explain the work in task terms rather than system-internal jargon where possible

Do not reopen the top-level destination model.

## Phase 4 Outcome To Aim For

After this phase, the product should make the following user story feel natural:

1. I can tell whether Decision Intelligence is ready to use.
2. If it is not ready, I immediately understand what is missing and where to go.
3. If it is ready, I understand what a run will produce before I run it.
4. After a run, I can move from summary to evidence to action without decoding the backend structure.
5. If I take a recommendation, the resulting downstream analysis feels like part of the same workflow.

## Required Frontend Direction For Gemini

## 1. Build the decision experience around three major states

Gemini should treat the decision flow as three explicit user-facing states:

### A. Setup guidance state

Triggered when `missing_requirements` is non-empty.

This state should:

- explain what is missing
- explain why it matters
- point the user to the correct destination-aware next step
- stay calm and guided
- avoid error styling that feels like failure handling

### B. Ready-to-run orientation state

Triggered when readiness is satisfied but the user has not yet run a meaningful decision pass in the current context.

This state should:

- explain what Decision Intelligence will evaluate
- clarify the output shape in user terms
- make the primary action obvious
- reduce ambiguity about when to use this feature

### C. Results state

Triggered when a valid `decision_bundle` is available.

This state should:

- lead with the decision summary
- make evidence readable and scannable
- present recommendations as the main action layer
- treat scenario preview as supporting context, not the primary headline

## 2. Use readiness and warnings as the source of truth

Gemini should follow `ai_handoff/phase_docs/phase_4_backend_usability_support.md` exactly.

Important rules:

- do not show blocking alerts for readiness problems
- use `missing_requirements` as the primary setup signal
- keep the user in guided states when metrics are missing, even if `decision_ready` is technically `true`
- keep `decision_bundle` rendering compatible with guided empty or partial states

## 3. Make the Decisions destination self-explanatory before the first run

The `Decisions` destination home, drawer, and panel should together answer:

- what this feature does
- what it uses
- when it helps
- what the user should do next

The current Decisions drawer is too thin for this phase and should be upgraded into a more explanatory guidance surface without becoming crowded.

## 4. Improve readability of evidence and action handoffs

Gemini should make signal and recommendation content feel product-grade.

Direction:

- avoid raw JSON as the default evidence presentation
- translate evidence into structured readable sections
- make severity, impact, scope, and traceability easier to scan
- keep recommendation actions obviously connected to the evidence that produced them
- keep downstream chart launch quick and visible

## 5. Add light-touch decision reachability in adjacent workflows

Do not turn every destination into a full decision workspace.

Do add enough contextual reachability that the user does not have to remember Decision Intelligence in isolation.

Safe examples:

- a readiness-aware prompt or CTA from `Workspace`
- a gentle bridge from `Dashboards` when monitoring assets exist
- a contextual entry from analysis-oriented states when the user already has semantic setup in place

This should be lightweight.

The dedicated execution and reading surface still belongs to `Decisions`.

Critical implementation rule:

- a bridge CTA must not trigger a hidden decision run
- if the user starts from `Workspace`, `Dashboards`, or another adjacent surface, the interaction must still land them in a visible decision experience
- "Run now" and "Go to Decisions" must behave consistently with the destination model

## 6. Preserve the existing destination model and backend contracts

Do not reopen any of the following:

- top-level destination labels
- left-rail authority
- `decision_bundle`
- `/api/decision/run`
- chart action payload shape
- backend readiness contract

If frontend work appears to require backend contract changes, stop and hand that back to Codex.

Also do not remove or narrow any of the following without explicit approval:

- recommendation-driven chart launch
- scenario preview support
- existing semantic chart and KPI workflows
- existing drag-and-drop behavior that already works
- Decision Intelligence destination ownership

## Specific Mapping Rules Gemini Should Follow

## Missing dataset

When `missing_requirements` includes `dataset`:

- frame the state as "load data to begin"
- point the user toward `Workspace`
- make the next action concrete

Do not frame this as a system error.

## Missing semantic model

When `missing_requirements` includes `semantic_model`:

- explain that decision support needs semantic context
- orient the user toward the definitions / semantic workflow already present in the shell
- keep the language grounded in user benefit, not backend internals

## Missing metrics

When `missing_requirements` includes `metrics`:

- keep the user in setup guidance
- explain that at least one metric is required
- point the user toward metric definition and management surfaces
- preserve manual metric-management paths instead of forcing AI or hidden steps

## Fully ready

When `missing_requirements` is empty:

- make the primary "run" action visually obvious
- explain what output the user will receive
- keep the post-run workflow legible

## Files Gemini Should Treat As Phase 4 Anchors

- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/DestinationHome.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.css`
- `frontend/frontend/src/features/business/decision/DecisionBrief.jsx`
- `frontend/frontend/src/features/business/decision/DecisionSignals.jsx`
- `frontend/frontend/src/features/business/decision/DecisionRecommendations.jsx`
- `frontend/frontend/src/features/business/decision/ScenarioPreview.jsx`
- `frontend/frontend/src/components/layout/DataPane.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`

## Concrete Remaining Frontend Tasks

Gemini should treat the following as active fix targets for this phase:

### 1. Preserve the fixed cross-destination bridge and clean the remaining hook issue

The cross-destination bridge behavior is now directionally correct in code.

Gemini should preserve that behavior and clean the remaining frontend stability issue around the destination-home action callback:

- keep the user transition into a visible `Decisions` experience
- keep `Go to Decisions` separate from expensive hidden runs
- fix the current `CanvasContainer.jsx` callback dependency drift without changing behavior
- keep CTA wording aligned with actual behavior

### 2. Remove the duplicate window-state provider

The app still has duplicate `WindowProvider` mounting in the shell bootstrap path.

Gemini should fix this carefully without removing any existing window behavior:

- keep current window interactions working
- preserve decision-panel visibility and restore behavior
- remove the duplicate provider only after tracing which scope should remain authoritative

### 3. Finish evidence rendering for nested payloads

The current evidence surface has improved, but nested objects still need a more intentional rendering model.

Gemini should:

- render nested evidence structures in a readable hierarchy
- preserve traceability and technical accuracy
- avoid collapsing back to raw JSON unless there is no better fallback

### 4. Remove Phase 4 polish drift

Gemini should clean obvious polish issues in this slice, including:

- awkward or duplicated button copy
- stale labels
- helper text that points to the wrong product surface
- any copy that still sounds like a prototype instead of a product

### 5. Keep recommendation handoff visible and trustworthy

If a recommendation launches a downstream chart or related surface:

- the result must be visible
- the transition must feel intentional
- the user should not have to guess whether the action worked

### 6. Consume the finalized period-context fields without weakening the system

The backend now provides additive period/comparison display metadata for the existing sequential comparison flow.

Gemini should:

- prefer `brief.period_context` over frontend-invented context copy
- prefer `key_metrics[].period_label` and `key_metrics[].comparison_label` when present
- prefer `scenario_preview.projections[].baseline_label` and `projected_label` when present
- keep sensible fallback copy only for truly missing values

### 7. Avoid weakening the system to paper over the remaining fiscal gap

If fiscal/calendar comparison support is incomplete:

- do not hide decision features
- do not remove comparison-oriented language entirely
- do not oversimplify the UX into generic signal cards only
- do not treat `fiscal_calendar: null` as a frontend failure state

Instead, keep the product ready for richer time intelligence and report backend gaps to Codex.

## Emergency Regression Rule

Gemini must preserve the emergency no-data fix now in place.

Specifically:

- when the current app session has no explicit dataset rows, `Decisions` must remain in setup guidance
- the workspace and dashboard bridge surfaces must not claim Decision Intelligence is connected or ready without an explicit current dataset
- running Decision Intelligence with no explicit current dataset must not surface stale generic results from old backend state

If Gemini changes anything in readiness, bridge CTAs, or decision orchestration, it must re-verify this exact no-data behavior before calling the work complete.

## What Gemini Should Not Spend This Phase Doing

- do not redesign the entire shell again
- do not reopen destination navigation or ribbon decisions
- do not replace the decision backend with new frontend-only logic
- do not push raw-field-first configuration back into decision-oriented states
- do not turn this into a Phase 5 semantic definitions rewrite
- do not solve every dashboard, AI, or charting UX issue inside this phase

Phase 4 is specifically about decision clarity, decision readiness, and decision actionability.

## Acceptance Criteria

Phase 4 should be considered successful when:

- the `Decisions` destination immediately communicates readiness and next steps
- setup states feel guided rather than like empty placeholders
- stale or pre-overhaul terminology is removed from decision-facing UX
- users can understand what a decision run will do before running it
- decision evidence is readable without exposing raw backend structure as the default
- recommendations feel directly connected to downstream actions
- decision support feels reachable from normal product flow without requiring a new navigation model
- cross-destination CTAs never produce hidden or confusing runs
- the decision UX is compatible with future fiscal/calendar comparison context instead of being hard-coded around generic latest-period language
- no backend contract changes are required

## Final Direction For Gemini

Treat the current decision implementation as a working but early integration layer.

Do not discard it.

Refine it into a clearer destination experience that:

- teaches itself better
- guides setup better
- reads more like a product surface than a payload viewer
- connects more naturally to the rest of the destination-based application

This phase should make Decision Intelligence feel usable, not merely present.
