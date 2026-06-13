# Decision Intelligence Execution Status

This is the short active status file. It should stay readable in under two minutes. Implementation history belongs in archive, not in this active gate document.

Detailed history:

`project_docs/archive/decision_intelligence_status_history_2026_06_01.md`

Full older preserved status history:

`project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md`

## Current Truth

Decision Intelligence V3 is active.

AI Chat is the primary work surface. Existing AI Chat behavior must remain: normal answers, charting, exploration, decide mode, artifact inspection, and exports.

Decision Intelligence is being unified into AI Chat's results pane. The Decisions window is not deleted, but its intended role is secondary after the AI Chat output flow is clear.

Completed foundations: AI Chat answer/chart protection, Dataset Trust, backend `decision_output`, frontend `decision_output` rendering, chat-native corrections, Evidence Board rendering, Decision Graph backend data foundation, Interactive Decision Graph Workspace, User Hypotheses and Graph-To-Action Flow, and Scenario Compare in the AI Chat decision output.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded. Dataset truth now belongs inside Dataset Trust in the unified AI Chat decision output flow.

## Current Project Gate

Legacy Decision state routing is **fully purged**. The frontend paths that exposed or called old Decision-window behavior have been removed.

Current gate is **AI Chat Emergency Overhaul setup and implementation**.

Next standalone goal: make AI Chat one coherent product surface before broader conflicting-surface pruning resumes. The active implementation plan is `project_docs/active/decision_intelligence/current/ai_chat_emergency_overhaul_action_plan.md`.

Use this status file as the single current source of truth. Use `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` for implementation details only, and use `project_docs/active/contracts/decision_objects.md` when payload details are needed.

## Latest Verified Slice

## AI Chat Emergency Overhaul Setup & Shell Cleanup
**Status:** FRONTEND COMPLETE FOR CHUNK 2

**Focus:** Clean up the Gemini AI Chat shell to remove placeholder UI and fix keyboard shortcuts.

**Verified facts:**
1. Backend `open_workspace` remains a compatibility action id, but its backend-owned label, intent, description, produced payload description, action artifact title, review target, assistant message, and availability reason now describe AI Chat decision review instead of the old Decisions-window continuation path.
2. The active contract states that `open_workspace` is a compatibility id only and must not be used to infer old Decisions-window navigation.
3. The active Decision Intelligence folder map points to the AI Chat emergency overhaul plan as the current active implementation plan.
4. The stale app-wide UI flaws Gemini handoff markdown is marked historical and no longer instructs Gemini to wire `open_workspace` into the Decisions destination.
5. `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service` passes at 29/29.
6. The frontend AI Chat shell (`AIShell.jsx`) has been cleaned up. Placeholder navigation rails, tabs, and fake "Soon" context modules have been removed.
7. Required mode selection before asking has been removed.
8. The composer `handleKeyDown` logic was corrected so Enter sends without shifting, Shift+Enter inserts a newline, and Escape closes the mention UI.
9. Blanking out of the right results pane during follow-up queries has been prevented by removing eager cache clearing.
10. `npm --prefix frontend\frontend run build` passes with no errors.

**Current Blockers:**
- None.

## Next Focus

Start Chunk 3 in `project_docs/active/decision_intelligence/current/ai_chat_emergency_overhaul_action_plan.md`.

Do not edit frontend files unless the user explicitly authorizes Codex frontend work in the current session. Gemini should implement the AI Chat decision artifact and graph cleanup next.

## Status File Discipline

Keep this file short. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave only the current gate, the latest verified fact, and the archive pointer here.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
