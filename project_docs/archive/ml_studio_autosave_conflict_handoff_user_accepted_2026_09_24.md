Archived handoff — the user accepted this slice on 2026-09-24 and directed the project to the next step. Source review had found unresolved in-flight navigation and automatic retry behavior; acceptance was a user override, not verification that those cases work.

Goal: Save the open ML Studio draft’s name, Guidance setting, and permitted stage selection, with visible save status and recoverable revision conflicts.

REPAIR REQUIRED

## Repair Blocker

In `MLStudioShell.jsx`, `flushSave` returns success when `isSavingRef.current` is true (line 239). `handleGoHome` checks only queued edits (lines 363–371), so Home can leave while a PATCH is in flight and cannot keep the developer on the draft if that request fails. The `finally` block (lines 287–293) schedules another PATCH whenever edits remain queued, including after a 409 conflict or network failure; this bypasses the required deliberate conflict recovery and explicit retry.

## Required Repair

- Treat a request already in flight as pending, never as a successful flush. Home and permitted stage navigation must wait for that request and any newer queued edit to settle; a failed request keeps the draft open, local edits intact, and the error visible.
- After HTTP 409 or a network or server failure, stop all save timers and automatic PATCH dispatch. Keep unsaved edits for explicit Retry Save after a non-conflict failure. On conflict, block Retry Save until the developer deliberately reloads the server draft.
- Add the deferred-response tests in the Acceptance And Return section. Preserve the other handoff behavior.

Change only the three target frontend files below. Run the focused shell test, frontend build, and `git diff --check`; return exact results for Codex review.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`. The PATCH route, service, and transactional repository are implemented in `backend/routes/ml_studio.py`, `backend/ml_studio/service.py`, and `backend/ml_studio/repository.py`. The focused `tests.test_ml_studio_drafts` and `tests.test_ml_studio_api` suites passed 26 tests with the bundled Python dependencies. They prove revision advance, new etag, cross-workspace exclusion, and no overwrite after a stale-etag 409. Use `project_docs/active/contracts/ml_studio.md#step-3-draft-api--current-backend-truth` as contract truth.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/ml_studio/README.md` — Step 3 save and resume
- `project_docs/active/contracts/ml_studio.md` — current draft API

## Scope And Target Files

Change only `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.css`, and `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`. This slice adds an editable experiment name in the open draft frame; persists name and Guidance changes; and saves navigation only to a server-available stage. Keep the draft home, Configure form state, recent-runs dock, and accepted shell styling intact. Do not connect other draft fields, add duplication, issue recipe or run changes, or edit backend or documentation.

**Required Change Coverage**: JSX and focused test; CSS only if needed.

**Maximum Diff Lines**: 750

**Inline Styles**: forbidden.

**Async Mutation**: yes

**Preserved Controls**: Keep the existing Guidance checkbox visible and operable in an open draft, including after rename, save error, and conflict; keep Configure and the run dock usable. Test: assert the Guidance checkbox remains visible and toggles after those state transitions, and Configure form values survive.

## Proven API Contract

- `PATCH /api/ml-studio/v1/drafts/<experiment_id>?workspace_id=<activeWorkspace.workspace_id>` with `Content-Type: application/json` and `If-Match: <raw opaque draft.etag>`; no quotes around the etag. Send only changed editable keys from `{ name: string, guidance_enabled: boolean, active_stage: string }`. Never send `workspace_id` in the body or server-owned fields. `name` is at most 500 characters. The backend permits `active_stage` only when its current workflow prerequisites are met; now only `Data & Goal`, and `Prepare Data` when both snapshot and task exist, can be available.
- HTTP 200 returns `{ draft: ExperimentDraft, workflow_state: WorkflowState }`. Replace the server snapshot, `draft_revision`, `etag`, `updated_at`, and effective `workflow_state.active_stage` from this response. Refresh the home list after a successful rename when appropriate.
- A missing or stale etag returns HTTP 409 `{ error: { code: 'draft_revision_conflict', message: string, remediation: string } }`; storage is unchanged. A missing or cross-workspace draft returns 404 `draft_not_found`; missing workspace returns 400 `invalid_identity`; invalid edits return 400 `draft_invalid` or 409 `draft_stage_locked`; unexpected failures use the same safe error envelope. Use the returned message and remediation, without assuming all failures are conflicts.
- `GET /api/ml-studio/v1/drafts/<experiment_id>?workspace_id=<activeWorkspace.workspace_id>` returns the current `{ draft, workflow_state }` for explicit reload after conflict. Keep local unsaved values visible until the developer chooses Reload saved version. A deliberate reload may replace them; do not automatically retry with a newer etag or overwrite another revision.

```ts
type SaveState = 'saved' | 'saving' | 'save_error' | 'conflict';
type DraftEdit = Partial<{ name: string; guidance_enabled: boolean; active_stage: string }>;
type DraftError = { error: { code: string; message: string; remediation: string } };
type WorkflowStage = { stage: string; state: 'locked' | 'available' | 'active' | 'complete' | 'stale'; blocker_codes: string[]; stale_reason_codes: string[] };
type WorkflowState = { experiment_id: string; draft_revision: number; active_stage: string; stages: WorkflowStage[] };
type SaveResponse = { draft: ExperimentDraft; workflow_state: WorkflowState };
```

`ExperimentDraft` fields needed here: `experiment_id`, `workspace_id`, `draft_revision`, opaque `etag`, `name`, `guidance_enabled`, `active_stage`, and `updated_at`. Preserve the rest of the server object without fabricating fields.

## Representative Fixtures

- Success: request `{ "name": "Forecast idea" }` with `If-Match: etag-v1`; response `{ "draft": { "experiment_id": "e1", "workspace_id": "w1", "draft_revision": 2, "etag": "etag-v2", "name": "Forecast idea", "guidance_enabled": true, "active_stage": "Data & Goal", "updated_at": "2026-09-24T12:00:00+00:00" }, "workflow_state": { "experiment_id": "e1", "draft_revision": 2, "active_stage": "Data & Goal", "stages": [{ "stage": "Data & Goal", "state": "active", "blocker_codes": [], "stale_reason_codes": [] }] } }`. Test fixtures may include the remaining draft fields and all six stages.
- Conflict: HTTP 409 `{ "error": { "code": "draft_revision_conflict", "message": "The draft changed since it was loaded.", "remediation": "Reload or duplicate the draft to preserve local edits." } }`.
- Not found: HTTP 404 `{ "error": { "code": "draft_not_found", "message": "The draft is unavailable in this workspace.", "remediation": "Select a draft from the current workspace." } }`.

## Required UI And State Behavior

- Show a labeled name editor only for an open draft. Blank names and values over 500 characters stay local with visible validation; never submit them. Guidance remains one shared control panel and toggling it must not reset form state.
- Debounce ordinary edits and show `saving`, `saved`, `save_error`, or `conflict` near the draft name. Serialize requests using the latest returned etag. Queue a newer edit made during a pending save; never let an older response erase it. A non-conflict save error stays visible until the developer explicitly retries with the same local values and current etag.
- Home navigation and a permitted stage change must wait for every queued or in-flight save, including an edit made during an in-flight request. Do not navigate on an optimistic `true` result from an already-running save. If any save fails, remain on the draft and show retry or conflict recovery. Do not permit a locked stage to be saved or displayed as effective. Use server `workflow_state` for stage availability and the effective stage after save.
- On conflict, keep local edits visible and block further PATCH requests. Offer Reload saved version with an explicit warning that it replaces local edits; load the same draft and workspace with GET only after that choice. Duplication is a separate handoff.
- On workspace identity change, draft switch, or unmount, cancel pending timers and ignore stale responses. Never send an old workspace etag or local edits to a new workspace.
- Keep errors actionable and announced, controls keyboard operable, pending navigation protected, and narrow layout usable.

## Async Mutation Acceptance

**In-Flight Navigation**: Home and permitted stage navigation wait for an unresolved PATCH and any queued edit; failure leaves the draft open. Test: defer PATCH, click Home, reject PATCH, then assert the draft and local value remain with Retry Save visible.

**Concurrent Edits**: A second edit waits for the first PATCH result and uses its returned etag, while the latest local value stays visible. Test: defer first PATCH, edit again, resolve with a new etag, then assert the second PATCH uses that etag and latest value.

**Failure Retry**: Network or server failure retains unsaved edits and stops timers until the developer selects Retry Save. Test: fail PATCH, advance timers, assert no second PATCH, click Retry Save, then assert one new PATCH with the same local value.

**Conflict Or Duplicate**: HTTP 409 blocks further PATCH and keeps local edits until deliberate reload; no automatic overwrite or retry occurs. Test: return 409, advance timers, assert no second PATCH and conflict action visible.

**Identity And Unmount**: Workspace change, draft switch, and unmount invalidate timers and late responses. Test: defer PATCH, change workspace or unmount, resolve PATCH, then assert no stale draft update or follow-up request.

## Acceptance And Return

- Name and Guidance edits survive reopening; only server-available stage navigation persists.
- Rapid edits serialize with successive etags and retain the newest local value.
- Network failure keeps unsaved edits and offers retry; 409 preserves local edits and offers deliberate reload without silent overwrite.
- Workspace switch and unmount cannot apply or send an old draft save.
- Existing draft-home, Configure, and recent-runs tests still pass.
- Use deferred PATCH promises and controlled timers for these assertions: (1) click Home during a pending PATCH, reject it, and prove Home stays on the draft with the unsaved value and Retry Save; (2) return HTTP 409, advance timers, and prove no second PATCH occurs while local edits and the conflict action remain visible; (3) return a network error, advance timers, and prove no second PATCH occurs until Retry Save is clicked; (4) edit again during a pending PATCH, resolve the first response with a new etag, and prove the second PATCH uses that etag and the latest value.

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Return the changed-file list and exact command outcomes, then stop for Codex review. Do not claim browser acceptance.
