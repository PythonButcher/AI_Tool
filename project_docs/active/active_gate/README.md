Goal: Establish the next user-authorized project outcome before opening implementation.

## User Outcome

One clearly scoped priority with an owner, observable acceptance criteria and appropriate verification.

## Scope

No executable implementation step or specialist handoff is active. Await a product decision in chat.

## Contracts

- [Documentation governance](../rules/DOCUMENTATION_GOVERNANCE.md)

## Acceptance

- The user chooses the outcome and authorizes any implementation.
- Status and the authorization record agree with the next active gate.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Next decision owner is the user. Codex records the chosen scope before implementation.
