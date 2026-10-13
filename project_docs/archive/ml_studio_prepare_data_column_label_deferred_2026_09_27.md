Deferred Prepare Data column-label repair. The user-reported Data & Goal save conflict takes priority; this file is not an active assignment.

Goal: Show the affected column for every missing-value finding in Prepare Data.

## User Value

Prepare Data will tell you exactly which column has missing values, alongside the warning and the available fix. You can inspect the finding; applying a fix still comes later.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` renders `issue.message` and `issue.remediation` in `PrepareDataStage`, but never renders `issue.field`. The backend's real message says only “This field contains missing values,” so the user cannot identify the affected column.

**Expected Contract**: `GET /api/ml-studio/v1/drafts/{experiment_id}/preparation` owns each issue's `field`, `message`, and `remediation`. Show `field` as the column name in the visible issue card. Keep the issue/fix pairing by server IDs; do not infer a column from the message, fix parameters, browser rows, or a draft PATCH response.

**Regression Test**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` — `prepare-data-shows-affected-column`; render the exact issue fixture with `field: "value"` and generic message “This field contains missing values.” Assert “value” is visibly identified as the column alongside the warning and fix explanation.

**Return Evidence**: Report the named regression test result, focused shell test command, production build result, and final source lines that render the field.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `backend/ml_studio/preparation.py` — `DraftPreparationService.options`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

## Scope And Target Files

Change only the issue card's visible column identification and its focused test. Preserve the existing loading, empty, open-operation, error/retry, identity-change, and shell-control behavior. Do not start preparation or modify Power Query, backend, contracts, authorization, or any `GEMINI.md` file.

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css` (only if column-label styling requires it)

**Required Change Coverage**: only the named required subset: MLStudioShell.jsx and MLStudioShell.test.jsx; CSS is optional.

**Maximum Diff Lines**: 600

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Home, experiment name, guidance, save status/retry/reload, stage navigation, Data & Goal, Configure, and run dock remain visible and usable. Test: `prepare-data-controls-survive` remains passing after the column is shown.

## Verification And Stop Point

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Then run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_prepare_data_options.md --summary "Column name visible; report prepare-data-shows-affected-column and test/build results"`.

Return the changed files, exact command results, named assertion, and source line evidence; then stop for Codex review.
