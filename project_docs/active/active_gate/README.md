# Project Active Gate — Phase 6 / Slice 6: Add Sources To The Current Workspace

Goal: Deliver and verify one bounded Data Model action that adds a governed catalog source or upload to the currently displayed workspace without changing the primary analytical source.

## User Outcome

A user can remain in the current Data Model workspace, choose an eligible catalog source or upload one governed file, set its alias and non-primary role, and see the authoritative new member appear without creating or selecting another workspace.

## Scope

Antigravity implements only `project_docs/active/ai_hand_off/add_sources_current_workspace.md`. The primary target is `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx` and its focused styling or sibling component under the same feature directory.

Codex reviews the returned frontend source and verification evidence against `project_docs/active/contracts/multiple_data_source_workspace.md`, the route behavior in `backend/routes/data_workspaces.py` and `backend/routes/upload.py`, and the bounded handoff.

## Contracts

The implementation uses `GET /api/data-sources`, `POST /api/data-workspaces/<workspace_id>/sources`, and the optional existing-workspace multipart fields on `POST /api/upload`.

Successful membership mutations return authoritative `source`, `workspace`, and `analysis_context`. The updated workspace version and memberships come from `workspace`; `analysis_context` remains primary-only with empty `relationship_ids`.

Only `lookup` and `context` are valid added roles. Duplicate membership, alias conflict, stale version, missing identities, and invalid inputs remain structured server errors.

## Acceptance

The current Data Model workspace exposes one accessible Add Source action supporting one catalog attachment or one file upload at a time. The interaction shows the current workspace, alias, role, progress, recoverable conflicts, and safe cancellation.

Success awaits an authoritative canvas refresh and keeps the existing primary source and relationship state. It does not create another workspace, select a multi-source path, activate a relationship, change the default upload surface, or begin retained global workspace state.

Codex acceptance requires a focused source review against the handoff, a clean frontend build result from Antigravity, and evidence that pending user choices survive alias and version conflicts.

## Verification

Antigravity runs `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.

Codex performs the targeted contract review after control returns. Browser-level acceptance remains with the user in chat after Codex accepts the implementation.

## Owner And Control Return

Antigravity owns the bounded frontend implementation in `project_docs/active/ai_hand_off/add_sources_current_workspace.md`. Antigravity stops after the requested source changes and verification evidence, then returns control to Codex. Codex owns acceptance classification, documentation truth, and the next gate decision.
