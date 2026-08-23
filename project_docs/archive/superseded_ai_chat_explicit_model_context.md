# Superseded Design Reference — Manual AI Chat Model Context

This handoff is not active. It preserves the rejected manual-selection design for historical context only.

# Antigravity Handoff — Explicit AI Chat Model Context

Goal: Let users explicitly choose a workspace source-and-relationship model for AI Chat, send only its verified identity boundary, and retain the canonical context through conversational refinements.

## Required Context

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, and `project_docs/active/contracts/multiple_data_source_relationships.md`.

Work primarily in `frontend/frontend/src/features/ai/AIShell.jsx` and `AIShell.css`. Update `frontend/frontend/src/context/DataContext.jsx` and `DataContext.test.jsx` only if a small shared-state boundary is needed. Add focused AI Shell tests where they directly prove request and refinement behavior. Do not change backend files, Data Model authoring, or `GEMINI.md`.

## Backend Contract

`POST /api/decision/chat/turns` accepts identity-only `analysis_context` containing `workspace_id`, exact `workspace_version`, `primary_source_id`, ordered unique `source_ids`, and ordered unique `relationship_ids`. The backend reloads workspace, source, and relationship truth; requires the primary source; accepts only an explicit active, confirmed, freshly valid relationship tree; rejects stale, missing, unsafe, cyclic, disconnected, or ambiguous selections; and never trusts caller rows, aliases, relationship definitions, fingerprints, or lineage.

A successful response returns canonical `analysis_context`, optional `analysis_lineage`, governance readiness, BI artifacts, and `session_state`. Multi-source artifacts repeat the canonical lineage in their artifact and grounding payloads. The returned session state retains identity-only analysis context for refinements.

## Required Selection Behavior

Add a compact, discoverable model-context control in AI Chat using `DataContext.activeWorkspace` and the workspace-scoped `GET /api/data-workspaces/<workspace_id>/relationships` response. The user must explicitly select ordered sources and relationship IDs. Keep the primary source selected and first. Do not infer a path merely because sources are workspace members, and do not automatically select or activate relationships.

Only active, confirmed, freshly `valid`, non-`many_to_many` relationships are eligible for execution. Other relationships may be shown with an honest disabled reason if that improves clarity. Preserve the user's explicit draft selection when a request is refused, but require deliberate correction or retry.

Show the active model context near the AI Chat input or header so the user can see the selected source aliases and relationship count and can clear back to one-source mode. Keep presentation compact and consistent with the current design system.

## Request And Retention Behavior

When an explicit multi-source model is active, send `analysis_context` in the initial `/api/decision/chat/turns` request and omit `dataset`, `semantic_model`, and `dataset_ref`. Do not combine the model context with unrelated Data Hub mention resolution. Use only workspace identity from `activeWorkspace` and the user's ordered explicit selections.

After success, treat `data.analysis_context` as canonical. Retain that returned context with the response session state; do not promote the local draft object as verified state. Update `resolveRequestContext` or its equivalent so a session containing `dataset_context.analysis_context` remains an analysis-context request during suggested-action refinements. It must not be converted into a workspace `dataset_ref`.

If the workspace version changes or a selected relationship is no longer eligible, show the context as stale, refresh authoritative workspace and relationship state, and require a deliberate resubmission. Never silently choose a replacement path.

When no explicit multi-source model is selected, preserve the current one-source inline dataset, Data Hub mention, cleaning command, chart, table, export, and suggested-action behavior exactly.

## Acceptance

An explicit two-source, one-relationship selection produces a chat request whose `analysis_context` contains the exact current workspace identity and ordered selections with no inline dataset payload. A successful response replaces the draft with canonical returned context. A suggested refinement retains that context and does not emit a workspace `dataset_ref`.

Clearing the model context returns AI Chat to its unchanged one-source behavior. Invalid or stale selections remain visible with a useful error and are never auto-corrected into another path. Rapid workspace or selection changes cannot let an older fetch or response overwrite newer context.

Full result-lineage presentation, source mentions inside answer text, and broader table/chart provenance design are outside this handoff.

## Verification And Control Return

Run focused frontend tests, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Return the exact changed-file list and verification results to Codex, then stop. Codex reviews through `project_docs/active/active_gate/README.md`; do not begin the lineage-presentation follow-up or claim user browser acceptance.
