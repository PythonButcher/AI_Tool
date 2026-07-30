# AI_Tool Agent Map

Give Codex and frontend agents a map, not a 1000 page instruction manual.

This file is the first routing helper for AI_Tool. It should point agents to current truth, ownership, and the next useful file. Historical detail belongs in archive or completed records, not in the active path.

## Start Here

| Need | Read |
| --- | --- |
| Start any project task | `project_docs/INDEX.md` |
| Understand current truth and scan rules | `project_docs/active/README.md` |
| Check current project status | `project_docs/active/status/project_execution_status.md` |
| Work on the current project slice | `project_docs/active/active_gate/README.md` |
| Confirm Codex vs Antigravity ownership | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| Review completed AI Chat rollout history | `project_docs/archive/ai_chat_decision_output_unification_rollout_completed.md` only when historical context is needed |
| Work on contracts | `project_docs/active/contracts/decision_objects.md` |
| Review active Codex-to-frontend-agent handoffs | `project_docs/active/ai_hand_off/README.md` |
| Run Codex efficiently on substantial work | `project_docs/active/codex_harness_engineering.md` |
| Improve or reuse the agent harness | `project_docs/active/agent_harness/README.md` |
| Find archived historical detail | `project_docs/archive/README.md` |

## Current Product Direction

AI Chat is a BI-first NLP workspace. It keeps grounded answers, tables, charts, conversational refinements, semantic-model behavior, artifact inspection, and BI exports. It does not expose Decision Intelligence workspaces.

Decision Intelligence backend services may remain isolated for compatibility, but they are not part of the active AI Chat product direction. Do not reconnect them without explicit user approval and a new active plan.

## Ownership

Codex owns backend truth, contracts, tests, architecture, documentation, cleanup planning, and review for the broader AI Tool.

Codex is the Lead Orchestrator for AI_Tool, including the AI Chat BI pivot. Codex owns the roadmap, active gates, backend implementation, contracts, tests, architecture, project documentation, integration review, and the decision about which owner acts next.

Antigravity is the primary UI implementation owner. Codex gives Antigravity one bounded frontend handoff at a time after backend readiness and the frontend gap are verified. The handoff fixes the contract, required behavior, scope boundary, regressions, and acceptance evidence while leaving Antigravity reasonable creative freedom over component composition, interaction polish, styling details, accessible presentation, and concise UI copy within the existing design system.

The control-return sequence is mandatory: Antigravity implements only the current handoff, then stops and returns changed-file and verification evidence to Codex. Codex reviews source, build evidence, and contract compliance. Only after Codex accepts the implementation does the user perform final browser-level acceptance.

Codex must never create, edit, restore, delete, move, rename, patch, or otherwise modify any `GEMINI.md` file. If a `GEMINI.md` file is missing, stale, damaged, or needs new instructions, Codex must report the issue and leave the file untouched for the user or another agent.

## Codex Orchestration Duty

Codex leads the overall AI Tool and the AI Chat work. Antigravity executes UI work from Codex-authored handoffs and reports completion evidence back to Codex for review.

At the end of substantial work, Codex must state the project gate clearly: whether the backend API is complete, blocked, ready for an Antigravity UI handoff, awaiting Codex review, or awaiting user browser acceptance. Codex must not make the user infer who acts next.

User browser acceptance is coordinated only in chat. Never create, update, retain, or link a project goal, handoff, checklist, prompt, or other file for user browser acceptance.

If a phase has backend and frontend parts, backend verification alone is not enough to call the phase complete. Say `backend complete; Antigravity implementation or frontend verification still required` unless frontend behavior has also been verified or the active docs define the slice as backend-only.

Before writing a frontend-agent handoff, Codex must first confirm there is a real frontend gap from source review, browser verification, or explicit user direction. Do not send speculative frontend work.

Whenever Codex determines Antigravity needs UI work, Codex must create or update a handoff file with a clean `Goal:` prompt instead of pasting that prompt into chat. The final response should link or name the handoff file and state that Antigravity should read the latest handoff. Only paste the full prompt in chat if the user explicitly asks for it.

Keep active status short. Move completed slice diaries to `project_docs/archive/` once their facts are no longer the current gate.

## Final Response Stop Check

Before every final response after substantial project work, Codex must explicitly check whether it wrapped up a project phase, cleared a backend gate, cleared a frontend gate, or identified that Antigravity takes over next.

If yes and a forward-looking `Goal:` prompt is needed, the prompt must live in a handoff file under `project_docs/active/ai_hand_off/`. The final response must reference that handoff file instead of pasting the full prompt into chat. This is required even when the backend work is complete, the goal is marked complete, or the response already states the project gate. Do not end with only a status summary when a handoff is the next action.

The handoff `Goal:` prompt must be forward-looking only. It must name the next standalone goal, target file or files, active docs to read, exact contract or source fields to use, acceptance checks, build command when relevant, and browser check when frontend work is needed. It must not recap prior phase names, prior verification history, or who completed earlier work.

## Communication Rule

Write rollout plans in plain project language. Use short phase names, one purpose per phase, and direct acceptance checks. Explain technical terms immediately. Do not use dense shorthand such as "Decision Map now, CDD later" unless the same paragraph explains exactly what that means.

When creating prompts for another agent, put the prompt in a handoff file by default. Do not use code blocks and do not over-format with many bullets. Keep the prompt clean and directly executable by the receiving agent.

## Prompt Goal Format

All prompts generated for another agent or a future session must be written in goal format and stored in a handoff file unless the user explicitly asks for chat output. This includes Antigravity, Codex next-session, review, handoff, and implementation prompts. Start with `Goal:` followed by the standalone outcome, then state the target files, active documentation to read, exact contract or source fields to use, acceptance checks, verification command when relevant, and ownership constraints. Antigravity prompts must use the same goal format because Antigravity supports goals. Keep every prompt forward-looking, clean, and free of code blocks.

## Catastrophic Change Protection

Agents must use `apply_patch` for source edits. They must not use Python `open(path, "w")`, `Path.write_text`, PowerShell `Set-Content`, `Out-File`, redirection, or bulk-cleanup scripts to rewrite source files, especially when the target path is stored in a variable. Those patterns can truncate a file before its contents are read. Before claiming frontend work complete, run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and the relevant build. If a source file is unexpectedly empty or substantially smaller than its baseline, stop immediately, report the incident, and restore from the tracked baseline before any feature work continues.

When Codex wraps up a project phase or clears a phase gate (or whenever the user requests a kick-off / next-session / new phase prompt), Codex must replace the sole `project_docs/active/active_gate/README.md` for Codex-owned work or create a handoff file for Antigravity-owned UI work, then reference that file in the final response. Never create a second plan, goal, kickoff, or status file under `active_gate/`. The user should not have to copy a prompt from chat into another agent.
CRITICAL: The generated kick-off/next-session handoff prompt MUST NEVER mention or refer to ANY previous phase names or numbers (e.g., do not say "Phase 4", "Phase 5", "previous phase", or recap what was just completed). It MUST NOT recap prior accomplishments, review history, implementation history, or who approved earlier work. It must start directly and cleanly by naming only the next standalone goal, specifying the target file, and listing the active doc links for the current task. Keep the prompt completely forward-looking and decoupled from history. Do not include sentences like "Phase N is complete", "Gemini did X", "reviewed by", or detailed verification history inside the next-session handoff prompt.


## Working Rules

Always review current project Markdown before making project decisions. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then only the task-specific files named by those navigation docs.

The active gate has exactly one authoritative file: `project_docs/active/active_gate/README.md`. It must contain the current `Goal:`, user outcome, target files, required context, contract details, acceptance checks, boundaries, verification commands, owner, and control-return rule. No other file or subdirectory may exist under `project_docs/active/active_gate/`.

Before starting, handing off, or closing a numbered project phase, use the `project-doc-governance` skill and run `python .codex/hooks/agent_harness_check.py`. The check blocks a completed brief left in the active gate, completed reference files left under `active_gate/`, and a current work gate without its declared phase number. The only unnumbered state allowed is the explicit idle gate `Awaiting User Epic Goal`.

For this repository, the authoritative documentation checks are `python .codex/hooks/agent_harness_check.py` and `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`. The installed generic `project-doc-governance/scripts/audit_project_docs.py` is hard-coded to retired `project_docs/active/decision_intelligence/` paths and must not be used as this repository's release gate. Do not recreate retired paths to satisfy that external script.

Do not scan every Markdown file. Do not scan `project_docs/archive/` unless an active doc points there or the user asks for historical context. Do not bulk scan `project_docs/active/decision_intelligence/`; read its README first and select only the relevant file.

For substantial repo work, read `project_docs/active/codex_harness_engineering.md` before opening large source files or running noisy verification tools.

For coding work, proceed one step at a time, verify behavior before calling work complete, and update active status Markdown truthfully as work progresses.

Full prior root instructions were preserved at `project_docs/archive/superseded_active_2026_05_24/AGENTS_full_2026_05_24.md`.
