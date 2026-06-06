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

## Codex Orchestration Duty

Codex is the project facilitator. At the end of substantial Decision Intelligence work, Codex must state the project gate clearly: whether the phase is complete end to end, backend-only complete, frontend-ready but unverified, blocked, or ready for the next phase.

Codex must not make the user infer who acts next. State directly whether Codex continues, Gemini needs a handoff, both are done, or a specific audit is required before moving forward.

If a phase has backend and frontend parts, backend verification alone is not enough to call the phase complete. Say `backend complete; frontend verification or Gemini work still required` unless frontend behavior has also been verified or the active docs define the slice as backend-only.

Before writing a Gemini handoff, Codex must first confirm there is a real frontend gap from source review, browser verification, or explicit user direction. Do not send Gemini speculative work.

Whenever Codex determines Gemini needs work, Codex must provide the user a clean paste-ready Gemini prompt in the same final response. Do not make the user ask for it separately.

Keep active status short. Move completed slice diaries to `project_docs/archive/` once their facts are no longer the current gate.

## Communication Rule

Write rollout plans in plain project language. Use short phase names, one purpose per phase, and direct acceptance checks. Explain technical terms immediately. Do not use dense shorthand such as "Decision Map now, CDD later" unless the same paragraph explains exactly what that means.

When creating prompts for another agent, do not use code blocks and do not over-format with many bullets. Keep the prompt clean and paste-ready.

When Codex wraps up a project phase or clears a phase gate (or whenever the user requests a kick-off / next-session / new phase prompt), the final response must include a clean, paste-ready prompt for starting the next session. The user should not have to ask for this handoff prompt separately.
CRITICAL: The generated kick-off/next-session prompt MUST NEVER mention or refer to ANY previous phase names or numbers (e.g., do not say "Phase 4", "Phase 5", "previous phase", or recap what was just completed). It MUST NOT recap prior accomplishments, review history, implementation history, or who approved earlier work. It must start directly and cleanly by naming only the next standalone goal, specifying the target file, and listing the active doc links for the current task. Keep the prompt completely forward-looking and decoupled from history. Do not include sentences like "Phase N is complete", "Gemini did X", "reviewed by", or detailed verification history inside the next-session prompt.


## Working Rules

Always review current project Markdown before making project decisions. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then only the task-specific files named by those navigation docs.

Do not scan every Markdown file. Do not scan `project_docs/archive/` unless an active doc points there or the user asks for historical context. Do not bulk scan `project_docs/active/decision_intelligence/`; read its README first and select only the relevant file.

For substantial repo work, read `project_docs/active/codex_harness_engineering.md` before opening large source files or running noisy verification tools.

For coding work, proceed one step at a time, verify behavior before calling work complete, and update active status Markdown truthfully as work progresses.

Full prior root instructions were preserved at `project_docs/archive/superseded_active_2026_05_24/AGENTS_full_2026_05_24.md`.
