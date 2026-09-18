Goal: Deliver a verified, native ML Studio destination and non-training shell through one bounded Antigravity handoff.

## User Outcome

Let a user enter ML Studio from the existing application rail and understand the current dataset identity, shell stages, evidence area, and durable run-list state without exposing training controls or implying unsupported readiness.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Current Step**: Step 1: Implement the bounded ML Studio shell handoff

**Target Files**: `frontend/frontend/src/components/layout/SideBar.jsx`, `frontend/frontend/src/components/layout/CanvasContainer.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`, `frontend/frontend/src/features/ml_studio/MLStudioShell.css`, `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`, and the active documentation files named by the authorization record.

**Step Acceptance**: Antigravity returns only the authorized frontend changes, with focused tests and a successful production build proving the rail destination and all required shell states.

**Step Verification**: `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx` and `npm --prefix frontend/frontend run build`

**Next Step**: Step 2: Review the returned implementation evidence

**Continuation Rule**: Antigravity executes `project_docs/active/ai_hand_off/ml_studio_shell.md`, returns evidence through the governed status command, and stops. Codex then reviews the source and verification evidence.

**Stop Condition**: Stop for a contract mismatch, work outside the exact file boundary, a returned handoff requiring Codex review, a user-requested pause, or the user browser-acceptance boundary.

- [ ] **Step 1: Implement the bounded ML Studio shell handoff** — [IN PROGRESS]
- [ ] **Step 2: Review the returned implementation evidence** — [PENDING]
- [ ] **Step 3: Return the verified shell for user browser acceptance** — [PENDING]

The only authorized frontend mutation is the exact path set in `project_docs/active/ai_hand_off/ml_studio_shell.md`. Do not add training controls, snapshot creation, run submission, comparison, candidate review, export behavior, legacy ML integration, deployment, or Context Ledger behavior.

## Contracts

Use `project_docs/active/contracts/ml_studio.md` for the verified versioned API and identity fields the shell may display without inventing backend behavior. The shell may call only `GET /api/ml-studio/v1/runs?limit=20`.

Use `project_docs/active/ml_studio/README.md` only for the Phase 13 ML Studio Shell architecture and acceptance boundary.

## Acceptance

- ML Studio is a keyboard-accessible first-class destination in the existing rail.
- The shell presents the Run Ribbon, Asset Rail, blank Experiment Canvas, Evidence Inspector, and Run Dock with native light/dark styling.
- No-dataset, blocked, identity-ready, run-list loading, empty, error, and populated states are distinct and tested.
- The shell uses existing workspace identity plus the proven run-list response and does not claim that training is authorized or available.
- Workspace, Data Model, Explore, Dashboards, and AI Suite behavior remains unchanged.
- Experiment controls, training execution, comparison, candidate review, exports, and broad application redesign remain excluded.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

Antigravity owns only the active bounded React/CSS handoff. It returns control to Codex after its focused test and build. Codex owns source-level integration review, and the user owns browser acceptance.
