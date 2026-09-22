Goal: Prove that ML Studio preserves durable run status and progress-stage truth in focused frontend coverage.

## User Outcome

Developers can rely on the shared-workspace tests to catch any UI change that drops or invents backend run progress.

## Scope

**Current Step**: Step 1: Prove returned run progress across every durable status

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`.

**Step Acceptance**: One parameterized test asserts the exact status and exact server-returned progress-stage text for all seven durable states.

**Step Verification**: Run the focused ML Studio shell test, frontend build, repository harness, and `git diff --check`.

**Next Step**: Step 2: Return focused verification evidence

**Continuation Rule**: `WAIT_FOR_AGENT` while Antigravity owns the bounded repair; Codex reviews the returned evidence.

**Stop Condition**: Stop on a contract mismatch, failed governed return, or successful return to Codex. Do not change production UI or begin another ML Studio stage.

- [ ] **Step 1: Prove returned run progress across every durable status** — [IN PROGRESS]
- [ ] **Step 2: Return focused verification evidence** — [PENDING]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_shared_workspace.md` — executable one-file repair.
- `project_docs/active/contracts/ml_studio.md` — durable run-status and progress-stage truth.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — frontend ownership boundary.

## Acceptance

Tests cover `queued`, `running`, `cancel_requested`, `completed`, `failed`, `cancelled`, and `interrupted`. Every case asserts the exact returned `status` and `progress_stage`. Production React, CSS, API calls, payloads, polling behavior, and backend files remain unchanged.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity for the bounded frontend test repair.

Control return: `WAIT_FOR_AGENT`. Antigravity returns changed-file and verification evidence through the governed return command, then stops for Codex review.
