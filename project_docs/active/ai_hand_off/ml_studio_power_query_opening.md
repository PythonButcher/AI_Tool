Goal: Let a user choose Stay or open Power Query from a Prepare Data issue, inspect its suggested step in a read-only ML Studio mode, and return to the same saved experiment without changing data.

## User Value

Clicking a data issue offers Stay and Open Power Query. Power Query identifies the experiment and affected column and provides a clear return to Prepare Data. Running previews or applying changes remains unavailable in this assignment.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

DraftPreparationService.options in backend/ml_studio/preparation.py returns server-owned missing-value issues, supported fixes and open-operation context. Its GET route is implemented in backend/routes/ml_studio.py. On 2026-09-29, `python -m unittest tests.test_ml_studio_preparation -q` passed all 14 tests using the repository dependency bundle, including issue pairing, stale identity, workspace isolation, durable return context and cancel preservation.

PrepareDataStage has no opening action. The existing gateway is MLStudioShell's onOpenCleaningForm prop, forwarded by CanvasContainer and handled in App by setCleaningFormProps/setShowCleaningForm. App renders DataCleaningForm as an overlay while the shell stays mounted. DataCleaningForm currently derives columns from global DataContext and posts to /api/manual_cleaning. Neither behavior is safe evidence of saved-draft preparation. Introduce an explicitly read-only opening mode; it must never route this mode into runCleaning.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `project_docs/active/ml_studio/README.md` — Step 4 assignment order

## Scope And Target Files

One opening and return boundary, using the existing overlay gateway. Keep the experiment mounted and preserve its server state.

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/data_management/DataCleaningForm.jsx`
- `frontend/frontend/src/components/data_management/DataCleaningForm.test.jsx` — create focused adapter tests

**Required Change Coverage**: all target files

**Maximum Diff Lines**: 1000

**Inline Styles**: forbidden

**Async Mutation**: no

Only the existing preparation-options GET and its explicit refresh/retry are consumed. Opening, staying and returning perform no server mutation and do not reserve an operation.

**Preserved Controls**: Saved experiment navigation, stage navigation, affected-column labels, Guidance, options Retry and the global Power Query editor's normal controls retain their existing behavior. Test: "preserves Prepare Data controls after Stay and Return" asserts their visible state and interaction; "legacy Power Query still previews and applies" asserts normal-mode requests and callbacks.

Reuse existing classes; no stylesheet, backend, contract, harness, authorization, gate, readiness or protected-file edits. Do not edit CanvasContainer, whose forwarding already exists. Preserve the user's existing shell/test changes. Configuration's legacy opening callback, training, snapshot creation, role reconciliation, durable resume, export and preparation POST operations are excluded.

## Proven API Contract

GET /api/ml-studio/v1/drafts/{experiment_id}/preparation?workspace_id={workspace_id}, with encoded current server identities. No body, If-Match or Idempotency-Key. HTTP 200 is exactly {snapshot_id, issues, fixes, preparation_context}. Do not substitute the immutable preparation-assessments response: it has a different shape. preparation_context here is null or the full open operation; it is GET-owned and must not be inferred from PATCH responses.

Copy-ready TypeScript types below describe the implemented options GET. They are reference declarations, not a request to convert the React files to TypeScript.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type ReturnStage = "Data & Goal" | "Prepare Data";

interface RecipeStep { contract_version: "ml_studio_contract_v1"; step_id: string; action_type: string; affected_columns: string[]; parameters: { [key: string]: Json }; }

interface Recipe { contract_version: "ml_studio_contract_v1"; recipe_id: string; workspace_id: string; base_snapshot_id: string; base_recipe_hash: string; recipe_version: number; steps: RecipeStep[]; canonical_recipe_hash: string; created_at: string; created_by: string | null; }

interface OpenPreparation { operation_id: string; experiment_id: string; workspace_id: string; base_draft_revision: number; base_etag: string; snapshot_id: string; workspace_version: number; source_id: string; issue_id: string | null; fix_id: string | null; return_stage: ReturnStage; recipe: Recipe; status: "open"; result: null; }

interface OptionsIssue { issue_id: string; code: "missing_values"; severity: "warning"; field: string; message: string; remediation: string; }

interface OptionsFix { fix_id: string; issue_id: string; action_type: "remove_nulls"; affected_columns: string[]; parameters: { columns: string[] }; support_status: "supported"; explanation: string; }

interface PreparationOptions { snapshot_id: string; issues: OptionsIssue[]; fixes: OptionsFix[]; preparation_context: OpenPreparation | null; }

interface ErrorResponse { error: { code: string; message: string; remediation: string }; }

Dates are server ISO strings; hashes are opaque server SHA-256 strings including their sha256: prefix. Recipe and nested step objects carry contract_version; the plain options/operation dictionaries do not. These types describe this GET's current missing-value scope, not every future issue or preparation operation response.

Errors use ErrorResponse. Applicable cases are 400 invalid_identity/preparation_request_invalid, 404 workspace_not_found/draft_not_found/snapshot_not_found, 409 snapshot_identity_stale or resolver identity/governance conflict, and safe 500 ml_studio_internal_error. The route has no separate permission response; cross-workspace drafts are hidden as 404. Preserve unknown structured codes and show their safe message/remediation. Network failure is local UI error, never a fabricated server response.

## Representative JSON Fixtures

Success: {"snapshot_id":"snapshot-1","issues":[{"issue_id":"issue-1","code":"missing_values","severity":"warning","field":"income","message":"This field contains missing values.","remediation":"Choose a preparation strategy appropriate to this field."}],"fixes":[{"fix_id":"fix-1","issue_id":"issue-1","action_type":"remove_nulls","affected_columns":["income"],"parameters":{"columns":["income"]},"support_status":"supported","explanation":"Remove rows missing this field; this may reduce the sample."}],"preparation_context":null}

Empty: {"snapshot_id":"snapshot-1","issues":[],"fixes":[],"preparation_context":null}

Validation 400: {"error":{"code":"preparation_request_invalid","message":"Save a data snapshot and task before preparing data.","remediation":"Use the documented preparation fields and server identities."}}

Missing identity 400: {"error":{"code":"invalid_identity","message":"workspace_id is required.","remediation":"Select a governed workspace."}}

Absent workspace 404: {"error":{"code":"workspace_not_found","message":"The workspace is unavailable.","remediation":"Select an existing workspace."}}

Hidden/absent draft 404: {"error":{"code":"draft_not_found","message":"The draft is unavailable in this workspace.","remediation":"Select a draft from the current workspace."}}

Absent snapshot 404: {"error":{"code":"snapshot_not_found","message":"The requested dataset snapshot does not exist.","remediation":"Create or select a valid snapshot."}}

Stale identity 409: {"error":{"code":"snapshot_identity_stale","message":"The dataset snapshot no longer matches authoritative server state.","remediation":"Create a new snapshot from the current governed Data Model."}}

Server error 500: {"error":{"code":"ml_studio_internal_error","message":"ML Studio could not complete the request.","remediation":"Retry the request or inspect server health."}}

Open-operation success captured from the real Flask GET in an isolated test workspace: {"fixes":[],"issues":[],"preparation_context":{"base_draft_revision":1,"base_etag":"CVyqw8-hTzQ5FvN8kxlRwRmPpkNpwOoH","experiment_id":"f34f63b1-fd64-4637-a1ce-454942bffcb5","fix_id":null,"issue_id":null,"operation_id":"preparation-2721ede3dc0d49a5b8ab491375969144","recipe":{"base_recipe_hash":"sha256:5743ccc6a77dde2c723d0a101484d873ec04a862a26f9a744bf26ed570576005","base_snapshot_id":"snapshot-c2800d45e1e7481a965805b3f8cd4ccf","canonical_recipe_hash":"sha256:55fb5cb19614e8277f7b8bb7e1bd9bc336e3fa3c921953a3abee8180b2fb241b","contract_version":"ml_studio_contract_v1","created_at":"2026-09-30T02:12:50.225222+00:00","created_by":null,"recipe_id":"recipe-5ef7213f1bfe46958eafd8c961d2a03f","recipe_version":1,"steps":[{"action_type":"remove_columns","affected_columns":["value"],"contract_version":"ml_studio_contract_v1","parameters":{"columns":["value"]},"step_id":"step-9cbcf98a3b77424e8141d1f135cad5c1"}],"workspace_id":"ws_bcffd91d4c804bd5ba6a6acd27c4d9d9"},"result":null,"return_stage":"Prepare Data","snapshot_id":"snapshot-c2800d45e1e7481a965805b3f8cd4ccf","source_id":"src_cb2dd5756b434e988add8d3cb934d79b","status":"open","workspace_id":"ws_bcffd91d4c804bd5ba6a6acd27c4d9d9","workspace_version":1},"snapshot_id":"snapshot-c2800d45e1e7481a965805b3f8cd4ccf"}

Preserve the captured opaque identities/hash in mocks rather than generating lineage in the browser. This state displays the existing operation warning and disables new issue opening; resuming or cancelling that operation is excluded.

## Required UI States

Keep the Prepare Data hierarchy: heading, quality findings, column, explanation and suggested action. Give the issue an accessible opening affordance. Its confirmation identifies the affected column and offers Stay and Open Power Query. Stay, Escape and dismiss return focus to the trigger and make no request.

Loading and missing saved identity disable issue opening. Empty success keeps the honest missing-value-check message and offers no fabricated issue. Error shows safe message/remediation and manual Retry, with no automatic retry loop. A 409 remains visible and blocks opening until explicit successful reconciliation; do not silently create a new snapshot.

Opening is allowed only for a current options snapshot matching activeDraft.snapshot_id and a supported server-issued issue/fix pair. Missing field, pair, gateway, or current identity leaves the user in Prepare Data with an actionable explanation. Repeated Open clicks create one overlay. An open server preparation operation blocks new opening and retains its warning.

The ML Studio overlay shows experiment name/identity, workspace, snapshot, affected column, suggested action and its explanation. Show the selected suggested step without enabling transformation editing, Add/Update/Delete/Move steps, Run Preview, Apply All or proceed-to-training. Hide the transformation ribbon in this mode. Guard runCleaning itself against invocation, not only its buttons. Do not display rows or columns inferred from global cleanedData/fullData/uploadedData; this slice has no draft-bound preview API integration. Explain that preview and applying changes arrive separately.

Provide Return to Prepare Data and close/Escape with the same safe result. Close must clear App's overlay props and invoke the scoped return callback once. Preserve default close behavior for every other entrypoint. Normal global Power Query continues to edit, preview and apply as it does today.

## State Ownership

Server state remains the existing activeDraft, workflow_state and options GET owned by PrepareDataStage. Do not copy the draft or options response into a second persistent store. Reuse the existing read request counter to reject late responses. Return may explicitly refresh options for the same identity, but no draft PATCH or creation is allowed and a refresh failure leaves the experiment open with Retry.

Local state is the selected issue/fix, confirmation, and one ephemeral opening context: experiment_id, workspace_id, snapshot_id, draft_revision, issue_id, fix_id, return_stage="Prepare Data", plus display-only title/field/action/explanation from current records. This is a frontend gateway prop, not a backend operation or persisted recipe. Do not manufacture operation_id, recipe identity/hash, workspace version, receipts, readiness or cancellation evidence.

Keep MLStudioShell mounted and its active stage/draft intact. An experiment/workspace/snapshot/revision change or shell unmount invalidates the confirmation and overlay; revoke stale callbacks and dismiss the old overlay without restoring the old experiment. Return must never overwrite a newer draft or stage. App owns overlay lifetime; the shell owns the identity guard and return destination. Do not change destinations or open the legacy training window.

URL state: unchanged; no new URL, history or deep-link behavior. Async job state: none; no polling, preparation reservation, automatic retry or durable reload promise. Reload discards the ephemeral opening context and uses ordinary saved-draft reopening.

## Acceptance Checklist

- Test "Stay preserves the saved experiment without requests": confirm an issue, choose Stay/Escape, assert same draft/stage and no additional POST/PATCH/DELETE or opening callback.
- Test "Open carries current issue identity and returns to the same experiment": assert exact ephemeral context and suggested pair, one gateway call on repeated clicks, safe close/return, preserved controls and unchanged draft revision.
- Test "invalidates opening on identity change and unmount": switch workspace/experiment/snapshot/revision during confirmation or overlay, resolve a deferred options read/return callback, and assert no stale opening or old experiment restoration.
- Test "opening respects missing, empty, failed, stale and pending options": cover missing identity/field/pair/gateway, empty success, network/400/404/409/500, explicit Retry, and an open operation. Assert no mutation and no implicit retry. Test "late options do not reopen a dismissed choice" checks a deferred read after Stay/close.
- In DataCleaningForm.test.jsx, test "ML Studio opening mode cannot clean global data": assert context labels, absent editing controls, no global-row preview, no axios cleaning request, safe Return/close and normal-mode isolation. Test "legacy Power Query still previews and applies" covers existing response callbacks.
- Inspect App's close bridge in final source evidence. Verify accessible names, keyboard dismissal, restored focus and visible errors. Do not claim browser acceptance.

## Non-Negotiables And Creative Latitude

Antigravity owns only the five listed frontend files. Use reviewable editor operations; never bulk-rewrite source, discard user changes or modify any GEMINI.md. Stop and report a contract/scope mismatch or unexpectedly empty/shrunken source. Choose component structure and concise copy within existing styles while preserving exact data and state boundaries.

## Verification And Stop Point

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `git diff --check`
- `git diff --name-only`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_power_query_opening.md --summary "Stay/Open identity, read-only editor isolation and safe return verified; focused tests and build passed"`

Return exact changed files, command exit results, named test assertions and source lines for opening context, guarded legacy cleaning path, close bridge and identity invalidation. Then stop for Codex review. Do not begin preview/apply/cancel integration or change the active gate.
