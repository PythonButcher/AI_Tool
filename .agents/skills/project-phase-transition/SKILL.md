---
name: project-phase-transition
description: Close a project phase, audit every file in the active documentation tree, archive verified completed files, repair navigation, and prepare the next standalone kickoff goal. Use when Codex is asked to mark a phase complete, perform end-of-phase cleanup, transition the active gate, clean completed handoffs or plans, archive stale active records, or prepare the next session.
---

# Project Phase Transition

## Overview

Use this skill as the wrap-up and kickoff discipline for AI_Tool project phases. The result must be a fully inventoried active documentation tree, no verified completed record left under `project_docs/active/`, exactly one current gate in `project_docs/active/active_gate/`, and a ready-to-run `Goal:` prompt for the next session.

## Workflow

1. Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, the current overall roadmap named by status, and the ownership guardrail.
2. Confirm the phase is actually complete from the acceptance evidence required by its gate. Use source review, tests, build evidence, Codex review, and user browser acceptance when the gate requires them. If evidence is missing, keep the gate open and report the missing proof.
3. Run the repository's authoritative checks before editing when possible: `python .codex/hooks/agent_harness_check.py` and `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`. Do not use the generic audit that targets retired Decision Intelligence paths.
4. Inventory every file under `project_docs/active/` with `rg --files project_docs/active`. Use targeted searches for completion, promotion, supersession, handoff, current-gate, roadmap, and archive language. Read every likely completion candidate; do not assume a file is current from its folder name.
5. Classify every active file as `keep active`, `archive`, or `needs evidence`. Keep only current routing, current status, the active gate and kickoff goal, unfinished overall roadmaps, live contracts, current harness/rules, genuinely deferred proposals, and the one active frontend handoff. Classify closed gate files, finished goals and handoffs, completed checkpoints, obsolete promoted proposals, stale council outputs, and fully delivered roadmaps as archive candidates.
6. Archive only files whose completion or supersession is proven. Use `apply_patch` to preserve their contents under `project_docs/archive/` with a concise completed-reference banner. Do not create a new `completed/` folder under `project_docs/active/`, and do not leave a completed copy in the active tree. Never edit any `GEMINI.md` file.
7. Repair every reference to moved files across `AGENTS.md`, `README.md`, `project_docs/`, active handoffs, agent-council prompts, and harness templates. Remove stale source-of-truth claims and retired paths. Keep the overall multi-phase plan in its product-area folder while any phase remains; archive it only when the full roadmap is delivered or explicitly replaced.
8. Replace `project_docs/active/active_gate/` with one forward-looking gate and kickoff goal. Choose the next work only from the current roadmap or explicit user direction. If the next outcome is unclear, use the permitted idle gate instead of inventing scope.
9. Update `project_docs/active/status/project_execution_status.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, and `project_docs/active/ai_hand_off/README.md` so they agree on the current roadmap, gate, owner, handoff state, and next action.
10. Re-run the full active-file inventory and completion search after edits. Then run the authoritative harness check, active-gate check, and `git diff --check`. Treat missing links, a completed file still under active, competing current plans, or an absent kickoff goal as blockers.
11. Report what was archived, what intentionally remains active, the new gate, the next owner, the kickoff-goal path, and validation results. Do not paste a long prompt into chat unless the user explicitly requests it.

## Kickoff Prompt Rules

Write kickoff prompts in clean goal format. Start directly with the new standalone outcome, for example `Goal: Build...`. Keep the prompt forward-looking and decoupled from history. Mention only the minimum prerequisite state needed to start safely, such as `active docs are current` or `backend contract must be verified from source`.

When the next owner is Codex, store the prompt under `project_docs/active/active_gate/`. When the next owner is Antigravity, store it under `project_docs/active/ai_hand_off/` and include exact frontend files, backend fields, acceptance checks, build command, and browser checklist.

## Summary Rules

Summarize the new phase in simple product language. State what the phase is for, what it will not claim, who owns the first slice, and what proof will make it complete. Avoid dense shorthand, phase-history recaps, and broad implementation promises.

Include a compact cleanup ledger with the archived paths and the reason each file left active documentation. If an active file looks completed but lacks evidence, name it under `needs evidence`; never archive it by guesswork.
