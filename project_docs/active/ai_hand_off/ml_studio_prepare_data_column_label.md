Goal: Show the affected column for each missing-value finding in ML Studio Prepare Data.

## User Value

Prepare Data will name the column with missing values beside its warning and available fix. Applying a fix remains a separate step.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx` renders each `issue.message` and `issue.remediation` in `PrepareDataStage`, but omits `issue.field`. A generic server message leaves the affected column unidentified.

**Expected Contract**: `GET /api/ml-studio/v1/drafts/{experiment_id}/preparation?workspace_id=...` owns each issue's `field`, `message`, and `remediation`. Show `field` visibly as the column name in the same issue card. Keep issue/fix pairing by server IDs; draft PATCH responses do not own this field.

**Regression Test**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` — `prepare-data-shows-affected-column`; render a returned issue with `field: "value"` and generic message “This field contains missing values.” Assert the column name is visible beside the warning and available fix.

**Return Evidence**: Report the named regression test result, focused shell test result, production build result, and final source lines that render `issue.field`.

## Required Context

- `project_docs/active/active_gate/README.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `backend/ml_studio/preparation.py` — `DraftPreparationService.options`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

## Scope And Target Files

Change only the issue card's visible column identification and its focused test. Preserve loading, empty, open-operation, error/retry, identity-change, and shell-control behavior. Do not start preparation or modify Power Query, backend, contracts, authorization, or any `GEMINI.md` file.

Target files:

- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css` (only if column-label styling requires it)

**Required Change Coverage**: only the named required subset: MLStudioShell.jsx and MLStudioShell.test.jsx; CSS is optional.

**Maximum Diff Lines**: 150

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Home, experiment name, Guidance, save status/retry/reload, stage navigation, Data & Goal, Configure, and run dock remain usable. Test: `prepare-data-controls-survive` passes after the column is shown.

## Verification And Stop Point

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Then run `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_prepare_data_column_label.md --summary "Column name visible; report prepare-data-shows-affected-column and test/build results"`.

Return changed files, exact command results, named assertion, and source-line evidence; then stop for Codex review.
