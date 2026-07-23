# Project Active Gate — Slice 5: Relationship Creation and Editing

## Goal

Let users create and edit governed source relationships from the existing Data Model canvas through the verified workspace-isolated relationship API.

## User Outcome

A user can connect fields between two workspace sources, review the relationship configuration and diagnostics in a focused inspector, save or cancel safely, validate the relationship, and explicitly control activation without any silent model changes.

## Scope

Extend only the existing Data Model feature with field-level relationship drafting and an accessible inspector for field pairs, cardinality, join behavior, filter direction, validation evidence, confirmation, activation, and save or cancel behavior. Use optimistic relationship versions for edits and refresh the visible relationship list from server responses.

Do not add candidate profiling, automatic relationship or path selection, workspace membership mutation, source deletion, AI Chat request changes, backend code, or changes to any `GEMINI.md` file.

## Contracts

Use `project_docs/active/ai_hand_off/antigravity_relationship_editor_goal.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

## Acceptance

New and edited relationships use live source IDs and schema fields, preserve composite field-pair ordering, send only supported contract values, and never activate without an explicit user action. Configuration edits expose their deactivation and revalidation consequence. Version conflicts, confirmation requirements, invalid or blocked validation, and general API failures remain visible without discarding the user's draft. Cancel causes no mutation, and the existing canvas trust display stays truthful after every successful response.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`, then return exact changed files and evidence to Codex. Do not claim browser acceptance.

## Owner

Antigravity owns the bounded frontend implementation in `project_docs/active/ai_hand_off/antigravity_relationship_editor_goal.md`, then stops and returns control to Codex for a targeted source and contract review.

Kickoff goal: `project_docs/active/active_gate/antigravity_relationship_editor_goal.md`.
