Goal: Let a developer duplicate a saved ML Studio draft from its current workspace experiment list without copying completed work.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`. `backend/routes/ml_studio.py:218`, `backend/ml_studio/service.py:401`, and `backend/ml_studio/repository.py:363` implement workspace-scoped duplication. The focused draft repository and API suites passed 26 tests; `tests/test_ml_studio_drafts.py:32` and `tests/test_ml_studio_api.py:124` cover new identity, revision 1, reset stage, and no copied assessment. Source and contract truth: `project_docs/active/contracts/ml_studio.md#step-3-draft-api--current-backend-truth`.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/ml_studio/README.md` — Step 3
- `project_docs/active/contracts/ml_studio.md` — current draft API

## Scope And Target Files

Edit only `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.css`, and `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`. Add a Duplicate action to each draft row on Experiment Home. After success, refresh the current-workspace list and show the returned copy as a separate resumable draft. Keep the developer on Home; Open remains the deliberate way to enter the copy. Do not implement another editor, autosave repair, later stages, backend changes, or project documentation edits.

**Required Change Coverage**: JSX and focused test; CSS only if needed.

**Maximum Diff Lines**: 1000

**Inline Styles**: forbidden.

**Async Mutation**: yes

**Preserved Controls**: Keep Create and Open usable on Home, the Guidance checkbox visible and operable after opening a draft, Configure form state, and the recent-runs dock. Test: assert these controls still render and operate after a duplicate succeeds or fails.

## Proven API Contract

- `POST /api/ml-studio/v1/drafts/<experiment_id>/duplicate?workspace_id=<activeWorkspace.workspace_id>` has no request body and needs no ETag. Use only the governed workspace identity shared by `activeWorkspace` and `analysisContext`; never infer a workspace from the selected row alone.
- HTTP 201 returns `{ draft: ExperimentDraft, workflow_state: WorkflowState }`. The server gives the copy a new `experiment_id`, `draft_revision: 1`, a new opaque `etag`, a name prefixed with `Copy of `, and `active_stage: "Data & Goal"`. Editable settings and lineage references are copied. Assessment, run, completion, and candidate selection evidence are not copied. Show only server-returned values; do not clone client state.
- The public error envelope is `{ error: { code, message, remediation } }`. Missing workspace is 400 `invalid_identity`; nonexistent workspace is 404 `workspace_not_found`; missing or cross-workspace source draft is 404 `draft_not_found`. Other failures display the returned safe message and remediation with an explicit Retry action.
- `GET /api/ml-studio/v1/drafts?workspace_id=<activeWorkspace.workspace_id>` returns `{ drafts: DraftSummary[] }` for refreshing after duplication. A draft summary includes `experiment_id`, `workspace_id`, `draft_revision`, `name`, `active_stage`, nullable `task_type`, and `updated_at`.

## Representative Fixtures

- Success: HTTP 201 `{ "draft": { "experiment_id": "copy-2", "workspace_id": "w1", "draft_revision": 1, "etag": "new-etag", "name": "Copy of Model idea", "guidance_enabled": true, "active_stage": "Data & Goal", "snapshot_id": null, "task_type": null, "goal": null, "latest_assessment_id": null, "latest_assessment_fingerprint": null }, "workflow_state": { "experiment_id": "copy-2", "draft_revision": 1, "active_stage": "Data & Goal", "stages": [{ "stage": "Data & Goal", "state": "active", "blocker_codes": [], "stale_reason_codes": [] }] } }`. Focused test fixtures may fill remaining draft fields and stage records from the backend contract.
- Error: HTTP 404 `{ "error": { "code": "draft_not_found", "message": "The draft is unavailable in this workspace.", "remediation": "Select a draft from the current workspace." } }`.
- Refreshed list: `{ "drafts": [{ "experiment_id": "copy-2", "workspace_id": "w1", "draft_revision": 1, "name": "Copy of Model idea", "active_stage": "Data & Goal", "task_type": null, "updated_at": "2026-09-24T12:00:00+00:00" }] }`.

## Required UI And State Behavior

Show Duplicate beside Open for each row with an accessible name that identifies the source draft. While its POST is pending, prevent repeated Duplicate submissions for that row and keep the original visible. On success, refresh the list and make the copy distinguishable from the source. On failure, keep the original list and show safe error text plus a retry for that row. Neither success nor failure may silently open another draft.

## Async Mutation Acceptance

**In-Flight Navigation**: A pending duplicate does not disappear or open a different draft through another list action. Test: defer POST, try Open and Duplicate, then assert one POST and unchanged current view until the response settles.

**Concurrent Edits**: Home has no editable draft fields; a duplicate uses the saved server draft and blocks competing list actions while pending. Test: trigger a second row action during deferred POST and assert no second mutation or unintended open.

**Failure Retry**: A failed POST leaves the source row and list intact and waits for an explicit Retry; no timer retries it. Test: return a network or server error, advance timers, assert one POST and visible error, then click Retry and assert exactly one new POST.

**Conflict Or Duplicate**: Repeated activation of Duplicate creates at most one copy per pending action; the returned new identity and revision are shown only after server success. Test: double click during deferred POST, resolve once, then assert one POST, a new row, and no fabricated copied completion.

**Identity And Unmount**: Workspace change or unmount invalidates a pending duplicate response and prevents an old-workspace refresh. Test: defer POST, change workspace or unmount, resolve, then assert no old copy appears and no old-workspace list request follows.

## Acceptance And Return

- Duplicate calls only the exact workspace-scoped endpoint and refreshes the current list after success.
- A copy has its own server identity, revision 1, reset stage, and no invented completed status.
- Pending, failure, retry, workspace switch, and preserved controls match the named tests above.

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Return the changed-file list and exact command outcomes, then stop for Codex review. The user owns browser acceptance.
