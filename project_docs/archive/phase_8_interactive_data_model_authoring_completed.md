> COMPLETED REFERENCE — Retained as the implementation and repair record for the interactive Data Model authoring source gate.

# Antigravity Handoff — Interactive Data Model Authoring

## REPAIR REQUIRED

Goal: Repair the Data Model mutation sequencing so authoritative refreshes finish before controls unlock, and apply the workspace-only position response without retaining stale analysis state.

## Repair Blockers

In `frontend/frontend/src/features/data-model/RelationshipInspector.jsx`, the save, validate, and activation paths call the asynchronous parent `onSave(data.relationship)` without `await`. The parent performs the authoritative workspace and relationship refresh, so every path must await it inside the existing `try` block. Controls must remain disabled until that refresh finishes, and refresh errors must reach the inspector's visible error handling.

In `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`, `handleSaveAndRefresh` currently swallows `handleRefresh` failures with `.catch(() => {})`. Remove that suppression and let the rejected refresh propagate to the awaiting inspector callback.

The position-success path currently calls `setWorkspaceEnvelope({ workspace: data.workspace, analysis_context: analysisContext }, false)`. Apply only the server-returned `{ workspace }`, allow a successful mutation to clear any recorded conflict, and then await `refreshWorkspace(workspaceId)` so the standard state owner obtains a matching authoritative analysis context. Do not pass the stale client `analysisContext` as though it came from the position response. Remove the now-unneeded `analysisContext` dependency from this component if no other code uses it.

Ensure a new blank relationship draft resets correctly even when the inspector is already displaying another draft with no `relationship_id`. Clicking Create Relationship or starting a new field-handle connection must not retain source IDs, field pairs, or form values from a different unsaved draft.

Remove the trailing whitespace currently reported by `git diff --check` in `RelationshipInspector.jsx` at the two `<select>` lines and their two `value` lines, and in `SourceModelCanvas.jsx` on the blank line immediately after the drag-stop coordinate declaration. The final cleanliness command must exit successfully.

Keep the repair limited to `SourceModelCanvas.jsx`, `RelationshipInspector.jsx`, and focused tests if added. Do not change backend files, contracts, styling, or unrelated frontend behavior.

## Repair Acceptance

Source review must show that save, validate, activation, and their parent refresh are one awaited chain; refresh rejection remains visible; position success applies the workspace-only response and reconciles analysis context; successful retry clears the recorded conflict; and distinct draft starts cannot reuse stale form state. Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`, then stop and return the changed-file and verification evidence to Codex.

## Required Context

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, and `project_docs/active/contracts/multiple_data_source_relationships.md`.

Work primarily in `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`, `SourceModelCanvas.css`, `RelationshipInspector.jsx`, and `RelationshipInspector.css`. Update `frontend/frontend/src/context/DataContext.jsx` and its focused test only if a small shared-state helper is required to apply the workspace-only position response safely. Add focused Data Model tests where they provide direct acceptance evidence. Do not change backend files or `GEMINI.md`.

## Non-Negotiable Backend Contract

On drag end, call `PATCH /api/data-workspaces/<workspace_id>/sources/<source_id>/position` with `{ version: activeWorkspace.version, position: { x, y } }`. Both coordinates must be finite numbers. A success returns only `{ workspace }`; replace `activeWorkspace` wholesale from that authoritative object, then use the standard workspace refresh path to reconcile the now-version-mismatched `analysisContext`. Never construct or patch `analysisContext` from canvas membership or position state.

Treat `workspace_version_conflict` as a visible recoverable conflict. Record the attempted version through the existing workspace-conflict state, refresh authoritative workspace truth, preserve the user's dropped coordinate as an unsaved retry value, and never silently replay it. Other structured errors remain visible while the last authoritative saved canvas stays usable.

Relationship authoring must use the existing workspace-scoped endpoints: list and create through `/api/data-workspaces/<workspace_id>/relationships`, retrieve, edit, activate, deactivate, and delete through `/api/data-workspaces/<workspace_id>/relationships/<relationship_id>`, and validate through `/api/data-workspaces/<workspace_id>/relationships/<relationship_id>/validate`. Use exact `left_source_id`, `right_source_id`, ordered `field_pairs` with `left_field` and `right_field`, `cardinality`, `join_behavior`, `filter_direction`, relationship `version`, `is_confirmed`, `is_active`, `validation_state`, `validated_at`, and `diagnostics`. Suggestions remain optional and inactive; do not infer or auto-activate relationships.

## Required Behavior

Source nodes must be controlled, freely draggable with mouse and keyboard-accessible movement, and initialized from each membership's saved `position`. Edges must remain connected while nodes move. Persist at drag completion rather than on every pointer movement. A refresh or destination change must restore server positions, while sources without saved coordinates receive a deterministic local starting layout that is not treated as saved until the user moves them.

Make relationship creation discoverable without requiring users to guess that field handles are interactive. Users must be able to choose two sources and fields, manage ordered composite field pairs, configure cardinality, join behavior, and filter direction, then create, edit, validate, confirm, activate, deactivate, or delete a relationship. Preserve drafts and authoritative canvas state across save failures and stale versions. Show draft, unvalidated, invalid, blocked, stale, valid-inactive, and active states in plain language with actionable server diagnostics.

Keep source membership, aliases, roles, primary source, analysis source selection, AI Chat context, semantic metadata, and one-source compatibility state unchanged. Do not add automatic layout persistence, automatic relationship inference, source removal, primary-source changes, or AI Chat integration.

## Creative Latitude

Use the existing design system, but choose the component composition, control treatment, spacing, emphasis, micro-interactions, and concise copy that make the workflow clear and accessible. These presentation choices may not alter server identities, optimistic version behavior, validation semantics, or ownership boundaries.

## Acceptance Evidence And Control Return

Provide the exact changed-file list, focused test results, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Verify from source that rapid workspace changes cannot commit stale fetch results, network callbacks remain awaited, node moves do not issue request floods, errors preserve drafts, and delete cannot remove a source.

Stop after this handoff and return the evidence to Codex for review through `project_docs/active/active_gate/README.md`. Do not begin AI Chat integration or claim user browser acceptance; the user owns browser-level acceptance in chat.
