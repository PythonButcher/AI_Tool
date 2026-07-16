# Phase 2 - AI Chat Conversational Analysis Plan

Status: Acceptance pending

Owner: Codex for source truth, backend behavior, contracts, tests, and coordination; Gemini or Antigravity for frontend implementation after a focused handoff.

Planning source: Release 2 in `project_docs/active/future/codex/ai_chat_decision_intelligence_user_outcome_audit_and_repair_plan.md`.

## Purpose

Make AI Chat support a grounded conversation instead of treating each message as an isolated request. Users should be able to refine the metric, segment, period, or output format, resolve missing decision inputs through focused questions, and receive a concise result before opening detailed readiness information.

## Current Gate

Backend continuity, contract work, focused tests, frontend implementation, and Codex source review are complete. The remaining gate is user browser acceptance of the focused metric clarification flow. This plan stays active until that visible behavior is accepted.

## Release Scope

This phase covers four outcomes:

1. Conversation continuity: backend behavior uses safe conversation and structured session context for follow-up turns.
2. Plain-language refinement: a user can change the metric, segment, period, or chart preference without rebuilding the request from scratch.
3. Guided clarification: missing decision inputs become focused, answerable questions rather than a static blocker list.
4. Answer-first results: the response leads with the finding, strongest evidence, important uncertainty, and next useful action; detailed readiness remains available under details.

## Boundaries

Preserve truthful dataset identity, normal answers, charts, exploration, decision output, artifact inspection, exports, and immutable saved snapshots. Do not add alternatives comparison, sensitivity comparison, action ownership, outcome review, predictions, simulations, optimizers, causal proof, autonomous decisions, or final recommendations. Do not persist raw dataset rows or unrestricted chat transcripts in browser state.

Mode-selector, action-dispatch, refresh recovery, and New Chat frontend polish from the closed accepted scope remain deferred unless explicitly promoted. They are not silently included in this phase.

## Source And Contract Gate

Trace `conversation_history`, `session_state.active_mode`, `session_state.last_analytic_context`, `session_state.analytics_state`, `session_state.draft_workspace`, `decision_prompt`, `mode_context`, `artifacts`, `decision_output.frame`, `decision_output.correction_state`, `dataset_trust`, and any clarification state across `/api/decision/chat/turns`, `/api/decision/chat/actions`, backend services, tests, and read-only frontend integration.

Use existing state and contract fields where they are sufficient. Any public request, response, or persistence change must be documented in `project_docs/active/contracts/decision_objects.md`. Session state must remain compact and row-free.

## Acceptance Gate

The phase is complete when a user can ask for a metric, refine the segment or period, change the metric, request a chart, and continue the same grounded conversation without reconstructing the full request. Decision prompts with missing details must ask focused questions and show what changed after an answer. Results must lead with findings and uncertainty while retaining detailed observational boundaries. Focused backend tests, required frontend build evidence, Codex source review, and user browser acceptance must pass.

## Execution Order

Codex first audits conversation-history and structured-state behavior, implements the smallest backend-owned continuity slice, updates the contract, and adds focused regressions. Only after backend readiness is proven may Codex create one bounded frontend handoff. Gemini or Antigravity implements that UI slice and returns it for Codex review. The user owns final browser acceptance.

## Verification

Run focused Decision Chat and workspace tests, then run:

`python .codex/hooks/agent_harness_check.py`

`git diff --check`

When frontend implementation exists, also run:

`npm --prefix frontend/frontend run build`
