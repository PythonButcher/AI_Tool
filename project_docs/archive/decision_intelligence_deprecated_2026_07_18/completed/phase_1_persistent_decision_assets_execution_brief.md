# Persistent Decision Assets Execution Brief

Status: ready for implementation. This brief selects one standalone product outcome; it does not authorize implementation in this planning session.

## Recommended Goal

Let a user save the current AI Chat Decision Review as an immutable decision asset and reopen that exact snapshot after a page reload. The saved asset remains an observational decision-support record: it is not a live dataset view, final recommendation, forecast, simulation, optimizer, causal result, or autonomous decision.

The initial user flow stays in AI Chat. A user inspects a `decision_output`, saves it with a title, sees a compact saved-assets list in AI Chat, and reopens a saved snapshot in the existing inspector. This is intentionally not a new Decisions window, a fullscreen review redesign, historical comparison, asset editing, or deletion workflow.

## Why This Is The Next Slice

The current product has a visible continuity failure. `AIShell.jsx` labels the Decision Review as “Current Session Only,” and its decision graph context is React state only. Backend decision routes create, analyze, and graph decision data, but expose no asset storage routes. The graph contract explicitly allows `client_session_or_saved_decision_asset` while stating that the graph endpoint does not persist state. The existing SQLite helper already provides a narrow, lazy schema pattern for durable Data Hub metadata.

| Candidate | User value | Technical readiness and risk | Clear acceptance | Decision |
| --- | --- | --- | --- | --- |
| Persistent decision assets | High: preserves work a user has already framed, analyzed, and exported | High readiness: stable `decision_output`, Dataset Trust, export sections, existing SQLite helper; contained risk because the first asset is an immutable snapshot without raw dataset rows | Save, reload, list, and reopen the exact review | Selected |
| Saved decision library plus fullscreen review | High, but it combines persistence, a new secondary surface, navigation changes, and display ownership | Depends on stable asset IDs and storage first; larger frontend risk | Too broad for one implementation run | Defer until assets exist |
| Advanced analysis readiness controls | Low incremental value now | `advanced_gates`, readiness, Dataset Trust, and governance states already render in AI Chat | Would mainly duplicate an already-complete capability | Do not select |
| Targeted application cleanup | Necessary maintenance, not the strongest standalone user outcome | The pruning review identifies several unrelated surfaces and tracked artifacts | Broad and hard to prove as one product result | Keep as a separate cleanup run |

## Scope And Boundaries

Persist only a sanitized decision snapshot. The snapshot contains `decision_output`, including its `dataset_trust`, `frame`, `readiness`, `evidence_board`, `decision_map`, `scenario_compare`, `advanced_gates`, `export_sections`, `source_refs`, and `truth_boundary`. It may contain `graph_state` only when a caller supplies the contract-safe graph carry-forward state. It must not store chat transcripts, raw dataset rows, Data Hub paths, or unbounded request payloads.

An asset is immutable after creation. The implementation must not add edits, deletes, sharing, user identity, historical comparison, automatic refresh against changed data, a standalone Decisions destination, or fullscreen review. The saved view must identify itself as a snapshot and retain the stored Dataset Trust and truth boundary rather than inferring current data freshness or readiness.

## Backend Contract And Ownership

Codex owns the backend schema, service, routes, contract documentation, tests, and backend verification. Gemini owns the React integration and browser verification after Codex has delivered and verified the contract. Codex must not edit `frontend/frontend/src/`.

Add a `DecisionAsset` contract to `project_docs/active/contracts/decision_objects.md` with these persisted fields:

| Field | Requirement |
| --- | --- |
| `asset_id` | Backend-generated stable identifier, prefixed `decision_asset_` |
| `schema_version` | `di_decision_asset_v1` |
| `title` | Required normalized display title; caller title is optional and falls back to the decision output title |
| `created_at` | Backend-generated ISO-8601 UTC timestamp |
| `decision_output` | Required immutable copy of the current `decision_output` contract; no raw dataset rows or chat transcript |
| `graph_state` | Optional `decision_graph_build_state` only; absent when the graph was not supplied |
| `snapshot_notice` | Required UI copy stating that the asset is a saved observational snapshot, not a live refresh |

Expose only these routes in the first slice:

| Route | Request | Response |
| --- | --- | --- |
| `POST /api/decision/assets` | `title` optional, `decision_output` required, `graph_state` optional | HTTP 201 with the complete `DecisionAsset` |
| `GET /api/decision/assets` | optional bounded `limit`, default 25 and maximum 50 | HTTP 200 with newest-first asset summaries: `asset_id`, `title`, `created_at`, dataset label, readiness state, and truth boundary |
| `GET /api/decision/assets/<asset_id>` | path ID | HTTP 200 with the complete immutable `DecisionAsset`; HTTP 404 when absent |

The save service must validate the supplied `decision_output` before writing: it requires the current output identity and `truth_boundary: "observational_analysis_only"`; it requires a valid Dataset Trust object when Dataset Trust is present; it rejects raw dataset/chat fields and arbitrary oversized blobs. The service must preserve the original `source_refs` and stored Dataset Trust exactly. Saving does not re-run governance because it does not load or process a dataset. If the originating response supplied `governance_readiness`, the frontend may retain it in its client context for display, but the durable asset contract relies on its embedded Dataset Trust snapshot and must never claim a new governance evaluation.

Use a new `decision_assets` SQLite table created through the existing lazy `_ensure_schema` path. Store JSON snapshots and summary columns needed for newest-first listing. Do not add or commit a runtime `.db` artifact; the tracked-database cleanup remains separate from this schema change.

## Target Files

Codex implementation targets are `backend/db/backend_db.py`, new `backend/services/decision_asset_service.py`, `backend/routes/decision.py`, new `tests/test_decision_asset_service.py`, and `project_docs/active/contracts/decision_objects.md`. The existing `tests/test_decision_chat_service.py` remains the compatibility regression for creating the source `decision_output`.

Gemini integration targets are `frontend/frontend/src/features/business/decision/decisionApi.js`, new `frontend/frontend/src/features/business/decision/DecisionAssetLibrary.jsx`, its colocated stylesheet, and `frontend/frontend/src/features/ai/AIShell.jsx`. The library is a compact AI Chat control, not a new route or destination. It must use the saved asset’s own `decision_output` to populate the existing inspector renderer, preserving the current export affordance.

## Frontend Behavior And Ownership

Gemini adds a Save decision control only when the active inspected artifact is a valid `decision_output`. Saving must show in-progress, success, and backend error states without hiding the Decision Review. The compact Saved decisions control loads summary records, shows their title, creation time, dataset label, and snapshot status, and opens a selected record through `GET /api/decision/assets/<asset_id>`. The reopened inspector must render the stored `decision_output`; it must not silently substitute the active dataset, a newer chat result, or client-derived readiness.

The existing “Current Session Only” label in `AIShell.jsx` must change only when the displayed artifact is a saved asset. A live chat artifact remains current-session-only until saved. Saved assets must visibly state their immutable snapshot timestamp and observational boundary. Existing normal answer, chart, correction, Decision Graph launch, and PDF export paths must remain intact.

## Acceptance Checks

Backend acceptance is met when a valid decision-output fixture saves and returns an ID, list response, and detail response; detail data is byte-for-byte equivalent for the persisted decision snapshot; records are newest-first; title fallback works; missing IDs return 404; malformed, oversized, raw-data-bearing, or boundary-violating payloads are rejected; optional valid graph state persists; and the source decision-chat regression still passes.

Frontend acceptance is met when a user can generate a decision output in AI Chat, inspect it, save it, reload the application, see the saved summary, reopen the same asset, and see its saved title, Dataset Trust, Evidence Board, Scenario Compare state, export button, and `observational_analysis_only` boundary. A normal answer and chart must still render without saved-asset controls appearing where no decision output exists.

Run backend verification with `$env:PYTHONPATH='.codex_tmp_py\site-packages'; python -m unittest tests.test_decision_asset_service tests.test_decision_chat_service`. Run the required frontend checks with `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`.

The browser path is: load a governed dataset; request a Decision Intelligence result in AI Chat; inspect the `decision_output`; save it; refresh the page; choose the saved title from the compact Saved decisions control; reopen it; confirm the immutable snapshot label, Dataset Trust, truth boundary, and PDF export; then submit one standard answer and one chart prompt to confirm existing AI Chat behavior remains unaffected.

## Execution Order

Codex first implements and verifies the backend contract and records the result in the active status file as `backend_contract_ready` or `backend_not_ready`. Only after that gate is true should Gemini implement the named frontend files and browser path. The follow-on Decision Review Library and fullscreen work may use these stable asset IDs and retrieval routes, but it is out of this slice.
