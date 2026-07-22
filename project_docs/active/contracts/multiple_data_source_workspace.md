# Multiple Data Source Workspace Contract

## Status

Draft contract for the active source-registry and workspace-context gate. Codex must finalize field names against implementation and tests before changing backend readiness.

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
| `content_fingerprint` | Hash used to detect content or schema staleness |
| `schema` | Ordered field metadata without row values |
| `row_count`, `column_count` | Source shape at registration time |
| `semantic_model` | Source-bound semantic model |
| `governance_policy`, `governance_readiness` | Source-bound trust contract |
| `created_at`, `updated_at` | ISO-8601 timestamps |

The persistence layer may store a private `locator_json`, but public responses must not expose host filesystem paths or connection secrets.

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

The server generates the source ID, workspace ID, managed storage locator, timestamps, and fingerprint. A governance-blocked upload creates no managed file, source record, workspace, or membership.

## Planned Workspace Endpoints

The active gate may add `POST /api/data-workspaces`, `GET /api/data-workspaces/<workspace_id>`, `POST /api/data-workspaces/<workspace_id>/sources`, and `DELETE /api/data-workspaces/<workspace_id>/sources/<source_id>`. Implemented routes must return the objects above and stable errors for `workspace_not_found`, `source_not_found`, `source_not_in_workspace`, `alias_conflict`, `stale_workspace_version`, and `managed_source_unavailable`.

## Compatibility Boundary

Requests containing only `dataset` or `dataset_ref` continue to resolve as one-source analysis. `backend/utils/global_state.py` may mirror the active one-source context for existing callers, but durable source, workspace, and membership records are authoritative. No multi-source relationship or joined result may be inferred from global state.
