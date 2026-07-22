# Multiple Data Sources Implementation Roadmap

## Product Outcome

AI_Tool will let a user bring several governed data sources into one analytical workspace, define trustworthy relationships between them, and use that model in AI Chat, tables, and charts. A workspace with one source will remain a fully supported case, so the current upload and AI Chat experience can migrate without a disruptive rewrite.

The experience should feel like a modern data-model studio built for this application: clear source identities, an expressive relationship canvas, visible trust signals, and traceable answers. It may take inspiration from the clarity of established BI modeling tools, but its visual language, interaction patterns, and copy must remain original to AI_Tool.

## Source-Backed Starting Point

The backend can list many records in `datahub_datasets` and `/api/datahub/fetch_rows` can return several datasets, but analytical execution remains single-source. `backend/utils/global_state.py` stores one process-global dataframe and semantic model; `backend/services/dataset_context.py` resolves one bundle; `DecisionChatService.prepare_payload` refuses more than one resolved dataset; and `/api/nlp/chart` requires one inline dataset.

Upload, external API, and SQL preview routes also replace the same global active dataframe. The file upload route does not create a durable Data Hub identity, while manual Data Hub registration accepts a client-supplied path. The first change therefore extends the existing Data Hub registry into the canonical source registry and wraps the current active dataset in a workspace context.

## Architecture Direction

`datahub_datasets` remains the canonical source catalog instead of creating a competing registry. It gains source kind, managed locator metadata, content fingerprint, schema version, and timestamps. New `data_workspaces` and `workspace_sources` tables store the analytical boundary and source membership. A workspace source has a stable alias and role, so fields can later be addressed as `orders.revenue` or `customers.region` without collisions.

Relationships are persisted separately from source files. Each relationship names the workspace, both source IDs, one or more field pairs, cardinality, join behavior, filter direction, validation state, and diagnostics. Suggested relationships are candidates only; they never become active joins until validation and explicit user confirmation succeed.

The initial execution engine should use the app's existing pandas stack. It will compile only validated, acyclic relationship paths, block ambiguous or unsupported many-to-many execution, and enforce row-expansion limits. The contract will isolate execution behind a service boundary so DuckDB or another query engine can replace pandas later if measured scale requires it.

AI Chat and charting will receive an `analysis_context` containing the workspace ID, primary source ID, selected source IDs, and selected relationship IDs. The current `dataset` and `dataset_ref` request forms remain supported through a compatibility adapter that creates an ephemeral one-source context. Multi-source fields and artifacts use namespaced references and return source and relationship lineage.

## Delivery Phases

### Phase 1 — Source Registry and Workspace Context

Codex owns this backend foundation. Extend the database schema and repository helpers, add a workspace-context service and routes, and modify `POST /api/upload` so a successful governed upload receives a server-generated source identity, managed storage locator, and default one-source workspace. Preserve all current upload response fields while adding `source` and `analysis_context`.

Acceptance requires durable source and workspace retrieval, isolation between workspaces, governance and semantic metadata retained per source, an adapter that still resolves legacy single-dataset requests, safe handling of missing or unreadable managed files, and focused database, upload, and context tests. No relationship execution or frontend implementation belongs in this phase.

Control returns to Codex for contract and test review. Backend readiness remains `backend_not_ready` for frontend relationship work until this gate is accepted.

### Phase 2 — Relationship Contract and Trust

Codex adds relationship persistence, candidate profiling, validation, and CRUD endpoints. Validation checks field existence, type compatibility, key uniqueness, null rates, unmatched keys, declared cardinality, ambiguous paths, cycles, and estimated row multiplication. Candidate confidence must be explained from schema and profile evidence and must not be described as proof that a join is correct.

Acceptance requires stable relationship response fields, repeatable diagnostics, invalidation when a source fingerprint or schema changes, blocked unsupported many-to-many execution, and tests for one-to-one, one-to-many, composite-key, mismatch, cycle, and stale-source cases.

Control returns to Codex for contract review. A read-only frontend canvas may be handed off only when the workspace and relationship read contracts are verified.

### Phase 3 — Safe Multi-Source Analytics

Codex implements the relationship execution service and integrates `analysis_context` with AI Chat, semantic resolution, and chart construction. Joins must be deterministic, use namespaced fields, respect the primary source and explicit relationship path, surface governance from every participating source, and return lineage plus fanout diagnostics with every answer, table, and chart.

Acceptance requires cross-source metric-by-dimension analysis, safe refusal for ambiguous paths or blocked sources, conversational refinements that retain the same workspace context, chart artifacts with source lineage, and unchanged behavior for existing one-source requests. Focused regression coverage must include upload, Data Hub, AI Chat, semantic metrics, governance, and charting.

Control returns to Codex for backend acceptance. Only then may Antigravity connect the full editing and AI Chat experience to live endpoints.

### Phase 4 — Multi-Source Studio

Antigravity receives three bounded handoffs, one at a time. The first adds an original sidebar destination and a visually striking source-model canvas using the app's theme: recognizable connected-source iconography, polished source nodes, spacious relationship lines, meaningful depth and motion, strong empty/loading/error states, and accessible keyboard and screen-reader behavior. The result should feel premium and dramatic without copying Power BI's layout or visual assets.

The second handoff adds relationship creation and editing: field-level connection gestures, a focused inspector for keys, cardinality, direction, validation, mismatch warnings, and clear save or cancel behavior. The third handoff connects workspace selection to AI Chat and result lineage, including source mentions, active-model context, source-aware chart/table labels, and honest relationship or governance warnings.

Each handoff is limited to one visible behavior and a small file set. Antigravity returns changed-file and build evidence to Codex after every slice; Codex reviews source and contract compliance before the next handoff. The user performs browser acceptance only after Codex marks each frontend slice ready.

### Phase 5 — Reliability and Release

Codex owns cross-path regression, migration, concurrency, deletion, and performance hardening. Source deletion must protect or explicitly invalidate dependent relationships and workspaces. Tests cover restart persistence, duplicate uploads, stale schemas, large joins, row-explosion limits, governance aggregation, and one-source compatibility. Documentation and API examples are finalized from verified behavior.

Antigravity receives a repair-only handoff if integration review finds a concrete UI defect. The phase is complete only after backend verification, Codex frontend review, a clean production build, harness checks, and user browser acceptance of source modeling, relationship editing, and a cross-source AI Chat chart.

## Planned Backend File Areas

The first implementation should center on `backend/db/backend_db.py`, `backend/routes/upload.py`, a new workspace route module, a new workspace-context service, and focused tests. Later backend work will extend `backend/services/dataset_context.py`, `backend/decision_engine/chat_service.py`, `backend/routes/nlp_routes.py`, semantic-model services, and Data Hub routes. `backend/utils/global_state.py` remains a compatibility boundary, not the source of multi-workspace truth.

## Handoff Discipline

The active gate always contains a standalone Codex kickoff goal. No Antigravity handoff is activated before its backend readiness level is verified. Every frontend handoff names exact endpoints and response fields, non-negotiable acceptance behavior, creative latitude, build evidence, and the instruction to stop and return control to Codex. The active status file names one owner and one next action at all times.
