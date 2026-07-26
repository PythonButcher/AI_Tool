# Project Active Gate — Phase 5 / Slice 5: Workspace Membership API

## Goal

Add a safe, versioned backend boundary that lets one analytical workspace contain several governed sources.

## User Outcome

A client can list eligible sources, attach a catalog source to a workspace, or upload a new source into that workspace without creating a separate workspace or silently changing the analytical model.

## Scope

Implement membership repository transactions, workspace-context service behavior, public routes, upload targeting, and focused tests in `backend/repositories/source_workspace_repository.py`, `backend/services/workspace_context.py`, `backend/routes/data_workspaces.py`, `backend/routes/upload.py`, and `tests/test_source_workspace_context.py`.

Do not change frontend files, remove memberships, change the primary source, activate relationships, select analysis paths, alter AI Chat requests, or modify `GEMINI.md`.

## Contracts

Use `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

## Acceptance

The backend exposes a safe source list, attaches an eligible catalog source with optimistic workspace versioning, and accepts a governed upload targeted at a workspace. Each successful mutation advances workspace version exactly once and returns authoritative source, workspace, and primary-only analysis context. Duplicate membership, alias conflict, invalid role, missing identity, stale version, and failed upload membership are safe, structured, and transactionally clean. Default one-source upload behavior remains unchanged.

## Verification

Run `python -m unittest tests.test_source_workspace_context tests.test_source_relationships tests.test_relationship_execution`, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner

Codex owns backend implementation, contract updates, tests, and review. Control returns to Codex for a source and test gate before any frontend handoff.

Kickoff goal: `project_docs/active/active_gate/codex_workspace_membership_api_goal.md`.
