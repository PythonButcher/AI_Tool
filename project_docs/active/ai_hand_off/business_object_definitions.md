Goal: Make the Business Objects panel keep confirmed saves visible and recover from changed source fields or relationships.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: In BusinessObjectsPanel.jsx, loadDefinitions replaces the current list when GET resolves, including when that GET started before handleSubmit added a confirmed save. The save failure branch shows a 409 message but refreshes neither source fields nor relationships. SourceModelCanvas passes no model refresh callback to the panel.

**Expected Contract**: POST 201 owns the newly saved business_object. GET 200 owns the business_objects snapshot at read time. A read started before a confirmed save cannot erase that save. POST 409 carries error.code and error.message, with no fresh model metadata. Refresh choices through the existing canvas workspace, source, and relationship loading flow so the user can correct the draft.

**Regression Test**: `frontend/frontend/src/features/data-model/BusinessObjectsPanel.test.jsx` — `keeps a confirmed save when an older list request resolves last`; defer a list response with an empty snapshot, resolve POST 201 first, then resolve the GET and assert that the newly saved item remains visible exactly once.

**Return Evidence**: Report source lines for list and save ordering, metadata refresh after a conflict, and draft reconciliation. Return the named regression tests, focused test command, build, and whitespace results.

## User Value

A new definition stays visible after Save succeeds. If the source or its relationships change while the form is open, users can refresh their choices and correct the same draft.

## Required Context

- [Active gate](../active_gate/README.md), [execution status](../status/project_execution_status.md), [frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md), and [definition API](../business_objects/README.md#definition-api).

## Scope And Target Files

- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.jsx`
- `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.test.jsx`
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.css` remains in the handoff scope for the existing panel styling.

**Required Change Coverage**: the panel, its canvas integration, and the focused tests.

**Maximum Diff Lines**: 600

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: Create Relationship and Add Source retain their original interactions, and closing Business Objects returns keyboard focus to its entry. Test: keep the existing canvas interaction and focus-return assertions passing.

Keep the existing panel layout, labeled fields, straight checkbox list, and primary Save action. Work on save and refresh behavior in this panel. Keep records, Analytics, backend, and status files outside the implementation.

## Proven Contract And Required Behavior

- Panel list uses GET /api/data-workspaces/<workspace_id>/business-objects and receives a 200 with business_objects. The create form POSTs to the same path and uses the 201 business_object identified by object_id. Keep the server's created_at and object_id ordering. Apply a list refresh without silently dropping an acknowledged save.
- On a 409 reference conflict, show the server's message and provide an explicit way to refresh the model choices while keeping the draft open. Reload member sources and their schemas and workspace relationships through the canvas's existing loading flow. Keep valid selections and the typed display name. Make removed selections visible as needing correction or clear them with a clear explanation. In either case, keep unavailable selections out of a new save request and require a valid key before saving.
- Keep saved-list refresh for uncertain network failures independent from refreshing model choices after a conflict. Scope both to the active workspace and ignore late results after close or workspace changes. Preserve errors and the draft if refresh fails.

## Async Mutation Acceptance

**In-Flight Navigation**: Closing or reopening during a save does not let a pending response change the reopened list. Test: keep the deferred close and reopen assertion passing.

**Concurrent Edits**: Keep form edits and additional submissions disabled while a save is pending. Test: retain the disabled-control and one-request checks and add the named regression for a late list read after a successful save.

**Failure Retry**: A failed save leaves the draft and offers a list refresh after an uncertain network result. Test: keep the network failure assertion for preserved input, list refresh, and a single explicit retry.

**Conflict Or Duplicate**: A 409 keeps the draft open, shows the server message, and lets the user refresh the model and replace invalid choices before a retry. Test: return a 409 for a removed key, refresh with a schema containing a replacement, then verify the next POST uses the replacement and no removed relationship IDs.

**Identity And Unmount**: A late save or model read from another workspace cannot change the active draft or choices. Test: preserve the workspace-switch test and prove that a deferred model refresh cannot apply its old choices after switching workspace.

## Verification And Stop Point

- Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand BusinessObjectsPanel.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`.
- Return through `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff business_object_definitions.md --summary "Save and model refresh verification"` with the actual evidence in the summary. Report exact changed files, named test results, and source lines, then stop for Codex review.
