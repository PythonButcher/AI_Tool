Goal: Contain the ML Studio Experiment Configuration surface inside the available viewport and establish a polished responsive workspace shell through one bounded frontend handoff.

## User Outcome

The Experiment Configuration surface stays on screen, scrolls within ML Studio, keeps its primary action reachable, and presents a deliberate workspace instead of an oversized floating form.

## Scope

**Roadmap Gate**: Gate 6 — Experiment Configuration Recovery

**Current Step**: Step 2: Contain the ML Studio canvas and establish the new configuration shell

**Target Files**: The three existing ML Studio shell targets named in `project_docs/active/ai_hand_off/ml_studio_shell.md`.

**Step Acceptance**: The configuration workspace is top-aligned, width-contained, internally scrollable, responsive without horizontal clipping, and keeps actions and results within the same usable surface.

**Step Verification**: Antigravity returns focused shell tests, a successful production build, diff check, and guarded status return; Codex reviews the layout checkpoint before advancing.

**Next Step**: After Codex accepts containment, issue one Antigravity handoff replacing native multi-selects with the searchable single-role editor.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity stops after the shell containment return. Codex rejects scope expansion or any layout that can still leave actions or results outside the ML Studio surface.

- [x] **Step 1: Prove the assessment backend path with representative dataset shapes** — [COMPLETED]
- [ ] **Step 2: Contain the ML Studio canvas and establish the new configuration shell** — [IN PROGRESS]
- [ ] **Step 3: Replace multi-selects with a searchable single-role column editor** — [PENDING]
- [ ] **Step 4: Deliver the guided assessment interaction and actionable results** — [PENDING]
- [ ] **Step 5: Deliver Start Run and live Run Dock behavior** — [PENDING]
- [ ] **Step 6: Perform integration review and prepare user browser acceptance** — [PENDING]

## Contracts

- `project_docs/active/contracts/ml_studio.md` — snapshot, experiment, preparation-assessment, and run truth.
- `project_docs/active/ml_studio/README.md` — ordered Experiment Configuration Recovery plan.
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — Codex plans and verifies backend; Antigravity owns later frontend checkpoints.

## Acceptance

- Backend readiness is proven by 43 focused contract, execution, and API tests.
- Every later checkpoint produces one distinct visible UI outcome and returns to Codex for review.
- No later checkpoint begins while an earlier one is unaccepted.
- The final configuration surface stays inside the available viewport, removes native multi-select boxes and the confirmation checkbox, prevents overlapping roles, and never leaves Assess looking inert.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Antigravity owns Step 2 through `project_docs/active/ai_hand_off/ml_studio_shell.md`. Control returns to Codex after the guarded check-in; the user retains final browser acceptance.
