Goal: Implement the interactive chart context (Slice 3) in the frontend by rendering and handling backend-provided `suggested_actions` for analytics refinement.

Target docs/files to inspect:
- `project_docs/active/contracts/decision_objects.md` (Check the Analytics Refinement and Typed Suggested Actions sections)
- `frontend/frontend/src/features/ai/AIShell.jsx` (Handles `/api/decision/chat/turns` and renders `userMessages`)
- `frontend/frontend/src/features/ai/AIShell.css` (For chip styling)

Exact backend fields required:
- `suggested_actions` from the `/api/decision/chat/turns` response.
- Fields within each action: `action_id`, `label`, `kind` (expected: `analytics_refinement`), `enabled`, `disabled_reason`, `analytics_refinement`.

Acceptance checks:
- `suggested_actions` are captured from the backend response in `AIShell.jsx` and added to the assistant's message object.
- The UI renders `suggested_actions` as clickable chips or buttons below the main artifact/message content.
- Clicking an enabled action automatically sends a new turn to `/api/decision/chat/turns` containing the `analytics_refinement` object, the current `session_state`, and the action's label as the `user_message`.
- Disabled actions are rendered as visually disabled and cannot be clicked (ideally showing `disabled_reason` on hover).
- No broad new UI features or menus are added; the implementation is strictly bounded to inline action chips in the chat message.

Creative latitude:
- Choose the component composition, chip layout, spacing, hover/focus treatment, concise supporting copy, and subtle micro-interactions that best fit the existing AI Chat design system.
- Preserve accessibility, responsive behavior, and visual hierarchy. These presentation choices do not require Codex approval when they stay within the target files and acceptance behavior.
- Do not change the backend contract, invent additional action kinds, broaden navigation, or begin another slice. Return any backend or scope mismatch to Codex.

Verification command:
- `npm --prefix frontend/frontend run build`

Browser verification checklist:
- Ask a BI question that returns a chart or table (e.g., "Show total revenue by region").
- Confirm that `suggested_actions` appear below the result.
- Click an enabled suggested action (e.g., "breakdown by product category").
- Confirm that the UI updates, a new request is sent with the correct `analytics_refinement` payload, and the chart/table updates successfully.

Ownership constraints:
- Codex is the project lead and owns backend truth, gate state, and final integration review.
- Antigravity owns this frontend implementation. Do not edit backend files or active gate/status documentation; report changed source files, build evidence, and any blocker back to Codex.

Completion and control return:
1. Stop after this handoff is implemented and the frontend build has been run. Do not begin another slice.
2. Return the changed-file list, build result, and any remaining blocker to Codex.
3. Codex reviews source, contract compliance, and build evidence. If accepted, Codex—not Antigravity—moves the gate to user browser acceptance. If rejected, Codex issues a narrowed repair handoff.
