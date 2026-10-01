Goal: Invalidate the ML Studio Power Query overlay and its return callback when the saved draft revision changes, and prove the lifecycle with the real editor.

REPAIR REQUIRED

## User Value

Open Power Query stays open until the user returns or its experiment context changes. Returning keeps the same saved experiment and Prepare Data stage.

## Repair Blocker

**Observed Source**: PrepareDataStage's identityKey in MLStudioShell.jsx line 1715 includes workspace/version, experiment and snapshot but omits draft_revision. Its overlayIdentityRef and onClose guard therefore remain valid after a revision-only change. The gateway callback stabilization addresses callback churn; do not undo it. The new parent regression renders a placeholder div rather than DataCleaningForm and never exercises Return.

**Expected Contract**: The opening context carries draft_revision. A workspace/experiment/snapshot/revision change must dismiss its owned overlay and revoke captured callbacks. Ordinary parent rerenders preserve the overlay. The options GET owns preparation_context; PATCH responses omit it and cannot overwrite that GET-owned state. No preparation operation or draft write is introduced by opening/returning.

**Regression Test**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` — `Power Query invalidates on draft revision change`; mount a stateful App-equivalent parent with the real read-only DataCleaningForm, open it, change only the saved draft revision, invoke its captured return callback, and assert the overlay closes with no additional old-context GET or draft/stage restoration.

**Return Evidence**: Return the named revision regression result, focused suite and build exit results, and source lines proving revision-aware identity and revoked callbacks. The parent regression must render DataCleaningForm, click Return, assert one close and preserved controls, and retain ordinary-rerender coverage. Use the server-issued remove_nulls fixtures rather than invented fill_missing/idle options.

## Readiness And Required Context

**Frontend Readiness**: `frontend_repair_only`

Read the active gate, execution status, authorization record, frontend guardrail, and Draft Preparation Operations section in `project_docs/active/contracts/ml_studio.md`. Backend options GET is ready. No backend change is required.

## Scope And Target Files

- `frontend/frontend/src/App.jsx` — preserve the stable gateway and close bridge; inspect for regression.
- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` — separate read refresh and overlay lifetime from incidental callback changes.
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` — parent-integrated opening lifecycle regression.

**Required Change Coverage**: only MLStudioShell.jsx and MLStudioShell.test.jsx; App.jsx is inspection-only

**Maximum Diff Lines**: 450

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Stay/Open, Return to Prepare Data, stage navigation, Guidance, options Retry and normal global Power Query retain their behavior. Test: the parent-integrated regression asserts opening survives rerender and Return leaves Prepare Data controls usable without changing draft identity or revision.

## Proven Boundary

Use the existing GET /api/ml-studio/v1/drafts/{experiment_id}/preparation?workspace_id={workspace_id}, without a body or mutation headers. Its 200 shape is {snapshot_id, issues, fixes, preparation_context}; its safe failures contain error.code, error.message and error.remediation. Preserve existing options error/Retry rendering. No new API, preparation reservation, snapshot or draft write is authorized.

Server state remains activeDraft/workflow_state and the options GET. Local state remains confirmation and ephemeral opening context. No URL, polling or persisted-return changes.

Ordinary parent renders and opening/closing state updates must not invalidate confirmation or trigger the identity cleanup. Invalidate on actual workspace/experiment/snapshot/revision change or unmount. Cleanup must dismiss only its owned ML Studio overlay, not an unrelated editor. Return callbacks must use current identity/liveness rather than values captured by their own stale closure.

## Acceptance

- The named revision regression changes only draft_revision and proves owned-overlay dismissal and revoked late callbacks. The stateful parent renders the real editor, whose Open remains visible through unrelated rerenders.
- Count options GET and cleanup calls: no callback-driven refetch/close cycle occurs.
- Return clears the overlay once, preserves the saved experiment and stage, and leaves current controls usable. Normal editor opening/closing remains unchanged.
- Actual identity change/unmount dismisses the owned overlay. Invoke a captured late return callback and resolve a deferred read after invalidation; neither may restore the old experiment or request old-identity options.
- Keep the editor read-only and preserve current legacy cleaning guards. No POST/PATCH/DELETE is introduced.

## Non-Negotiables And Creative Latitude

Repair only this opening lifecycle and its tests. Do not modify the cleaning editor, backend, contracts, status, gate, authorization, stylesheet, CanvasContainer or any GEMINI.md. Preserve existing work. Use reviewable edits; stop on unexpectedly empty or shrunken source. Component structure may vary while maintaining the state boundary.

## Verification And Stop Point

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `git diff --check`
- `git diff --name-only`
- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_power_query_opening.md --summary "Gateway lifecycle regression, identity invalidation, focused tests and build verified"`

Return exact changed files, command results, the named regression assertion and final source lines. Stop for Codex review; do not begin preview/apply/cancel integration or claim browser acceptance.
