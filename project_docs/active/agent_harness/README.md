# Agent Harness

This folder is the repo-local backbone for agent work. It is not a new product area and it does not replace `AGENTS.md`, `GEMINI.md`, or the project-wide active gate.

Use this folder when the task is about making agents safer, faster, easier to resume, or easier to verify across future projects.

## Current Harness Shape

| Layer | Current File | Purpose |
| --- | --- | --- |
| Entry instructions | `AGENTS.md` | First project rules for Codex and other OpenAI agents |
| Active routing | `project_docs/INDEX.md` and `project_docs/active/README.md` | Smallest-doc-first navigation |
| Active gate | `project_docs/active/active_gate/README.md` | Single current project slice workspace |
| Codex run discipline | `project_docs/active/codex_harness_engineering.md` | Context, tool-output, and verification budget rules |
| Agent harness design | `project_docs/active/agent_harness/harness_blueprint.md` | Reusable harness pattern for this and future repos |
| Hook guidance | `project_docs/active/agent_harness/hooks.md` | Hook-ready checks and installation notes |
| Hook scripts | `.codex/hooks/` | Repo-local scripts that can be run manually or wired into Codex hooks |

## Operating Rule

Harness changes must make existing rules easier to follow. They must not weaken ownership boundaries, skip active Markdown review, edit any `GEMINI.md` file, or add broad automation that silently changes source files.

Harness changes must preserve the project-wide active-gate model: one active phase folder directly under `project_docs/active/`, completed work outside that folder, deferred ideas in the shared `project_docs/active/future/` hub, old history under `archive/`, and frontend-agent prompts under `ai_hand_off/` only when a frontend agent is truly next.

## When To Use This Folder

Use it to answer questions such as:

Is there a safe hook for this repeated mistake?

Should a repeated workflow become a reusable skill, subagent, command, or checklist?

What is the narrowest verification ladder for this task type?

How should future projects copy this repo's agent setup without copying Decision Intelligence history?

## Future Plans

Future harness planning notes live in `../future/`. They preserve ideas that are not current gates and should not be implemented until the active status file or user direction promotes them into an approved slice.

Current future plan:

`../future/codex/codex_antigravity_handoff_orchestration_plan.md` - planned orchestration layer for Codex and Antigravity phase handoffs, review loops, and user acceptance gates.

## Validation

Run the repo-local harness check before calling harness work complete:

`python .codex/hooks/agent_harness_check.py`

For active-gate changes, also run:

`python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`

These are the authoritative project checks. The installed generic project-doc audit still targets retired Decision Intelligence paths; do not recreate those paths or treat that external script as project truth.

Also run `git diff --check` after Markdown or hook edits.
