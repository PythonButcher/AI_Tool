Goal: Choose the next Datastream product outcome.

## User Outcome

The user selects one product outcome for Codex to scope into an executable plan.

## Scope

Review the product options with the user. This gate authorizes product review only.

## Contracts

- [Documentation governance](../rules/DOCUMENTATION_GOVERNANCE.md)
- [Product proposals](../future/codex/README.md)

## Acceptance

The user chooses one product outcome in chat. Codex records the chosen scope and any implementation authorization before work begins.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `python .codex/hooks/ci_harness_check.py`
- `git diff --check`

## Owner And Control Return

The user owns the product choice. Codex takes ownership of scoping after the user selects an outcome.
