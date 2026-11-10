# PostgreSQL workspace

Phase 15 connects PostgreSQL discovery and selection to the governed Data Model and catalog. Codex owns implementation and verification. The user owns browser acceptance.

1. Discover accessible databases, tables and columns. Materialize the selected tables and ordered column projections in one read-only PostgreSQL transaction. Publish the catalog sources and workspace atomically.
2. Wire the PostgreSQL picker to discovery and import. Let the user name the workspace and choose the primary table. Expose saved models for reopening and load their primary data and workspace identity together.
3. Verify persistence and reuse through Data Model relationship validation and activation, Data Hub source access, and deterministic AI Chat with a real PostgreSQL fixture. Check that the selected fields and source lineage survive reopening.

Saved sources are managed snapshots and use `source_kind: sql`. They can be reused without a connection. Relationships are configured in Data Model using the same workspace contract as other sources. AI Chat resolves the active model from `workspace_id`. Import requires a bounded data selection and refuses oversized requests with an actionable error. PostgreSQL credentials are request-scoped. No credential is saved in catalog or workspace data.

## API

`POST /api/postgres/databases` accepts `host`, `port`, `user`, `password`, `sslmode`, and optional `dbname` as the starting database. It uses `postgres` when omitted and returns `{ databases }`, a list of database names with `CONNECT` privilege. A user who already knows the target database can use it directly.

`POST /api/postgres/tables` accepts the same settings with the target `dbname`. It returns `{ database, tables, limits }`. Each entry has `schema`, `table`, and ordered `columns`, each with `name` and `data_type`. Discovery and import use readable columns in accessible user schemas and support tables and views. Discovery refuses catalogs exceeding 10,000 readable columns.

`POST /api/postgres/workspaces` accepts `{ connection, name, tables, primary }`. Each selected table has `schema`, `table`, and optional `columns` as an ordered list of exact names. Omit `columns` or use `null` to request all readable columns. The `primary` object has `schema` and `table`. The server reads one repeatable-read transaction and rejects any projection exceeding 12 tables, 100 columns per table, 50,000 total rows, 1,000,000 total cells, or 32 MiB of encoded snapshots. Unsupported exact decimals fail with guidance to normalize them in a view. Nested PostgreSQL values are stored as text. Integer keys outside JavaScript's safe numeric range are serialized as text in browser records and retain their exact values for server analysis.

A successful import returns HTTP 201 with `workspace`, `analysis_context`, `source` (the primary), `sources`, `data_preview`, `full_data` (the saved primary), `semantic_model`, and `governance_readiness`. The initial context identifies the primary. Lookup sources are catalog datasets and can be used individually. Model consumers that resolve the active graph, including AI Chat, use the workspace identity and active relationships. A source snapshot has a managed file, fingerprint, semantic model, and schema containing only imported fields.

`GET /api/postgres/workspaces` returns `{ workspaces }` with `workspace_id`, `name`, `version`, `source_count`, `primary_source_id`, and `updated_at`. `POST /api/postgres/workspaces/<workspace_id>/open` restores the saved workspace envelope and primary data without connection settings. It works after the primary source is prepared or replaced. Row restrictions can be applied through a PostgreSQL view before import or in analysis after import.
