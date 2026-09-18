Goal: Obtain explicit user approval before creating the first bounded ML Studio UI shell handoff.

## User Outcome

The first visible ML Studio work begins with a clear, limited assignment for navigation and shell states, without silently expanding into experiment controls, execution, comparison, candidate review, or unrelated frontend changes.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Current Step**: Step 1: Confirm ML Studio UI shell authorization

**Target Files**: `project_docs/active/status/phase_authorization.json`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, and one bounded handoff under `project_docs/active/ai_hand_off/`

**Step Acceptance**: The user explicitly authorizes the first ML Studio UI shell assignment or revises its visible scope, and Codex records the exact frontend paths before activating a handoff.

**Step Verification**: `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`

**Next Step**: Step 2: Create the bounded Antigravity shell handoff

**Continuation Rule**: Wait for explicit user direction. After authorization, Codex creates one bounded handoff and waits for Antigravity to return implementation evidence.

**Stop Condition**: Stop for missing frontend authorization, a concrete blocker, a returned handoff requiring Codex review, a user-requested pause, or the UI shell acceptance boundary.

- [ ] **Step 1: Confirm ML Studio UI shell authorization** — [IN PROGRESS]
- [ ] **Step 2: Create the bounded Antigravity shell handoff** — [PENDING]
- [ ] **Step 3: Review returned shell implementation evidence** — [PENDING]
- [ ] **Step 4: Return the verified shell for user browser acceptance** — [PENDING]

No frontend source mutation is authorized yet. Do not add training controls, run execution, comparison, candidate review, export behavior, legacy ML integration, deployment, or Context Ledger behavior.

## Contracts

Use `project_docs/active/contracts/ml_studio.md` for the verified versioned API and identity fields the shell may display without inventing backend behavior.

Use `project_docs/active/ml_studio/README.md` only for the Phase 13 ML Studio Shell architecture and acceptance boundary.

## Acceptance

- The user explicitly authorizes the first bounded UI shell assignment or supplies a revised boundary.
- The authorization record names the exact frontend files allowed for Antigravity implementation.
- Codex creates exactly one handoff covering navigation, shell regions, and native empty, no-dataset, blocked, ready, loading, and error states.
- The handoff excludes experiment controls, training execution, comparison, candidate review, exports, and broad application redesign.
- Codex remains the backend and integration-review owner; Antigravity owns only the authorized React/CSS assignment.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

The user owns the UI authorization decision. After explicit approval, Codex records the frontend boundary and creates one bounded Antigravity handoff. Control then passes to Antigravity for that assignment and returns to Codex for source-level integration review.
