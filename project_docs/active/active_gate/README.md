Goal: Implement draft-bound Power Query preview and cancellation without changing the saved experiment or dataset.

## User Outcome

Users can run a suggested fix's preview, inspect its resulting rows and row count, then Cancel and Return safely to Prepare Data.

## Scope

**Current Step**: Step 1: Implement preview and cancel preparation

**Target Files**: The five frontend files named in project_docs/active/ai_hand_off/ml_studio_power_query_preview_cancel.md.

**Step Acceptance**: Use server-issued preparation/recipe identity for begin and preview, cancel with the stored base ETag, recover lost responses/open sessions, preserve normal editor behavior, and return focused test/build evidence.

**Step Verification**: Run the active handoff's focused shell/editor tests, production build, repository harness and git diff --check.

**Next Step**: Codex reviews returned source and exact async acceptance assertions before user review.

**Continuation Rule**: `WAIT_FOR_AGENT`.

**Stop Condition**: Return only the bounded preview/cancel assignment. Do not implement Apply, editable transformations, dataset replacement or training.

- [ ] **Step 1: Implement preview and cancel preparation** — [IN PROGRESS]

## Contracts

- `project_docs/active/ai_hand_off/ml_studio_power_query_preview_cancel.md` — executable assignment and state boundary
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — ownership and readiness

## Acceptance

Preview consumes the saved operation and returns at most 100 sample rows plus the full resulting row count. Cancellation preserves draft/dataset and closes only after confirmed terminal outcome. Failed or lost responses remain recoverable. Stale responses cannot affect another experiment. ML Studio never calls legacy global cleaning.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ml_studio/MLStudioShell.test.jsx src/components/data_management/DataCleaningForm.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: Antigravity, executing the sole active preview/cancel handoff. Return source and named focused-test/build evidence to Codex. Codex owns integration review; the user owns browser acceptance.
