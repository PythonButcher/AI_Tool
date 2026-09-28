Goal: Show the affected column for each missing-value finding in the ML Studio Prepare Data options view.

## User Outcome

The warning and available fix identify the column with missing values. Applying a fix remains a separate step.

## Scope

**Current Step**: Step 1: Show affected columns in Prepare Data

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`, and `frontend/frontend/src/features/ml_studio/MLStudioShell.css` only if styling requires it.

**Step Acceptance**: Render the server-issued `issue.field` visibly in its issue card with the warning and paired fix. Preserve the existing loading, empty, error/retry, open-operation, identity-change, and shell-control behavior.

**Step Verification**: Run the named affected-column regression test, focused shell suite, production build, and `git diff --check`.

**Next Step**: Codex reviews the returned repair, then scopes the separate Stay/Open Power Query and apply/cancel return behavior.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity returns changed-file and verification evidence for Codex review. Do not start preparation or modify Power Query in this step.

- [ ] **Step 1: Show affected columns in Prepare Data** — [IN PROGRESS]

## Contracts

- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations and `issue.field`
- `project_docs/active/ai_hand_off/ml_studio_prepare_data_column_label.md` — bounded frontend assignment
- `project_docs/active/ml_studio/README.md` — Step 4 assignment order

## Acceptance

A generic missing-value message still names the affected column from `issue.field`; issue/fix pairing uses server IDs. Existing shell controls remain usable.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity. Return the bounded repair to Codex for source and contract review before the next Step 4 handoff.
