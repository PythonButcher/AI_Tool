# Project Active Gate — Phase 7 / Slice 7: Retained Active Workspace State

Goal: Define and verify the authoritative frontend state contract that retains one workspace and its ordered memberships across source addition, destination changes, and Data Model refreshes without inferring a multi-source analysis selection.

## User Outcome

A newly added source remains part of the active workspace when the user navigates between destinations or refreshes the Data Model, while existing one-source consumers continue using the primary source unless the user explicitly selects a verified multi-source analysis path.

## Target Files

Codex reviews `frontend/frontend/src/context/DataContext.jsx`, `frontend/frontend/src/components/layout/CanvasContainer.jsx`, `frontend/frontend/src/components/data_management/FileUpload.jsx`, and `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`.

Update `project_docs/active/contracts/multiple_data_source_workspace.md` with the retained frontend state boundary. Change backend files or tests only if source review proves that the existing workspace read and membership APIs cannot support the contract. Do not edit frontend implementation files or any `GEMINI.md` file.

## Required Context

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, this file, `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/codex_harness_engineering.md`.

## Contract Questions

Define the minimum authoritative workspace state held by the frontend, including `workspace_id`, `version`, `primary_source_id`, ordered `workspace.sources`, and the narrower `analysis_context`. State which server response replaces each part of state after default upload, workspace-targeted upload, existing-source attachment, workspace refresh, and stale-version recovery.

Keep workspace membership separate from analytical selection. Several `workspace.sources` must not expand `analysis_context.source_ids`, infer `relationship_ids`, change the primary source, or alter one-source global compatibility state.

Define how the last authoritative workspace remains visible during refresh failure, how stale workspace versions are surfaced, and how navigation consumers obtain the same workspace identity without reconstructing it from dataset rows or process-global state.

## Acceptance

The contract identifies one owner for retained workspace state, one authoritative replacement rule for successful server responses, and explicit boundaries between workspace membership, active primary-source compatibility data, and selected multi-source analysis context.

Source review proves the exact current frontend gaps and confirms whether the existing backend endpoints are sufficient. No speculative frontend handoff is created before that evidence exists.

If frontend work is required, Codex creates one bounded Antigravity handoff naming the exact state fields, target files, reconciliation behavior, regressions, build command, and control-return evidence.

## Boundaries

Do not implement AI Chat multi-source request construction, relationship auto-selection, source deletion, membership removal, primary-source changes, canvas position persistence, or frontend code. Do not use user browser acceptance as a project file or goal.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

Run focused backend tests only if backend or contract evidence requires a backend change.

## Owner And Control Return

Codex owns contract definition, source review, backend-gap classification, documentation truth, and any resulting bounded frontend handoff. Antigravity acts only after Codex verifies a concrete frontend gap and writes that handoff.
