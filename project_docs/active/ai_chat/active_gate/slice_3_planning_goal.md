Goal: Define the exact implementation boundaries, target files, and acceptance criteria for Slice 3: Interactive Chart Context (Frontend).

Target docs/files to inspect:
- `project_docs/active/status/ai_chat_execution_status.md`
- `project_docs/active/ai_chat/active_gate/README.md`
- `project_docs/active/contracts/decision_objects.md` (Check chart contract support for interactivity)

Acceptance checks:
- A clear, bounded frontend handoff is written for Antigravity to implement the interactive chart context.
- The handoff explicitly lists the target files, exact backend fields required, and a manual browser checklist.
- The handoff does NOT include broad new UI features or backend changes.
- If backend APIs for interactive chart context are missing or insufficient, the goal must explicitly shift to building backend API support before frontend work begins.

Ownership constraints:
Codex owns this planning step and the project gate. The goal is complete when the handoff for Slice 3 is ready in `project_docs/active/ai_hand_off/` and the active docs are updated.
