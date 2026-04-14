# Decision Intelligence 2.0 Gemini Handoff 03

## 1. Goal

Finish the remaining frontend work needed to make the first scoped Decision Intelligence 2.0 workspace honestly V1-complete now that Codex has landed the active backend corrections.

The user-facing outcome is:

- the scoped decision workspace remains the primary DI 2.0 experience
- the UI reflects the corrected backend contract faithfully
- the UI captures the remaining high-value V1 structure needed for honest resolution
- the UI renders the remaining scoped-context fields instead of hiding them
- the DI 2.0 flow no longer bleeds back into the legacy broad-scan bundle model

This is still V1 completion work.

It is **not** V2 simulation or trade-off implementation.

## 2. What Is Already Decided

Treat all of the following as fixed:

- Codex owns backend logic, contracts, architecture, and markdown maintenance
- Gemini owns frontend implementation only
- the active contract remains:
  - `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`
- the primary endpoint remains:
  - `POST /api/decision/workspaces`
- the DI 2.0 product frame is scoped decision workspaces first, not broad dataset scanning
- V2 simulation and trade-off work is blocked until V1 is actually complete
- the current shell, theme, and broader product identity must be preserved
- unresolved objective, lever, and constraint structure must be shown honestly rather than disguised by polished UI

## 3. What Codex Has Already Finished

Treat this handoff as active now.

Codex has already completed:

- backend `status` behavior so `ready`, `needs_input`, and `limited` are real states
- readiness semantics so unresolved objective and hard-constraint gaps are reflected honestly
- replacement of placeholder scoped-context fallbacks with decision-scoped metric and dimension selection
- contract-faithful `time_context` and `period_context`
- stronger unknown and blocker generation so the workspace is candid about gaps
- additive legacy-path preservation without letting the legacy decision bundle define the DI 2.0 workspace model

Gemini should assume those backend corrections are now the fixed dependency boundary for this handoff.

## 4. What Gemini Is Allowed To Change

Gemini may change:

- `frontend/frontend/src/features/business/decision/DecisionWorkspaceComposer.jsx`
- `frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/App.jsx`
- supporting Decision Intelligence frontend components, styling, and API wiring needed for V1 completion

Gemini may improve:

- request-shape collection for the remaining V1 fields that matter for honest workspace resolution
- scoped-context rendering
- reset and create-new-workspace behavior
- UI clarity around `ready`, `needs_input`, and `limited`
- the visual distinction between the scoped workspace and the legacy decision bundle path

## 5. What Gemini Must Not Change

Do not change any of the following:

- do not implement backend logic in the frontend
- do not invent simulation outputs
- do not invent trade-off outputs
- do not redefine the V1 payload semantics
- do not mark V1 complete if backend contract behavior is still visibly wrong
- do not keep the legacy broad-scan bundle as the primary DI 2.0 interaction model
- do not redesign the application into a different product
- do not remove useful non-decision features just to simplify the task

## 6. Backend Contract

Gemini must follow this contract exactly:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

### Endpoint

- `POST /api/decision/workspaces`

### Frontend Completion Focus

Gemini should make the frontend faithfully support and render the remaining V1 shape, especially:

- `objective.target.unit`
- `objective.time_horizon.grain`
- `objective.time_horizon.start`
- `objective.time_horizon.end`
- `binding.dimension_id` and `binding.dimension_name` where relevant
- `lever.current_value`
- `lever.bounds.allowed_values`
- `lever.bounds.unit`
- `constraint.condition.secondary_value`
- `constraint.condition.values`
- `constraint.condition.unit`
- `constraint.rationale`
- `filters`
- `scope_preferences`
- `scoped_context.comparison_dimensions`
- `scoped_context.applied_filters`
- `scoped_context.time_context`
- `scoped_context.period_context`

This does **not** mean every optional field needs heavy UI.

It does mean the important V1 contract fields must no longer be silently absent from the primary DI 2.0 experience.

### Backend Interpretation Rules Gemini Should Assume Are Now Real

- `decision_workspace.status: "needs_input"` now means the user has not yet provided enough scope structure, especially a controllable lever set
- `decision_workspace.status: "limited"` now means the workspace exists but unresolved objective, lever, or hard-constraint gaps still materially limit it
- `decision_workspace.status: "ready"` now means the scoped workspace is structurally valid with no remaining V1 missing inputs
- `decision_workspace.readiness.can_run_simulation` is now a structural truth flag, not a promise that V2 simulation UI or endpoints already exist
- `scoped_context.relevant_metrics` no longer backfills from generic dataset-overview metrics when the decision scope itself does not justify them
- `scoped_context.time_context` now follows a metric-first fallback chain, then a scoped temporal slice fallback, then objective-horizon fallback when needed

## 7. UX Direction

The experience should feel like the product is helping the user structure a serious decision and inspect the real scope of that decision.

The right feel remains:

- analytical
- candid
- intentional
- product-grade
- calm under uncertainty

The correction should avoid two failure modes:

- a shallow polished form that still hides contract gaps
- a cluttered control panel that feels like schema administration rather than decision support

### Important UX Constraint

The workspace must feel clearly different from the old broad-scan bundle path.

If the scoped workspace exists, the UI should not visually collapse back into the old decision-bundle mental model underneath it.

## 8. Verification Standard

Gemini should not call this work complete unless all of the following are true:

- the primary entry flow is still based on `POST /api/decision/workspaces`
- the frontend respects the corrected backend `ready`, `needs_input`, and `limited` behavior
- the frontend treats `can_run_simulation` as structural metadata and still does not imply that V2 simulation outputs already exist
- the remaining important V1 payload fields are either collected or intentionally represented in a way that does not hide them
- the workspace view renders the remaining scoped-context fields that were previously omitted
- the reset and create-new-workspace path is trustworthy
- the DI 2.0 primary flow no longer bleeds into the legacy bundle experience
- the UI still does not imply that V2 simulation or trade-off outputs already exist
- the broader shell, theme, and destination behavior remain intact

## Final Reminder

Take your time.

Quality matters more than speed here.

This pass should make the frontend feel aligned with the real product contract, not just visually improved.
