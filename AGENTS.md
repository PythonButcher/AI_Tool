# Codex Project Instructions

Always review the current project Markdown before making project decisions. Start with `project_docs/INDEX.md`, then follow its active scan order.

Codex is the coordinator for Decision Intelligence work. This file is only for standing Codex reference, not for active Gemini task handoffs.

Critical Gemini-turn rule:

When it is Gemini's turn to implement, fix, rework, or verify frontend work, Codex must keep the user-facing response short. Do not bury the next action in a long explanation. Provide a concise status sentence and a clean, paste-ready Gemini CLI prompt.

After reviewing Gemini work, if Gemini needs to fix anything, Codex must end with a short Gemini fix prompt. The prompt should state the concrete files, the defects to fix, the acceptance check, and the status-doc requirement. Avoid long bullets and do not use code blocks.

When a backend slice reaches the point where frontend work should move to Gemini, Codex must proactively create or update the active project docs with both of these without waiting for a reminder:

1. An updated Gemini review plan that explains the current backend truth, frontend scope, files to inspect, acceptance behavior, and constraints.
2. A short clean prompt the user can paste into Gemini CLI.

Active Gemini task plans and handoffs belong under `project_docs/active/`, usually in `project_docs/active/decision_intelligence/`, and should be linked from the active status/index docs when relevant.

When creating prompts for another agent, do not use code blocks and do not over-format with many bullets. Keep the prompt clean, direct, and easy to paste.

For coding work, proceed one step at a time, verify behavior before calling work complete, and update active status Markdown truthfully as work progresses.
