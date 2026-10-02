Goal: Preview the selected suggested preparation step against the saved experiment's governed source, then cancel and return without changing its dataset or draft.

PREPARED ONLY — NOT AUTHORIZED FOR IMPLEMENTATION. Promote this document into one active Antigravity handoff only after the user authorizes the next step. Update the gate, status and authorization before source changes.

## User Value

Power Query gains Run Preview for the suggested step, a table of resulting rows, and the resulting row count. Cancel and Return leaves the dataset and saved experiment unchanged. Applying changes and editing transformations remain unavailable in this assignment.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

backend/ml_studio/preparation.py implements begin, preview and cancel; backend/routes/ml_studio.py exposes the versioned draft-scoped routes. Backend preview calls workspace cleaning with preview_only=true and returns at most 100 rows. Cancel checks the operation's base ETag and preserves the saved draft and workspace. Begin creates durable operation/recipe identities without changing the draft revision. An open operation blocks ordinary draft writes.

On 2026-10-01, all 14 tests in tests/test_ml_studio_preparation.py passed, including test_begin_issues_server_recipe_and_survives_restart_without_editing_draft, test_preview_cancel_preserve_saved_draft_and_dataset, test_open_preparation_blocks_saves_and_other_starts, test_wrong_identity_and_client_owned_fields_rejected and test_missing_value_fix_is_issued_and_bound_to_current_snapshot.

The editor currently disables runCleaning in ML Studio mode. Its legacy path posts to /api/manual_cleaning and updates global DataContext; preserve that normal editor behavior but never use it for ML Studio. The shell owns the active draft, ETag, header-save coordination, preparation-options GET and identity invalidation. App owns overlay visibility and spreads editor props after its default close handler; a dedicated asynchronous closeForm prop can therefore await cancellation before asking the existing gateway to close the overlay, without editing App.

## Required Context

- project_docs/active/contracts/ml_studio.md — Draft Preparation Operations and Workspace-Safe Cleaning
- project_docs/active/ml_studio/README.md — Step 4
- project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md
- The authorization, execution status and sole active gate after promotion
- backend/ml_studio/preparation.py, backend/routes/ml_studio.py, backend/ml_studio/repository.py and backend/services/workspace_cleaning.py for contract evidence only

## Scope And Target Files

One saved preparation session: start, preview its fixed suggested recipe, cancel and return, with recovery of an open session after reload. No apply or editable recipe controls.

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/components/data_management/DataCleaningForm.jsx`
- `frontend/frontend/src/components/data_management/DataCleaningForm.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css` — optional scoped preview/pending/error styles

**Required Change Coverage**: shell, editor and both focused tests; stylesheet optional

**Maximum Diff Lines**: 1000

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: The focused Stay/Open dialog, Guidance, saved-experiment navigation, current issue labels and normal global Power Query remain functional outside the reserved session. Test: "preview cancel preserves shell and global editor controls" verifies normal controls after cancellation, unchanged draft identity, and the existing legacy preview/apply requests.

No App, CanvasContainer, backend, contract, general preview component, global DataContext, authorization, status, gate or GEMINI.md edits by the implementer. No Apply All, manual transformations, recipe editing, role/schema reconciliation, training, exports or dataset replacement. If this cannot fit the budget as one independently reviewable session, return a scope mismatch to Codex before implementation.

## Proven API Contract

All paths use root /api/ml-studio/v1 and encoded server experiment/workspace identities. Error responses are exactly {error:{code,message,remediation}}.

1. GET /drafts/{experiment_id}/preparation?workspace_id={workspace_id}, no body or mutation headers, 200 {snapshot_id,issues,fixes,preparation_context}. Fix fields: fix_id,issue_id,action_type,affected_columns,parameters,support_status,explanation. Issues use issue_id,code,severity,field,message,remediation. Nullable preparation_context is the full open operation. Draft GET also owns this field; ordinary PATCH responses must not clear it.
2. POST /drafts/{experiment_id}/preparation?workspace_id={workspace_id}, Content-Type: application/json, If-Match: current opaque draft.etag, Idempotency-Key: one stable 1–256 character key for the exact start intent. Body exactly {snapshot_id,steps,issue_id,fix_id,return_stage}. Use the current server-issued selected fix pair and steps:[{type:fix.action_type,params:fix.parameters}], return_stage:"Prepare Data". Do not send editor-only step id/label, recipes/hashes, client rows or source paths. 200 {preparation}; identical intent/key replay returns the same operation, including terminal status.
3. GET /drafts/{experiment_id}/preparation/{operation_id}?workspace_id={workspace_id}, no body, 200 {preparation}. It recovers this operation's status within the exact draft/workspace.
4. POST that operation path, Content-Type: application/json, body exactly {action:"preview"}, no If-Match required, 200 {preparation,preview}. Preview rechecks current snapshot identity and uses the stored recipe. It does not modify data.
5. POST that operation path, Content-Type: application/json, If-Match: preparation.base_etag, body exactly {action:"cancel"}, 200 {preparation,draft,workflow_state,preparation_context}. Successful cancellation has preparation.status="cancelled", result=null, preparation_context=null; draft remains unchanged. Replaying cancel is supported. Never substitute a newly observed draft ETag for the operation's base_etag.

Operation fields: operation_id,experiment_id,workspace_id,base_draft_revision,base_etag,snapshot_id,workspace_version,source_id,nullable issue_id/fix_id,return_stage,recipe,status,result. Status is open/applied/cancelled. Recipe fields: contract_version="ml_studio_contract_v1",recipe_id,workspace_id,base_snapshot_id,base_recipe_hash,recipe_version,steps,canonical_recipe_hash,created_at,nullable created_by. Each step has the same contract_version plus step_id,action_type,affected_columns,parameters. Preserve opaque sha256: hashes and identities from the server.

Preview fields: committed=false,workspace_id,workspace_version,preview (at most 100 row objects),row_count (all transformed rows),schema (ordered objects with name,position,data_type,nullable),governance_readiness (server readiness object),receipt=null. Display the full row_count separately from the sample count. Use schema order, safely render null/boolean/date/string/numeric values and stringify any structured cell; never place raw objects directly in JSX. An empty preview is a valid outcome with explicit "No rows remain" copy and Cancel and Return. No global dataset rows are used.

Copy-ready consumer types:

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

interface StartRequest { snapshot_id: string; steps: { type: string; params: { [key: string]: Json } }[]; issue_id: string; fix_id: string; return_stage: "Prepare Data"; }

interface SchemaField { name: string; position: number; data_type: string; nullable: boolean; }

interface PreviewTable { committed: false; workspace_id: string; workspace_version: number; preview: { [column: string]: Json }[]; row_count: number; schema: SchemaField[]; governance_readiness: { [key: string]: Json }; receipt: null; }

interface ErrorResponse { error: { code: string; message: string; remediation: string }; }

Use complete server operation/draft/workflow fixtures from the backend tests rather than fabricating missing fields. Later applied results and workflow stages are outside this consumer's supported state; show a reload/recovery message instead of treating them as open or cancelled.

## Representative Fixtures And Errors

Start body: {"snapshot_id":"snapshot-1","steps":[{"type":"remove_nulls","params":{"columns":["Region"]}}],"issue_id":"issue-region","fix_id":"fix-region","return_stage":"Prepare Data"}.

Preview action: {"action":"preview"}. Cancel action: {"action":"cancel"}. Empty preview retains all PreviewTable fields with preview:[],row_count:0,schema from the transformed table and committed:false,receipt:null. Capture successful full begin, preview, cancel and open-resume envelopes from the isolated Flask fixture in tests/test_ml_studio_preparation.py; test_missing_value_fix_is_issued_and_bound_to_current_snapshot provides the selected-pair case. Keep opaque hashes and current identities intact.

Applicable errors: invalid request/steps and cleaning failure (400), hidden/absent draft or operation (404), draft_revision_conflict, snapshot_identity_stale, preparation_intent_conflict, draft_preparation_pending, preparation_terminal_conflict and preparation_relationships_unsupported (409), governance_blocked (422), and ml_studio_internal_error (500). Begin requires an unjoined primary source. Preserve server error.code/message/remediation, show explicit Retry and do not fabricate readiness or a successful return. Permission isolation appears as hidden 404, not a separate permission response.

Representative conflict: {"error":{"code":"snapshot_identity_stale","message":"The dataset snapshot no longer matches authoritative server state.","remediation":"Create a new snapshot from the current governed Data Model."}}.

Representative safe server failure: {"error":{"code":"ml_studio_internal_error","message":"ML Studio could not complete the request.","remediation":"Retry the request or inspect server health."}}.

## Required UI And State Ownership

Keep the current suggested-step inspection when opening. Run Preview starts/resumes the durable operation and requests its preview. Persist the exact start intent/key locally through network retry; never auto-start on mere editor opening. Wait for any queued header save using the existing save coordinator, then use its current server ETag. Freeze competing header/stage/delete/duplicate actions before begin dispatch and through resolution of the reserved session, without creating another autosave queue.

Server state: operation/recipe/base_etag and preview response. Local state: one immutable start intent/key until its outcome is reconciled, pending action, safe errors and preview display. Do not copy the saved draft into an independent editable store. URL state is unchanged. No background polling or automatic retry.

Cancel and Return, X and Escape use the same awaited cancellation when an operation exists; only successful cancellation/reconciled terminal outcome closes the overlay. Before any begin request, ordinary Return makes no mutation. While begin has an unknown outcome, stay in a recoverable editor and retry the same key or reconcile draft GET; do not claim cancellation from a missing response. Preview failure retains the known operation and keeps cancel available. Cancel failure keeps the editor and lock visible with manual Retry.

Open server context after reload offers Resume Preview/Cancel for that operation; ordinary header edits remain blocked until terminal reconciliation. Reuse its stored recipe/base_etag, not newly generated steps or a new start key. Existing applied/commit-pending operations show a safe recovery message; do not offer cancel after a data commit or implement Apply recovery in this assignment.

Capture workspace/experiment/snapshot/revision and a session token. Late responses after identity change/unmount cannot update another draft, preview, or gateway. External workspace changes retain the durable old operation for explicit recovery; do not silently apply/cancel it against the new workspace. A successful cancellation reconciles only the matching draft response and clears context/locks before closing. The old Return callback must not refetch or restore a different identity.

## Async Mutation Acceptance

**In-Flight Navigation**: Start/preview/cancel pending disables ordinary close and competing stage/header actions; unexpected identity changes revoke local callbacks and retain server recovery. Test: "preparation pending protects navigation" defers each response, attempts close/navigation, and asserts no unsafe close or mutation of a new identity.

**Concurrent Edits**: Await the current header save before begin, then freeze conflicting writes. Test: "begin waits for current ETag" defers header PATCH and asserts one begin after it settles, with its returned ETag and no subsequent competing PATCH.

**Failure Retry**: No timer retry; preserve operation or original start intent/key and show manual Retry. Test: "lost start and cancel responses remain recoverable" rejects responses after server success, advances timers, asserts no additional request, then retries identical intent/key or base_etag and closes only after terminal reconciliation.

**Conflict Or Duplicate**: Repeated Preview/Cancel clicks submit once; 409 retains safe errors/context until explicit reload/retry. Test: "preparation duplicate and conflict preserve context" double-clicks with deferred responses, asserts one begin/preview/cancel, unchanged start identity, and no silent draft overwrite.

**Identity And Unmount**: Ignore old body/operation results and stale callbacks; resume server context on reload. Test: "preparation identity and reload recovery" changes identity while JSON/start/preview/cancel is deferred, resolves it, and asserts no stale state/request; reload an open-operation fixture and cancel using its stored base_etag without another begin.

## Acceptance And Verification

Focused tests cover the exact selected-fix request, representative full envelopes, bounded/empty preview, actionable errors, open-operation resumption, immutable dataset/draft cancellation, header-save ordering and all five async assertions. Test normal Power Query separately to preserve its existing legacy path. No apply request or global DataContext mutation may occur from this ML Studio path.

- npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx
- npm --prefix frontend/frontend run build
- python .codex/hooks/agent_harness_check.py
- git diff --check
- git diff --name-only
- After promotion only: run the governed Antigravity return command with the promoted active handoff path, changed-file list, exact named tests, build results and source lines for operation/base_etag ownership and safe cancellation.

Antigravity may choose component structure, accessible labels, spacing and loading presentation within existing styles. It must stop after this one session boundary and return to Codex. Codex reviews integration before any Apply assignment. Browser acceptance belongs to the user; it is never claimed by this document.
