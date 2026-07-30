# Multiple Data Source Workspace Contract

## Status

Verified backend contract for durable upload sources, workspace context, and identity-only multi-source analysis requests. Joined execution is permitted only through the separately governed relationship execution boundary described below.

## Contract Version

All public objects use `contract_version: "multi_source_workspace_v1"`. Additive fields may be introduced within this version; renamed or removed fields require a new version or a compatibility adapter.

## Source

`source` is the public identity of one governed dataset in `datahub_datasets`.

| Field | Meaning |
| --- | --- |
| `source_id` | Stable server-generated identifier |
| `name` | User-visible source name |
| `source_kind` | `upload`, `api`, `sql`, or `catalog` |
| `locator_kind` | Server-controlled locator type such as `managed_file`; never a trusted client path |
| `managed_locator` | Public server-created metadata containing `kind`, opaque `storage_key`, sanitized `file_name`, and `format`; never a host path |
| `content_fingerprint` | Hash used to detect content or schema staleness |
| `schema_version` | Integer version of the persisted schema metadata |
| `schema` | Ordered field metadata without row values |
| `row_count`, `column_count` | Source shape at registration time |
| `semantic_model` | Source-bound semantic model |
| `governance_policy`, `governance_readiness` | Source-bound trust contract |
| `created_at`, `updated_at` | ISO-8601 timestamps |

The persistence layer stores the compatibility `path` and private `locator_json`. Public source and workspace responses do not expose either value, host filesystem paths, or connection secrets. For upload sources, `content_fingerprint` is a `sha256:<hex digest>` of the accepted request bytes.

## Workspace

`workspace` is the durable analytical boundary.

| Field | Meaning |
| --- | --- |
| `workspace_id` | Stable server-generated identifier |
| `name` | User-visible workspace name |
| `version` | Monotonic integer changed by membership or model edits |
| `primary_source_id` | Source that defines the default analytical grain |
| `source_count` | Current membership count |
| `created_at`, `updated_at` | ISO-8601 timestamps |

## Workspace Source

`workspace_source` binds a catalog source to one workspace.

| Field | Meaning |
| --- | --- |
| `workspace_id`, `source_id` | Composite membership identity |
| `alias` | Unique, stable field namespace inside the workspace |
| `role` | `primary`, `lookup`, or `context` |
| `position` | Optional persisted canvas ordering value; not analytical truth |
| `added_at` | ISO-8601 timestamp |

A source may belong to several workspaces. An alias must be unique inside its workspace. A workspace must have exactly one primary source while it contains sources.

## Analysis Context

`analysis_context` is the request boundary that later relationship and query phases extend.

| Field | Meaning |
| --- | --- |
| `contract_version` | `multi_source_workspace_v1` |
| `workspace_id` | Durable workspace identity |
| `workspace_version` | Version used to reject stale requests |
| `primary_source_id` | Default analytical grain |
| `source_ids` | Ordered selected source IDs |
| `relationship_ids` | Ordered, explicit relationship IDs selected for this analysis. Empty for one-source analysis. |

The execution boundary re-resolves this object only from `workspace_id`, the exact current `workspace_version`, `primary_source_id`, ordered `source_ids`, and ordered `relationship_ids`. Caller-provided rows, aliases, relationship definitions, fingerprints, or lineage are never treated as execution truth. The workspace primary source must be selected and must match persisted workspace truth.

## Upload Response And Workspace Targeting

`POST /api/upload` retains `message`, `data_preview`, `full_data`, `numeric_summary`, `categorical_summary`, `semantic_model`, and `governance_readiness`. It adds `source`, `workspace`, and `analysis_context`. Existing clients may ignore the additions.

The server generates the source ID, workspace ID, managed storage locator, timestamps, and fingerprint. The server does not accept a request path as managed-storage truth. A governance-blocked upload creates no managed file, source record, workspace, or membership. The returned top-level `semantic_model` and `source.semantic_model` identify the generated `source_id`, preserving that identity when current Data Hub and Decision Chat resolution loads the record.

When optional multipart `workspace_id`, `workspace_version`, `alias`, and `role` fields are supplied, the upload creates the governed source and attaches it to the named workspace in one database transaction. `workspace_version` is required for this path. Added roles are limited to `lookup` and `context`; omitted alias and role values default deterministically from the file name and to `lookup`. A failed transaction removes the new managed file. The response keeps every legacy field, returns the authoritative updated workspace, and returns a primary-only `analysis_context` with empty `relationship_ids`.

## Implemented Endpoints

`GET /api/data-sources` returns `{ sources }` using the same public source serializer as `GET /api/data-sources/<source_id>`. Neither endpoint returns `path`, private `locator_json`, host paths, or secrets. `GET /api/data-workspaces/<workspace_id>` returns `{ workspace }` with only that workspace's memberships. `GET /api/data-workspaces/<workspace_id>/analysis-context` returns `{ workspace, sources, analysis_context }`; repeated `source_id` query parameters select members, while omission selects the primary source.

`POST /api/data-workspaces/<workspace_id>/sources` accepts JSON `source_id`, required `version`, optional `alias`, and optional `role`. It attaches an existing catalog source with compare-and-swap workspace versioning and returns `{ source, workspace, analysis_context }`. Membership changes advance the workspace version exactly once and never change `primary_source_id`, activate a relationship, or select a multi-source path.

Errors use structured `{ error: { code, message } }` responses. Missing workspaces and sources use HTTP 404 with `workspace_not_found` or `source_not_found`. Cross-workspace selection, duplicate membership, alias conflict, and stale workspace version use HTTP 409 with `source_not_in_workspace`, `duplicate_workspace_membership`, `workspace_alias_conflict`, or `workspace_version_conflict`. Invalid alias, role, or version inputs use HTTP 400 with `invalid_source_alias`, `invalid_workspace_role`, or `invalid_workspace_version`. Missing managed file storage uses HTTP 409 with `managed_source_unavailable` and does not expose the private path. Relationship persistence, validation, activation, and workspace-version effects are verified separately in `project_docs/active/contracts/multiple_data_source_relationships.md`.

## Persistence

`datahub_datasets` remains canonical and carries `source_kind`, `locator_kind`, private `locator_json`, `content_fingerprint`, `schema_version`, `created_at`, and `updated_at`. `data_workspaces` persists workspace identity, version, and primary source. `workspace_sources` persists composite membership, workspace-unique alias, role, optional position, and added timestamp. Default upload registration writes the source, one-source workspace, and primary membership in one SQLite transaction after managed-file creation. Existing-workspace upload writes the source, added membership, and one compare-and-swap version increment in one transaction. A database failure rolls back every record and removes the newly created managed file.

## Verified Analysis Resolution

One selected source with no relationships resolves through the existing source dataframe and semantic model without namespacing its fields. Two or more selected sources require an explicit active relationship tree. Successful multi-source resolution returns the canonical `analysis_context`, a namespaced dataframe/model bundle for backend consumers, a conservative multi-source governance rollup, and `analysis_lineage` using `multi_source_analysis_lineage_v1`.

## Compatibility Boundary

Requests containing only `dataset` or `dataset_ref` continue to resolve as one-source analysis. One-source `analysis_context` requests preserve original field names, the source semantic model, and the standard governance response. `backend/utils/global_state.py` may mirror the active one-source context for existing callers, but durable source, workspace, and membership records are authoritative. No multi-source relationship or joined result may be inferred from global state.
