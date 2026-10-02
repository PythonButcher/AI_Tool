Goal: Authorize the prepared ML Studio Power Query preview and cancel assignment before implementation.

## User Outcome

Run Preview will show the selected fix's resulting rows and row count, with Cancel and Return preserving the saved experiment and dataset.

## Scope

**Current Step**: Step 1: Authorize preview and cancel implementation

**Target Files**: project_docs/active/status/phase_authorization.json and the prepared assignment at project_docs/active/future/codex/ml_studio_power_query_preview_cancel.md.

**Step Acceptance**: Obtain a direct user instruction to implement this bounded preview/cancel assignment, record it, promote the prepared file to the sole active frontend handoff and assign the owner.

**Step Verification**: Run repository documentation checks after authorization and promotion.

**Next Step**: Antigravity implements only the promoted preview/cancel session and returns focused source/test/build evidence to Codex.

**Continuation Rule**: `WAIT_FOR_USER`.

**Stop Condition**: Do not implement or activate the assignment until the user authorizes it. Apply, dataset replacement and editable transformations are excluded.

- [ ] **Step 1: Authorize preview and cancel implementation** — [IN PROGRESS]

## Contracts

- `project_docs/active/future/codex/ml_studio_power_query_preview_cancel.md` — prepared-only scope and exact API boundaries
- `project_docs/active/contracts/ml_studio.md` — Draft Preparation Operations
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` — ownership and readiness

## Acceptance

Implementation authorization is explicit and recorded. One bounded active handoff names the exact begin/preview/cancel requests, server-issued operation and recipe, current/base ETags, safe return/recovery and focused tests. No Apply action is assigned.

## Verification

- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Current owner: User for implementation authorization. Codex records the instruction and promotes the prepared assignment; Antigravity owns the bounded frontend implementation. Browser acceptance remains in chat and belongs to the user.
