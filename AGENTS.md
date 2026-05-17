# Codex Project Instructions

Always review the current project Markdown before making project decisions. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then read only the task-specific files named by those navigation docs.

Do not scan every Markdown file. Do not scan `project_docs/archive/` unless an active doc explicitly points there or the user asks for historical context. Do not bulk scan `project_docs/active/decision_intelligence/`; read `project_docs/active/decision_intelligence/README.md` first and select only the relevant file.

## Codex Run Efficiency

For substantial repo work, read `project_docs/active/codex_harness_engineering.md` before opening large source files or running noisy verification tools.

Codex must keep context use disciplined: use targeted searches and line ranges before full-file reads, avoid full diffs unless they are small, summarize build/test/browser output, and escalate verification only when the cheaper check cannot prove the claim. Quality remains required, but broad exploration, repeated browser flows, and large tool dumps are not acceptable substitutes for a scoped run plan.

## Documentation Table Of Contents For Agents

| Need | Read |
| --- | --- |
| Start any project task | `project_docs/INDEX.md` |
| Understand current truth and scan rules | `project_docs/active/README.md` |
| Run Codex efficiently on substantial work | `project_docs/active/codex_harness_engineering.md` |
| Check current Decision Intelligence status | `project_docs/active/status/decision_intelligence_execution_status.md` |
| Confirm Codex vs Gemini ownership | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| Review active Codex/Gemini handoffs | `project_docs/active/ai_hand_off/README.md` |
| Review the council-derived roadmap | `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` |
| Choose next implementation work | `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md` |
| Inspect detailed next-focus recommendations | `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json` |
| Work on contracts | `project_docs/active/contracts/decision_objects.md` |
| Work on Decision Intelligence historical plans or handoffs | `project_docs/active/decision_intelligence/README.md` first |
| Run or update Agent Council workflow | `project_docs/active/agent_council/README.md` |

Current project truth: Decision Intelligence V3 is active. Phase 4.5 hardening and Phase 1 reliability foundation are complete. Phase 2 semantic metadata plumbing is implemented. Phase 2.5 backend semantic frame completion and Gemini frontend segment rendering are complete and verified. The handoff at `project_docs/active/ai_hand_off/phase_2_5_gemini_frontend_segment_dimensions.md` is a completed record, not an active implementation request. Phase 3 correction and ranked observational evidence is deferred until the user explicitly starts Phase 3. Frontend implementation belongs to Gemini unless the user explicitly authorizes Codex frontend edits in the current session.

Codex is the coordinator for Decision Intelligence work. This file is only for standing Codex reference, not for active Gemini task handoffs.

Critical Gemini-turn rule:

When it is Gemini's turn to implement, fix, rework, or verify frontend work, Codex must keep the user-facing response short. Do not bury the next action in a long explanation. Provide a concise status sentence and a clean, paste-ready Gemini CLI prompt.

When reviewing another agent's work, start with a plain acceptance answer: "Complete", "Not complete", or "Complete except for documentation cleanup." Then list only the findings that change that answer or the next action. Avoid vague phrasing like "appears" unless the evidence is genuinely indirect.

After reviewing Gemini work, if Gemini needs to fix anything, Codex must end with a short Gemini fix prompt. The prompt should state the concrete files, the defects to fix, the acceptance check, and the status-doc requirement. Avoid long bullets and do not use code blocks.

When a backend slice reaches the point where frontend work should move to Gemini, Codex must proactively create or update the active project docs with both of these without waiting for a reminder:

1. An updated Gemini review plan that explains the current backend truth, frontend scope, files to inspect, acceptance behavior, and constraints.
2. A short clean prompt the user can paste into Gemini CLI.

Active Gemini task plans and handoffs belong under `project_docs/active/ai_hand_off/` while active. Move completed handoffs out of the active table when done, and keep old examples in archive or completed reference paths.

When creating prompts for another agent, do not use code blocks and do not over-format with many bullets. Keep the prompt clean, direct, and easy to paste.

For coding work, proceed one step at a time, verify behavior before calling work complete, and update active status Markdown truthfully as work progresses.
