Goal: Add a polished Start Run action to the ready ML Studio assessment state through one guarded frontend repair handoff.

## User Outcome

Let a developer submit one prepared experiment and see its server-issued queued record appear in the existing Run Dock.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Roadmap Gate**: Gate 6 — Run Observatory And Comparison

**Current Step**: Step 1: Implement the polished Start Run action and immediate Run Dock refresh

**Target Files**: `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.css`, and `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx` through `project_docs/active/ai_hand_off/ml_studio_shell.md`.

**Step Acceptance**: The ready state submits one idempotent run, protects duplicate clicks, renders safe pending and error states, awaits the existing Run Dock refresh, and produces a durable guarded diff in all three target files.

**Step Verification**: Antigravity returns the exact changed files and successful focused test, frontend build, and diff checks required by the handoff; Codex then performs targeted source acceptance review.

**Next Step**: After Codex accepts this repair, issue a separate bounded handoff for live polling and cancellation.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity stops after the assigned Start Run repair. Codex stops at any contract mismatch or source-level acceptance blocker.

- [ ] **Step 1: Implement the polished Start Run action and immediate Run Dock refresh** — [IN PROGRESS]
- [ ] **Step 2: Review the returned Start Run repair against the backend contract and guarded diff** — [PENDING]
- [ ] **Step 3: Issue the bounded live polling and cancellation handoff** — [PENDING]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_shell.md` — exact frontend scope, API shapes, fixtures, state rules, and acceptance evidence.
- `project_docs/active/contracts/ml_studio.md` — durable run lifecycle and identity-first API truth.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — frontend ownership boundary.

## Acceptance

- Frontend behavior submits the exact stored snapshot and experiment identities and uses the server response.
- Pending, retry, refresh, identity change, and unmount behavior remain race-safe.
- The slice adds no polling, cancellation, evidence, comparison, backend, or contract work.
- Codex accepts source and verification evidence before another frontend slice begins.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Antigravity owns the bounded implementation in `project_docs/active/ai_hand_off/ml_studio_shell.md`. Control returns to Codex for targeted acceptance review; the user retains final browser acceptance.
