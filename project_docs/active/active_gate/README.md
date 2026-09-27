Goal: Establish workspace-safe data cleaning contracts for ML Studio preparation.

## User Outcome

A developer can preview and apply preparation changes to the governed workspace bound to an experiment, with a server-issued receipt identifying the resulting data state.

## Scope

**Current Step**: Step 1: Authorize the workspace-safe cleaning boundary

**Target Files**: Preparation edits only the gate, status, authorization record, active navigation, and `project_docs/active/ml_studio/README.md`. After explicit implementation authorization, Codex may propose changes to `backend/routes/manual_cleaning.py`, the workspace resolver in `backend/routes/ml_studio.py`, their directly required workspace services, `project_docs/active/contracts/ml_studio.md`, and focused backend tests. Record the exact allowed source paths before mutation.

**Step Acceptance**: A direct user instruction authorizes the first backend assignment. Codex records the exact mutation boundary and specifies workspace/version validation, bounded preview, the canonical workspace commit path, and a server-issued apply receipt before source implementation.

**Step Verification**: Preparation runs the repository harness, active-gate validator, and `git diff --check`. After authorization, focused tests must prove stale-version and cross-workspace rejection, no commit during preview/cancellation, and receipt/schema identity after apply.

**Next Step**: Codex defines and implements the bounded workspace-safe cleaning contract, verifies it, then prepares the draft recipe/return-context assignment. No UI handoff precedes backend readiness.

**Continuation Rule**: `WAIT_FOR_USER`. Authority is `REVIEW_ONLY`; the user requested preparation without implementation.

**Stop Condition**: Do not implement backend or frontend changes, execute cleaning requests, or issue an active frontend handoff until implementation is explicitly authorized.

- [ ] **Step 1: Authorize the workspace-safe cleaning boundary** — [IN PROGRESS]
- [ ] **Step 2: Implement and verify workspace-safe preview/apply receipts** — [PENDING]

## Contracts

- `project_docs/active/ml_studio/README.md` — Step 4 prerequisites and assignment order.
- `project_docs/active/contracts/ml_studio.md` — implemented and proposed contract boundaries.
- `project_docs/active/status/phase_authorization.json` — implementation authority.

## Acceptance

The proposed backend contract scopes every preparation mutation to an existing workspace and expected version, uses server-resolved data, and returns bounded preview or an authoritative commit receipt. Preview/cancellation preserve data; applying to stale or wrong identities is rejected. Preserve the existing cleaning engine and compatibility callers. Proposed routes/fields remain labeled proposed until verified in source and tests.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: User for implementation authorization; Codex owns the first backend assignment once authorized.

Control return: `WAIT_FOR_USER`. After authorization Codex records `AUTHORIZED`, the exact allowed paths, and one atomic backend step. Antigravity receives a bounded handoff only after the relevant backend gate passes.
