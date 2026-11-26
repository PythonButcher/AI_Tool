# Business Objects in Data Model

## Product outcome

In **Data Model → Business Objects**, a user can name an object from existing data, choose how to identify and label its records, and select the relationships to show. Devstream generates a list and record view from that configuration. The user can open the selected record and its relevant data in Analytics with the scope already set.

Customer with Orders and Equipment with Maintenance are useful verification examples. Use the same configuration, API, and rendering path for both, with different fields and relationship IDs. The runtime behavior follows the definition supplied by the user.

The [active gate](../active_gate/README.md) names the one executable step. [Execution status](../status/project_execution_status.md) records readiness and ownership. This product area implements the first capability in the [three-project platform strategy](../future/codex/three_project_data_platform_review.md).

## Reuse existing Devstream behavior

Data Hub remains the place to find datasets. Data Model already defines, validates, and activates relationships within a workspace. Business Objects attach a name and record identity to those sources and relationships. Analytics already accepts an explicit server-verified `analysis_context`; its default workspace selection starts with the primary dataset. The record handoff must request the exact validated scope, preserve the previous analysis draft, and make the selected object and record visible in the new analysis. [Source workspace contract](../contracts/multiple_data_source_workspace.md) · [Relationship contract](../contracts/multiple_data_source_relationships.md) · [Analytics contract](../contracts/analytics_workspace.md)

## Delivery order

| Phase | User outcome and scope | Evidence and owner |
| --- | --- | --- |
| **1 — Business Object definitions** | A definition can be saved and reloaded. Store a stable object ID in its workspace, a display name, a member source ID, one record key field, an optional display field, and explicit relationship IDs. Keep the first persistence step separate from API exposure. Use the existing source and relationship contracts to validate references. | Codex owns storage and a focused create, list, and retrieve contract. Prove workspace isolation, stable identity, two configurations, atomic failed writes, and behavior for missing or changed sources. With the definition API verified, prepare one Antigravity handoff for the definition surface. |
| **2 — Browse Business Objects** | An authorized user can find records and open one record with its selected related rows. Use the configured display and key fields. Read source data under existing governance checks, bound list and relationship results, and distinguish missing evidence from an empty relationship. | Codex verifies the list, detail, and relationship response contract before UI ownership transfers. Prove exact typed record selection, bounded reads, correct related rows, and clear behavior for duplicate or blank record keys and stale relationships. Antigravity receives one bounded UI interaction at a time. |
| **3 — Open a record in Analytics** | An **Open in Analytics** action carries the selected record, its fields, and explicit relationship scope into a new analysis. The user can see and work with that scope directly. | Codex proves the server-verified context and exact record filter. Test that the handoff works for both configured object types, preserves the current draft, and fails visibly if the chosen scope changes. Assign required UI integration through the frontend guardrail. |

## Backend boundaries for the first phase

Use workspace and source identities from the existing catalog. Validate that selected fields exist and that relationship IDs belong to the same workspace and apply to the object scope. A saved definition is configuration. A valid source field at save time does not establish record-key uniqueness forever. The record-serving phase must verify usable key values against the current source and refuse ambiguous record lookups. Persist the definition independently of workspace layout and preserve the established source and relationship contracts. Define compatibility and conflict behavior before implementing editable definitions or adding delete behavior.

The definition service validates and saves configuration in one SQLite transaction. Definitions are scoped to a workspace and stored separately from the workspace canvas. Their IDs remain stable across reads. Creation leaves the workspace and relationship versions intact.

## Definition API

All paths are relative to the existing workspace API on the Devstream backend. Encode IDs as path segments. These endpoints have no query parameters and use the same access boundary as other workspace routes.

| Method and path | Request | Success |
| --- | --- | --- |
| `POST /api/data-workspaces/<workspace_id>/business-objects` | `Content-Type: application/json` with the fields below | `201` with `{ business_object }` |
| `GET /api/data-workspaces/<workspace_id>/business-objects` | No body | `200` with `{ business_objects }`, ordered by `created_at` then `object_id`. The empty value is `[]`. |
| `GET /api/data-workspaces/<workspace_id>/business-objects/<object_id>` | No body | `200` with `{ business_object }` |

| Definition field | Create request | Response |
| --- | --- | --- |
| `display_name` | Required nonblank string | String with surrounding whitespace trimmed |
| `source_id` | Required string identifying an existing workspace member | String |
| `record_key_field` | Required nonblank string matching a catalog field name exactly | String |
| `display_field` | Optional exact catalog field name or `null` | String or `null` |
| `relationship_ids` | Required ordered array of distinct relationship IDs. Use `[]` for zero. Each relationship must directly connect the object source to a second workspace member. Either endpoint can be the object source. | Array of strings in the requested order |
| `contract_version` | Server field | `business_object_definition_v1` |
| `object_id`, `workspace_id` | Server fields | Generated object ID and route workspace ID, both strings |
| `created_at` | Server field | UTC ISO 8601 string |
| `configuration_error` | Server field | `null` or `{ code, message }`. On create it is `null`. |

Creation rejects extra fields. Display names can repeat, and every successful POST creates a distinct ID. The API has no edit, delete, or idempotency operation.

Reads recheck the current catalog schemas, managed file availability, workspace memberships, and relationship references. A schema change that preserves selected fields can leave the definition usable. A broken reference leaves the saved definition visible with the first detected `configuration_error`. It may use any of the 404 or 409 reference codes below other than `workspace_not_found` and `business_object_not_found`. Relationship drafts can be selected for configuration. Existing relationship activation and execution rules govern later record access. Record data and key uniqueness are checked in the record-serving phase.

Errors outside a saved definition use `{ error: { code, message } }`.

| Status | Codes |
| --- | --- |
| `400` | `invalid_request` for malformed JSON, a non-object body, or extra fields. `invalid_definition` for missing or invalid values or duplicate relationship IDs. |
| `404` | `workspace_not_found`, `business_object_not_found`, `source_not_found`, `relationship_not_found`. Scoped object and relationship lookups use the same miss response for absent and foreign IDs. |
| `409` | `source_not_in_workspace`, `managed_source_unavailable`, `source_schema_unavailable`, `source_field_not_found`, `relationship_not_applicable`, `relationship_field_not_found`. |
| `500` | `business_object_storage_error` for a database failure. The response has no private storage or database details. |

Published products, shared investigations, and integration with Context Ledger and Slipstream can build on stable Business Object identities. Deliver those after the user-directed Business Objects release.
