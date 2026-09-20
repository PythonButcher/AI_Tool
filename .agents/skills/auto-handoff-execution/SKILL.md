---
name: auto-handoff-execution
description: Validate and execute AI Tool's current bounded Antigravity handoff when the user asks to read, take over, resume, or execute a handoff Markdown file.
---

# Auto Handoff Execution

1. Read `AGENTS.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/status/phase_authorization.json`, `project_docs/active/ai_hand_off/README.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.
2. Run `python .gemini/skills/status-tracker-skill/scripts/update_status.py check`.
3. Do not edit frontend source unless the check confirms Antigravity ownership, Frontend Readiness of `backend_contract_ready` or `frontend_repair_only`, and exactly one non-README active handoff.
4. Read that handoff and adopt its `Goal:` as the complete task. Treat target files, proven API contracts, fixtures, UI states, state ownership, non-negotiables, acceptance checks, and stop point as authoritative.
5. Implement only the bounded React slice with reviewable editor operations. Never use Python, PowerShell, shell redirection, or bulk-rewrite commands to edit source. Never use `git checkout`, `git restore`, or reset to recover a file. If any target becomes empty or unexpectedly smaller, stop immediately, preserve the worktree, report the incident, and return control without attempting reconstruction.
6. Run the handoff's focused verification and build. Browser acceptance remains with the user. Tests and builds do not replace the required source diff and visual-quality evidence.
7. Return control with the governed status tracker. Its return command verifies target scope, non-empty files, suspicious shrinkage, required changed files, forbidden inline styles, a durable source diff, and whitespace. If it rejects, stop and report the exact rejection; do not bypass or rewrite files in bulk.
8. Stop after reporting changed files, exact command results, and any contract mismatch.
