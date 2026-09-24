Goal: Let developers create and reopen ML Studio drafts in the shared workspace.

## User Outcome

A developer can see experiments in the current workspace, create an incomplete draft, and reopen one without losing workspace identity.

## Scope

**Current Step**: Step 1: Build the workspace-scoped draft home

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `MLStudioShell.css`, and `MLStudioShell.test.jsx`.

**Step Acceptance**: The home lists drafts for the active workspace, creates an incomplete draft, and reopens one with server-returned name, Guidance setting, and effective stage.

**Step Verification**: Run the focused ML Studio shell test, frontend build, and `git diff --check`.

**Next Step**: Step 2: Return focused frontend evidence for Codex review

**Continuation Rule**: `WAIT_FOR_AGENT` while Antigravity implements only the bounded handoff.

**Stop Condition**: Stop after the governed frontend return; do not add autosave, duplication, or later ML Studio stages in this slice.

- [ ] **Step 1: Build the workspace-scoped draft home** — [IN PROGRESS]
- [ ] **Step 2: Return focused frontend evidence for Codex review** — [PENDING]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_draft_home.md` — bounded frontend assignment.
- `project_docs/active/contracts/ml_studio.md` — current draft API fields and route behavior.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — frontend ownership.

## Acceptance

The first frontend slice creates and reopens server drafts for one workspace. It preserves existing Configure and run-dock behavior and does not claim autosave or duplication is connected.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity for the bounded draft-home frontend slice.

Control return: `WAIT_FOR_AGENT`. Antigravity returns changed-file and verification evidence, then Codex reviews before another assignment.
