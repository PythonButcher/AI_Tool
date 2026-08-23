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
| `position` | Optional persisted finite numeric `{ x, y }` canvas coordinate; presentation state only |
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
| `source_ids` | Ordered source IDs in the server-resolved analysis model |
| `relationship_ids` | Ordered relationship IDs in the server-resolved execution tree. Empty for one-source analysis. |

The execution boundary re-resolves this object only from `workspace_id`, the exact current `workspace_version`, `primary_source_id`, ordered `source_ids`, and ordered `relationship_ids`. Caller-provided rows, aliases, relationship definitions, fingerprints, or lineage are never treated as execution truth. The workspace primary source must be selected and must match persisted workspace truth.

## Automatic AI Chat Resolution

`POST /api/decision/chat/turns` accepts the current `workspace_id` without caller-selected `source_ids`, `relationship_ids`, source tables, join fields, or relationship paths. When no explicit compatibility `analysis_context` is supplied, Decision Chat resolves the workspace's active Data Model on the server and replaces any legacy caller rows or semantic model with the verified workspace bundle before analysis.

The resolver selects only active, confirmed, freshly `valid`, executable relationships connected to the workspace primary source. Source order follows persisted workspace-membership order, and relationship order follows deterministic traversal from the primary source. Inactive relationship drafts are ignored. If no active relationship exists, the resolver returns the unchanged primary-only context.

Decision Chat stores the canonical identity-only context and aggregate-safe lineage in row-free session state. Suggested-action refinements recover the workspace identity from that verified state, re-resolve current server truth, and return the canonical context again. A stale, non-executable, disconnected, cyclic, or ambiguous active graph is refused with a message directing model repair to Data Model; chat never activates, validates, substitutes, or guesses a relationship.

The joined semantic model keeps qualified `id`, `name`, `field`, expression columns, source IDs, and source aliases as machine truth. It also supplies additive `qualified_label`, `display_name`, `label`, `source_label`, and business aliases for interpretation and presentation. Natural-language matching requires a business field term or semantic alias; a source namespace by itself cannot select every field in that source. Result artifacts keep qualified identities in `fieldsUsed`, semantic configuration, result rows, and lineage while chart titles, dataset labels, axis labels, grouping labels, answer text, and BI grounding use readable semantic labels. Normalized semantic filters retain qualified `field`, add authoritative `dimension_id` and business-readable `label`, and carry that label into chart slicers.

## Upload Response And Workspace Targeting

`POST /api/upload` retains `message`, `data_preview`, `full_data`, `numeric_summary`, `categorical_summary`, `semantic_model`, and `governance_readiness`. It adds `source`, `workspace`, and `analysis_context`. Existing clients may ignore the additions.

The server generates the source ID, workspace ID, managed storage locator, timestamps, and fingerprint. The server does not accept a request path as managed-storage truth. A governance-blocked upload creates no managed file, source record, workspace, or membership. The returned top-level `semantic_model` and `source.semantic_model` identify the generated `source_id`, preserving that identity when current Data Hub and Decision Chat resolution loads the record.

When optional multipart `workspace_id`, `workspace_version`, `alias`, and `role` fields are supplied, the upload creates the governed source and attaches it to the named workspace in one database transaction. `workspace_version` is required for this path. Added roles are limited to `lookup` and `context`; omitted alias and role values default deterministically from the file name and to `lookup`. A failed transaction removes the new managed file. The response keeps every legacy field, returns the authoritative updated workspace, and returns a primary-only `analysis_context` with empty `relationship_ids`.

## Implemented Endpoints

`GET /api/data-sources` returns `{ sources }` using the same public source serializer as `GET /api/data-sources/<source_id>`. Neither endpoint returns `path`, private `locator_json`, host paths, or secrets. `GET /api/data-workspaces/<workspace_id>` returns `{ workspace }` with only that workspace's memberships. `GET /api/data-workspaces/<workspace_id>/analysis-context` returns `{ workspace, sources, analysis_context }`; repeated `source_id` query parameters select members, while omission selects the primary source.

`POST /api/data-workspaces/<workspace_id>/sources` accepts JSON `source_id`, required `version`, optional `alias`, and optional `role`. It attaches an existing catalog source with compare-and-swap workspace versioning and returns `{ source, workspace, analysis_context }`. Membership changes advance the workspace version exactly once and never change `primary_source_id`, activate a relationship, or select a multi-source path.

`DELETE /api/datahub/<source_id>` deletes only a catalog source with no workspace membership, primary-workspace reference, or relationship dependency. The dependency check and delete execute under one immediate database transaction. A referenced source returns HTTP 409 with `source_has_dependencies` plus aggregate-safe workspace IDs, membership count, relationship IDs, relationship count, and primary-workspace count; no membership, relationship, workspace, or source row is changed. A missing source returns HTTP 404 with `source_not_found`.

`PATCH /api/data-workspaces/<workspace_id>/sources/<source_id>/position` accepts required JSON `version` and `position`, where `position` contains exactly finite numeric `x` and `y` coordinates. The source must be a member of the named workspace. The operation updates only `workspace_sources.position_json`, advances the workspace version exactly once, and returns the authoritative `{ workspace }`. It does not change membership, aliases, roles, `primary_source_id`, analysis selection, relationships, source metadata, semantic metadata, or source data.

Errors use structured `{ error: { code, message } }` responses. Missing workspaces and sources use HTTP 404 with `workspace_not_found` or `source_not_found`. Cross-workspace selection, a missing position-target membership, duplicate membership, alias conflict, and stale workspace version use HTTP 409 with `source_not_in_workspace`, `duplicate_workspace_membership`, `workspace_alias_conflict`, or `workspace_version_conflict`. Invalid alias, role, version, or canvas coordinates use HTTP 400 with `invalid_source_alias`, `invalid_workspace_role`, `invalid_workspace_version`, or `invalid_workspace_position`. Missing managed file storage uses HTTP 409 with `managed_source_unavailable` and does not expose the private path. Relationship persistence, validation, activation, and workspace-version effects are verified separately in `project_docs/active/contracts/multiple_data_source_relationships.md`.

## Retained Frontend Workspace State

The frontend has one authoritative retained-workspace state owner: `DataContext`. Its `activeWorkspace` record is the complete latest server `workspace` object and must expose at least `workspace_id`, `version`, `primary_source_id`, and the server-ordered `sources` memberships. Successful replacements are wholesale server-object replacements rather than field-by-field merges. This state is not a replacement for the existing `uploadedData`, `fullData`, `cleanedData`, or `filteredData` compatibility state.

`analysisContext` is a separate, narrower state record. It contains the server-issued `workspace_id`, `workspace_version`, `primary_source_id`, ordered `source_ids`, and ordered `relationship_ids`. The default and membership-mutation responses retain the primary-only selection and empty `relationship_ids`. A frontend must never derive `analysisContext.source_ids` or `relationship_ids` from `activeWorkspace.sources`; multiple memberships do not select an analysis path, change `primary_source_id`, or overwrite one-source compatibility data.

The replacement rules are:

| Operation | Authoritative retained-state result |
| --- | --- |
| Default `POST /api/upload` | Atomically replace `activeWorkspace` and `analysisContext` from the response; separately update the existing one-source dataset compatibility state. |
| Workspace-targeted `POST /api/upload` | Atomically replace `activeWorkspace` and `analysisContext`; do not replace the active primary dataset with the added source. |
| `POST /api/data-workspaces/<workspace_id>/sources` | Atomically replace `activeWorkspace` and `analysisContext`; do not change one-source compatibility data. |
| Successful `PATCH /api/data-workspaces/<workspace_id>/sources/<source_id>/position` | Replace `activeWorkspace` wholesale with the returned server workspace, then reconcile the version-mismatched `analysisContext` through the standard workspace refresh path before issuing analysis. Do not derive a new analysis context from the position response. |
| `GET /api/data-workspaces/<workspace_id>` with unchanged identity, primary source, and version | Replace `activeWorkspace` and retain the matching `analysisContext`. |
| `GET /api/data-workspaces/<workspace_id>` when the retained analysis context is absent or its workspace ID, primary source, or version no longer matches | Do not commit the workspace-only response. Treat the retained analysis context as stale, fetch `GET /api/data-workspaces/<workspace_id>/analysis-context` with no `source_id` parameters, and atomically apply its authoritative primary-only `{ workspace, analysis_context }`. Do not construct a replacement analysis context locally. |
| Explicit `GET /api/data-workspaces/<workspace_id>/analysis-context` with selected `source_id` parameters | Atomically replace `activeWorkspace` and `analysisContext` only after the explicit selection succeeds. |

The Data Model, navigation shell, and upload surfaces read the same `activeWorkspace.workspace_id` rather than reconstructing identity from dataset rows, `uploadedData`, or process-global compatibility state. The canvas obtains safe public source metadata through `GET /api/data-sources` or `GET /api/data-sources/<source_id>` and merges it in the order of `activeWorkspace.sources`. Source metadata enrichment remains local and cannot become workspace truth. The canvas must not request an analysis context containing every member merely to obtain schemas.

The shared state exposes `workspaceRefreshStatus` as `idle`, `refreshing`, or `error`, `workspaceRefreshError` as either null or normalized `{ code, message }`, and `workspaceVersionConflict` as either null or `{ code, message, attemptedVersion, currentVersion }`. Server errors retain their stable code and message; transport failures use a client code such as `workspace_refresh_failed`. During refresh, the last authoritative `activeWorkspace` and `analysisContext` remain readable. A refresh failure preserves both records and sets the error state. A `workspace_version_conflict` first records the attempted version from the failed request, then refreshes authoritative state; `currentVersion` comes from the refreshed server workspace. The user's alias, role, selected catalog source, or file choice remains available for a deliberate retry. The client never silently replays the failed mutation.

## Persistence

`datahub_datasets` remains canonical and carries `source_kind`, `locator_kind`, private `locator_json`, `content_fingerprint`, `schema_version`, `created_at`, and `updated_at`. `data_workspaces` persists workspace identity, version, and primary source. `workspace_sources` persists composite membership, workspace-unique alias, role, optional position, and added timestamp. Position updates write one membership coordinate and one compare-and-swap workspace version increment in the same transaction. Default upload registration writes the source, one-source workspace, and primary membership in one SQLite transaction after managed-file creation. Existing-workspace upload writes the source, added membership, and one compare-and-swap version increment in one transaction. A database failure rolls back every record and removes the newly created managed file.

## Verified Analysis Resolution

One selected source with no relationships resolves through the existing source dataframe and semantic model without namespacing its fields. Two or more selected sources require an explicit active relationship tree. Successful multi-source resolution returns the canonical `analysis_context`, a namespaced dataframe/model bundle for backend consumers, a conservative multi-source governance rollup, and `analysis_lineage` using `multi_source_analysis_lineage_v1`.

Natural-language numeric inference accepts complete formatted numbers but rejects mixed identifiers such as `TXN-000001`. Qualified source terms may disambiguate an already matched field but do not contribute field relevance alone. Value-filter extraction removes qualified machine references before comparing the prompt with observed dimension values, so `hardware_inventory_5000_csv.Category` does not imply `Category = Hardware`; an explicit request for Hardware remains a valid filter. Raw chart and semantic-metric aggregation return `chart_measure_not_numeric` or `metric_measure_not_numeric` when a selected summed measure contains no usable numeric values.

## Compatibility Boundary

Requests containing only `dataset` or `dataset_ref` continue to resolve as one-source analysis. One-source `analysis_context` requests preserve original field names, the source semantic model, and the standard governance response. `backend/utils/global_state.py` may mirror the active one-source context for existing callers, but durable source, workspace, and membership records are authoritative. No multi-source relationship or joined result may be inferred from global state.
