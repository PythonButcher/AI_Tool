# Multiple Data Source Relationship Contract

## Status

Verified backend contract for durable relationship configuration, candidate profiling, validation diagnostics, workspace-isolated CRUD, explicitly selected backend execution, and automatic AI Chat resolution from the active Data Model. It does not authorize frontend behavior.

## Contract Version

Stored relationship objects use `contract_version: "multi_source_relationships_v1"`. Candidate proposals are not stored relationship objects and carry a deterministic `candidate_id` instead of a `relationship_id`. Additive response fields may be introduced within this version; renamed fields or changed meanings require a new version or compatibility adapter.

## Relationship Object

| Field | Meaning |
| --- | --- |
| `relationship_id` | Stable server-generated `rel_` identity |
| `workspace_id` | Workspace that owns and isolates the relationship |
| `left_source_id`, `right_source_id` | Two different catalog sources that must both be members of the owning workspace |
| `field_pairs` | One or more ordered `{ left_field, right_field }` pairs; repeated fields and empty pairs are rejected |
| `cardinality` | `one_to_one`, `one_to_many`, `many_to_one`, or `many_to_many` |
| `join_behavior` | `inner`, `left`, `right`, or `full` behavior used when this relationship is selected by the verified execution boundary |
| `filter_direction` | Future propagation intent: `none`, `left_to_right`, `right_to_left`, or `both` |
| `is_active` | Whether the relationship belongs to the active model graph; activation still does not execute it |
| `is_suggested` | Whether the saved configuration originated from a candidate proposal |
| `is_confirmed` | Explicit user or caller confirmation; required before activation |
| `validation_state` | `unvalidated`, `valid`, `invalid`, `stale`, or `blocked` |
| `diagnostics` | Ordered, value-safe explanations from the latest validation |
| `source_fingerprints` | Left and right `source_id`, `content_fingerprint`, and `schema_version` used by the latest validation |
| `version` | Monotonic relationship version advanced by every durable mutation |
| `created_at`, `updated_at`, `validated_at` | ISO-8601 lifecycle timestamps; `validated_at` is null until profiling succeeds |

Creating a relationship always stores it inactive and `unvalidated`. Configuration edits remove old validation evidence, return the relationship to `unvalidated`, and deactivate it. An activation request must include explicit confirmation and triggers a fresh validation before `is_active` can become true. Deactivation is always permitted. Relationship creation, update, validation, activation, deactivation, and deletion also advance the owning workspace version because each changes the stored model boundary.

## Validation Semantics

Validation reads each existing source through the established Data Hub dataset loader solely to compute aggregate evidence. It does not merge dataframes, return source values, compile a join, or change global single-source state.

The validator first rechecks workspace existence, source existence, membership, configured field existence, and compatible type families. Numeric fields are compatible with numeric fields, strings with strings, datetimes with datetimes, and booleans with booleans. A missing field produces `relationship_field_missing`; an incompatible pair produces `relationship_type_mismatch`. Both states are `invalid`.

For valid field pairs, the validator profiles complete single or composite keys. `relationship_key_profile` records aggregate row counts, null rates, distinct-key counts, uniqueness on each side, unmatched-key counts and rates, estimated joined rows, and estimated row multiplication relative to the left source grain. `relationship_key_nulls`, `relationship_unmatched_keys`, and `estimated_row_multiplication` are warnings that preserve a valid state when no blocking or invalid evidence exists. Estimated multiplication above `2.0` is surfaced as a warning for future execution design; no rows are joined.

Observed uniqueness must support the declaration. `one_to_one` requires both sides unique, `one_to_many` requires the left side unique, and `many_to_one` requires the right side unique. A mismatch produces `declared_cardinality_mismatch` and an `invalid` state. A declared `many_to_many` relationship always receives `many_to_many_execution_unsupported` and is `blocked`, even when observed duplicates support that declaration.

The active source graph is treated as undirected for safety. If the relationship being validated would connect sources that already have an active path, validation emits both `relationship_cycle` and `ambiguous_active_path` and marks the relationship `blocked`. It therefore cannot be activated. These diagnostics describe model safety only and do not imply an execution engine exists.

After validation, each read compares the stored left and right source fingerprints and schema versions with current catalog truth. Any change transitions the validation to `stale`, deactivates the relationship, replaces prior diagnostics with `relationship_source_stale`, and advances the relationship and workspace versions once. Fresh validation is required before reactivation.

Every diagnostic contains stable `code`, `severity`, `message`, and `next_action` fields. Aggregate evidence is nested under `evidence`. Diagnostics do not expose source rows, key values, private locators, or filesystem paths.

## Candidate Profiling

`POST /api/data-workspaces/<workspace_id>/relationship-candidates` conservatively compares workspace source pairs. It proposes compatible fields only when normalized field names match and profiled keys overlap. Each proposal explains name match, type family, matched-key ratio, observed uniqueness, inferred cardinality, and bounded confidence.

Candidates are evidence-backed suggestions, not truth. Every candidate returns `is_active: false`, `is_suggested: true`, `is_confirmed: false`, and `confirmation_required: true`. Profiling does not persist or activate candidates. A caller must explicitly create a relationship from the proposed fields, confirm it, and pass fresh validation before activation.

## Endpoints

| Method and path | Behavior |
| --- | --- |
| `POST /api/data-workspaces/<workspace_id>/relationships` | Create an inactive relationship. `validate: true` optionally profiles it immediately. `is_active: true` additionally requires `is_confirmed: true` and a valid fresh result. |
| `GET /api/data-workspaces/<workspace_id>/relationships` | List only that workspace's relationships and reconcile stale validation state. |
| `GET /api/data-workspaces/<workspace_id>/relationships/<relationship_id>` | Retrieve one workspace-isolated relationship and reconcile staleness. |
| `PATCH /api/data-workspaces/<workspace_id>/relationships/<relationship_id>` | Edit configuration, confirm, activate, or deactivate. Optional `version` enforces optimistic concurrency. |
| `DELETE /api/data-workspaces/<workspace_id>/relationships/<relationship_id>` | Delete relationship metadata without deleting either source. |
| `POST /api/data-workspaces/<workspace_id>/relationships/<relationship_id>/validate` | Refresh profiling, fingerprints, state, and diagnostics without executing a join. |
| `POST /api/data-workspaces/<workspace_id>/relationship-candidates` | Return inactive, non-persisted candidate proposals. |

Successful single-record responses use `{ relationship }`; list responses use `{ relationships }`; candidate responses use `{ candidates }`. Delete returns HTTP 204.

## Errors and Isolation

Errors use `{ error: { code, message } }`, with validation diagnostics added to `error.diagnostics` when activation fails. Missing workspaces, sources, and workspace-scoped relationships return HTTP 404. `source_not_in_workspace`, `relationship_version_conflict`, and `relationship_confirmation_required` return HTTP 409. Unavailable source storage returns HTTP 409. A freshly invalid or blocked relationship cannot activate and returns HTTP 422 with `relationship_not_activatable` plus the persisted diagnostics.

Relationship lookup always includes both `workspace_id` and `relationship_id`. A relationship ID requested through another workspace returns `relationship_not_found` and does not reveal its real owner. The public source-deletion boundary refuses any source with workspace or relationship dependencies, so it never relies on a foreign-key cascade as product behavior. Database foreign keys remain a last-resort integrity guard. Relationship deletion never removes sources or memberships.

## Verified Execution Semantics

Multi-source execution accepts only relationship IDs explicitly present in the verified `analysis_context`. Every relationship is reloaded through the requested workspace and must be active, confirmed, freshly `valid`, and not `many_to_many`. The selected edges must form exactly one connected acyclic tree over the ordered selected sources. Missing, cross-workspace, stale, inactive, blocked, invalid, cyclic, disconnected, or ambiguous selections are refused; the executor never chooses an unrequested relationship or activates a candidate.

Execution starts from the persisted workspace primary source. The ordered selected source IDs determine deterministic traversal, with relationship ID used only as a stable tie-breaker inside the already explicit tree. Single and composite field pairs are supported. Every physical field is emitted as `<workspace_alias>.<source_field>`. The composed semantic model keeps IDs, names, physical fields, filter fields, and formula references qualified while exposing separate business-readable labels and aliases for interpretation and presentation.

The pandas executor refuses a result above either `250000` rows or `5.0` times the primary-source row count. This is the documented hard ceiling, independent of the validation-time `2.0` warning threshold. Fresh `relationship_key_profile` evidence is checked against the same hard ceilings before each merge, so an already oversized estimate is refused before pandas materializes the result. The observed row count and primary-grain ratio are checked again after every merge to contain multi-hop or runtime fanout that pairwise validation could not predict. Returned `analysis_lineage` includes ordered sources and relationships, relationship versions, validation fingerprints, field origins, join order, aggregate unmatched-key evidence, primary-grain anchoring, per-step fanout, and final observed fanout. Raw relationship keys are never returned.

## Automatic AI Chat Model Resolution

Decision Chat may receive only the current `workspace_id`. The server reads the persisted active relationship graph, reconciles fresh validation evidence for every active edge, and produces deterministic ordered `source_ids` and `relationship_ids` before calling the same bounded executor. Persisted workspace-membership order fixes source order; traversal from the primary source fixes relationship order.

Inactive drafts are never selected. An active edge must remain confirmed, freshly `valid`, executable, and attached to workspace members. An active graph must be one connected acyclic tree rooted at the workspace primary source. Stale, blocked, invalid, many-to-many, disconnected, cyclic, and ambiguous active state is refused with Data Model repair guidance. Chat never validates, confirms, activates, repairs, or substitutes a relationship. A workspace with no active edge retains primary-only one-source behavior.

## Compatibility Boundary

The existing source, workspace, upload, Data Hub, and global-state compatibility paths remain unchanged. `relationship_ids` stays empty for one-source consumers. `/api/nlp/chart` continues to require an explicit multi-source `analysis_context`. Decision Chat accepts that compatibility form or resolves the active model from `workspace_id` and verified Decision Chat session state.
