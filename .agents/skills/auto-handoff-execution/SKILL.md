---
name: auto-handoff-execution
description: Validate and execute AI Tool's current bounded Antigravity handoff when the user asks to read, take over, resume, or execute a handoff Markdown file.
---

# Auto Handoff Execution

1. Read `AGENTS.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/status/phase_authorization.json`, `project_docs/active/ai_hand_off/README.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.
2. Run `python .gemini/skills/status-tracker-skill/scripts/update_status.py check`.
3. Do not edit frontend source unless the check confirms Antigravity ownership, Frontend Readiness of `backend_contract_ready` or `frontend_repair_only`, and exactly one non-README active handoff.
4. Read that handoff and adopt its `Goal:` as the complete task. Treat target files, proven API contracts, fixtures, UI states, state ownership, non-negotiables, acceptance checks, and stop point as authoritative.
5. Implement only the bounded React slice. Do not invent backend behavior, broaden scope, alter authorization or gate files, or modify any `GEMINI.md` file.
6. Run the handoff's focused verification and build. Browser acceptance remains with the user.
7. Return control with the governed status tracker and stop after reporting changed files, exact command results, and any contract mismatch.
