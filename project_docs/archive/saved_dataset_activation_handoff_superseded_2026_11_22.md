Superseded reference. Codex owns the opt-in save and full reopen workflow under the [active gate](../active/active_gate/README.md). This frontend assignment is closed.

Goal: Open the selected saved dataset into its working data, model, and Analytics scope from Data Hub.

## User Value

People can find a saved dataset by name, inspect its rows, and continue in Data Model or Analytics. This assignment covers opening an entry. The Save Dataset toolbar is the next assignment.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

The backend integration tests opened an upload, a refined copy, and a two-source model with a Business Object from fresh backend processes. An Analytics query used the returned relationship scope. Same-name records, denied governance, missing dependencies, and retries have distinct outcomes. Source is in `backend/routes/datahub_routes.py`, `backend/services/saved_datasets.py`, and `tests/test_saved_datasets.py`.

## Required Context

Read the [active gate](../active/active_gate/README.md), [status](../active/status/project_execution_status.md), [authorization](../active/status/phase_authorization.json), [frontend guardrail](../active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md), [saved dataset API](../active/saved_datasets/README.md#api-contract), and [workspace context contract](../active/contracts/multiple_data_source_workspace.md#analysis-context).

## Scope And Target Files

- `frontend/frontend/src/features/database/DataHubWindow.jsx`
- `frontend/frontend/src/features/database/DataHubWindow.test.jsx`
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/App.test.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`

**Required Change Coverage**: all target files

**Maximum Diff Lines**: 550

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: Keep search, upload, manual registration, confirmed row removal, Delete All and its confirmation, and legacy direct Open in Analytics. Test: keep the existing Data Hub search, delete, and draft-preservation assertions passing against the new discovery response.

Wire Data Hub discovery and activation through the existing shell and Data Preview. Save and Refine editors, Business Object panel changes, Analytics UI changes, backend edits, and browser acceptance are outside this assignment.

## Proven API Contract

| Request | Success and consumed fields |
| --- | --- |
| `GET /api/datahub/datasets` | `200 { datasets }` with each record keyed by `dataset_id`. A named entry has `name`, `kind` of `source`, `refined`, or `model`, numeric `revision`, `primary_source_id`, ordered `source_ids`, `created_at`, `updated_at`, `row_count`, `column_count`, and nullable `lineage`. A legacy entry has `kind: "legacy"`, `revision: null`, and the public source fields, including `source_id`, `source_kind`, dates, counts, and optional readiness. |
| `POST /api/datahub/datasets/<encoded dataset_id>/open` | Send `{}` with `Content-Type: application/json` for initial open. `200` returns `dataset`, `workspace`, `source`, `analysis_context`, `analysis_lineage`, `governance_readiness`, `semantic_model`, `schema`, `preview`, `row_count`, `offset`, `has_more`, `capabilities`, and `identity_map`. `preview` is a bounded array of JSON row objects. |
| `POST /api/datahub/datasets/<encoded dataset_id>/open` for another page | Send `{ offset, limit, expected_revision }` for a named entry. Omit `expected_revision` for legacy. `limit` is 1 through 200. Only apply the page if it matches the dataset and active workspace. |
| `DELETE /api/datahub/saved-datasets/<encoded dataset_id>` | `204` removes a named entry. Legacy removal still uses `DELETE /api/datahub/<encoded source_id>`. Delete All and manual registration keep their existing endpoints. |

Exact consumed types are `type SavedKind = 'source' | 'refined' | 'model' | 'legacy'`, `type AnalysisContext = { contract_version: 'multi_source_workspace_v1', workspace_id: string, workspace_version: number, primary_source_id: string, source_ids: string[], relationship_ids: string[] }`, and `type OpenPage = { offset?: number, limit?: number, expected_revision?: number }`. The activation's `capabilities` is `{ refine: boolean, save_kind: 'source' | 'model' }`. `identity_map` is null for legacy or an object with `relationship_ids` and `object_ids` string-to-string maps. Use `analysis_context` directly for execution.

The API returns structured `error.code` and `error.message` for invalid requests (`400`), missing datasets (`404`), missing or changed dependencies, revision mismatches or ambiguous sources (`409`), denied governance (`422`), and storage failure (`500`). A `422` adds top-level `governance_readiness` and no preview. Keep the existing string-error handling for legacy registration.

## Test Fixtures

Use `tests/test_saved_datasets.py` and the API contract for the full activation envelope. An empty list is `{"datasets":[]}`. A named model row can be `{"dataset_id":"saved_orders","name":"Quarterly data","kind":"model","revision":2,"primary_source_id":"src_customers","source_ids":["src_customers","src_orders"],"row_count":3,"column_count":4,"created_at":"2026-11-22T12:00:00Z","updated_at":"2026-11-22T12:10:00Z","lineage":null}`. Its activation can use the context `{"contract_version":"multi_source_workspace_v1","workspace_id":"ws_saved","workspace_version":1,"primary_source_id":"src_customers","source_ids":["src_customers","src_orders"],"relationship_ids":["rel_saved"]}` and a page containing namespaced keys such as `orders.total`.

Refusal fixtures include `{"error":{"code":"invalid_open_request","message":"Supply optional offset, limit and expected revision."}}`, `{"error":{"code":"saved_dataset_not_found","message":"Dataset not found in Data Hub."}}`, `{"error":{"code":"saved_dataset_dependency_changed","message":"The managed source file has changed.","source_id":"src_orders"}}`, and `{"error":{"code":"saved_dataset_unavailable","message":"The saved dataset could not be accessed. Try again."}}`. The focused backend legacy governance test demonstrates the `422` envelope.

## Required UI States And State Ownership

- Keep the catalog searchable by name and keyed by `dataset_id`. Include a helpful source, fixed copy, or live model label. Keep internal workspace IDs out of the primary interaction. Keep existing loading, empty, and registration states.
- Give the selected entry a primary **Open dataset** action and retain **Open in Analytics**. The primary action opens Data Preview in Workspace, sets the returned workspace and analysis context together, and supplies the returned semantic model. Data Model reuses that active workspace. For a named direct Analytics action, queue `{ kind: 'workspace', id: analysis_context.workspace_id, name: dataset.name, analysis_context }` via `pendingAction` and `updateAnalyticsWorkspace`. After the queue accepts it, install the same workspace envelope before navigating so the existing Analytics source selector has that context. Legacy direct Analytics retains `{ kind: 'datahub', id: source_id, name }` and works even when full legacy activation is ambiguous. Preserve the existing draft-archive behavior and show the storage failure if the action cannot be queued.
- Store the activated dataset ID, revision, capabilities and page together in app state. Keep `preview` separate from `fullData`, `cleanedData`, and inline Analytics payloads. Clear the previous upload's rows, raw file and filters only after a successful activation. Page through saved rows in the existing preview and show the server's total. Scope pages to the opened identity and reject a changed workspace response without replacing current work. Use the active workspace for Data Model. Keep saved data out of legacy global-state Refine and inspection actions until their governed paths are wired.
- Preserve WarehouseContext's source-ID consumers. The named `dataset_id` is never a legacy catalog source ID. Keep the pre-existing legacy-source entries in that context and leave named model IDs in Data Hub activation state. Avoid a URL or persistence migration.
- During open, show a visible pending state on the selected action. On failure, retain the entry, existing working context, and prior Analytics draft. Show an announced error with an explicit retry option. Changing destinations or selection invalidates the old request. Keep keyboard focus and accessible labels, including distinguishable same-name rows.

## Async Mutation Acceptance

**In-Flight Navigation**: A response that arrives after leaving Data Hub cannot activate data. Test: defer opening, navigate away, and assert the late success leaves the new destination and previous working context intact.

**Concurrent Edits**: While activating one record, prevent duplicate open requests and prevent a stale activation from overlapping a removal. Test: click Open twice while the first request is pending and assert one request for that ID.

**Failure Retry**: Unavailable saved data leaves the current working context and draft intact. Test: fail an open, assert the server's message, then retry explicitly and verify the same ID is requested.

**Conflict Or Duplicate**: Same-name entries are independently selectable and a stale dependency refuses activation. Test: open the second same-name entry, assert its ID was sent, return a `409`, and confirm the first entry's workspace was not replaced.

**Identity And Unmount**: A page response from an older activation cannot replace rows after a switch. Test: resolve a deferred page after another dataset opens and check that only the new dataset's rows appear.

## Verification And Stop Point

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand App.test.jsx DataHubWindow.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff saved_dataset_open.md --summary "Data Hub activation verification"` with the actual verification evidence in the summary.

Include the exact changed files, test and build results, and source lines for identity binding and draft preservation. Stop for Codex integration review. The user owns browser acceptance. Keep all `GEMINI.md` files untouched.
