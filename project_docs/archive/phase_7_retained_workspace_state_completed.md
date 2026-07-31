# Completed Reference — Retained Active Workspace State

This handoff is archived as verified delivery evidence and is not an active implementation prompt.

# Retained Active Workspace State

## REPAIR REQUIRED

## Repair Blocker

`frontend/frontend/src/context/DataContext.test.jsx` asserts `contextState.workspaceRefreshError`, but its `TestComponent` never reads that context field or supplies it to `onStateChange`. The focused command therefore fails with `Received: undefined`; add the field to the test harness and retain the assertion proving the normalized error object while preserving the retained records.

`frontend/frontend/src/context/DataContext.jsx` converts every failed workspace or analysis-context response into `new Error(...)` and then always records `{ code: 'refresh_error', ... }`. This loses a structured server `error.code`, despite the active contract requiring stable server codes and messages to remain visible. Preserve server codes such as `workspace_not_found` when the response supplies them, using a client fallback code only for transport or unstructured failures. Add a focused assertion for this behavior.

Repair only these test and structured-error blockers. Do not broaden the UI or API scope.

Goal: Make `DataContext` the single retained frontend owner of the active workspace so workspace identity and ordered memberships survive upload, navigation, and Data Model refreshes without expanding the selected analysis context.

## Read First

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/active_gate/README.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and this handoff.

## Target Files

Update `frontend/frontend/src/context/DataContext.jsx`, add `frontend/frontend/src/context/DataContext.test.jsx`, and update `frontend/frontend/src/App.jsx`, `frontend/frontend/src/components/layout/CanvasContainer.jsx`, `frontend/frontend/src/components/data_management/FileUpload.jsx`, `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`, and `frontend/frontend/src/features/data-model/AddSourcePanel.jsx`. Do not change backend files, `GEMINI.md`, AI Chat request construction, relationship selection, source removal, primary-source changes, or canvas position persistence.

## Backend Contract

`POST /api/upload`, including workspace-targeted multipart upload, and `POST /api/data-workspaces/<workspace_id>/sources` return `{ source, workspace, analysis_context }`. Store the returned `workspace` and `analysis_context` atomically. `workspace` supplies `workspace_id`, `version`, `primary_source_id`, and server-ordered `sources`. `analysis_context` supplies `workspace_id`, `workspace_version`, `primary_source_id`, ordered `source_ids`, and ordered `relationship_ids`.

`GET /api/data-workspaces/<workspace_id>` returns `{ workspace }` and is the membership refresh. Inspect the response before committing it. If its identity, primary source, and version match the retained analysis context, replace only the workspace. If the analysis context is absent or any of those fields differ, do not commit the workspace-only response; fetch `GET /api/data-workspaces/<workspace_id>/analysis-context` with no `source_id` parameters and atomically apply the authoritative primary-only `{ workspace, analysis_context }`. Never construct that fallback locally.

Use `GET /api/data-sources` or `GET /api/data-sources/<source_id>` for public source schemas and metadata, then merge those details in `workspace.sources` order. Do not request an analysis context containing every workspace member merely to populate the Data Model. A `workspace_version_conflict` is HTTP 409 with structured `error.code` and `error.message`; the current version is learned from the subsequent workspace refresh.

## Required Behavior

Add `activeWorkspace` and separately named `analysisContext` records to `DataContext`. Store the complete latest server objects rather than reconstructing or partially merging them. Add `workspaceRefreshStatus` with `idle`, `refreshing`, and `error` values, structured `workspaceRefreshError`, and structured `workspaceVersionConflict` containing `code`, `message`, `attemptedVersion`, and the refreshed `currentVersion`.

Provide one context action that atomically applies a successful `{ workspace, analysis_context }` envelope and one refresh action implementing the version-reconciliation rule above. Preserve both retained records while refresh is in flight or fails. Keep `uploadedData`, `fullData`, `cleanedData`, and global one-source compatibility behavior intact.

Make the app-level upload success handler the single successful default-upload integration point: it applies the workspace envelope and continues the current preview, full-data, semantic-model, and one-source compatibility updates. `FileUpload` passes the complete response to that handler and must not independently maintain a competing retained-workspace copy or perform a second workspace update.

Pass the retained workspace identity from context through the navigation shell to `SourceModelCanvas`; do not derive it from `uploadedData`. Refactor the canvas so refresh uses the shared action, keeps the last successful workspace visible during loading and failure, renders memberships in server order, and keeps relationship state and source-schema enrichment local.

`AddSourcePanel` must pass the complete successful `{ source, workspace, analysis_context }` response to the canvas/shared action for both existing-source attachment and workspace-targeted upload. Apply that envelope before refreshing metadata. For a stale-version conflict, retain the user's file or catalog selection, alias, and role; record the attempted version; refresh shared state to learn the current version; keep the conflict visible; and require a deliberate retry. Never silently replay the mutation.

Multiple `workspace.sources` must not change `analysisContext.source_ids`, set any relationship IDs, change the primary source, or overwrite global one-source data.

For this repair, `CanvasContainer` must pass `activeWorkspace?.workspace_id` or `SourceModelCanvas` must read that identity directly from `DataContext`; there must be no remaining workspace-ID dependency on `uploadedData`.

The mutation conflict path must record `{ code, message, attemptedVersion }` from the failed add-source request, refresh the shared workspace, and then fill `currentVersion` from the refreshed server workspace while keeping the conflict present. `workspaceRefreshError` must remain a normalized `{ code, message }` object rather than a string. Remove the impossible test that expects `GET /api/data-workspaces/<workspace_id>` to return a version conflict and replace it with a test of the actual mutation-conflict recording plus refresh reconciliation path.

## Acceptance

Default upload creates retained workspace state exactly once. Adding an existing or uploaded source updates the shared ordered membership list, version, and primary-only analysis envelope immediately. Leaving and re-entering Data Model shows the same active workspace without relying on dataset rows. Canvas schema loading uses the public source endpoints and does not expand analytical selection. A failed refresh does not blank the last known workspace or analysis context. A stale-version conflict preserves the attempted input and becomes recoverable after authoritative refresh. One-source upload, charts, ML, and AI Chat behavior remain primary-source compatible.

Focused tests must prove atomic envelope replacement, preservation during refresh failure with a structured error, stale-version reconciliation from a mutation conflict to a server-issued primary-only context, retained conflict visibility with attempted and current versions, the Data Model identity path from `activeWorkspace`, and the rule that multiple memberships do not expand `source_ids` or `relationship_ids`.

## Verification And Return

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand DataContext.test.jsx`, then run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Stop after this bounded implementation. Return the changed-file list, test and build results, and a concise account of default upload, workspace-targeted upload, add-existing-source, refresh failure, stale-version recovery, and one-source regression handling so Codex can review the contract.

## Creative Latitude

Choose the component decomposition, state helper names, accessible error treatment, loading treatment, and concise UI copy within the existing design system. Do not alter the stated state boundary, API contract, or product scope.
