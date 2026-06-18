# AI Chat Emergency Overhaul Action Plan

> COMPLETED REFERENCE ONLY: This file records the AI Chat emergency overhaul plan. It is not an active implementation plan. Current truth lives in `project_docs/active/status/decision_intelligence_execution_status.md`.

This was the implementation plan for the AI Chat emergency overhaul. The completed record now lives outside the active `current` path.

## Standalone Goal

Make AI Chat one coherent product surface for answers, charts, exploration, decision review, artifact inspection, export, and optional graph tooling. The decision flow must be finishable inside AI Chat. The Decision Graph may remain a separate tool window, but it must be optional, state-aware, and clearly launched from AI Chat.

This work is scoped to AI Chat behavior and the backend/docs support needed for that behavior. Do not restart the old Decisions-window flow, do not make the Decisions window a required continuation path, and do not destroy existing useful renderers without a replacement.

## Historical Docs Read During This Work

These were the implementation docs used while this plan was active. For current work, start from `project_docs/INDEX.md` and follow the active status file.

1. `project_docs/INDEX.md`
2. `project_docs/active/README.md`
3. `project_docs/active/status/decision_intelligence_execution_status.md`
4. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
5. `project_docs/active/contracts/decision_objects.md`
6. `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`
7. `project_docs/active/decision_intelligence/completed/ai_chat_emergency_overhaul_action_plan.md`

## Target Files

Backend and docs:

`backend/decision_engine/chat_service.py`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/contracts/decision_objects.md`

`project_docs/active/ai_hand_off/README.md`

Frontend:

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/ai/AIShell.css`

`frontend/frontend/src/features/ai/AIChat.jsx`

`frontend/frontend/src/features/ai/AIChat.css`

`frontend/frontend/src/features/ai/AICharts.jsx`

`frontend/frontend/src/utils/decisionPdfExport.js`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/App.jsx`

## Chunk 1: Codex Setup And Contract Cleanup

Owner: Codex.

Codex prepares the project truth before frontend implementation. Inspect backend action metadata and active docs for stale `open_workspace`, Decisions-window continuation, workspace-handoff, phase-label, and export-contract language. Make only backend/docs changes that are required before Gemini starts frontend work.

The backend may keep the `open_workspace` action id for compatibility, but user-facing labels, descriptions, availability reasons, and fallback messages must not tell the user to open the old Decisions destination as the next step from AI Chat. Preferred user-facing language is decision review, decision output, blockers, assumptions, analysis, graph tool, and export.

Acceptance checks:

At the time, `project_docs/active/status/decision_intelligence_execution_status.md` identified this emergency AI Chat overhaul as the current gate.

Backend action metadata no longer presents the Decisions window as the continuation path from AI Chat.

Active docs do not instruct Gemini to preserve `Open workspace` as a visible no-op.

Codex final response includes the paste-ready Gemini prompt for Chunk 2.

## Chunk 2: Gemini AI Chat Shell Cleanup

Owner: Gemini/Antigravity.

Gemini implements the AI Chat shell cleanup. Remove or hide placeholder tabs, placeholder rail controls, stale phase/workspace labels, large visible mode selection, duplicate mode controls, fake `Soon` context modules, and inactive library/skills affordances. Keep backend modes internal.

The empty state, composer, result pane, context/status display, loading state, error state, keyboard behavior, and responsive layout should feel like one coherent AI Chat product surface. The UI should not make the user choose `Inquire`, `Explore`, or `Decide` before asking a question. Detected backend mode may be shown only as a low-emphasis status when it is useful.

Acceptance checks:

AI Chat no longer shows disabled placeholder navigation.

No visible mode selector is required before asking a question.

No stale phase, workspace-agent, workspace-handoff, or Decisions-window labels are visible in AI Chat.

The composer supports normal chat keyboard behavior: Enter sends when appropriate, Shift+Enter inserts a newline, and Escape closes mention/autocomplete UI.

The results pane opens only when useful and does not blank out confusingly during follow-up work.

Desktop and narrow-width layouts do not overflow.

`npm --prefix frontend\frontend run build` passes.

## Chunk 3: Gemini Decision Artifact, Export, And Graph Cleanup

Owner: Gemini/Antigravity, with Codex review after implementation.

Gemini fixes AI Chat artifact behavior. Suppress or relabel `open_workspace`, remove duplicate action surfaces, add full `decision_output` PDF export using `export_sections`, gate Decision Graph launch on usable graph context, pass dataset and semantic model into the graph path, remove chart debug logging, and preserve answer/chart/artifact inspection behavior.

The Decision Graph button must not appear as an always-enabled blue primary action unless the graph can open with usable data and context. If graph prerequisites are missing, the UI should show a disabled tool action with a clear reason or omit it from the current artifact.

The full decision output should have the primary PDF export affordance. Partial exports such as blockers can remain secondary, but they must not appear to be the main decision export.

Acceptance checks:

A decision question can be completed inside AI Chat.

`Open workspace` does not appear as a no-op.

Full decision PDF export is available from the decision output.

Partial blocker export does not look like the main decision export.

Decision Graph either opens with usable variables/context or is disabled with a clear reason.

Chart questions still render.

Answer artifacts, chart artifacts, artifact inspection, and existing non-decision exports still work.

`npm --prefix frontend\frontend run build` passes.

## Completion And Archive Rule

This plan has already been moved to:

`project_docs/active/decision_intelligence/completed/ai_chat_emergency_overhaul_action_plan.md`

`project_docs/active/status/decision_intelligence_execution_status.md` no longer points to this file as the active gate. If additional detailed work notes are created later, move those notes to `project_docs/archive/` unless they are useful completed references.

Do not mark the emergency overhaul complete from a frontend build alone. Completion requires Codex source review against this plan and the active contract, plus build or browser verification when the specific acceptance check depends on visible behavior.
