> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Decision Intelligence V3 Gemini Handoff 01

## Status: COMPLETE

This frontend cleanup is finished. 

The Analyze Workspace flow is fully wired end-to-end, and the analysis payload renders a contract-correct view for scoped diagnostics.

- [x] Fixed prop wiring in `App.jsx` -> `CanvasContainer` -> `DecisionPanel` -> `DecisionWorkspaceView`.
- [x] Aligned `ScopedDiagnosticCard` with the backend contract.
- [x] Implemented status-aware rendering (`observed_change`, `insufficient_history`, `metric_unavailable`).
- [x] Used `metric_ref.label` as the primary header for diagnostics.
- [x] Rendered real evidence stats (deltas, current, previous) for observed changes.
- [x] Preserved the workspace as the main frame and legacy evidence as secondary.

Read first:

- `ai_handoff/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `ai_handoff/ui_overhaul/ui_overhaul_execution_status.md`
- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`
- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

## 1. Goal

Wire the Decision Intelligence workspace UI to the new backend continuation endpoint so the product can move from:

- scoped workspace creation

to:

- scoped workspace analysis

without collapsing back into the legacy broad-scan bundle model.

The intended user-facing outcome is:

- the workspace remains the primary frame
- the user can request follow-on analysis from that workspace
- the returned analysis is clearly presented as scoped observational diagnostics
- any legacy signals remain visually secondary and explicitly additive
- the UI does not imply simulation, trade-off execution, or optimization completion

## 1A. What Still Needs To Be Fixed

Gemini should finish these items before marking this handoff complete:

- render `workspace_analysis.scoped_diagnostics` correctly as a list of diagnostic objects
- show each scoped diagnostic clearly:
  - summary
  - metric label
  - status
  - any evidence values that are useful
- do not render the whole diagnostics payload as one string or blob
- keep legacy signals secondary
- keep wording simple and honest

## 2. What Codex Already Finished

Codex has already completed the backend support for this slice.

Treat these as fixed:

- `POST /api/decision/workspaces`
- `POST /api/decision/workspaces/analyze`
- workspace-native analysis response rooted in the scoped workspace
- scoped diagnostics built from workspace-relevant metrics and filters
- filtered legacy diagnostics attached only as secondary evidence
- truthful backend language that does not claim simulation or trade-off completion

## 3. Files Gemini May Change

Gemini may change:

- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`
- `frontend/frontend/src/features/business/decision/decisionApi.js`
- supporting Decision Intelligence frontend components and styles needed for this frontend continuation

## 4. Contract Shape Gemini Should Expect

Primary continuation endpoint:

- `POST /api/decision/workspaces/analyze`

The response includes:

- `decision_workspace`
- `workspace_analysis`

`workspace_analysis` currently contains:

- `analysis_id`
- `analysis_mode: "scoped_observational"`
- `status`
- `summary`
- `truthfulness_note`
- `scoped_diagnostics`
- `legacy_diagnostics`
- `notes`
- `generated_at`

Important interpretation:

- `scoped_diagnostics` are the real primary analysis payload
- `legacy_diagnostics.signals` are optional secondary evidence only
- this is not a simulation response
- this is not a trade-off response

## 5. UX Direction

The frontend should make the product feel like:

- define the decision
- inspect the scoped workspace
- continue into scoped analysis

It should not feel like:

- define the workspace
- then drop back into the old generic decision bundle as the main experience

Recommended presentation direction:

- keep the workspace at the top as the durable object
- add a clear “analyze this workspace” action
- render `workspace_analysis.summary` and `truthfulness_note`
- render `scoped_diagnostics` as the main evidence area
- if rendering `legacy_diagnostics.signals`, put them in a secondary section with explicit additive wording

## 6. What Gemini Must Not Do

Do not:

- invent simulation outputs
- invent trade-off paths
- relabel observational diagnostics as optimization or simulation
- make legacy diagnostics look like the primary DI V3 experience
- remove the scoped workspace framing once analysis is returned

## 7. Verification Standard

Do not call this slice complete unless all of the following are true:

- the workspace remains visible as the primary object
- the new frontend call uses `POST /api/decision/workspaces/analyze`
- `workspace_analysis.scoped_diagnostics` are rendered correctly in the primary analysis area as structured diagnostic items
- `workspace_analysis.legacy_diagnostics` are clearly secondary if shown
- the UI text stays truthful and does not imply simulation or trade-off execution
- the broader Decisions destination still behaves normally

## 8. Plain-English Product Truth

The backend can now analyze a defined decision workspace honestly.

The frontend’s next job is to expose that step cleanly without pretending the deeper simulation system already exists.
