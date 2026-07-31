# Project Active Gate — Phase 8 / Slice 1: Explicit Analysis Context Selection

Goal: Implement a server-authoritative selection boundary that returns explicit source and relationship IDs for multi-source AI Chat requests.

## User Outcome

A user can deliberately choose a verified multi-source model path for AI Chat instead of the application treating workspace membership as analytical selection.

## Scope

Extend `GET /api/data-workspaces/<workspace_id>/analysis-context` to accept repeated `source_id` and `relationship_id` parameters. Update `backend/routes/data_workspaces.py`, `backend/services/workspace_context.py`, and the smallest reusable validation boundary in `backend/services/relationship_execution.py`. Update `tests/test_source_workspace_context.py` and `tests/test_relationship_execution.py`.

## Contracts

Use `project_docs/active/contracts/multiple_data_source_workspace.md` and `project_docs/active/contracts/multiple_data_source_relationships.md`. The returned `analysis_context` must contain the current `workspace_version`, persisted `primary_source_id`, ordered selected `source_ids`, and ordered explicit `relationship_ids`. Never infer a relationship merely because sources share a workspace.

## Acceptance

One-source requests remain relationship-free. Multi-source selection requires the primary source and an explicit active, confirmed, freshly valid, connected, acyclic relationship tree. Missing, stale, inactive, cross-workspace, disconnected, cyclic, or ambiguous selections return structured errors. The successful response remains `{ workspace, sources, analysis_context }` and contains no joined rows or private storage data.

## Boundaries

Do not edit frontend files, auto-activate relationships, choose paths for the user, change the primary source, execute an AI Chat request, or alter one-source compatibility behavior.

## Verification

Run the focused workspace-context and relationship-execution tests, `python .codex/hooks/agent_harness_check.py`, the active-gate validator, and `git diff --check`.

## Owner And Control Return

Codex owns this backend contract slice. After source and test verification, Codex creates one bounded Antigravity handoff for explicit model selection and AI Chat request integration.
