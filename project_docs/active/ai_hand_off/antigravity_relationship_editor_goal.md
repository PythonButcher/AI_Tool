Goal: Add safe relationship creation and editing to the existing Data Model canvas through the verified workspace-isolated relationship API.

## Target

Work only in `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx`, `frontend/frontend/src/features/data-model/SourceModelCanvas.css`, and focused new components or styles under `frontend/frontend/src/features/data-model/` when separation materially improves the implementation. Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/active_gate/README.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/codex_harness_engineering.md` before editing.

Backend readiness is `backend_contract_ready`. Keep `analysis_context.workspace_id` as the only workspace identity. Continue using `workspace.sources[]` and the analysis-context response's `sources[].schema[]` as the source and field choices. Do not infer sources, fields, relationships, or paths from display labels.

## Required Behavior

Add one coherent relationship-management flow to the existing Data Model destination. A field-level connection gesture should seed a draft between two different workspace sources, and selecting an existing relationship should open the same focused inspector in edit mode. The inspector must support one or more ordered field pairs using exact schema field names, plus `cardinality`, `join_behavior`, and `filter_direction`. It must show `validation_state`, ordered `diagnostics`, `is_confirmed`, `is_active`, `version`, and `validated_at` from the server response.

Create with `POST /api/data-workspaces/<workspace_id>/relationships`. Send `left_source_id`, `right_source_id`, ordered `field_pairs`, `cardinality`, `join_behavior`, `filter_direction`, and `validate: true`; do not request activation during creation. Edit configuration with `PATCH /api/data-workspaces/<workspace_id>/relationships/<relationship_id>` and include the current `version`. Configuration edits must visibly explain that server truth deactivates the relationship and clears old validation evidence. Refresh validation with `POST /api/data-workspaces/<workspace_id>/relationships/<relationship_id>/validate`.

Activation must be a separate, explicit user action. Activate with `PATCH` using the current `version`, `is_confirmed: true`, and `is_active: true`; deactivate with the current `version` and `is_active: false`. Never activate automatically after create, edit, validation, or opening the inspector. Treat the returned `{ relationship }` as authoritative after every successful mutation and update the canvas without inventing local trust state.

Preserve a user's draft when the API returns `{ error: { code, message, diagnostics? } }`. Make `relationship_version_conflict`, `relationship_confirmation_required`, and `relationship_not_activatable` understandable and actionable; render returned diagnostics without exposing raw data. Cancel must close the draft with no request. Prevent same-source links, empty field pairs, repeated fields, unsupported enum values, and accidental duplicate submission before sending.

## Boundaries

Do not call the candidate-profiling endpoint, generate automatic suggestions, select paths automatically, delete relationships, mutate workspace membership, persist canvas positions, change upload or AI Chat payloads, add backend code, redesign unrelated destinations, or modify any `GEMINI.md` file. Preserve the read canvas's loading, empty, unavailable, API-error, no-relationships, and literal executable/non-executable trust states.

Creative latitude includes inspector composition, field-handle treatment, responsive layout, accessible focus management, keyboard operation, validation emphasis, motion, spacing, and concise copy inside the existing AI_Tool design system. Do not copy Power BI assets or layout.

## Acceptance

Acceptance requires a user to draft a relationship from exact live source fields, add or remove composite key pairs, cancel without mutation, create an inactive server-backed relationship, edit it with optimistic versioning, validate it, and explicitly activate or deactivate it. The canvas must immediately reflect each returned server record. Invalid, blocked, stale, suggested, inactive, unconfirmed, and many-to-many relationships must never appear executable. Error and diagnostic states must be visible, accessible, and preserve recoverable form input. Existing upload, Workspace, Explore, Dashboards, AI, Data Hub, and read-only Data Model behavior must remain intact.

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Return the exact changed files and verification output to Codex, then stop. Do not claim browser acceptance and do not start AI Chat or active-model integration.
