# Multiple Data Source Workspace Contract

## Status

Verified backend contract for durable upload sources and one-source workspace context. Relationship persistence, relationship inference, joined execution, and multi-source AI Chat behavior are not part of this contract state.

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
| `relationship_ids` | Empty in the active gate; populated only by verified relationship work |

## Active Upload Response

`POST /api/upload` retains `message`, `data_preview`, `full_data`, `numeric_summary`, `categorical_summary`, `semantic_model`, and `governance_readiness`. It adds `source`, `workspace`, and `analysis_context`. Existing clients may ignore the additions.

The server generates the source ID, workspace ID, managed storage locator, timestamps, and fingerprint. The server does not accept a request path as managed-storage truth. A governance-blocked upload creates no managed file, source record, workspace, or membership. The returned top-level `semantic_model` and `source.semantic_model` identify the generated `source_id`, preserving that identity when current Data Hub and Decision Chat resolution loads the record.

## Implemented Read Endpoints

`GET /api/data-sources/<source_id>` returns `{ source }`. `GET /api/data-workspaces/<workspace_id>` returns `{ workspace }` with only that workspace's memberships. `GET /api/data-workspaces/<workspace_id>/analysis-context` returns `{ workspace, sources, analysis_context }`; repeated `source_id` query parameters select members, while omission selects the primary source.

The read endpoints return structured `{ error: { code, message } }` responses. Missing workspaces and sources use HTTP 404 with `workspace_not_found` or `source_not_found`. Cross-workspace selection uses HTTP 409 with `source_not_in_workspace`. Missing managed file storage uses HTTP 409 with `managed_source_unavailable` and does not expose the private path.

Workspace creation, membership mutation, aliases conflicts, stale-version writes, and relationship routes remain outside the verified surface.

## Persistence

`datahub_datasets` remains canonical and carries `source_kind`, `locator_kind`, private `locator_json`, `content_fingerprint`, `schema_version`, `created_at`, and `updated_at`. `data_workspaces` persists workspace identity, version, and primary source. `workspace_sources` persists composite membership, workspace-unique alias, role, optional position, and added timestamp. Upload registration writes all three records in one SQLite transaction after managed-file creation; a database failure removes the newly created managed file.

## Compatibility Boundary

Requests containing only `dataset` or `dataset_ref` continue to resolve as one-source analysis. `backend/utils/global_state.py` may mirror the active one-source context for existing callers, but durable source, workspace, and membership records are authoritative. No multi-source relationship or joined result may be inferred from global state.
