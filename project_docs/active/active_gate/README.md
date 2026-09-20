Goal: Obtain explicit user authorization before beginning the Run Observatory and Comparison gate.

## User Outcome

Give the user a clean decision boundary before AI_Tool begins asynchronous ML runs, live progress, evidence, and comparison work.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Roadmap Gate**: Gate 6 — Run Observatory And Comparison

**Current Step**: Step 1: Await explicit user authorization for Run Observatory and Comparison

**Target Files**: No implementation files. After a direct user start instruction, Codex may update the authorization record, execution status, and this sole active gate before any source mutation.

**Step Acceptance**: The user directly instructs Codex to begin, start, resume, or implement Gate 6, and Codex records that authority before implementation.

**Step Verification**: Confirm the direct instruction in `project_docs/active/status/phase_authorization.json`, then run the repository documentation and active-gate validators.

**Next Step**: Replace this authorization boundary with the first bounded Codex-owned Gate 6 backend contract and implementation step.

**Continuation Rule**: `WAIT_FOR_USER`.

**Stop Condition**: Do not inspect or mutate Gate 6 implementation surfaces without direct user authorization.

- [ ] **Step 1: Await explicit user authorization for Run Observatory and Comparison** — [IN PROGRESS]

## Contracts

- `project_docs/active/ml_studio/README.md` — Gate 6 outcome, ownership, and acceptance boundary.
- `project_docs/active/status/phase_authorization.json` — canonical implementation authority.

## Acceptance

- Gate 6 implementation does not begin from roadmap sequence alone.
- A direct user instruction is recorded before source, contract, test, or frontend-handoff mutation.
- The next executable gate begins with a bounded Codex-owned backend step.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

The user owns the authorization decision. Control returns to Codex only after a direct Gate 6 start instruction.
