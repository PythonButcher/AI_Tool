Superseded Prepare Data options handoff, retained as historical context after the first frontend return. The active repair handoff replaces it.

Goal: Replace the Prepare Data placeholder with a read-only, draft-bound quality view from the implemented preparation options endpoint.

## User Value

Prepare Data will show which columns have missing values, explain what each available fix would do, and say if preparation is already in progress. You can inspect these findings; applying a fix comes later.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

`backend/routes/ml_studio.py` serves `GET /api/ml-studio/v1/drafts/{experiment_id}/preparation?workspace_id={workspace_id}`. `DraftPreparationService.options` requires a saved snapshot and task, checks that the snapshot is current, and returns `{snapshot_id, issues, fixes, preparation_context}`. `tests/test_ml_studio_preparation.py` covers empty options, server-issued issue/fix pairs, and open-operation context. `MLStudioShell.jsx` still renders Prepare Data through `UnconnectedStage`. This is one read-only UI boundary; starting, previewing, applying, or canceling an operation is a later handoff.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `backend/ml_studio/preparation.py` — `options`
- `backend/routes/ml_studio.py` — `draft_preparation`
- `tests/test_ml_studio_preparation.py` — options cases

## Scope And Target Files

Render the saved draft's quality issues and server-supported fixes in Prepare Data. Use the current draft experiment/workspace identity. Show loading, empty, issue, open-operation, and safe error/retry states. Display the issue message/remediation and fix explanation; do not imply that removing rows is automatically the right choice. An empty issue list means only that this bounded check found no missing-value issues, not that the data is ready for training. Keep raw IDs in details rather than primary copy.

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`

**Required Change Coverage**: only the named required subset: MLStudioShell.jsx and MLStudioShell.test.jsx.

**Maximum Diff Lines**: 600

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Keep Home, experiment name, guidance toggle, save status/retry/reload, stage navigation, Data & Goal, Configure, and run dock functional across loading, error, and success states. Test: `prepare-data-controls-survive` asserts these controls remain available after options load and retry.

No preparation POST, Power Query callback, draft PATCH, backend/contract change, training readiness claim, or general autosave change. Do not alter the accepted Data & Goal behavior. A request that needs any of those changes is a scope mismatch to return to Codex.

## Proven API Contract

`GET /api/ml-studio/v1/drafts/{experiment_id}/preparation?workspace_id={workspace_id}` has no body or custom headers. 200 returns exactly `{snapshot_id: string, issues: Issue[], fixes: Fix[], preparation_context: Preparation | null}`. `Issue` is `{issue_id: string, code: "missing_values", severity: "warning", field: string, message: string, remediation: string}`. `Fix` is `{fix_id: string, issue_id: string, action_type: "remove_nulls", affected_columns: string[], parameters: {columns: string[]}, support_status: "supported", explanation: string}`. `Preparation` is the server operation with `operation_id`, `experiment_id`, `workspace_id`, `base_draft_revision`, `base_etag`, `snapshot_id`, `workspace_version`, `source_id`, nullable `issue_id`/`fix_id`, `return_stage`, `recipe`, `status`, and nullable `result`; this slice only reads `status` and `operation_id`.

Errors use `{error: {code, message, remediation}}`. Missing saved snapshot/task is 400 `preparation_request_invalid`; stale snapshot is a 409 with safe remediation; a missing or cross-workspace draft is 404. Show the server's safe message/remediation and Retry. No route-level 403 contract is defined here.

`preparation_context` belongs to this GET response (and draft GET), not a draft PATCH response. Key options by workspace ID/version, experiment ID, and saved snapshot ID. Ignore late responses after any key change or unmount. Do not use the shell's accepted Data & Goal context state as proof that preparation is closed; this endpoint is the source for this view.

## Representative JSON Fixtures

Empty 200: `{"snapshot_id":"snapshot-1","issues":[],"fixes":[],"preparation_context":null}`.

Issue 200: `{"snapshot_id":"snapshot-1","issues":[{"issue_id":"issue-missing_values-610f2ebef51d","code":"missing_values","severity":"warning","field":"value","message":"This field contains missing values.","remediation":"Choose a preparation strategy appropriate to this field."}],"fixes":[{"fix_id":"fix-remove_nulls-ddf5c3b220d6","issue_id":"issue-missing_values-610f2ebef51d","action_type":"remove_nulls","affected_columns":["value"],"parameters":{"columns":["value"]},"support_status":"supported","explanation":"Remove rows missing this field; this may reduce the sample."}],"preparation_context":null}`.

Open 200: `{"snapshot_id":"snapshot-1","issues":[],"fixes":[],"preparation_context":{"operation_id":"preparation-1","experiment_id":"exp-1","workspace_id":"ws-1","base_draft_revision":2,"base_etag":"etag-2","snapshot_id":"snapshot-1","workspace_version":1,"source_id":"source-1","issue_id":null,"fix_id":null,"return_stage":"Prepare Data","recipe":{"contract_version":"ml_studio_contract_v1","recipe_id":"recipe-1","workspace_id":"ws-1","base_snapshot_id":"snapshot-1","base_recipe_hash":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","recipe_version":1,"steps":[],"canonical_recipe_hash":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","created_at":"2026-09-27T12:00:00+00:00","created_by":null},"status":"open","result":null}}`.

Missing prerequisite 400: `{"error":{"code":"preparation_request_invalid","message":"Save a data snapshot and task before preparing data.","remediation":"Use the documented preparation fields and server identities."}}`.

## State Ownership And Acceptance

Server owns the saved snapshot, quality issues/fixes, and operation context. Local UI owns only fetch/loading/error state and disclosure. Do not derive quality findings from browser rows, `uploadedData`, `fullData`, or `cleanedData`. If `preparation_context.status` is `open`, show a pending-operation explanation without offering a new start or pretending the operation finished.

- `prepare-data-options-render`: issue and fix text comes from the exact GET fixture; empty options say this bounded check found no missing-value issues, without a readiness claim.
- `prepare-data-options-open`: the open fixture shows a pending-operation explanation without offering a new start or marking it finished.
- `prepare-data-options-identity`: a deferred old GET response after workspace/version, experiment, or snapshot change cannot replace the current view.
- `prepare-data-options-error`: safe server error/remediation and explicit Retry render without hiding the shell.
- `prepare-data-controls-survive`: preserved shell controls remain visible and interactive after load and retry.

## Verification And Stop Point

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, `git diff --check`, and `git diff --name-only`. Then run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_prepare_data_options.md --summary "Prepare Data options view; report five named assertions and exact test/build results"`.

Use reviewable edits and leave all `GEMINI.md` files untouched. Return the changed-file list, named assertion results, exact commands/exits, and any scope mismatch. Stop for Codex review; do not begin the preparation mutation or Power Query return flow.
