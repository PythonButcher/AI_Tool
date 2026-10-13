Codex-owned repair context retained after the user's direct request to fix the Data & Goal blocker in this session. This is not an active agent handoff.

Goal: Make Save and continue leave Data & Goal only after the current draft is saved successfully.

## User Value

After editing the experiment name or goal, Save and continue should take you to Prepare Data without the “draft changed” error. If another session really changed the draft, your edits should stay visible with a clear recovery choice.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` passes `onSaveRequest={handleExplicitStageSave}` to `DataGoalStage`, but the child ignores it, PATCHes directly with `activeDraft.etag`, and calls the undefined `onSaveSuccess`. A header autosave can rotate the ETag before that direct PATCH. The user reproduced the resulting 409 “The draft changed since it was loaded” while clicking Save and continue. `data-goal-save-order` and `data-goal-navigation-waits` in the focused test file are `expect(true)` placeholders.

**Expected Contract**: `POST /api/ml-studio/v1/drafts` and `GET /drafts/{experiment_id}` return `draft.etag`. Each `PATCH /drafts/{experiment_id}?workspace_id={workspace_id}` requires the current opaque ETag in raw `If-Match` and returns a new `draft.etag` plus `workflow_state`; a stale tag returns 409 `draft_revision_conflict` without saving. Route the stage action through one parent-owned save path, wait for any header save to finish, use its returned ETag, and apply the stage response before advancing. Preserve a real 409 as a conflict; never silently overwrite or auto-retry it.

**Regression Test**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` — `data-goal-save-and-continue-after-header-autosave`; use a real-looking draft with `etag-1`, defer the header PATCH, return `etag-2`, then click Save and continue. Assert no stage PATCH precedes the header response, the stage PATCH sends `If-Match: etag-2`, and Prepare Data becomes active only after a successful stage response. Do not use `expect(true)` placeholders.

**Return Evidence**: Report the named regression result, the focused shell suite and production build exits, and source lines showing the single stage callback, ETag handoff, and response-driven navigation.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/contracts/ml_studio.md` — Step 3 Draft API
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `backend/ml_studio/repository.py` — `update_draft` conditional ETag behavior
- `tests/test_ml_studio_drafts.py` — draft revision conflict

## Scope And Target Files

Repair only Data & Goal explicit save sequencing and the tests that prove it. Keep goal/task edits on failure, keep the saved snapshot ID for explicit retry, and use server workflow for stage activation. Preserve the existing read-only Prepare Data options view; its separate column-label polish is deferred. Do not implement preparation mutations, Power Query return, backend changes, or broad autosave redesign.

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css` (only if an existing pending state needs styling)

**Required Change Coverage**: only the named required subset: MLStudioShell.jsx and MLStudioShell.test.jsx; CSS is optional.

**Maximum Diff Lines**: 700

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: Home, experiment name, guidance, save feedback/reload, stage navigation, Data & Goal, Prepare Data options, Configure, and run dock remain usable after success or failure. Test: `data-goal-controls-survive` checks these controls after the stage response.

## Async Mutation Acceptance

**In-Flight Navigation**: Home and stage exit stay blocked while the stage PATCH is unresolved; Prepare Data appears only after success. Test: replace the `data-goal-navigation-waits` placeholder with a deferred PATCH assertion that Home cannot leave and no optimistic stage activation occurs.

**Concurrent Edits**: A pending header PATCH finishes first and supplies the next ETag; later local goal text is not reset by an older response. Test: replace the `data-goal-save-order` placeholder with request-order, `If-Match`, and local-text assertions.

**Failure Retry**: A failed stage PATCH keeps task/goal and the prepared snapshot; there is no timer retry. Test: `data-goal-explicit-retry` checks request count after timers advance and explicit Retry uses the same snapshot with the current ETag.

**Conflict Or Duplicate**: Duplicate clicks cause one stage PATCH; a true 409 keeps local fields and offers reload/duplicate without unlocking Prepare Data. Test: `data-goal-conflict-and-duplicate` checks one request, local fields, and unchanged workflow.

**Identity And Unmount**: An old save response after workspace/version/experiment change or unmount cannot replace the current draft or trigger another PATCH. Test: `data-goal-stale-response` resolves a deferred response after identity change and checks no stale update.

## Verification And Stop Point

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, `git diff --check`, and `git diff --name-only`. Then run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_data_goal_save_repair.md --summary "Data & Goal save conflict repaired; report named race, retry, conflict, and navigation assertions plus test/build exits"`.

Use reviewable edits and leave every `GEMINI.md` file untouched. Return exact changed files, command exits, the named assertions, and any contract mismatch; then stop for Codex review.
