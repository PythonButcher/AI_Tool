# AI_Tool Agent Map

Give Codex and Gemini a map, not a 1000 page instruction manual.

This file is the first routing helper for AI_Tool. It should point agents to current truth, ownership, and the next useful file. Historical detail belongs in archive or completed records, not in the active path.

## Start Here

| Need | Read |
| --- | --- |
| Start any project task | `project_docs/INDEX.md` |
| Understand current truth and scan rules | `project_docs/active/README.md` |
| Check current Decision Intelligence status | `project_docs/active/status/decision_intelligence_execution_status.md` |
| Confirm Codex vs Gemini ownership | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| Review the active rollout | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` |
| Work on contracts | `project_docs/active/contracts/decision_objects.md` |
| Review active Codex/Gemini handoffs | `project_docs/active/ai_hand_off/README.md` |
| Run Codex efficiently on substantial work | `project_docs/active/codex_harness_engineering.md` |
| Find archived historical detail | `project_docs/archive/README.md` |

## Current Product Direction

Decision Intelligence should be unified through AI Chat, not split into a separate required Decisions-window flow. AI Chat keeps its existing answer, chart, exploration, artifact, and export behavior. Decision Intelligence becomes a richer structured output in the AI Chat results pane.

The Decisions window is not deleted. Its future role should be secondary: saved decision library, fullscreen review, or historical asset viewer after the AI Chat output flow is clear.

## Ownership

Codex owns backend truth, contracts, tests, architecture, documentation, cleanup planning, and review.

Gemini owns frontend implementation unless the user explicitly authorizes Codex frontend edits in the current session.

When frontend work is needed, Codex writes the backend truth and a focused Gemini handoff. Gemini implements React/CSS/UI behavior, verifies it, and updates status truthfully.

Codex must never create, edit, restore, delete, move, rename, patch, or otherwise modify any `GEMINI.md` file. If a `GEMINI.md` file is missing, stale, damaged, or needs new instructions, Codex must report the issue and leave the file untouched for the user or another agent.

## Communication Rule

Write rollout plans in plain project language. Use short phase names, one purpose per phase, and direct acceptance checks. Explain technical terms immediately. Do not use dense shorthand such as "Decision Map now, CDD later" unless the same paragraph explains exactly what that means.

When creating prompts for another agent, do not use code blocks and do not over-format with many bullets. Keep the prompt clean and paste-ready.

When Codex wraps up a project phase or clears a phase gate, the final response must include a clean, paste-ready prompt for starting the next session. The user should not have to ask for this handoff prompt separately. The wrap-up summary may describe the phase just completed, but the next-session prompt must focus on the next phase's work. Do not re-explain prior phases in the next-session prompt except for the minimum verified prerequisite state needed to start safely. Keep the prompt concise, point to the current docs, name the verified state, and state the next phase's first task.

## Working Rules

Always review current project Markdown before making project decisions. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then only the task-specific files named by those navigation docs.

Do not scan every Markdown file. Do not scan `project_docs/archive/` unless an active doc points there or the user asks for historical context. Do not bulk scan `project_docs/active/decision_intelligence/`; read its README first and select only the relevant file.

For substantial repo work, read `project_docs/active/codex_harness_engineering.md` before opening large source files or running noisy verification tools.

For coding work, proceed one step at a time, verify behavior before calling work complete, and update active status Markdown truthfully as work progresses.

Full prior root instructions were preserved at `project_docs/archive/superseded_active_2026_05_24/AGENTS_full_2026_05_24.md`.
