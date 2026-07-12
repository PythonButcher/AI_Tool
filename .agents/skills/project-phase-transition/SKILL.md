---
name: project-phase-transition
description: Close a project phase and prepare the next one. Use when Codex is asked to mark a phase complete, update project docs for a new phase, clean active handoffs/plans, create a next-session kickoff goal prompt, or summarize the next phase for a clean chat.
---

# Project Phase Transition

## Overview

Use this skill as the wrap-up and kickoff discipline for AI_Tool project phases. The output of the workflow is a cleaned active documentation set, exactly one active phase in `project_docs/active/decision_intelligence/active_gate/`, and a ready-to-run `Goal:` prompt for the next clean chat session.

## Workflow

1. Read the project navigation and governance files first: `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, and `project_docs/active/decision_intelligence/active_gate/README.md`.
2. Confirm the current phase is actually complete. Use source review, tests, build output, user browser acceptance, or explicit user acceptance as evidence. If acceptance is missing, record the missing gate instead of closing the phase.
3. Run the documentation audit before editing when possible: `python C:/Users/18022/.codex/skills/project-doc-governance/scripts/audit_project_docs.py`.
4. Move completed active-gate files out of `active_gate/` and into `project_docs/active/decision_intelligence/completed/`. Add a short completed-reference banner at the top of moved plan, goal, and handoff files. Do not edit any `GEMINI.md` file.
5. Choose the next phase only from an active planning source named by the status file or active-gate README. Do not infer from archive files or from old phase numbers. If the next phase is unclear, make the active gate a decision task instead of inventing implementation work.
6. Create the next active phase plan in `project_docs/active/decision_intelligence/active_gate/`. Keep it short: purpose, current gate, product boundaries, Codex-owned acceptance checks, frontend handoff conditions, and verification commands.
7. Create the next Codex kickoff prompt in `project_docs/active/decision_intelligence/active_gate/`. The prompt must start with `Goal:` and be standalone for a new clean chat. It must name target docs/files, source fields or contracts to inspect, acceptance checks, verification commands, and ownership constraints. It must not recap prior phase names, prior implementation history, or who completed the previous phase.
8. Update active maps and status: `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, and `project_docs/active/ai_hand_off/README.md` when handoff state changes. Keep active status concise and forward-looking.
9. Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and the project-doc governance audit after edits. Fix every documentation or whitespace blocker before reporting completion.
10. Final response must include a short phase-complete statement, the new phase summary, and the path to the new kickoff goal prompt. Do not paste a long prompt into chat unless the user explicitly asks for chat output.

## Kickoff Prompt Rules

Write kickoff prompts in clean goal format. Start directly with the new standalone outcome, for example `Goal: Build...`. Keep the prompt forward-looking and decoupled from history. Mention only the minimum prerequisite state needed to start safely, such as `active docs are current` or `backend contract must be verified from source`.

When the next owner is Codex, store the prompt under `project_docs/active/decision_intelligence/active_gate/`. When the next owner is Gemini or Antigravity, store it under `project_docs/active/ai_hand_off/` and include exact frontend files, backend fields, acceptance checks, build command, and browser checklist.

## Summary Rules

Summarize the new phase in simple product language. State what the phase is for, what it will not claim, who owns the first slice, and what proof will make it complete. Avoid dense shorthand, phase-history recaps, and broad implementation promises.
