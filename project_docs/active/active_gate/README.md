Goal: Give AI Tool a polished model selector and cohesive, expressive light and dark themes across its interface.

## User Outcome

Users can clearly choose Auto, Quick or Deep analysis and work in a layered light theme or softly blended dark theme with readable controls, charts, dialogs and panels.

## Scope

No executable implementation step is active. Await specific user feedback before opening bounded repairs to the AI Chat selector, shared CSS/MUI themes or concrete theme exceptions under `frontend/frontend/src/`.

Preserve backend contracts, model routing, dataset identity, chart semantics and all existing workflows. No browser operations or provider calls are in scope. Visual feedback stays in chat.

## Contracts

- [Model routing](../contracts/ai_chat_model_routing.md)
- [AI Chat business workspace](../ai_chat/README.md)

## Acceptance

- Model choices have distinct selection, hover, keyboard focus and disabled states, with useful descriptions.
- Light mode remains light with subtle tinted surfaces and restrained accent color; dark mode uses a coherent slate surface hierarchy.
- Shared CSS and MUI palettes agree. Native controls, portals and detached windows follow the active theme.
- Review reachable pages for hardcoded surfaces and unreadable theme combinations; preserve intentional chart series colors and export backgrounds.
- Respect reduced motion, narrow layouts and existing feature behavior.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ai/.*test|context/ThemeContext.test|context/WindowContext.*test|features/charts/ChartThemes.test)'`
- Scoped ESLint, CSS parsing and theme-token coverage inspection.
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, `WAIT_FOR_USER`. Codex resumes on specific feedback and updates status and authorization before bounded implementation. Final visual acceptance remains in chat.
