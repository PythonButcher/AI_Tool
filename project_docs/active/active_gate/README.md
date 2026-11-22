Goal: Keep Analytics Studio aligned with the next user-authorized product change.

## User Outcome

Users can work in a customizable Analysis workspace while directing any follow-up in chat.

## Scope

The user directs product changes. A requested implementation outcome requires a matching authorization record and an executable gate.

## Contracts

- [Analytics workspace](../contracts/analytics_workspace.md)

## Acceptance

- Any follow-up gate identifies one authorized outcome, its owner, and observable engineering acceptance checks.

## Verification

- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

The user owns product direction. Codex acts when the user assigns a follow-up outcome.
