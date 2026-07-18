# Phase 2 - BI-First AI Chat Reset Plan

Status: Acceptance pending

Owner: Codex. The user explicitly authorized Codex to edit the AI Chat frontend for this reset.

## Purpose

Return AI Chat to a focused business-intelligence product. A business user should be able to choose data, ask a plain-language question, receive a direct grounded answer, refine the question conversationally, and create readable tables, charts, and exports.

## Remove From AI Chat

Remove the Decide mode, decision-specific clarification choices, workspace draft and preview cards, Decision Output and Command Center rendering, decision actions, readiness and capability panels, Evidence Board, Decision Map, Scenario Compare, decision-asset save paths, and Decision Intelligence PDF output from the AI Chat journey.

Do not delete backend Decision Intelligence services in this slice. Isolate them from AI Chat so the rollback remains safe and reviewable. The separate Decisions window is not expanded or redesigned.

## Preserve

Preserve the existing AI Chat shell, chat and results panes, navigation, buttons, dataset mentions, active Data Hub identity, semantic model grounding, normal answers, tables, chart generation, chart styling, conversational metric and dimension refinements, artifact inspection, loading and error treatment, and BI answer or chart PDF exports.

## BI-First Behavior

AI Chat exposes only `Auto`, `Ask data`, and `Explore` behavior. Decision-like wording is handled as a grounded analytical question whenever the active data and semantic model support it. If the metric, dimension, period, or requested output is ambiguous, the assistant asks one plain-language BI clarification without creating a decision workspace.

Every response leads with the answer or the exact information needed to answer. Internal field paths, correction types, schema names, readiness engines, capability boundaries, raw action IDs, and implementation terminology are never presented as the main response.

## Acceptance

The reset is accepted when normal business questions return readable answers or charts without any decision workspace, decision frame, decision output, readiness, capability, Evidence Board, Decision Map, Scenario Compare, or Command Center UI. Follow-ups retain grounded metric, dimension, period, and chart context. Data Hub identity remains correct. Answer and chart exports remain readable. Existing non-DI AI Chat controls and layout remain intact.

Run focused Decision Chat tests that cover Ask/Explore routing and conversational analytics, `npm --prefix frontend/frontend run build`, `python .codex/hooks/agent_harness_check.py`, the project documentation audit, and `git diff --check`. The user owns final browser acceptance.
