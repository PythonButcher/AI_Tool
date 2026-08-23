# AI Chat Active Model Context And Lineage

> COMPLETED REFERENCE: This handoff is retained as implementation history and is not an active assignment.

Goal: Complete the AI Chat trusted-result lineage presentation by rendering safe relationship identity alongside the existing multi-source names without changing the accepted workspace-context request integration.

## Repair Blocker

`frontend/frontend/src/features/ai/AIShell.jsx` renders `lineage.sources` in the Model Lineage row but never reads or renders `lineage.relationships`. The active contract requires a multi-source trusted result to show both source names or aliases and relationship identity. Extend the existing lineage treatment with a compact relationship summary using server fields such as `relationship_id`, `cardinality`, and `join_behavior`. Keep the accepted `activeWorkspace.workspace_id`, requested-mode, grounded-state, session-state, and backend-error changes intact.

## Target Files

Repair the bounded frontend change in `frontend/frontend/src/features/ai/AIShell.jsx` and, only where presentation requires it, `frontend/frontend/src/features/ai/AIShell.css`. Add a focused AIShell test only if needed to prove the rendering behavior. Do not change backend files, shared workspace persistence, the Data Model authoring surface, or unrelated AI Chat layout.

## Required Context

Read `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and this handoff before editing.

`DataContext.activeWorkspace.workspace_id` is the current workspace identity. `POST /api/decision/chat/turns` now accepts top-level `workspace_id` and resolves the complete active model on the server. The frontend must not send or derive `source_ids`, `relationship_ids`, table choices, join fields, or relationship paths. Existing `dataset`, `semantic_model`, `dataset_ref`, resolved mention, and one-source behavior remain compatibility inputs.

Send `workspace_id: activeWorkspace?.workspace_id` on both the normal message request and the suggested-action refinement request. Treat an available workspace identity as grounded Explore context when setting `requested_mode` and the assistant message's `grounded` flag. Preserve the returned `session_state`; the backend retains and re-resolves canonical context for refinements. When there is no active workspace identity, keep the current one-source request behavior unchanged.

Successful multi-source responses expose canonical `analysis_context` with `workspace_id`, `workspace_version`, `primary_source_id`, ordered `source_ids`, and ordered `relationship_ids`. Result artifacts expose aggregate-safe lineage at `artifact.bi_grounding.analysis_lineage` and `artifact.analysis_lineage`. The lineage contract includes `sources[]` with `source_id`, `source_alias`, and `source_name`; `relationships[]` with `relationship_id`, `cardinality`, `join_behavior`, and ordered `field_pairs`; plus `primary_grain`, `join_order`, and `observed_fanout`.

## Required Behavior

Keep the existing AI Chat composition and show concise lineage within the trusted-result card when `analysis_lineage` contains more than one source. Render source names or aliases and a relationship summary derived from `lineage.relationships`. The relationship treatment must expose the stable relationship identity and may add its cardinality or join behavior for clarity. Do not expose source fingerprints, validation fingerprints, raw data values, private locators, or filesystem paths. Do not render a lineage section for ordinary one-source results.

Surface backend model-resolution failures through the existing error treatment without replacing the server's Data Model repair message with join-configuration instructions. In both request catch paths, prefer `requestError.response?.data?.error?.message` after any governance message and before the generic Axios message. Do not add a source picker, relationship picker, setup wizard, join editor, or model-context selector to AI Chat.

The non-negotiable boundary is the workspace-only request identity, server-owned relationship selection, retained session state, visible safe lineage, unchanged one-source behavior, and no AI Chat modeling controls. Antigravity has creative latitude over the compact accessible lineage layout, labels, spacing, disclosure treatment, and concise copy inside the existing design system.

## Acceptance And Verification

Source evidence must show the Model Lineage treatment reading both `lineage.sources` and `lineage.relationships`, with stable relationship identity visible for a multi-source answer or chart. Both Decision Chat request paths must continue sending only the current `workspace_id` for model resolution and preserving server `session_state`. A one-source result must keep the existing trusted-result presentation. Existing mentions, cleaning commands, tables, charts, export, and suggested refinements must remain intact.

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Return the changed-file list, focused source or test evidence, and build result to Codex, then stop for Codex integration review.

## Owner And Control Return

Antigravity owns this bounded frontend implementation. Control returns to Codex after the requested evidence is available. Codex owns contract review and the readiness decision.
