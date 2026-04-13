# Decision Intelligence 2.0 Gemini Handoff 01

## Status

This file is now the historical first-slice handoff for the scoped workspace build.

The active follow-up Gemini handoff after Codex backend corrections is:

- `decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md`

## 1. Goal

Build the first frontend experience for Decision Intelligence 2.0 around scoped decision workspace creation.

The user-facing outcome is:

- the user defines a decision
- the user defines the objective
- the user defines candidate levers
- the user defines constraints
- the UI sends that structure to the new scoped workspace contract
- the UI renders a scoped decision workspace instead of the old broad-scan-first decision summary

This is the new primary Decision Intelligence entry workflow.

## 2. What Is Already Decided

Treat all of the following as fixed:

- Decision Intelligence 2.0 is centered on the decision, not the dataset
- the app must stop using broad full-dataset scanning as the default decision workflow
- the first DI 2.0 contract is:
  - `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`
- the first DI 2.0 backend endpoint is:
  - `POST /api/decision/workspaces`
- this first frontend slice is about scoped decision workspace creation and display
- this slice is not the final simulation engine
- this slice is not the final trade-off engine
- assumptions and unknowns must be visible as first-class product elements
- current `/api/decision/run` and the existing decision bundle are now legacy migration inputs, not the target product frame
- preserve the current destination-based shell
- preserve the existing theme, visual tone, and broader product identity

## 3. What Gemini Is Allowed To Change

Gemini owns the frontend implementation for this slice.

Gemini may change:

- the Decision Intelligence entry workflow UI
- the setup form or staged composer used to collect:
  - decision prompt
  - objective
  - levers
  - constraints
- the main Decision Intelligence panel content model
- the presentation of the scoped decision workspace after creation
- the frontend API wiring needed to call `POST /api/decision/workspaces`
- loading, empty, partial, and warning states for this new flow

Gemini may reuse or adapt these existing frontend areas as needed:

- `frontend/frontend/src/features/business/decision/`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/App.jsx`

## 4. What Gemini Must Not Change

Do not change any of the following:

- do not invent or redefine payload semantics beyond the backend contract
- do not keep the old broad-scan bundle as the primary DI 2.0 interaction model
- do not fake simulation results
- do not fake trade-off paths
- do not fake uncertainty handling
- do not silently reinterpret unresolved levers or constraints as resolved
- do not change destination ownership or global shell architecture
- do not redesign the application into a different visual product
- do not remove useful existing capability just to simplify the implementation

## 5. Backend Contract

Gemini must follow this contract exactly:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

### Endpoint

- `POST /api/decision/workspaces`

### Request Rules

The UI must submit:

- `decision_prompt`
- `objective`
- `levers`
- `constraints`

The UI may also submit:

- `dataset`
- `dataset_ref`
- `semantic_model`
- `filters`
- `scope_preferences`

### Critical Interpretation Rules

- `objective` is required
- `levers` may be empty during draft setup, but the workspace should then be expected to return `needs_input`
- `constraints` may be empty, but the UI must not create fake constraints to fill the gap
- `filters` scope the workspace dataset slice, but they do not replace objective / lever / constraint structure
- frontend must treat `contract_version: "di_2_0_v1"` as required for this flow

### Response Rules

Frontend should treat `decision_workspace` as the primary object.

The UI must use:

- `decision_workspace.status`
- `decision_workspace.decision_scope`
- `decision_workspace.scope_summary`
- `decision_workspace.scoped_context`
- `decision_workspace.assumptions`
- `decision_workspace.unknowns`
- `decision_workspace.readiness`

### Status Rules

If `decision_workspace.status` is:

- `ready`
  - render the scoped workspace as usable
- `needs_input`
  - keep the user in completion mode and emphasize missing structure
- `limited`
  - render the workspace, but make the gaps clear

### Readiness Rules

Frontend must not treat the workspace as simulation-ready just because the workspace exists.

Use `decision_workspace.readiness.can_run_simulation`.

If it is `false`, the UI must not imply that simulation already exists.

### Scope Rules

Frontend must treat:

- `scoped_context.relevant_metrics`
- `scoped_context.relevant_dimensions`

as the scoped workspace context only.

They are not a generic “top metrics in the dataset” view.

## 6. UX Direction

The experience should feel like the product is helping the user structure a real decision before analysis begins.

The workflow should feel:

- intentional
- product-grade
- clear
- constrained in a good way
- honest about missing information

The interaction model should not feel like:

- a generic form dump
- a dataset scanner with a new label
- a fake AI planner inventing hidden logic

### Desired UX Shape

The strongest direction is a two-part flow:

- a decision setup area
- a scoped workspace result area

The setup area should make it easy to understand:

- what decision is being made
- how success is defined
- what the user can actually change
- what limits cannot be violated

The scoped workspace area should make it easy to understand:

- what this decision is scoped to
- which metrics and dimensions are in play
- what is assumed
- what is still unknown
- whether the workspace is structurally ready for deeper modeling

### Tone Requirements

Preserve the current product tone.

Do not make this feel sterile or enterprise-generic.

Do not make it feel playful in a way that weakens trust.

The right feel is:

- confident
- composed
- analytical
- candid about uncertainty

### Important UX Constraint

Unknowns and assumptions should not be buried in tiny footnotes.

They should read like a first-class part of the workspace.

They are central to DI 2.0 behavior.

## 7. Verification Standard

Gemini should not call this work complete unless all of the following are true:

- the primary entry flow is based on `POST /api/decision/workspaces`
- the UI collects the full decision structure:
  - decision prompt
  - objective
  - levers
  - constraints
- the request payload matches `decision_intelligence_2_0_contract_v1.md`
- the UI renders `decision_workspace` as the primary response object
- `ready`, `needs_input`, and `limited` states are visibly distinct
- assumptions are visibly rendered
- unknowns are visibly rendered
- readiness is visibly rendered
- the UI does not imply that simulation or trade-off outputs already exist in this slice
- the broader shell, theme, and destination behavior remain intact

## Final Reminder

Be strict about behavior.

Be creative about presentation inside those rules.

The product should feel like it has shifted from:

- “scan the data and tell me something”

to:

- “help me structure this decision and prepare the right workspace for it”

## Current Correction Pass

The current implementation exists, but V1 is not done yet.

Gemini should treat this handoff as the active correction pass for the already-started V1 flow.

What must be corrected before V1 can be called complete:

- the composer must collect more of the contract structure so the backend can resolve the decision honestly
- the workspace view must render the missing V1 contract fields:
  - target
  - time horizon
  - comparison dimensions
  - applied filters
  - scoped notes
  - time context
  - period context
- the UI must make `ready`, `needs_input`, and `limited` feel meaningfully different
- the UI must provide a clear reset / create-new-workspace path
- the scoped workspace must remain the primary experience rather than falling back into the legacy broad-scan mental model

Do not move on to simulation UI or trade-off-path UI until this V1 correction pass is complete.
