# Completed Reference

Status: Closed on 2026-07-15 by explicit user acceptance of the delivered dataset-identity scope. Mode-selector, action-dispatch, refresh recovery, and New Chat frontend items were not accepted as shipped and remain deferred rather than being represented as complete.

# Phase 1 - AI Chat Trustworthy Interaction Plan

Status: Closed with accepted scope

Owner: Codex for source truth, backend, contracts, tests, and coordination; Gemini or Antigravity for frontend implementation after a focused handoff.

Planning source: Release 1 in `project_docs/active/future/codex/ai_chat_decision_intelligence_user_outcome_audit_and_repair_plan.md`.

## Purpose

Make the existing AI Chat journey dependable before adding more Decision Intelligence features. A user must be able to trust which data was analyzed, understand or control the selected mode, use every enabled action, and recover the current session without silently reopening stale work.

## Current Gate

Codex begins with source tracing and backend truth. Frontend work is not yet assigned. After the backend state is classified as `backend_not_ready`, `backend_contract_ready`, or `frontend_repair_only`, Codex may issue one bounded frontend handoff at a time.

## Release Scope

Release 1 covers four outcomes:

1. Dataset identity: an explicit dataset selection or mention must resolve to the analyzed dataset or produce a clear refusal. The response must expose the actual dataset context. A dataset change must invalidate or deliberately rebase an existing result.
2. Intent routing: explicit `Auto`, `Ask data`, `Explore`, and `Decide` intent must have one source of truth. Ambiguous comparison prompts must request confirmation instead of silently choosing the wrong workflow.
3. Action integrity: every enabled `suggested_actions` item must have a real backend and frontend execution path. Unsupported or unavailable actions must be disabled with a reason or shown as information. `open_workspace` must use current structured state rather than scan stale messages.
4. Session integrity: safe structured state may restore the current chat and result after refresh. `New Chat` must clear that state. Misleading welcome actions and unfinished navigation controls must not appear executable.

## Boundaries

Preserve normal answers, charts, exploration, decision output, artifact inspection, export behavior, and immutable saved-decision snapshots. Do not build alternatives comparison, guided conversational refinement, sensitivity comparison, action ownership, or outcome review in this phase. Do not store raw dataset rows in browser persistence. Do not present sensitivity arithmetic as forecasting, simulation, optimization, causal proof, or a final recommendation.

## Source and Contract Gate

Codex must trace `dataset`, `dataset_ref`/`datasetRef`, `resolved_datasets`, `dataset_trust`, `conversation_history`, `session_state.active_mode`, `mode_context.current_mode`, `mode_context.reason_code`, `suggested_actions[].action_id`, `suggested_actions[].enabled`, `suggested_actions[].disabled_reason`, and `session_state.draft_workspace` across `/api/decision/chat/turns`, `/api/decision/chat/actions`, backend services, React state, and persistence. Existing names are evidence to inspect, not permission to invent a parallel contract.

Any contract change must be documented in `project_docs/active/contracts/decision_objects.md` or the more specific active contract. Multi-source architecture remains deferred except for the minimum identity behavior required to prevent the wrong dataset from being analyzed.

## Acceptance Gate

The phase is complete only when all of these are true:

- The named or selected dataset is the dataset actually analyzed, and the response exposes that identity.
- Ambiguous chart-versus-decision comparisons ask for confirmation; explicit mode selection is honored.
- Every enabled action produces a visible result or transition, including current-state `open_workspace`.
- Refresh safely restores the current structured session, `New Chat` clears it, and changing datasets cannot silently reuse a stale result.
- Welcome and navigation controls accurately represent implemented behavior.
- Focused backend tests pass, the frontend build passes after frontend work, and the user completes the final browser acceptance check.

## Execution Order

Codex first audits the source and writes or repairs the backend contract and tests. If frontend work is required, Codex creates a focused handoff under `project_docs/active/ai_hand_off/` for only the first independently reviewable behavior. Gemini or Antigravity implements React and CSS changes, reports the build result, and returns the slice for Codex acceptance review. The user performs final browser acceptance.

## Verification

Run the focused Decision Chat and workspace tests, then run:

`python .codex/hooks/agent_harness_check.py`

`git diff --check`

When frontend implementation exists, also run:

`npm --prefix frontend/frontend run build`
