Goal: Duplicate a saved ML Studio draft inside its governed workspace.

## User Outcome

A developer can make a separate copy of an experiment draft without treating copied work as completed.

## Scope

**Current Step**: Step 1: Implement workspace-scoped draft duplication

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `MLStudioShell.css`, and `MLStudioShell.test.jsx`.

**Step Acceptance**: The home list duplicates one saved draft through the server, shows a new draft identity and revision 1, and does not fabricate completed stages or runs.

**Step Verification**: Run the focused ML Studio shell test, frontend build, and `git diff --check`.

**Next Step**: Return changed-file and verification evidence for Codex review.

**Continuation Rule**: `WAIT_FOR_AGENT` while Antigravity implements the bounded handoff.

**Stop Condition**: Stop after the duplication frontend return; do not implement later ML Studio stages.

- [ ] **Step 1: Implement workspace-scoped draft duplication** — [IN PROGRESS]
- [ ] **Step 2: Return focused frontend evidence for Codex review** — [PENDING]

## Contracts

- `project_docs/active/contracts/ml_studio.md` — draft duplication contract.
- `project_docs/active/ml_studio/README.md` — Step 3 save and resume outcome.
- `project_docs/active/ai_hand_off/ml_studio_duplicate_draft.md` — bounded frontend assignment.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — frontend ownership.

## Acceptance

A current-workspace source draft produces one separate server draft with a new identity, revision 1, reset stage, and no copied completion or run evidence.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity for the bounded draft-duplication slice.

Control return: `WAIT_FOR_AGENT`. Antigravity returns focused source and verification evidence; Codex reviews before another assignment.
