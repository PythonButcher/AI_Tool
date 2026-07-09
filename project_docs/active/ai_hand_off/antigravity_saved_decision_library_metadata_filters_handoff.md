# Antigravity Saved Decision Library Compact Rehaul Handoff

REHAUL REQUIRED

## Product Blocker

The saved snapshot library now consumes too much AI Chat real estate for a secondary historical-review feature. The current bottom panel shows a full filter row, a large card, repeated caveat text, and multiple badges directly in the chat workspace. This makes saved snapshots feel more important than the active AI Chat decision output, which conflicts with the product direction that AI Chat remains primary and saved DecisionAssets are secondary historical artifacts.

Goal: Rework Saved Decision Library into a compact AI Chat utility that stays out of the main conversation flow, supports archive and delete lifecycle actions, and still lets users reopen saved immutable snapshots when needed.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/decision_objects.md`, and this handoff.

Target frontend files are `frontend/frontend/src/features/business/decision/decisionApi.js`, `frontend/frontend/src/features/business/decision/DecisionAssetLibrary.jsx`, `frontend/frontend/src/features/business/decision/DecisionAssetLibrary.css`, and the smallest necessary integration point in `frontend/frontend/src/features/ai/AIShell.jsx`. Inspect `DecisionOutputReview.jsx` and `DecisionCommandCenter.jsx` only if needed to preserve saved-asset reopen behavior.

Use these backend endpoints. `GET /api/decision/assets` lists active snapshots by default and accepts `limit`, `readiness_state`, `truth_boundary`, `dataset_label`, `query`, `has_graph_state`, `created_from`, `created_to`, `archived_state`, and `include_archived`. `GET /api/decision/assets/<asset_id>` reopens one saved snapshot. `POST /api/decision/assets/<asset_id>/archive` archives a snapshot without changing its saved content. `POST /api/decision/assets/<asset_id>/restore` restores an archived snapshot to the active list. `DELETE /api/decision/assets/<asset_id>` permanently removes the saved snapshot record and must require confirmation. Continue to treat saved assets as immutable historical artifacts, not live data or final decisions.

Replace the persistent bottom library panel with a compact entry point in the AI Chat sidebar or rail. Use a small History/Saved Decisions icon button with an optional count, placed with the other AI Chat navigation or utility controls rather than in the results pane content. Opening it in a right-aligned Material UI Drawer is approved for this slice. Keep the drawer contained and secondary: about 400 to 450px on desktop, responsive on smaller screens, with normal close behavior and no obstruction of the active decision output once closed. Do not show full metadata cards in the main chat flow.

Inside the opened library view, keep filtering useful but quiet. Provide text search and optional compact filters for readiness, dataset label, graph-state presence, and archived/active state. Dataset label filtering must send saved dataset names through `dataset_label`, not source labels such as `Active dataset` unless that is actually the saved dataset name. For lifecycle state, prefer compact tabs or a segmented control for `Active`, `Archived`, and `All` because this is a view switch, not an arbitrary filter. A dropdown is acceptable only if drawer width or existing local component patterns make tabs cramped.

Each asset row should be dense. Show title, created time, dataset label, lifecycle state when archived, and one or two small status hints. Put detailed metadata such as evidence count, export section count, scenario status, graph-state saved, provenance, and snapshot notice behind row expansion, tooltip, or secondary details. Do not repeat the full immutable snapshot notice on every visible row in the default view.

Add archive and delete actions to each row. Archive should hide the asset from the default active list and allow viewing archived items through an archived filter. Restore should be available for archived rows. Delete should require an explicit confirmation and remove the row from the library after success. Neither archive nor delete may affect the currently active unsaved AI Chat decision output. If the user deletes the currently reopened saved asset, clear or gracefully mark the active asset state so the UI does not reference a missing asset.

Do not implement historical comparison UI in this slice. The backend comparison route remains deferred until the compact library and lifecycle behavior are accepted.

Acceptance checks: the AI Chat workspace no longer reserves a large bottom region for saved snapshots when the library is closed; opening the compact library still allows search, filtering, reopening a saved asset, archiving, restoring, and deleting; saved-asset lifecycle actions call the backend endpoints above; archive hides assets from the default active list; archived assets can be viewed and restored; delete requires confirmation and removes the saved asset record; no frontend code recomputes Dataset Trust, Evidence Board, source refs, scenario state, command-center state, or export readiness from current data; saved snapshots remain clearly secondary immutable historical artifacts.

Verification command: run `npm --prefix frontend\frontend run build` and `git diff --check`. Manual browser check: open AI Chat, save a decision snapshot, confirm the closed library is compact, open the library, filter by text and dataset label, reopen the asset, archive it, confirm it disappears from active view, show archived items, restore it, delete it with confirmation, and confirm the UI handles the missing deleted asset cleanly.

Ownership constraints: Antigravity owns frontend implementation, CSS, build, browser verification, and truthful frontend status updates. Do not edit backend Python, backend tests, active-gate goal files, or `GEMINI.md`.
