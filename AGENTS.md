# AI_Tool Agent Rules

Use this file as the repository entrypoint. It defines authority, ownership, safety, and required verification. Current product details belong in `project_docs/`, not here.

## Read First

| Need | Read |
| --- | --- |
| Start any project task | `project_docs/INDEX.md` |
| Understand the active documentation path | `project_docs/active/README.md` |
| Check current truth and ownership | `project_docs/active/status/project_execution_status.md` |
| Execute the current goal | `project_docs/active/active_gate/README.md` |
| Confirm frontend ownership | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| Review the current product roadmap | The task-specific roadmap linked by status or the active gate |
| Review contracts | The task-specific file under `project_docs/active/contracts/` |
| Review active agent handoffs | `project_docs/active/ai_hand_off/README.md` |
| Run substantial Codex work efficiently | `project_docs/active/codex_harness_engineering.md` |
| Find historical context | `project_docs/archive/README.md`, only when requested or linked by an active document |

Read the smallest relevant path. Do not bulk-scan Markdown, active product folders, or archives.

## Authority And Current Truth

- The user controls product direction and final browser acceptance.
- Codex is lead orchestrator and owns backend implementation, contracts, tests, architecture, project documentation, integration review, and next-owner decisions.
- The status file states what is true now. The sole active gate states what work is authorized now.
- If status, the active gate, a roadmap, a handoff, and source disagree, stop implementation and repair the active documentation before continuing.
- Archived, completed, future, and unreferenced handoff files are never active instructions.

## One Active Gate

- `project_docs/active/active_gate/README.md` is the only Codex-owned execution entrypoint.
- Nothing else may exist under `project_docs/active/active_gate/`.
- The gate must contain one forward-looking `Goal:`, user outcome, scope, required contracts, acceptance checks, verification commands, owner, and control-return rule.
- Do not place completion history, work diaries, prior phase names, or supporting plans in the active gate.
- Status uses one `Roadmap Phase` value and a plain-language gate name. Never combine phase and slice numbering.
- Before starting, handing off, or closing a numbered roadmap phase, use the `project-doc-governance` skill and run the repository documentation checks.

## Ownership And Handoffs

- Codex must not implement frontend or browser-visible UI unless the user explicitly authorizes it in the current session.
- The frontend owner works from one bounded handoff at a time. Follow the owner named by current status; Document Studio frontend work belongs to Gemini.
- Confirm a real frontend gap and backend readiness from source before creating a frontend handoff. Never send speculative UI work or let the frontend owner invent backend contracts.
- Store agent prompts in `project_docs/active/ai_hand_off/` unless the user explicitly requests the prompt in chat.
- Every handoff starts with `Goal:` and names target files, required active docs, exact contract fields, scope boundaries, acceptance evidence, and build or test commands.
- A frontend implementer stops after the assigned handoff and returns changed-file and verification evidence. Codex reviews that evidence before user browser acceptance or another handoff.
- Browser acceptance stays in chat and belongs to the user. Never create a browser-acceptance goal, checklist, prompt, or project file.
- After substantial work, state the gate plainly and identify exactly who acts next.

## Protected Files And Edit Safety

- Codex must never create, edit, move, rename, delete, restore, or repair any `GEMINI.md` file. Report any problem and leave the file untouched.
- Use `apply_patch` for source and documentation edits.
- Do not rewrite files with Python `open(..., "w")`, `Path.write_text`, PowerShell `Set-Content`, `Out-File`, shell redirection, or bulk rewrite scripts.
- Preserve unrelated worktree changes. Never use destructive Git commands to discard user work.
- If a source file becomes empty or unexpectedly smaller, stop immediately, report the incident, and restore the tracked baseline before continuing.

## Working Rules

- Proceed one coding step at a time and verify each meaningful behavior before calling work complete.
- Prefer targeted `rg`, narrow diffs, focused tests, and source inspection over broad scans or noisy full-suite runs.
- Keep active status short and factual. Archive completed handoffs and detailed historical records when they stop describing the current gate.
- Write plans and prompts in clear project language. Define technical terms when needed and avoid dense shorthand.
- Do not use code blocks for agent prompts. Use bullets only when they improve scanning.

## Required Checks

Run checks proportional to the changed surface, plus these repository gates when applicable:

- Agent instructions, status, navigation, active gate, roadmap, contract, or handoff changes:
  - `python .codex/hooks/agent_harness_check.py`
  - `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
  - `git diff --check`
- Frontend completion: run the harness, `git diff --check`, and the relevant frontend build before acceptance.
- Backend completion: run the focused tests named by the active gate, compile changed Python modules when applicable, and run `git diff --check`.

Do not run `project-doc-governance/scripts/audit_project_docs.py` in this repository. It is hard-coded to retired paths and is not an authoritative release check.

## Final Stop Check

Before the final response, determine whether the work cleared a backend gate, cleared a frontend gate, changed the active goal, or transferred ownership.

- If Codex remains next, replace the sole active-gate README with the next standalone forward goal.
- If another agent is next, create or update that agent's bounded handoff and reference it in the final response.
- Never make the user infer the current gate or next owner.

The preserved long-form historical instructions are at `project_docs/archive/superseded_active_2026_05_24/AGENTS_full_2026_05_24.md`.
