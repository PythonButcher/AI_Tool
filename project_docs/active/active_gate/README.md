# Project Active Gate — Phase 5 / Slice 5: Workspace Membership API

Goal: Build versioned workspace membership APIs so a governed catalog source or upload can join one analytical workspace safely.

## User Outcome

A client can list eligible sources, attach a catalog source to a workspace, or upload a new source into that workspace without creating a separate workspace or silently changing the analytical model.

## Target Files

Implement and verify the gate in:

`backend/repositories/source_workspace_repository.py`

`backend/services/workspace_context.py`

`backend/routes/data_workspaces.py`

`backend/routes/upload.py`

`tests/test_source_workspace_context.py`

Update `project_docs/active/contracts/multiple_data_source_workspace.md` only when implementation evidence requires a contract correction.

## Required Context

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, this file, `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/codex_harness_engineering.md`.

## Contract

Add `GET /api/data-sources` using the public source serializer so callers can choose catalog identities without receiving host paths, private locator data, or secrets.

Add `POST /api/data-workspaces/<workspace_id>/sources` with JSON `source_id`, optional `alias`, `role`, and required workspace `version`. Only `lookup` and `context` are valid added roles. Reject duplicate membership, duplicate alias, missing workspace or source, invalid role, and stale workspace version with stable structured errors.

Extend `POST /api/upload` with optional multipart `workspace_id`, `workspace_version`, `alias`, and `role`. When no workspace is supplied, preserve the current one-source upload behavior and every legacy response field. When a workspace is supplied, create the governed source, attach it to that workspace, and advance workspace version exactly once in one database transaction. Remove the newly created managed file if the database transaction fails.

Successful membership responses return authoritative `source`, `workspace`, and `analysis_context`. Membership alone must not select a multi-source path: return a primary-only `analysis_context` with empty `relationship_ids` until a caller explicitly selects verified sources and relationships.

## Acceptance

Repository writes use compare-and-swap workspace versioning and remain workspace-isolated. Alias defaults are deterministic and conflicts are explicit rather than silently renamed. Every successful membership mutation advances the workspace version exactly once.

Failed writes leave no membership, no version advancement, and no orphaned managed upload. Restart retrieval returns the new membership and version. Default upload, source reads, workspace reads, relationship validation, and one-source compatibility remain intact.

Focused tests cover safe source listing, attaching an existing source, uploading into a workspace, version conflict, duplicate membership, alias conflict, invalid role, missing identities, rollback and managed-file cleanup, restart persistence, and unchanged default upload behavior.

## Boundaries

Do not implement membership removal, source deletion, primary-source changes, canvas position persistence, frontend behavior, relationship activation, candidate profiling, AI Chat request changes, or any `GEMINI.md` change. Do not issue a frontend handoff until Codex verifies the route, transaction, response, and error contracts from source and tests.

## Verification

Run `python -m unittest tests.test_source_workspace_context tests.test_source_relationships tests.test_relationship_execution`, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner And Control Return

Codex owns backend implementation, contract updates, tests, and review. Return exact changed files and verification evidence to Codex. Codex performs the backend acceptance review and decides whether the bounded add-sources frontend handoff is ready.
