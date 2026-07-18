# Decision Intelligence Execution Status

This is the short active status file. Implementation history belongs in completed records or archive, not in this active gate document.

## Current Truth

AI Chat is returning to a BI-first NLP product. Its primary job is to answer grounded business questions using the active dataset and semantic model, support conversational refinements, and produce readable tables, charts, and exports.

Decision Intelligence output, decision framing, clarification-choice workflows, workspace previews, command-center output, and Decision Output exports are being removed from AI Chat. Existing Decision Intelligence backend services may remain isolated and unused so the rollback is safe; they are not part of the active AI Chat product direction.

## Current Project Gate

Status: **Phase 2 - BI-First AI Chat Reset: IMPLEMENTATION VERIFIED; USER BROWSER ACCEPTANCE NEEDED**

Active gate:

`project_docs/active/decision_intelligence/active_gate/README.md`

Current plan:

`project_docs/active/decision_intelligence/active_gate/phase_2_bi_first_ai_chat_reset_plan.md`

Current Codex goal:

`project_docs/active/decision_intelligence/active_gate/codex_bi_first_ai_chat_reset_goal.md`

Active frontend handoff: none. The user explicitly authorized Codex frontend implementation for this reset.

Latest verified fact: AI Chat now imports, invokes, renders, inspects, saves, and exports only BI answer and chart artifacts. Decide routing is overridden by explicit Explore routing for data-backed chat turns, and Decision Intelligence session state is removed at the frontend boundary. Decision Output review, Command Center, clarification controls, saved-decision UI, scenario preview, semantic decision references, and the Decision Intelligence PDF exporter were deleted from the AI Chat frontend. The frontend build and focused BI-routing tests pass.

## Next Focus

The user performs one concise BI-first browser check: ask a metric question, request a chart, refine the metric or segment in a follow-up, reference a Data Hub dataset, and export one answer or chart. No Decision Intelligence workspace, frame, readiness, capability, command-center, scenario, or decision-asset output may appear. Decision Comparison is withdrawn and must not be promoted.

## Future Cycle Memory

The Data Foundation cycle proceeds in this order: multiple data sources, data source relationships, better cleaning, improved basic ML, improved automation, then AI Chat-linked automations. Do not run another AI Council by default; use one only for conflicting priorities, unclear ownership, or a major architecture fork.
