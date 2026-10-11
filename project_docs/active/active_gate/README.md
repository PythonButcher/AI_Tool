Goal: Let users start, reset, resume and manage isolated AI Chat conversations without losing grounded results or mixing analytical context.

## User Outcome

Users can create a fresh chat from the header, return to locally saved conversations, rename or delete a chat, and deliberately reset the current conversation.

## Scope

No executable implementation step is active. Await specific user feedback in chat before opening bounded repairs to the conversation controls, storage or request lifecycle in `frontend/frontend/src/features/ai/`.

Preserve grounded results, dataset lineage and dashboard items. Do not extend scope to ML Studio or perform browser operations.

## Contracts

- [AI Chat business workspace](../ai_chat/README.md)
- [BI result contracts](../contracts/decision_objects.md)
- [Dashboard state](../contracts/dashboard_canvas_state.md)

## Acceptance

- Use existing theme tokens, responsive container layouts, keyboard focus and reduced-motion support.
- Expose New Chat and Reset Chat outside the collapsible sidebar; make saved conversations available at narrow window widths.
- Keep messages, drafts, artifacts and in-memory analytical context isolated per conversation.
- Confirm reset/delete actions and preserve dashboard items.
- Keep dialogs above the docked chat portal and in the same document as the chat host. Deleting an inactive conversation preserves the active draft.
- Keep local storage additive; handle unavailable or malformed storage without claiming persistence succeeded.
- Preserve grounded AI Chat answers, contextual follow-ups, recoverable failures and deliberate dashboard additions. Preserve dashboard storage and dataset lineage.
- Preserve pending ML Studio acceptance. No AI Chat browser operations are authorized.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ai/.*test|features/dashboard/.*test|context/WindowContext.*test|utils/aiDashboard.*test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, with WAIT_FOR_USER. Final visual acceptance and any requested refinements remain in chat. Codex resumes only after specific user direction and updates authorization and status before implementing a bounded repair.
