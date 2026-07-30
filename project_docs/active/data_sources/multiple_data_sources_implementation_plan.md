# Multiple Data Sources Implementation Roadmap

## Product Outcome

AI_Tool will let a user bring several governed data sources into one analytical workspace, define trustworthy relationships between them, and use that model in AI Chat, tables, and charts. A workspace with one source will remain a fully supported case, so the current upload and AI Chat experience can migrate without a disruptive rewrite.

The experience should feel like a modern data-model studio built for this application: clear source identities, an expressive relationship canvas, visible trust signals, and traceable answers. It may take inspiration from the clarity of established BI modeling tools, but its visual language, interaction patterns, and copy must remain original to AI_Tool.

## Current Source Truth

The backend now persists governed sources, workspaces, workspace memberships, validated relationships, safe multi-source execution, and lineage. The Data Model canvas can read a workspace containing several sources and can create, edit, validate, activate, and deactivate relationships through the verified relationship API.

The backend can now populate one workspace through `GET /api/data-sources`, `POST /api/data-workspaces/<workspace_id>/sources`, and the optional existing-workspace fields on `POST /api/upload`. The normal frontend path does not use those contracts yet. `FileUpload.jsx` still posts only a file to the default upload path, so a second upload through the current interface creates and selects a separate one-source workspace instead of joining the current workspace.

## Architecture Direction

`datahub_datasets` remains the canonical source catalog. `data_workspaces` and `workspace_sources` remain the analytical and membership boundary. A workspace membership has a stable alias and a non-primary role, so fields can be addressed as `orders.revenue` or `customers.region` without collisions.

Relationships are persisted separately from source files. Each relationship names the workspace, both source IDs, one or more field pairs, cardinality, join behavior, filter direction, validation state, and diagnostics. Suggested relationships are candidates only; they never become active joins until validation and explicit user confirmation succeed.

The pandas execution boundary compiles only explicitly selected, validated, acyclic relationship trees, blocks ambiguous or unsupported many-to-many execution, and enforces row-expansion limits. The service boundary allows a different execution engine later without changing the public workspace contract.

AI Chat and charting consume an `analysis_context` containing the workspace ID, workspace version, primary source ID, selected source IDs, and selected relationship IDs. Membership changes do not automatically select or activate analytical paths. The current `dataset` and `dataset_ref` request forms remain supported for one-source compatibility, while multi-source fields and artifacts use namespaced references and return source and relationship lineage.

## Delivery Phases

### Phase 1 — Source Registry and Workspace Context

Status: delivered backend foundation.

Codex owns the durable source registry, default one-source workspace, managed upload identity, workspace reads, and compatibility-safe `analysis_context`.

Acceptance requires durable source and workspace retrieval, isolation between workspaces, governance and semantic metadata retained per source, an adapter that still resolves legacy single-dataset requests, safe handling of missing or unreadable managed files, and focused database, upload, and context tests. No relationship execution or frontend implementation belongs in this phase.

Control returns to Codex for contract and test review.

### Phase 2 — Relationship Contract and Trust

Status: delivered backend foundation.

Codex owns relationship persistence, candidate profiling, validation, CRUD endpoints, optimistic versions, activation safety, and value-safe diagnostics.

Acceptance requires stable relationship response fields, repeatable diagnostics, invalidation when a source fingerprint or schema changes, blocked unsupported many-to-many execution, and tests for one-to-one, one-to-many, composite-key, mismatch, cycle, and stale-source cases.

Control returns to Codex for contract review.

### Phase 3 — Safe Multi-Source Analytics

Status: delivered backend foundation.

Codex owns deterministic relationship execution, namespaced semantic composition, primary-grain anchoring, governance aggregation, lineage, and row-expansion limits.

Acceptance requires cross-source metric-by-dimension analysis, safe refusal for ambiguous paths or blocked sources, conversational refinements that retain the same workspace context, chart artifacts with source lineage, and unchanged behavior for existing one-source requests. Focused regression coverage must include upload, Data Hub, AI Chat, semantic metrics, governance, and charting.

Control returns to Codex for backend acceptance.

### Phase 4 — Data Model Canvas and Relationship Editor

Status: delivered frontend foundation.

Antigravity owns the Data Model destination, read canvas, field-level relationship drafting, focused relationship inspector, validation evidence, optimistic versions, explicit activation, recoverable errors, and literal executable or non-executable trust rendering.

Acceptance requires the canvas and editor to consume only server identities and schema fields, preserve ordered composite pairs, keep invalid or unsafe relationships non-executable, and leave source membership and AI Chat context outside this phase.

Control returns to Codex for targeted source and contract review.

### Phase 5 — Workspace Membership API

Status: delivered backend foundation.

Codex adds the missing backend boundary for populating one workspace with several sources. Add a safe source-catalog read endpoint, a versioned endpoint that attaches an existing catalog source to a workspace, and an optional existing-workspace target for governed file upload. Membership writes must be transactional, workspace-isolated, alias-safe, and optimistic-concurrency protected.

The existing-source request uses `source_id`, `alias`, `role`, and current workspace `version`. Upload-to-workspace uses multipart `workspace_id`, `workspace_version`, optional `alias`, and `role` while preserving every legacy upload response field. Added sources may use only `lookup` or `context`; membership mutation never changes the primary source, activates a relationship, or selects a multi-source analysis path. Responses return authoritative `{ source, workspace, analysis_context }`, with `analysis_context` remaining a safe one-source primary context until explicit source and relationship selections are made.

Acceptance requires safe public source listing without private paths or locators; atomic membership plus workspace-version advancement; duplicate-member, alias-conflict, invalid-role, missing-source, missing-workspace, and stale-version errors; managed-file cleanup after failed upload membership; restart persistence; and unchanged default one-source upload behavior. Focused tests must prove both attaching an existing source and uploading a new source into an existing workspace.

Control returns to Codex for route, transaction, contract, and test review. Frontend readiness remains `backend_not_ready` until this phase is accepted.

### Phase 6 — Add Sources to the Current Workspace

Antigravity receives one bounded frontend handoff after Phase 5 reaches `backend_contract_ready`. Add one clear action in the existing workspace or Data Model surface that lets a user upload another governed file into the current workspace or choose an eligible existing catalog source. The interface must show the current workspace, source identity, proposed alias and role, progress, conflicts, and the authoritative returned membership.

Acceptance requires no accidental creation of a separate workspace, no automatic relationship or analysis-path selection, visible alias and version conflicts without losing the user's choice, safe cancellation, and an immediate refresh of the workspace source list from the returned server record. Existing one-source upload remains unchanged.

Control returns to Codex for targeted source and contract review.

### Phase 7 — Retained Active Workspace State

Codex first fixes the frontend state contract, then Antigravity receives one bounded handoff to retain the authoritative workspace and its ordered members across upload, source addition, destination changes, and Data Model refreshes. The active state must distinguish workspace membership from the narrower source and relationship selections used for analysis.

Acceptance requires a newly added source to remain visible after navigation and refresh, the Data Model canvas to receive all workspace members, one-source consumers to keep their current behavior, and no multi-source AI Chat request to be inferred merely because several sources belong to the workspace. Stale workspace versions and failed refreshes remain visible without discarding the last authoritative workspace.

Control returns to Codex for state-flow and regression review.

### Phase 8 — AI Chat Model Context and Lineage

Antigravity receives a separate frontend handoff only after workspace membership and active workspace state are verified. Connect explicit selected source IDs and active relationship IDs to AI Chat, tables, charts, and result lineage. Show source mentions, active-model context, namespaced fields, governance warnings, and honest relationship limitations without automatically choosing paths.

Acceptance requires cross-source questions and charts to use only the explicit verified analysis context, conversational refinements to retain that context, and result artifacts to show source and relationship lineage. Existing one-source AI Chat remains unchanged.

Control returns to Codex for integration review.

### Phase 9 — Reliability and Release

Codex owns cross-path regression, migration, concurrency, deletion, and performance hardening. Source deletion must protect or explicitly invalidate dependent relationships and workspaces. Tests cover restart persistence, duplicate uploads, stale schemas, large joins, row-explosion limits, governance aggregation, and one-source compatibility. Documentation and API examples are finalized from verified behavior.

Antigravity receives a repair-only handoff if integration review finds a concrete UI defect. The phase is complete only after backend verification, Codex frontend review, a clean production build, harness checks, and user acceptance discussed in chat.

## Current Backend File Areas

Phase 5 centers on `backend/repositories/source_workspace_repository.py`, `backend/services/workspace_context.py`, `backend/routes/data_workspaces.py`, `backend/routes/upload.py`, and `tests/test_source_workspace_context.py`, with relationship and execution regressions where membership changes affect their fixtures. Later work may extend `frontend/frontend/src/context/DataContext.jsx`, the upload and Data Model feature areas, Decision Chat request construction, charting, and lineage rendering. `backend/utils/global_state.py` remains a one-source compatibility boundary, not workspace truth.

## Handoff Discipline

The active gate always contains one standalone Codex kickoff goal. No Antigravity handoff is activated before its backend readiness level is verified. Every frontend handoff names exact endpoints and response fields, non-negotiable acceptance behavior, creative latitude, build evidence, and the instruction to stop and return control to Codex. User acceptance remains in chat and never creates a project goal or checklist file. The active status file names one owner and one next action at all times.
