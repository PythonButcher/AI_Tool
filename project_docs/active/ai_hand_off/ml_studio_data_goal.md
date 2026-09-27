Goal: Connect ML Studio Data & Goal to governed snapshot/schema/preview and conditionally save the experiment's dataset, problem type, and goal.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

`backend/routes/ml_studio.py` implements snapshot creation/retrieval and conditional draft saves. `backend/routes/manual_cleaning.py` implements a read-only, bounded workspace preview through `preview_only: true`. The focused preparation/draft/API/cleaning/workspace/persistence run executed 82 tests, with one symbolic-link permission skip. Compilation and the provider-neutral CI harness pass. Source inspection confirms `UnconnectedStage` still owns Data & Goal in the shell. This is a real UI gap with verified APIs.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/contracts/ml_studio.md` — Draft API, Snapshot Identity, and Workspace-Safe Cleaning
- `project_docs/active/ml_studio/README.md` — Step 4
- Source/fixtures: `backend/routes/ml_studio.py`, `backend/routes/manual_cleaning.py`, `tests/test_ml_studio_drafts.py`, `tests/test_ml_studio_api.py`, `tests/test_workspace_cleaning.py`, `tests/test_ml_studio_preparation.py`

## Scope And Target Files

Replace only the Data & Goal placeholder and its guidance. Present the selected governed workspace by friendly name and dimensions, its ordered snapshot schema, a bounded server preview, a problem choice, and an optional goal. Reuse the existing shared dataset/workspace selection; this handoff does not build a separate workspace picker. Show the current governed dataset as an explicit choice and make binding it to the draft deliberate. Do not derive schema or preview from `uploadedData`, `fullData`, or `cleanedData`.

Show all five problem labels: Predict a number (`regression`), Classify (`classification`), Forecast (`forecasting`), Find groups (`clustering`), and Detect anomalies (`anomaly_detection`). Regression/classification may be selected. The other three must be labeled unavailable and disabled because execution is not implemented; a resumed draft containing one still shows its saved choice and explains that execution is unavailable. Never silently substitute a supported task.

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`

**Required Change Coverage**: only the named required subset: MLStudioShell.jsx and MLStudioShell.test.jsx; CSS may change for this stage only.

**Maximum Diff Lines**: 1000

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: Keep Home, New experiment, reopen, duplicate, experiment name, guidance toggle, save status/error/retry/reload, stage navigator, Configure controls, and run dock visible and functional before and after this stage's requests; at 1024px the primary stage action remains reachable. Test: existing shell assertions plus data-goal-controls-survive render and interaction assertions.

Excluded behavior: Prepare Data UI, Power Query callbacks/return operations, training/configuration replacement, run/export changes, unrelated shell restyling, DataContext/App changes, backend, contracts, authorization, gate, readiness, and browser acceptance. Do not reopen the general autosave slice. Any changes around save sequencing must be narrowly required by this stage's explicit save action. Return a scope mismatch if correct sequencing requires broader repair.

## Proven API Contract

Use the existing API_URL convention. Root `/api/ml-studio/v1`:

- `GET /drafts/{experiment_id}?workspace_id={workspace_id}` → 200 `DraftGetEnvelope`; current draft plus workflow and nullable open preparation context. Never edit a draft with an open preparation context; show the pending preparation explanation and keep Data & Goal save disabled.
- `POST /snapshots`, JSON `SnapshotRequest`, Content-Type application/json → 201 `{snapshot: Snapshot}`. Use exact current workspace/version and ordered source/relationship arrays from the shared governed identity. Do not upload rows, hashes, schema, or paths.
- `GET /snapshots/{snapshot_id}` → 200 `{snapshot: Snapshot}`. This returns immutable saved metadata; compare workspace/version and ordered identity arrays against current context and visibly mark a mismatch stale. Do not treat GET alone as a freshness assertion.
- `PATCH /drafts/{experiment_id}?workspace_id={workspace_id}`, JSON `DataGoalEdit`, Content-Type application/json, raw `If-Match` saved ETag → 200 `DraftSaveEnvelope`. Save `snapshot_id`, `task_type`, and `goal` together. Save `active_stage: "Prepare Data"` only for the explicit Save and continue action. A successful response supplies the new draft revision/ETag and workflow; never unlock a stage locally before that response.

Bounded preview is a separate compatibility-root route: `POST /api/data-workspaces/{workspace_id}/manual-cleaning`, Content-Type application/json, exactly `PreviewRequest` with `steps: []` and `preview_only: true` → 200 `WorkspacePreview`. Never send false or cleaning steps from Data & Goal. This preview supports a primary-source workspace without any relationship records; relationship-backed or inactive-relationship workspaces return 409 `preparation_relationships_unsupported`. Show preview unavailable with that explanation while retaining the server snapshot schema; never fall back to global rows or invent a join preview.

Save sequencing: use one explicit Save Data & Goal / Save and continue action. Do not put these fields into a failing automatic retry loop. Wait for or disable this action during an in-flight header save. Flush any queued header edits and proceed only after its successful response supplies the current ETag; an unresolved save is not a successful flush. Serialize this stage's PATCH against header saves, preserve newer local goal/task edits, and use the latest response ETag. Disable conflicting header edits/navigation only while this explicit save is unresolved, then restore them. A failed stage save preserves its local fields and offers explicit retry. Retain the created snapshot ID for retry; retry does not create another snapshot unless identity changed. Reopening resumes the saved fields.

Copy-ready TypeScript contract declarations (documentation only; the implementation remains JSX):

`type Json = null | boolean | number | string | Json[] | { [key: string]: Json };`

`type Stage = 'Data & Goal' | 'Prepare Data' | 'Configure' | 'Train' | 'Review Results' | 'Use & Share';`

`type Task = 'regression' | 'classification' | 'forecasting' | 'clustering' | 'anomaly_detection';`

`interface ApiError { error: { code: string; message: string; remediation: string } }`

`interface PreviewError { error: { code: string; message: string } }`

`interface SnapshotRequest { workspace_id: string; workspace_version: number; source_ids: string[]; relationship_ids: string[] }`

`interface ColumnProfile { name: string; logical_type: 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text'; null_count: number; distinct_count: number }`

`interface Snapshot extends SnapshotRequest { contract_version: 'ml_studio_contract_v1'; snapshot_id: string; source_fingerprints: { source_id: string; content_fingerprint: string; schema_version: number }[]; schema_version: number; semantic_model_version: string; governance_result: { [key: string]: Json }; transformation_recipe_hash: string; row_count: number; column_profile: ColumnProfile[]; created_at: string; created_by: string | null }`

`interface Roles { target: string | null; numeric: string[]; categorical: string[]; ignored: string[]; time: string[]; group: string[] }`

`interface Draft { contract_version: 'ml_studio_workflow_v1'; experiment_id: string; workspace_id: string; draft_revision: number; etag: string; name: string; guidance_enabled: boolean; active_stage: Stage; snapshot_id: string | null; task_type: Task | null; goal: string | null; recipe_id: string | null; recipe_version: number | null; roles: Roles; validation: { [key: string]: Json }; metric: { [key: string]: Json }; candidate: { [key: string]: Json }; resource: { [key: string]: Json }; latest_assessment_id: string | null; latest_assessment_fingerprint: string | null; updated_at: string }`

`interface Workflow { experiment_id: string; draft_revision: number; active_stage: Stage; stages: { stage: Stage; state: 'locked' | 'available' | 'active'; blocker_codes: string[]; stale_reason_codes: string[] }[] }`

`interface Recipe { contract_version: 'ml_studio_contract_v1'; recipe_id: string; workspace_id: string; base_snapshot_id: string; base_recipe_hash: string; recipe_version: number; steps: { step_id: string; action_type: string; affected_columns: string[]; parameters: { [key: string]: Json } }[]; canonical_recipe_hash: string; created_at: string; created_by: string | null }`

`interface SchemaField { name: string; position: number; data_type: string; nullable: boolean }`

`interface Receipt { receipt_id: string; workspace_id: string; workspace_version: number; base_workspace_version: number; base_source_id: string; source_id: string; content_fingerprint: string; schema_version: number; schema: SchemaField[]; row_count: number; committed_at: string }`

`interface Preparation { operation_id: string; experiment_id: string; workspace_id: string; base_draft_revision: number; base_etag: string; snapshot_id: string; workspace_version: number; source_id: string; issue_id: string | null; fix_id: string | null; return_stage: 'Data & Goal' | 'Prepare Data'; recipe: Recipe; status: 'open' | 'applied' | 'cancelled'; result: { snapshot_id: string; receipt: Receipt; draft_revision: number } | null }`

`interface DraftSaveEnvelope { draft: Draft; workflow_state: Workflow }`

`interface DraftGetEnvelope extends DraftSaveEnvelope { preparation_context: Preparation | null }`

`interface DataGoalEdit { snapshot_id: string; task_type: 'regression' | 'classification'; goal: string | null; active_stage?: 'Data & Goal' | 'Prepare Data' }`

`interface PreviewRequest { workspace_version: number; source_id: string; steps: []; preview_only: true }`

`interface WorkspacePreview { committed: false; workspace_id: string; workspace_version: number; preview: { [column: string]: Json }[]; row_count: number; schema: SchemaField[]; governance_readiness: { [key: string]: Json }; receipt: null }`

## Representative JSON Fixtures

Use these exact request/response projections together with complete source-backed draft/snapshot fixtures from `tests/test_ml_studio_api.py`, `tests/test_ml_studio_drafts.py`, and `tests/test_ml_studio_preparation.py`. The frontend fixture must retain every field in the interfaces; do not substitute rows for a snapshot. Existing shell test factories may be extended to generate complete records from these values.

Snapshot request: `{"workspace_id":"ws_demo","workspace_version":1,"source_ids":["src_demo"],"relationship_ids":[]}`.

Snapshot success (201): `{"snapshot":{"contract_version":"ml_studio_contract_v1","snapshot_id":"snapshot-demo","workspace_id":"ws_demo","workspace_version":1,"source_ids":["src_demo"],"relationship_ids":[],"source_fingerprints":[{"source_id":"src_demo","content_fingerprint":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","schema_version":1}],"schema_version":1,"semantic_model_version":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","governance_result":{"status":"ready"},"transformation_recipe_hash":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","row_count":150,"column_profile":[{"name":"row_id","logical_type":"numeric","null_count":0,"distinct_count":150},{"name":"value","logical_type":"numeric","null_count":0,"distinct_count":150}],"created_at":"2026-09-27T12:00:00+00:00","created_by":null}}`.

Preview request: `{"workspace_version":1,"source_id":"src_demo","steps":[],"preview_only":true}`.

Preview success (200): `{"committed":false,"workspace_id":"ws_demo","workspace_version":1,"preview":[{"row_id":1,"value":125}],"row_count":150,"schema":[{"name":"row_id","position":0,"data_type":"int64","nullable":false},{"name":"value","position":1,"data_type":"int64","nullable":false}],"governance_readiness":{"status":"ready"},"receipt":null}`. Render row count separately from the bounded preview's sample size.

Save request with raw If-Match `etag-demo`: `{"snapshot_id":"snapshot-demo","task_type":"regression","goal":"Predict order value","active_stage":"Prepare Data"}`.

Complete save success (200): `{"draft":{"contract_version":"ml_studio_workflow_v1","experiment_id":"experiment-demo","workspace_id":"ws_demo","draft_revision":2,"etag":"etag-after-save","name":"Order value","guidance_enabled":true,"active_stage":"Prepare Data","snapshot_id":"snapshot-demo","task_type":"regression","goal":"Predict order value","recipe_id":null,"recipe_version":null,"roles":{"target":null,"numeric":[],"categorical":[],"ignored":[],"time":[],"group":[]},"validation":{},"metric":{},"candidate":{},"resource":{},"latest_assessment_id":null,"latest_assessment_fingerprint":null,"updated_at":"2026-09-27T12:00:00+00:00"},"workflow_state":{"experiment_id":"experiment-demo","draft_revision":2,"active_stage":"Prepare Data","stages":[{"stage":"Data & Goal","state":"available","blocker_codes":[],"stale_reason_codes":[]},{"stage":"Prepare Data","state":"active","blocker_codes":[],"stale_reason_codes":[]},{"stage":"Configure","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Train","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Review Results","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Use & Share","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]}]}}`.

Build the complete draft save fixture from the draft creation defaults in `backend/ml_studio/repository.py` with experiment `experiment-demo`, workspace `ws_demo`, name `Order value`, revision 2, ETag `etag-after-save`, these saved fields, and timestamp `2026-09-27T12:00:00+00:00`. Recipe and assessment fields remain null; role lists and settings are empty. The exact workflow is `{"experiment_id":"experiment-demo","draft_revision":2,"active_stage":"Prepare Data","stages":[{"stage":"Data & Goal","state":"available","blocker_codes":[],"stale_reason_codes":[]},{"stage":"Prepare Data","state":"active","blocker_codes":[],"stale_reason_codes":[]},{"stage":"Configure","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Train","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Review Results","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]},{"stage":"Use & Share","state":"locked","blocker_codes":["preparation_required"],"stale_reason_codes":[]}]}`. GET adds `preparation_context: null`.

Empty success: a persisted draft has `snapshot_id: null`, `task_type: null`, and `goal: null`; Data & Goal is active, Prepare Data and all later stages are locked with `data_goal_required`. A successful empty snapshot creation is impossible (422 `snapshot_dataset_empty`); do not mock an empty valid snapshot. The no-workspace UI performs no requests. Test bounded preview rendering of `preview: []` without inventing raw rows if a fixture exercises an empty sample; do not use it to imply a usable empty dataset.

Applicable error fixtures:

- Validation 400: `{"error":{"code":"draft_invalid","message":"The draft contains unsupported or immutable fields.","remediation":"Submit only editable draft fields."}}`.
- Missing saved snapshot 404: `{"error":{"code":"snapshot_not_found","message":"The requested dataset snapshot does not exist.","remediation":"Create or select a valid snapshot."}}`.
- Cross-workspace draft 404: `{"error":{"code":"draft_not_found","message":"The draft is unavailable in this workspace.","remediation":"Select a draft from the current workspace."}}`.
- Save conflict 409: `{"error":{"code":"draft_revision_conflict","message":"The draft changed since it was loaded.","remediation":"Reload or duplicate the draft to preserve local edits."}}`.
- Open preparation 409: `{"error":{"code":"draft_preparation_pending","message":"Preparation is open for this draft.","remediation":"Apply or cancel preparation before editing the draft."}}`.
- Stale snapshot request 409: `{"error":{"code":"snapshot_identity_stale","message":"The requested workspace, source, or relationship identity is stale.","remediation":"Reload the current Data Model identities and create a new snapshot."}}`.
- Snapshot governance 422: `{"error":{"code":"snapshot_governance_blocked","message":"Dataset governance blocks this ML Studio snapshot.","remediation":"Resolve the governance findings and create a new snapshot."}}`.
- Preview limitation 409: `{"error":{"code":"preparation_relationships_unsupported","message":"Relationship workspaces require a separate preparation contract."}}`.
- Preview identity 409: `{"error":{"code":"workspace_version_conflict","message":"Reload the workspace version."}}`.
- Preview governance 422: `{"error":{"code":"governance_blocked","message":"Cleaning violates the source governance policy."}}`.
- Preview failure 500: `{"error":{"code":"preparation_unavailable","message":"Preparation could not be committed. Reload before retrying."}}`.
- ML API failure 500: `{"error":{"code":"ml_studio_internal_error","message":"ML Studio could not complete the request.","remediation":"Retry the request or inspect server health."}}`.

There is no route-level permission/403 contract in this slice. Do not invent one. Network failures have no server JSON and must preserve the form with an explicit retry action.

## Required UI States

The stage shows a dataset summary, server schema table and bounded preview, five problem choices with availability labels, goal text, Save Data & Goal, and Save and continue. IDs and hashes go in expandable details, not primary copy. Guidance explains the problem choices without changing availability or persisted state.

Loading: show schema/preview placeholders and disable save until the governed snapshot is available. Empty: explain the missing governed dataset or draft and reuse existing Home/New experiment controls. Error: show safe server message/remediation and an explicit retry near the affected snapshot/preview/save action. Success: show the friendly dataset/version, truthful dimensions, saved fields, and the primary save/continue action. Pending: disable duplicate saves and conflicting navigation until this stage's request settles. Conflict/stale identity: preserve local goal/task text, explain the changed identity or revision, and offer explicit reload/refresh; never silently overwrite or send stale data. An open preparation operation prevents edits and explains that preparation must be resolved before another draft save.

## State Ownership

Server state: keys are workspace ID/version, experiment ID/revision/ETag, and immutable snapshot ID. Apply successful save envelopes to the shell's authoritative draft/workflow and refresh draft summaries only after success. Schema and preview come from server requests keyed by current governed identity. Do not create parallel authoritative copies of the draft or workflow.

Local UI state: unsaved task/goal, selected current dataset intent, disclosure expansion, request/error state, and a transient snapshot prepared for the current save. Preserve edits made after a save payload was captured. URL state: no new URL fields; retain current routing. Asynchronous state: no training job or polling in this slice; identity and request-generation guards suppress stale responses. Retry is explicit for this stage; clear timers/requests on unmount. Pending preparation is server-owned and read-only here.

## Async Mutation Acceptance

**In-Flight Navigation**: Block Home/stage exit while this stage's explicit save is unresolved and explain the pending save; failed saves keep the form and permit explicit retry. Test: data-goal-navigation-waits resolves a deferred PATCH and asserts no departure or optimistic Prepare Data activation before success.

**Concurrent Edits**: Serialize against header saves and disable duplicate submission; later local task/goal edits remain unsaved rather than being reset by an older response. Test: data-goal-save-order asserts header PATCH completes before the stage PATCH uses its returned ETag, and a deferred older stage response preserves newer local text.

**Failure Retry**: Keep goal/task and the created snapshot after network/500 failure; retry occurs only through the stage action and does not recreate the snapshot for unchanged identity. Test: data-goal-explicit-retry advances timers after failure, asserts no repeat stage PATCH, then clicks Retry and asserts the same snapshot ID and current ETag.

**Conflict Or Duplicate**: Duplicate clicks produce one save. A 409 keeps local form text and visible reconciliation; no optimistic stage unlock or silent overwrite. Test: data-goal-conflict-and-duplicate asserts request count one, preserved goal/task, and unchanged server workflow after a controlled 409.

**Identity And Unmount**: Workspace/version/experiment changes or unmount invalidate schema/preview/snapshot/save response generations. Test: data-goal-stale-response resolves each old deferred request after identity change or unmount and asserts no new draft/workflow update, stale preview, or follow-up PATCH.

## Acceptance Checklist

- Data & Goal is connected for fresh and resumed drafts; server schema and bounded preview are used.
- Save/continue persists the exact data/task/goal fields conditionally, and follows the returned workflow.
- All five problem labels appear with truthful availability; unsupported execution cannot be started.
- Missing data, loading, error/retry, save pending, open preparation, stale identity, and conflict states are covered.
- Every async assertion and preserved-control assertion has a focused test.
- No preparation/Power Query, training, broad autosave, or excluded-path implementation is added.
- Keyboard labels, focus, disabled explanations, and error announcements are accessible; tables scroll within their region.

## Verification And Stop Point

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, `git diff --check`, and `git diff --name-only`.

Then run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_data_goal.md --summary "Connected Data & Goal; list focused async/control assertions and exact test/build results"`.

Use apply_patch for reviewable edits. Never touch GEMINI.md. If a target becomes empty or unexpectedly smaller, stop and return the incident without reconstruction. Return exact changed files, command exit results, and the named assertion evidence, then stop for Codex review. Do not implement the Prepare Data slice or claim browser acceptance.
