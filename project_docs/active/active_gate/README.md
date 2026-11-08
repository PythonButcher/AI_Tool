Goal: Establish the next user-authorized project outcome before opening implementation.

## User Outcome

One clearly scoped priority with an owner, observable acceptance criteria and appropriate verification.

## Scope

No executable implementation step or specialist handoff is active. Await direction in chat.

## Contracts

- [Documentation governance](../rules/DOCUMENTATION_GOVERNANCE.md)

## Acceptance

- The user chooses the outcome and authorizes implementation.
- Status and the authorization record agree with the next active gate.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

The user owns the next decision in chat. Codex records the chosen scope before implementation.
