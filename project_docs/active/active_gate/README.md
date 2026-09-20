Goal: Deliver the ML Studio Aggressive Overhaul through small, independently reviewed frontend checkpoints.

## User Outcome

A user can move from an active dataset to a started run through an understandable, polished workflow that prevents conflicting column roles instead of reporting avoidable errors afterward.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Roadmap Gate**: Gate 6 — Run Observatory And Comparison

**Current Step**: Step 1: Make the current configuration visibly usable and role-safe

**Target Files**: The three existing ML Studio shell targets named in `project_docs/active/ai_hand_off/ml_studio_shell.md`.

**Step Acceptance**: The UI identifies the connected dataset and size, supported dataset shapes populate selectors, role conflicts reconcile immediately, and guidance moves forward from configuration through ready-to-assess, assessing, blocked, or ready-to-start states.

**Step Verification**: Antigravity returns after the focused shell tests, diff check, and guarded status command; Codex reviews this checkpoint before authorizing Step 2.

**Next Step**: After Codex accepts the visible Step 1 improvement, replace the native multi-selects with a focused searchable role-editor component under a new bounded handoff.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity stops after each checkpoint. Codex must accept the returned source and evidence before replacing the handoff and advancing the single in-progress checklist item.

- [ ] **Step 1: Make the current configuration visibly usable and role-safe** — [IN PROGRESS]
- [ ] **Step 2: Replace native multi-selects with a visible searchable single-role editor** — [PENDING]
- [ ] **Step 3: Add a visible four-stage journey, review summary, and responsive polish** — [PENDING]
- [ ] **Step 4: Deliver a visible, safe Start Run and live Run Dock refresh** — [PENDING]
- [ ] **Step 5: Perform Codex integration review and prepare user browser acceptance** — [PENDING]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_shell.md` — the only executable frontend checkpoint.
- `project_docs/active/contracts/ml_studio.md` — durable preparation and run lifecycle truth.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — frontend ownership boundary.

## Acceptance

- Only one checklist step and one bounded Antigravity handoff are active at a time.
- Every Antigravity checkpoint returns to Codex and stops before the next step.
- Every checkpoint ends in a distinct UI change the user can inspect; invisible refactors alone do not clear a step.
- Dataset usability, role editing, guided polish, and Start Run behavior are reviewed independently.
- Step 1 evidence explicitly covers object-shaped data, connected-dataset rendering, every role-reconciliation direction, disjoint request payloads, forward guidance states, and warning-free awaited updates.
- No checkpoint expands its named file, behavior, diff, or contract boundary.
- Repository harness, active-gate validator, and diff checks pass whenever the gate advances.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Antigravity owns only Step 1 through `project_docs/active/ai_hand_off/ml_studio_shell.md`. Control returns to Codex after its mandatory check-in. Codex alone advances the gate and issues the next handoff; the user retains final browser acceptance.
