Goal: Give AI Chat economical GPT-5.6 Luna answers and stronger GPT-5.6 Sol reasoning through the existing router.

## User Outcome

Users choose Quick for GPT-5.6 Luna with low reasoning or Deep analysis for GPT-5.6 Sol with medium reasoning; Auto uses those tiers when commentary is needed.

## Scope

No executable implementation step is active. Await specific user feedback before opening bounded repairs to `backend/services/chat_model_router.py`, its tests or the routing contract. Live provider availability and quality depend on deployment access.

## Contracts

- [Model routing](../contracts/ai_chat_model_routing.md)
- [AI Chat business workspace](../ai_chat/README.md)

## Acceptance

- Quick defaults to `gpt-5.6-luna`, low reasoning and a 2000-token completion cap including reasoning.
- Deep defaults to `gpt-5.6-sol`, medium reasoning and a 6000-token completion cap including reasoning.
- Request parameters match official model documentation and the installed SDK. Keep existing explicit supported overrides available.
- Preserve BI results, governance, one-call budgets, local Auto calculations and failure disclosure.
- No frontend changes, browser operations or paid provider calls are required.

## Verification

- `python -m unittest tests.test_chat_model_router tests.test_decision_chat_service tests.test_decision_chat_workspace`
- `python -m py_compile backend/services/chat_model_router.py`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, WAIT_FOR_USER. Codex resumes on specific feedback and updates authorization and status before bounded implementation. Live model access and final acceptance remain in chat.
