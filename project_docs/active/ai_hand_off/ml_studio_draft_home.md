Goal: Let a developer create an incomplete ML Studio experiment and reopen an existing one from a small workspace-scoped experiment home.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`. `tests/test_ml_studio_drafts.py` and `tests/test_ml_studio_api.py` passed the focused draft/API suite (25 tests before the added concurrency case); the concurrency case passed separately. Source truth is `backend/ml_studio/repository.py`, `backend/ml_studio/service.py`, `backend/routes/ml_studio.py`, and `project_docs/active/contracts/ml_studio.md#step-3-draft-api--current-backend-truth`.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/ml_studio/README.md` — Step 3 only

## Scope And Target Files

Edit only `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `MLStudioShell.css`, and `MLStudioShell.test.jsx`. Preserve the user-accepted shell CSS changes already in the worktree. Add a compact experiment-home entry in the existing ML Studio shell, list drafts for the active governed workspace, create an incomplete draft, and reopen one selected draft. When opened, show its server-returned name, Guidance setting, and effective `workflow_state.active_stage` in the existing frame. Do not autosave edits, duplicate, implement later stage behavior, or change backend files. A later handoff will cover save/conflict recovery and another will cover duplication.

**Required Change Coverage**: JSX and focused test; CSS only if needed for the home view.

**Maximum Diff Lines**: 700. **Inline Styles**: forbidden.

## Proven API Contract

- `GET /api/ml-studio/v1/drafts?workspace_id=<activeWorkspace.workspace_id>` returns 200 `{ "drafts": DraftSummary[] }`, stable newest-first, maximum 100. No drafts returns `{ "drafts": [] }`. Missing workspace returns 400 `invalid_identity`; nonexistent workspace returns 404 `workspace_not_found`.
- `POST /api/ml-studio/v1/drafts` with JSON `{ "workspace_id": "<activeWorkspace.workspace_id>" }` returns 201 `{ "draft": ExperimentDraft, "workflow_state": WorkflowState }`. It accepts an incomplete draft. Errors use `{ "error": { "code", "message", "remediation" } }`.
- `GET /api/ml-studio/v1/drafts/<experiment_id>?workspace_id=<activeWorkspace.workspace_id>` returns 200 with the same `draft` and `workflow_state` shape. Missing or cross-workspace identity returns 404 `draft_not_found`.
- Use only the workspace identity already confirmed by `activeWorkspace` and `analysisContext`. On identity change or unmount, ignore stale responses. Do not fabricate a draft or mark a locked stage available.

`DraftSummary` has `experiment_id`, `workspace_id`, `draft_revision`, `name`, `active_stage`, nullable `task_type`, and `updated_at`. `ExperimentDraft` adds `contract_version: "ml_studio_workflow_v1"`, opaque `etag`, `guidance_enabled`, nullable `snapshot_id`, `goal`, `recipe_id`, `recipe_version`, nullable assessment identity/fingerprint, `roles`, and `validation`, `metric`, `candidate`, `resource` objects. `WorkflowState` has `experiment_id`, `draft_revision`, effective `active_stage`, and six ordered `stages`; each stage has `stage`, `state`, `blocker_codes`, and `stale_reason_codes`. Stage state is `locked | available | active | complete | stale`.

Representative empty response: `{ "drafts": [] }`. Representative list response: `{ "drafts": [{ "experiment_id": "e1", "workspace_id": "w1", "draft_revision": 1, "name": "Untitled Experiment", "active_stage": "Data & Goal", "task_type": null, "updated_at": "2026-09-23T12:00:00+00:00" }] }`. Representative error: `{ "error": { "code": "draft_not_found", "message": "The draft is unavailable in this workspace.", "remediation": "Select a draft from the current workspace." } }`.

## Required UI States And Ownership

Show loading, empty with a Create action, list success, actionable error with Retry, create pending with duplicate-submit protection, and reopen pending. Keep the active draft and list as server state; local state is only the current home/frame selection and pending controls. Preserve existing dataset identity and recent-runs behavior. When opening a draft, use the server's effective workflow stage, and retain the returned `etag` for the later save handoff without issuing PATCH now. Guidance toggling in this slice changes presentation only and must not reset form state.

## Acceptance And Return

- A workspace with no drafts shows an honest empty state and creates a server draft.
- Existing drafts list and reopen by exact workspace and experiment identity; name, Guidance, and effective stage reflect the GET response.
- Workspace switches cannot show a prior workspace's draft or late response.
- Loading, error, pending, keyboard, focus, and narrow layout remain usable; current Configure behavior and recent-runs dock still work.
- Only the target frontend files change. Return changed-file list, focused test result, build result, and `git diff --check`; then stop for Codex review.

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`.
