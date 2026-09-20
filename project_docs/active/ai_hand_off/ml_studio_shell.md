# ML Studio Start Run — Antigravity Repair Handoff

REPAIR REQUIRED

Goal: Add one polished Start Run action to the ready ML Studio assessment state and refresh the existing Run Dock from the server after submission.

## Repair Blocker

The returned implementation is not present. `MLStudioShell.jsx`, `MLStudioShell.css`, and `MLStudioShell.test.jsx` exactly match `HEAD`, so there is no durable frontend diff to review. The retry must produce reviewable changes in all three target files and must pass the governed return guard.

## Readiness Evidence

**Frontend Readiness**: `frontend_repair_only`

`POST /api/ml-studio/v1/runs` and `GET /api/ml-studio/v1/runs?limit=20` are implemented and covered by `tests/test_ml_studio_execution.py` and `tests/test_ml_studio_api.py`. The existing shell already retains `snapshotData`, `experimentData`, an assessment-ready state, and a guarded run-list refresh callback.

## Scope And Integrity

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`

**Required Change Coverage**: all target files

**Inline Styles**: forbidden

Implement only the Start Run action, its local pending/error state, and the immediate server refresh. Do not add polling, cancellation, evidence, comparison, new components, backend changes, project-doc changes, or edits outside the three targets.

Use reviewable editor operations only. Never use Python, PowerShell, shell redirection, bulk rewrites, `git checkout`, `git restore`, or reset to edit or recover source. If a target becomes empty or unexpectedly smaller, stop immediately and return the incident without attempting reconstruction.

## Proven API Contract

Submit `POST /api/ml-studio/v1/runs` with `Content-Type: application/json` and one `Idempotency-Key` generated when the user begins the attempt. Reuse that key only when retrying the same failed attempt.

The exact request is `{ "experiment_id": experimentData.experiment_id, "specification_version": experimentData.specification_version, "snapshot_id": snapshotData.snapshot_id, "parameters": {}, "environment": { "client": "ai_tool_web" }, "code_revision": revision }`, where `revision` is `process.env.REACT_APP_GIT_SHA` only when its length is 7–64, otherwise `web-ui-unknown`.

Success is `201 { run: RunRecord, created: true }` or idempotent `200 { run: RunRecord, created: false }`. Public failure is `{ error: { code, message, remediation } }`. After success, await the existing parent run refresh before clearing pending state. Do not infer or synthesize run state locally.

Representative queued response: `{ "run": { "run_id": "run-01", "experiment_id": "exp-01", "specification_version": 1, "snapshot_id": "snapshot-01", "status": "queued", "progress_stage": null, "submitted_at": "2026-09-19T18:00:00+00:00", "started_at": null, "finished_at": null, "updated_at": "2026-09-19T18:00:00+00:00", "warnings": [], "run_specification": {} }, "created": true }`.

Representative conflict: `{ "error": { "code": "snapshot_identity_stale", "message": "The dataset snapshot no longer matches authoritative server state.", "remediation": "Create a new snapshot from the current governed Data Model." } }`.

## Required UI Behavior

- Place a clear `Start Run` button inside the existing successful readiness card.
- The action exists only while the exact assessment, snapshot, and experiment remain ready and current.
- While submitting, disable the action and show `Starting Run…` with an accessible busy state.
- On failure, show the safe server message and remediation in an announced error treatment next to the action; keep the same idempotency key for retry.
- On success, await the Run Dock refresh, clear the attempt state, and leave lifecycle truth to the refreshed server record.
- Style the action and error treatment in `MLStudioShell.css` using the existing visual language, tokens, focus treatment, spacing, and light/dark behavior. No inline style object is allowed.

## Acceptance

- Focused tests prove the exact request, stable retry key, duplicate-submit protection, safe error rendering, awaited refresh, and stale identity/unmount protection.
- The CSS change provides an intentional default, hover, focus-visible, disabled/pending, and error treatment without unrelated restyling.
- The existing preparation and Run Dock tests continue to pass.
- The governed return command accepts the durable diff.

## Verification And Stop Point

- `npm --prefix frontend/frontend test -- --watchAll=false MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff ml_studio_shell.md --summary "Start Run repair implemented and verified"`

Return the exact changed files and command results, then stop for Codex review. Do not begin polling, cancellation, or evidence UI.
