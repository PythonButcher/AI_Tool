Goal: Modernize AI Chat with a calmer layout and a generously sized opening window.

## User Outcome

A spacious BI conversation workspace with fewer framed elements, clearer hierarchy, a compact answer selector and a larger initial window that fits the available screen.

## Scope

No executable implementation step is active. Specific user feedback may open bounded refinements to `frontend/frontend/src/features/ai/AIShell.jsx`, `AIShell.css`, `frontend/frontend/src/components/layout/CanvasContainer.jsx` or `frontend/frontend/src/utils/aiChatWindowSizing.js`. Preserve conversation behavior, BI contracts and existing themes.

## Contracts

- [AI Chat business workspace](../ai_chat/README.md)
- [Model routing](../contracts/ai_chat_model_routing.md)

## Acceptance

- Header, sidebar, dataset context, starting prompts and composer retain functionality with less visual framing.
- Auto, Quick and Deep analysis remain accessible native radio controls.
- Docked and separate chat windows open larger within available screen bounds.
- Theme variables apply throughout; narrow windows retain usable controls.
- No backend or ML Studio behavior changes.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --runTestsByPath src/features/ai/AIShell.test.jsx src/utils/aiChatWindowSizing.test.js`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, WAIT_FOR_USER. Feedback and final visual acceptance stay in chat. Codex updates authorization and status before implementing bounded feedback. Browser operations require a specific user request.
