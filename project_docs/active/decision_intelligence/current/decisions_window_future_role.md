# Phase 2 — Decision Review Fullscreen Viewer

Status: active Phase 2 architecture and planning reference. Phase 1 persistent decision assets is complete. No Phase 2 implementation has been made in this note.

## Decision

The standalone Decisions window should become a secondary **Decision Review Library**.

Its first safe implementation role should be **fullscreen review of the current AI Chat decision output**, while preserving the existing Decisions-window renderers as compatibility assets. Its target product role should be a saved decision library after a real decision-asset persistence contract exists. Historical comparison and advanced gated review should remain future capabilities layered on top of saved assets, not the first implementation slice.

AI Chat remains the primary work surface. A user should be able to frame, correct, analyze, inspect, graph, and export the current decision output from AI Chat without being forced into the Decisions destination.

## Source Evidence

AI Chat already owns the complete current decision flow:

`frontend/frontend/src/features/ai/AIShell.jsx` sends normal turns through `/api/decision/chat/turns`, keeps scoped `session_state`, and auto-focuses rich artifacts including `decision_output`. It also sends correction and action requests through `/api/decision/chat/actions`.

`AIShell.jsx` renders `decision_output` directly with Executive Brief, Dataset Trust, Decision Frame, readiness and allowed actions, correction state, Evidence Board, Decision Map, Scenario Compare, Advanced Gates, Decision Graph launch, and export affordances.

The active backend/frontend contract for that output is `project_docs/active/contracts/decision_objects.md`, section `AI Chat Decision Output`.

The old Decisions destination still contains useful frontend renderers and window continuity:

`frontend/frontend/src/components/layout/CanvasContainer.jsx` mounts `DecisionPanel` inside the reusable window frame and preserves window minimize/restore behavior.

`frontend/frontend/src/features/business/decision/DecisionPanel.jsx` keeps setup guidance, intake flow, workspace view rendering, legacy diagnostic signal rendering, and legacy bundle support.

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx` keeps a rich workspace review surface, observational boundary banner, structured scope sections, ranked observational evidence rendering, and workspace PDF export.

The old Decisions destination also still contains behavior that conflicts with the new product direction:

`frontend/frontend/src/components/layout/MenuBar.jsx` exposes a Decisions ribbon action named `Analyze` that runs the older decision path.

`frontend/frontend/src/components/layout/DestinationHome.jsx` still nudges prepared data toward Decisions with `Analyze`, `run_intelligence`, and copy about recommendations and potential outcomes.

`frontend/frontend/src/features/business/decision/decisionApi.js` still labels `/api/decision/run` as the legacy pipeline and separately calls `/api/decision/workspaces` and `/api/decision/workspaces/analyze`.

There is no backend decision-asset persistence service yet. The current graph build state explicitly says persistence is `client_session_or_saved_decision_asset` and that the graph endpoint does not persist server-side state. Because of that, a real saved decision library should not be presented as durable until a storage contract and route exist.

## Role Boundaries

The current AI Chat output is the source of truth for active decision work. The Decisions window should not create a parallel required flow, should not be the default continuation after a chat decision, and should not be the only place where analysis, correction, graph launch, or export can happen.

The Decisions window should act as a review and continuity surface. In the first frontend slice, it should open the current AI Chat `decision_output` in a larger review window when one exists. If no active decision output exists, it should direct the user to start in AI Chat, not run the legacy pipeline as the primary path.

The saved library role is the correct strategic direction, but it needs backend support before the UI claims durable saved decisions. Until then, any retained client-side history must be labeled as current-session only.

Historical comparison depends on saved assets. It should compare previous `decision_output` artifacts only after the app has stable asset IDs, timestamps, source refs, dataset trust snapshots, and export sections.

Advanced review should remain gated. Monte Carlo, causal CDD, optimization, autonomous decisions, prediction certainty, and final recommendations should not appear as enabled Decisions-window features until backend contracts and tests support them.

## Implementation Guidance For Gemini After Approval

Backend readiness level for the next frontend slice is `backend_contract_ready` for active AI Chat `decision_output` review, and `backend_not_ready` for durable saved decision library persistence.

Focused backend verification passed with the repo-local dependency path:

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_chat_service`

Result: 29 tests passed.

Use the active decision artifact fields documented in `project_docs/active/contracts/decision_objects.md`: `title`, `summary`, `dataset_trust`, `frame`, `readiness`, `correction_state`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, `source_refs`, and `truth_boundary`.

Adjust navigation copy and actions so the Decisions destination is no longer a mandatory continuation path. The Decisions ribbon should not lead with legacy `Analyze`. Prefer review-oriented actions such as opening the current decision asset, opening AI Chat to create or refine a decision, and opening Decision Graph when context exists.

Preserve existing renderer code unless a replacement is already wired and verified. In particular, do not delete `DecisionPanel.jsx`, `DecisionWorkspaceView.jsx`, `DecisionSignals.jsx`, `ScenarioPreview.jsx`, or `decisionPdfExport.js` as part of the first slice. If a component becomes legacy-only, label and isolate it rather than removing it.

Demote or rewrite overpromising language in the old surface. Avoid prominent wording such as final recommendation, strategic recommendation, optimizer, forecast, potential outcome, simulation, or decision rule unless the text clearly says the capability is unsupported or observational-only.

The first implementation can be frontend-only if it only changes navigation, copy, and review routing around the existing AI Chat artifact. Do not invent a persistence API. If a temporary current-session asset list is added, it must be explicitly session-scoped and should not be called a saved library.

## Acceptance Checks

A user can complete the core decision flow in AI Chat without being required to open the Decisions destination.

The Decisions destination no longer presents the legacy Analyze pipeline as the primary next step.

Opening Decisions with an active AI Chat `decision_output` gives a larger review path or clearly points back to AI Chat if no active output exists.

Existing useful renderers remain available or are wrapped behind a compatibility path.

No UI copy implies unsupported simulation, optimization, causal proof, prediction certainty, autonomous decisions, or final recommendations.

Frontend verification should include `npm --prefix frontend\frontend run build`, `git diff --check`, one AI Chat normal answer or chart path, one AI Chat decision-output path, and one Decisions destination path showing it is secondary review rather than required continuation.
