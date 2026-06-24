# Phase 2 — Decision Review Fullscreen Viewer

> COMPLETED REFERENCE ONLY: This plan records the completed saved-asset review slice. It is not an active implementation plan. Current truth is `project_docs/active/status/decision_intelligence_execution_status.md`.

Status: COMPLETE — USER ACCEPTED.

## Decision

The standalone Decisions window should become a secondary **Decision Review Library**.

Its first safe implementation role should be **an app-scoped full-viewport review overlay for an existing saved DecisionAsset**. It is not browser fullscreen, a new tab, a new route, or a window pop-out. The existing AI Chat Decision Review renderer remains the smallest viable surface; the removed legacy Decisions panel must not be revived. Historical comparison and advanced gated review remain future capabilities layered on top of saved assets, not part of the first implementation slice.

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

Saved DecisionAsset persistence is implemented and contract-ready. `decisionApi.js` provides `saveDecisionAsset`, `getDecisionAssets`, and `getDecisionAssetById`; `DecisionAssetLibrary.jsx` retrieves a complete asset before `AIShell.jsx` reopens it in the existing results pane. The asset contract preserves immutable `asset_id`, `schema_version`, `title`, `created_at`, `decision_output`, optional `graph_state`, and `snapshot_notice`. The graph endpoint itself still does not persist state server-side; only its contract-safe carry-forward state may be present inside a saved asset.

## Role Boundaries

The current AI Chat output is the source of truth for active decision work. The Decisions window should not create a parallel required flow, should not be the default continuation after a chat decision, and should not be the only place where analysis, correction, graph launch, or export can happen.

The review surface should act as continuity for a saved DecisionAsset. In the first frontend slice, the existing saved-asset selection flow in AI Chat opens the complete immutable asset in the current results pane, and an explicit `Open full review` control opens an app-scoped overlay around that same renderer. The overlay has a fixed closeable header and a scrollable review body. If there is no selected saved asset, the surface must direct the user to select or create one in AI Chat, not run the legacy pipeline as the primary path.

The saved library contract is already available. This slice only reviews an existing immutable asset; it must not add persistence, change saved assets, refresh them against live data, or present the snapshot as current dataset state.

Historical comparison depends on saved assets. It should compare previous `decision_output` artifacts only after the app has stable asset IDs, timestamps, source refs, dataset trust snapshots, and export sections.

Advanced review should remain gated. Monte Carlo, causal CDD, optimization, autonomous decisions, prediction certainty, and final recommendations should not appear as enabled Decisions-window features until backend contracts and tests support them.

## Implementation Guidance For Gemini After Approval

Backend readiness level for the next frontend slice is `backend_contract_ready` for immutable DecisionAsset retrieval and review. The slice must reuse `GET /api/decision/assets/<asset_id>` through the existing helper and must not add or change any backend route.

Focused backend verification passed with the repo-local dependency path:

`$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_chat_service`

Result: 29 tests passed.

Use the immutable asset fields documented in `project_docs/active/contracts/decision_objects.md`: `asset_id`, `schema_version`, `title`, `created_at`, `decision_output`, optional `graph_state`, and `snapshot_notice`. Preserve `decision_output.dataset_trust`, `source_refs`, `export_sections`, and `truth_boundary: observational_analysis_only` without synthesizing or refreshing them.

Adjust navigation copy and actions so the Decisions destination is no longer a mandatory continuation path. The Decisions ribbon should not lead with legacy `Analyze`. Prefer review-oriented actions such as opening the current decision asset, opening AI Chat to create or refine a decision, and opening Decision Graph when context exists.

Preserve existing renderer code unless a replacement is already wired and verified. In particular, do not delete `DecisionPanel.jsx`, `DecisionWorkspaceView.jsx`, `DecisionSignals.jsx`, `ScenarioPreview.jsx`, or `decisionPdfExport.js` as part of the first slice. If a component becomes legacy-only, label and isolate it rather than removing it.

Demote or rewrite overpromising language in the old surface. Avoid prominent wording such as final recommendation, strategic recommendation, optimizer, forecast, potential outcome, simulation, or decision rule unless the text clearly says the capability is unsupported or observational-only.

The first implementation is frontend-only. The smallest surface is a MUI full-screen dialog rendered inside the existing `AIShell.jsx` page context after `DecisionAssetLibrary.jsx` has already retrieved the complete asset. It must not call the browser Fullscreen API or use the existing AI Chat `WindowFrame` pop-out. Do not change the library, `decisionApi.js`, `CanvasContainer.jsx`, or the legacy Decisions navigation for this slice.

## Acceptance Checks

A user can complete the core decision flow in AI Chat without being required to open the Decisions destination.

The Decisions destination no longer presents the legacy Analyze pipeline as the primary next step.

Selecting a saved DecisionAsset in AI Chat and choosing `Open full review` opens the fixed-header, scrollable-body overlay around the unchanged immutable renderer. Without a selected saved asset, no full-review control is shown.

Existing useful renderers remain available or are wrapped behind a compatibility path.

No UI copy implies unsupported simulation, optimization, causal proof, prediction certainty, autonomous decisions, or final recommendations.

Frontend verification should include `npm --prefix frontend\frontend run build`, `git diff --check`, one AI Chat normal answer or chart path, one AI Chat decision-output path, and one Decisions destination path showing it is secondary review rather than required continuation.
