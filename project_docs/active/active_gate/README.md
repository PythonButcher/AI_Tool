Goal: Let AI Chat use economical models for everyday explanations and deeper reasoning for detailed questions while preserving verified BI results.

## User Outcome

Users choose Auto, Quick or Deep analysis, see which model answered, and retain useful local results when AI is unavailable.

## Scope

No executable implementation step is active. Await specific user feedback before opening bounded repairs to `backend/services/chat_model_router.py`, the chat route, or `frontend/frontend/src/features/ai/`. Live provider access and quality depend on the deployment's API key and model availability.

Preserve grounded results, dataset lineage and dashboard items. Do not extend scope to ML Studio or perform browser operations.

## Contracts

- [AI Chat business workspace](../ai_chat/README.md)
- [Model routing](../contracts/ai_chat_model_routing.md)
- [BI result contracts](../contracts/decision_objects.md)
- [Dashboard state](../contracts/dashboard_canvas_state.md)

## Acceptance

- Use existing theme tokens, responsive container layouts, keyboard focus and reduced-motion support.
- Auto avoids paid calls for direct calculations; explicit Quick/Deep controls reasoning tier. Model IDs stay server-controlled.
- Governance and clarification boundaries run before provider calls. AI commentary cannot alter computed artifacts or execute tools.
- No hidden model escalation or provider retries. Failure preserves local results and reports unavailable commentary.
- Persist selection per chat and snapshot it for submissions/retries. Deep analysis does not claim internet research.
- Expose New Chat and Reset Chat outside the collapsible sidebar; make saved conversations available at narrow window widths.
- Keep messages, drafts, artifacts and in-memory analytical context isolated per conversation.
- Confirm reset/delete actions and preserve dashboard items.
- Keep dialogs above the docked chat portal and in the same document as the chat host. Deleting an inactive conversation preserves the active draft.
- Keep local storage additive; handle unavailable or malformed storage without claiming persistence succeeded.
- Preserve grounded AI Chat answers, contextual follow-ups, recoverable failures and deliberate dashboard additions. Preserve dashboard storage and dataset lineage.
- Preserve pending ML Studio acceptance. No AI Chat browser operations are authorized.

## Verification

- `python -m unittest tests.test_chat_model_router tests.test_decision_chat_service`

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testPathPattern '(features/ai/.*test|features/dashboard/.*test|context/WindowContext.*test|utils/aiDashboard.*test)'`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Owner: User, WAIT_FOR_USER. Final visual acceptance and requested refinements remain in chat. Codex resumes on specific user direction and updates the authorization and status before bounded implementation.
