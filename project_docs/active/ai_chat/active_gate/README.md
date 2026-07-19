# AI Chat Active Gate

**Current Phase:** Slice 4 — Guided Exploration (Definition and Backend Readiness) [Active]

## Purpose
Define one guided-exploration behavior that materially improves how a user discovers the next useful BI question. It must be distinct from the inline suggested-action chips already available and remain grounded in the active dataset, semantic model, and structured analytics state.

## Current Gate
Codex must inspect the current backend contract and frontend integration, define the smallest distinct user outcome, and classify backend readiness before any UI handoff is written.

## Product Boundaries
Guided Exploration stays inside BI answers, tables, charts, semantic metrics, filters, grouping, aggregation, and time periods. It must not restore Decision Intelligence workspaces, decision outputs, scenario tools, or command-center surfaces. It must not become an open-ended recommendation engine that invents unsupported questions.

## Ownership
**Project Lead and Current Owner:** Codex

Antigravity has no active assignment. Codex will implement or verify backend truth first, then create one bounded UI handoff only if source review proves a concrete frontend gap.

## Acceptance Checks
1. The behavior is described as one clear user outcome and is not a duplicate of inline action chips.
2. Exact request, response, session-state, enabled/disabled, and grounding fields are named from source.
3. Backend readiness is classified from implementation and focused tests, not documentation alone.
4. Any backend gap is implemented and tested before an Antigravity handoff is created.
5. Decision Intelligence output remains disconnected from AI Chat.

## Active Goal
`project_docs/active/ai_chat/active_gate/guided_exploration_definition_goal.md`
