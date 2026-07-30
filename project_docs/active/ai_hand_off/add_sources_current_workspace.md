# Add Sources To The Current Workspace

Goal: Add one accessible Data Model action that lets a user attach an eligible catalog source or upload a governed file into the currently displayed workspace without changing the primary analytical source.

## Target Files

Implement the bounded UI behavior in `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx` and `frontend/frontend/src/features/data-model/SourceModelCanvas.css`. A focused sibling component and stylesheet under `frontend/frontend/src/features/data-model/` may be added when that keeps the canvas logic clear. Do not modify `DataContext.jsx`, `FileUpload.jsx`, AI Chat request construction, relationship contracts, backend files, or any `GEMINI.md` file.

## Active Documentation

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and this handoff.

## Backend Contract

Load eligible governed sources from `GET /api/data-sources`, which returns `{ sources }`. Each public source includes `source_id`, `name`, `source_kind`, `managed_locator`, `schema`, `row_count`, `column_count`, governance fields, and timestamps; it never includes a host path or private locator. Exclude sources already present in the current workspace.

Attach an existing source with `POST /api/data-workspaces/<workspace_id>/sources` and JSON `{ source_id, alias?, role?, version }`. Upload a new source with multipart `POST /api/upload` fields `file`, `workspace_id`, `workspace_version`, optional `alias`, and optional `role`. Added roles are only `lookup` and `context`.

Both successful mutations return authoritative `source`, `workspace`, and `analysis_context`. Use `workspace.version` and `workspace.sources` from that response as mutation truth, then await the canvas workspace refresh before re-enabling the completed action. Do not treat `analysis_context.source_ids` as the workspace membership list; it intentionally remains primary-only with empty `relationship_ids`.

Render stable server errors from `error.message`. Handle `duplicate_workspace_membership`, `workspace_alias_conflict`, and `workspace_version_conflict` as recoverable conflicts without discarding the selected file or catalog source. Refresh authoritative workspace data after a version conflict while keeping the user's pending choice visible. Treat `workspace_not_found` and `source_not_found` as missing-identity errors, and reject `primary` locally because only `lookup` and `context` are allowed.

## Non-Negotiable Acceptance

The Data Model surface shows one clear Add Source action only when a workspace exists. The focused panel identifies the current workspace, supports exactly one catalog attachment or one file upload at a time, exposes editable alias and role, provides progress and safe cancellation, and prevents duplicate submission.

A successful mutation immediately refreshes the canvas from the returned workspace identity and the existing workspace read path. It must not create a separate workspace, replace the primary source, select a multi-source analysis path, activate a relationship, or route the new upload through the legacy global `setUploadedData` behavior.

An alias or stale-version conflict remains visible and actionable without losing the user's pending choice. Closing or cancelling performs no mutation. Existing relationship drafting, validation, activation, canvas error recovery, and the default one-source upload surface remain unchanged.

## Creative Latitude

Choose the focused component structure, accessible dialog or panel treatment, spacing, icons, concise labels, and micro-interactions within the existing Data Model design system. Keep server identities, roles, version semantics, error behavior, and refresh ordering exactly as specified.

## Verification And Control Return

Run `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Return the exact changed files, build result, and concise source-level evidence for catalog attach, workspace-targeted upload, conflict retention, cancellation, and awaited refresh. Stop after this bounded implementation and return control to Codex for contract review. Do not begin retained workspace state or AI Chat integration.
