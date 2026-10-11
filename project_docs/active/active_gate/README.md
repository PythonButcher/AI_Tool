Goal: Deliver coherent, theme-aligned interfaces for ML Studio exploration and the AI Chat business workspace while preserving their working data flows.

## User Outcome

Developers can explore machine-learning tasks and trustworthy learning material, start or resume an experiment, and work in a spacious AI Chat window with readable results, a focused composer and consistent navigation.

## Scope

**Target Files**: This chat owns `frontend/frontend/src/features/ml_studio/MLStudioHome.jsx`, `MLStudioHome.css`, `MLStudioShell.jsx` and focused home/shell tests. The authorized AI Chat chat owns `features/ai/AIShell.jsx`, `AIShell.css`, `DashboardDraft.jsx`, focused tests, and the user's requested sidebar/header refinement. This chat owns shared navigation/status records and the final production build.

ML Studio combines an interactive home, supported algorithm links and working experiment actions. AI Chat provides a coherent header, conversation, composer, results and optional sidebar without losing grounded BI answers or dashboard content. Keep refinements within the user's direction and the file ownership above.

## Contracts

- [ML Studio workflow and supported algorithms](../contracts/ml_studio.md)
- [ML Studio product requirements](../ml_studio/README.md)
- [AI Chat business workspace](../ai_chat/README.md)
- [BI result contracts](../contracts/decision_objects.md)
- [Dashboard state](../contracts/dashboard_canvas_state.md)

## Acceptance

- Use existing theme tokens, responsive container layouts, keyboard focus and reduced-motion support.
- Learning content describes only current draft task families and links to verified official educational resources.
- Illustrations are clearly educational and never impersonate real experiment results.
- Preserve dataset identity, draft persistence, pending-action guards and recoverable errors.
- Keep learning available before selecting data; creation still requires valid workspace identity.
- Preserve grounded AI Chat answers, contextual follow-ups, recoverable failures and deliberate dashboard additions. Preserve dashboard storage and dataset lineage.
- Respect each chat's file ownership. AI Chat browser operations remain prohibited.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern 'features/ml_studio/.*test'`
- AI Chat owner: `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ai/.*test|features/dashboard/.*test|context/WindowContext.*test|utils/aiDashboard.*test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, with WAIT_FOR_USER. Final acceptance or refinement requests belong in chat. Do not start additional implementation without user direction. The ML Studio chat coordinates shared records; the AI Chat chat owns its assigned interface files. Delivery evidence belongs in execution status.
