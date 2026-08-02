# Project Active Gate — Phase 8 / Slice 1: Persisted Data Model Layout

Goal: Add the backend contract required to save and restore each data source position on the Data Model canvas.

## User Outcome

Each data source can be moved freely on the canvas and returns to its saved location after refresh or navigation.

## Scope

Define and implement a versioned workspace-membership position update using the existing `workspace_sources.position_json` persistence. Update `backend/routes/data_workspaces.py`, `backend/services/workspace_context.py`, `backend/repositories/source_workspace_repository.py`, `project_docs/active/contracts/multiple_data_source_workspace.md`, and focused workspace tests.

## Contracts

Persist a finite numeric `{ x, y }` position for one source membership inside one workspace. Require the current workspace version, preserve workspace isolation, advance the workspace version exactly once, and return the authoritative updated `{ workspace }`. Position is presentation state only and must not change membership, primary source, analysis context, relationships, semantic metadata, or source data.

## Acceptance

The API saves valid coordinates and returns the updated workspace. Invalid coordinates, missing membership, cross-workspace access, and stale versions return structured errors. Restart retrieval returns the saved position. Existing source registration, membership mutation, relationship behavior, and one-source compatibility remain unchanged.

## Boundaries

Do not edit frontend files in this slice. Do not add automatic layout, relationship inference, AI Chat integration, source removal, or primary-source changes.

## Verification

Run the focused workspace repository, route, and context tests, `python .codex/hooks/agent_harness_check.py`, the active-gate validator, and `git diff --check`.

## Owner And Control Return

Codex owns the backend layout contract. After verification, Codex creates one bounded Antigravity handoff for draggable nodes, saved positions, and the usable relationship-authoring interface.
