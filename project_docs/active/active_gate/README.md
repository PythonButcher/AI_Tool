Goal: Obtain explicit user direction for the ML Studio identity-first API gate before expanding backend implementation scope.

## User Outcome

The API gate begins from an intentional, recorded scope decision, with exact backend ownership and no accidental route, frontend, legacy-service, or deployment changes.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Current Step**: Step 1: Confirm identity-first API authorization

**Target Files**: `project_docs/active/status/phase_authorization.json`, `project_docs/active/status/project_execution_status.md`, and `project_docs/active/active_gate/README.md`

**Step Acceptance**: The user explicitly authorizes Gate 3 implementation or revises its scope, and Codex records the exact allowed backend and test paths before source mutation.

**Step Verification**: `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`

**Next Step**: Step 2: Define the identity-first route and application-service contract

**Continuation Rule**: Wait for explicit user direction at this authorization boundary. Continue automatically after authorization while Codex remains the owner and each bounded step is executable.

**Stop Condition**: Stop for missing authorization, a concrete blocker, a recorded ownership handoff, a user-requested pause, or the identity-first API acceptance boundary.

- [ ] **Step 1: Confirm identity-first API authorization** — [IN PROGRESS]
- [ ] **Step 2: Define the identity-first route and application-service contract** — [PENDING]
- [ ] **Step 3: Implement versioned snapshot, experiment, and run APIs** — [PENDING]
- [ ] **Step 4: Implement events, cancellation, comparison, evaluation, and candidate-review APIs** — [PENDING]
- [ ] **Step 5: Prove stale-identity rejection, safe errors, lineage, isolation, and regressions** — [PENDING]

No Gate 3 source mutation is authorized yet. Do not modify Flask routes, frontend files, legacy ML services, authentication, deployment, prediction serving, Context Ledger, or process-global model state.

## Contracts

Use `project_docs/active/contracts/ml_studio.md` for ML Studio identity, experiment, run, evaluation, reviewed-candidate, error, persistence, and artifact semantics.

Use `project_docs/active/ml_studio/README.md` only for the Phase 13 Gate 3 architecture and acceptance boundary.

## Acceptance

- The user explicitly authorizes Gate 3 or supplies a revised boundary.
- The authorization record names the exact route, service, repository, contract, and focused-test paths allowed for implementation.
- Codex remains the backend owner; Antigravity and frontend files remain out of scope.
- The active gate is replaced with an executable, bounded identity-first API goal before backend source mutation.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

The user owns the authorization decision. After explicit authorization, Codex records the allowed implementation boundary, replaces this README with the executable API gate, and owns backend implementation through its acceptance boundary. Antigravity remains blocked until Codex verifies the identity-first API and creates one bounded frontend handoff.
