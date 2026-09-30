Goal: Implement the bounded ML Studio Stay/Open Power Query opening and safe return behavior.

## User Outcome

Users can stay in Prepare Data or inspect a selected issue in a read-only Power Query mode and return to the same saved experiment without changing data.

## Scope

**Current Step**: Step 1: Implement the Power Query opening handoff

**Target Files**: The five frontend files named in `project_docs/active/ai_hand_off/ml_studio_power_query_opening.md`.

**Step Acceptance**: Implement the exact opening/return boundary, prevent all cleaning requests in ML Studio opening mode, preserve normal Power Query behavior, and return focused test and build evidence.

**Step Verification**: Run the handoff's focused frontend tests, production build, repository harness and `git diff --check`.

**Next Step**: Codex reviews the returned source and acceptance evidence.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Antigravity returns only the bounded handoff for Codex review. Do not begin preparation preview, apply or cancel integration.

- [ ] **Step 1: Implement the Power Query opening handoff** — [IN PROGRESS]

## Contracts

- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `project_docs/active/ai_hand_off/ml_studio_power_query_opening.md` — exact API, local context and acceptance boundary
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — ownership boundary

## Acceptance

Stay preserves the saved experiment. Open carries current issue identity into a read-only editor. Return preserves that same experiment and Prepare Data stage. Identity changes invalidate stale callbacks. The normal editor retains its existing behavior. No data mutation, draft write or durable operation is introduced.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity, working only from `project_docs/active/ai_hand_off/ml_studio_power_query_opening.md`. Return source and verification evidence to Codex, who owns integration review. Browser acceptance belongs to the user.
