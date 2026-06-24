# Decision Intelligence Execution Status

This is the short active status file. It should stay readable in under two minutes. Implementation history belongs in archive, not in this active gate document.

Detailed history:

`project_docs/archive/decision_intelligence_status_history_2026_06_01.md`

Full older preserved status history:

`project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md`

## Current Truth

Decision Intelligence V3 is active, and the 11-phase AI Chat decision-output rollout is complete.

AI Chat is the primary work surface. Existing AI Chat behavior must remain: normal answers, charting, exploration, decide mode, artifact inspection, and exports.

Decision Intelligence is unified into AI Chat's results pane. The Decisions window is not deleted, but its intended role is secondary unless a future approved slice defines saved decision library, fullscreen review, or historical asset behavior.

Completed foundations: AI Chat answer/chart protection, Dataset Trust, backend `decision_output`, frontend `decision_output` rendering, chat-native corrections, Evidence Board rendering, Decision Graph backend data foundation, Interactive Decision Graph Workspace, User Hypotheses and Graph-To-Action Flow, and Scenario Compare in the AI Chat decision output.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth now belongs inside Dataset Trust in the unified AI Chat decision output flow.

## Current Project Gate

Current gate is **Phase 2 — Decision Review Fullscreen Viewer**.

Status: **READY FOR PLANNING**

Phase 2 opens an existing immutable decision asset in a fullscreen historical-review surface. It must not add edits, deletes, sharing, live refresh, comparison, or a new persistence contract.

Phase 1 is complete. Its implementation brief is retained at `project_docs/active/decision_intelligence/completed/phase_1_persistent_decision_assets_execution_brief.md`. The active Phase 2 architecture is `project_docs/active/decision_intelligence/current/decisions_window_future_role.md`. Browser control remains user-owned.

## Latest Verified Slice

## Phase 1 — Persistent Decision Assets
**Status:** COMPLETE — USER ACCEPTED

**Verified facts:**
1. Created `DecisionAssetLibrary.jsx` and colocated stylesheet `DecisionAssetLibrary.css` rendering a compact list of saved decision snapshots displaying titles, timestamps, dataset labels, readiness, and the `observational_analysis_only` snapshot boundary.
2. Implemented `saveDecisionAsset`, `getDecisionAssets`, and `getDecisionAssetById` API helpers in `decisionApi.js`.
3. Integrated save control forms, snapshot metadata indicators, and reopening logic inside `AIShell.jsx`.
4. The prior untracked browser screenshots and report were removed because they did not establish one continuous, reproducible run.
5. A clean live check confirmed the library UI loads; the workspace backend created, listed, and retrieved a `Codex Clean Acceptance Snapshot` with the expected immutable notice and observational boundary.
6. The user completed the required browser-level acceptance and approved this slice. Browser acceptance remains a user-controlled gate for future work.

## Phase 1 Backend Contract
**Status:** COMPLETE

**Verified facts:**
1. `decision_assets` SQLite table is created through the lazy schema check and successfully persists immutable snapshot records.
2. `POST /api/decision/assets`, `GET /api/decision/assets`, and `GET /api/decision/assets/<asset_id>` match request/response payload specifications exactly.
3. Rejects oversized payloads, raw rows, chat transcripts, and non-JSON data while correctly preserving Dataset Trust summaries.
4. Backend test suites `tests.test_decision_asset_service` and `tests.test_decision_chat_service` pass cleanly with 35 tests.

## Governance and Quality Gates
**Status:** COMPLETE — CSV UPLOADS AND POLICY BLOCKS WORK IN THE RUNNING APP

**Verified facts:**
1. `backend/services/data_catalog_lineage.py` defines one explainable readiness contract for required fields, null thresholds, duplicate keys, value ranges, freshness, PII handling, and retention expiry.
2. Upload, basic and manual cleaning, NLP charts, Decision Intelligence routes, AutoML, Data Hub row fetches, legacy AI routes, and exports either return `governance_readiness` or block with HTTP 422 before producing downstream output.
3. Data Hub persists governance policy and exposes `GET /api/datahub/<dataset_id>/governance-readiness` for immediate re-evaluation.
4. Focused coverage in `tests/test_data_catalog_lineage.py` proves a deliberately bad dataset is blocked before chart generation, AI Chat/Decision Intelligence output, AutoML, and export. `tests.test_decision_chat_service` remains green.
5. `project_docs/active/contracts/data_catalog_lineage.md` is the source contract for response shape and frontend handling.
6. The upload gate no longer blocks an ordinary CSV merely because an inferred `id` field repeats or a default null threshold is crossed. Those heuristic checks return an explicit warning; declared duplicate-key and null policies still block as configured.
7. `FileUpload.jsx` lets the browser set the multipart boundary, renders successful upload warnings, and renders backend-provided HTTP 422 block reasons and next actions.
8. `AIShell.jsx` now handles warning and block readiness for action, correction, and message requests. `AutoMLPanel.jsx` and `FileExport.jsx` retain their focused governance handling.
9. Focused backend and harness coverage passed with 38 tests. The current frontend production build passed with existing lint warnings only.
10. Against the running backend, a real multipart ordinary CSV returned HTTP 200 with the `warning` readiness state, while the same CSV with an explicit duplicate-key policy returned HTTP 422 with the `blocked` readiness state. The browser loaded the Upload workspace without client errors. The remaining native operating-system file-picker click is a user smoke check, not an open code or connection defect.

## Final AI Chat Decision Export
**Status:** COMPLETE

**Verified facts:**
1. `backend/services/decision_output_service.py` builds PDF-renderable `body` content for every export section, not only non-rendered summaries.
2. Export sections now cover Executive Brief, Dataset Trust, Goal, Drivers, Limits, Breakdowns, Evidence Board, Decision Map Summary, Scenario Compare, Assumptions and Unknowns, and Truth Boundary.
3. Dataset Trust export includes source, dataset, row count, column count, semantic readiness, transform state, freshness, and warnings.
4. Goal, Drivers, Limits, Breakdowns, Evidence Board, Scenario Compare, Assumptions, and Unknowns export as cards when detail is available.
5. Truth Boundary export explicitly states observational-only limits and unsupported final recommendation, optimization, simulation, causal proof, prediction certainty, and autonomous decisioning.
6. `project_docs/active/contracts/decision_objects.md` documents the current `export_sections` shape and section order.
7. Focused backend verification passed with `PYTHONPATH=C:\Users\18022\Desktop\AI_Tool\.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service`.
8. Frontend production build passed with `npm --prefix frontend\frontend run build`; it completed with existing lint warnings only.
9. Browser validation against the production build sent an AI Chat decision prompt, received backend-produced `workspace_preview` and `decision_output` artifacts, found three enabled PDF export buttons, clicked the active decision output export button, and downloaded `decision_ai_result_2026-06-17.pdf` with `%PDF-` header.
10. PDF text extraction found 3 pages and verified all required export sections plus the final recommendation, simulation, optimization, causal proof, prediction certainty, and autonomous decisioning boundary text.

## Next Focus

Next focus is Phase 2 implementation planning for the Decision Review Fullscreen Viewer.

## Status File Discipline

Keep this file short. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave only the current gate, the latest verified fact, and the archive pointer here.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
