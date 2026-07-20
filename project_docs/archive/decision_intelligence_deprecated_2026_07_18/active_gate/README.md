# Decision Intelligence Active Gate

This folder is the only active Decision Intelligence phase workspace.

Read this folder after `project_docs/active/status/decision_intelligence_execution_status.md` when working on the current Decision Intelligence gate. Do not infer active work from files in `completed/`, `future/`, `archive/`, or `ai_hand_off/`.

## Current Gate

Status: Phase 2 - BI-First AI Chat Reset is implementation-verified and awaiting user browser acceptance.

Product direction: AI Chat returns to grounded business intelligence. Decision Intelligence output is being removed from the AI Chat experience.

Current plan: `phase_2_bi_first_ai_chat_reset_plan.md`.

Current Codex goal: `codex_bi_first_ai_chat_reset_goal.md`.

Active frontend handoff: none. The user explicitly authorized Codex to edit the AI Chat frontend for this reset.

Current owner: User for browser acceptance. Codex source removal, BI-first routing, frontend integration, focused tests, build, and documentation checks are complete. Readiness classification: `user_browser_acceptance`.

Decision Comparison and other Decision Intelligence expansion work are paused and must not be promoted.

## Active-Gate Rule

Only one phase may live here. When a phase is complete, move its plan, Codex goal, and related handoffs to `project_docs/active/decision_intelligence/completed/` with completed-reference banners. Future or deferred ideas belong under `project_docs/active/future/`.

`project_docs/active/ai_hand_off/` is only for active frontend-agent handoffs. It must not be used as proof of the current Decision Intelligence phase unless this `active_gate/README.md` or the status file points there.
