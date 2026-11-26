Goal: Make an explicit Save Dataset action persist the current working data and let users reopen it by name from Data Hub.

## User workflow

Uploads and applied Refine results belong to the working dataset. The toolbar's **Save Dataset** action is how a user names and adds the current state to Data Hub. A saved entry can be updated or copied by name. Preview filters and paging affect the view. Apply permanent row changes in Refine. Save confirmation follows the committed response.

Data Hub uses **Open dataset** to load all working rows, the source and semantic model, and the saved relationship scope into Workspace. Refine, row inspection, Data Model, and Analytics use the same activated identity as the working data.

A named upload reuses its managed source. Refined data is a fixed copy with full rows, schema, and source lineage. A live model saves the model definition and exact dependency identities. The model calculates joined rows when opened and reports unavailable or changed dependencies explicitly. Saving a copy or updating a record preserves original sources and existing Analytics drafts.

## Work order

| Phase | Behavior and ownership | Evidence |
| --- | --- | --- |
| 1 — Dataset persistence and activation | Codex implements named source and model saves, governed activation, compatible legacy opening, and isolated Refine results. Follow the [active gate](../active_gate/README.md). | Restart tests for full uploaded and refined rows, model relationships, objects, exact scope, duplicate names, stale dependencies, retries, and update conflicts. |
| 2 — Opt-in save and full activation | Codex implements the working dataset, toolbar, and single Data Hub open action. | Upload, optionally refine or model, save, reopen into Workspace after refresh, inspect full rows, and save an update or copy. Verify the Analytics scope and existing draft preservation, then run focused frontend tests and production build. |

The user owns browser acceptance. The Publishing Portal has separate scope.

## API contract

All paths start with `/api/datahub`. Mutations use JSON. IDs in path segments are URL encoded. Errors use `{ error: { code, message, ...details } }` with optional top-level `governance_readiness` on a policy block.

| Endpoint | Request | Success |
| --- | --- | --- |
| `GET /datasets` | No body | `200` with `{ datasets }`. Includes named saves and explicitly registered files. Working uploads and unsaved Refine results are excluded. An empty catalog returns `{ "datasets": [] }`. |
| `POST /saved-datasets` | `name`, `request_id`, `kind`, `workspace_id`, `workspace_version`, and `source_id`. Also send `dataset_id` and `expected_revision` together for an explicit update. | `201` with `{ dataset, replayed: false }`. An exact retry returns `200` with the original receipt and `replayed: true`. |
| `POST /refine-preview` | `workspace_id`, `workspace_version`, `source_id`, and ordered `steps`. Each step is `{ type, params }` in the existing Refine recipe format. | `200` with `preview`, `row_count`, `schema`, `source_fingerprint`, and `governance_readiness`. Holds at most 100 preview rows and does not write data. |
| `POST /refine-working` | Preview inputs and `request_id`. Optionally send the matching `source_fingerprint` from preview. | `200` with the full working envelope for the applied result. Retry the same request ID and payload to resolve the same working identity. Applying Refine creates a working copy outside the catalog. |
| `POST /datasets/<dataset_id>/open` | Send `{}` for a full open. Optional `offset` (default `0`) or `limit` (default `100`, maximum `200`) selects bounded paging. `expected_revision` binds the request to a catalog revision. | `200` with the activation and row fields below. A full open returns `full_data`. |
| `DELETE /saved-datasets/<dataset_id>` | No body | `204`. Removes the named entry. Existing source and Analytics references remain valid under their access rules. |

`GET /api/data-sources` remains the internal source inventory for Data Model. `DELETE /api/datahub` removes named catalog entries and explicit file registrations and keeps managed working sources. It returns the number of entries removed.

### Saving the current state

- The toolbar sends `kind: "current"`. The server infers whether to save the current source, refined copy, or model from the workspace and source lineage. An API client may send `kind: "source"` explicitly. That request receives `409 model_save_required` if the workspace contains model configuration.
- Model saves use `kind: "model"`. Omit `analysis_context` to resolve the active connected relationship scope. Send it when the user has explicitly selected a narrower scope. The saved definition retains the full model, including relationships, source aliases, layout and applicable Business Objects. The analysis scope separately retains the exact selected source and relationship IDs.
- Refine applies the ordered recipe to a durable source and produces a working copy with complete rows, schema, and lineage. The toolbar saves that copy by reference. API clients can also combine apply and save using `kind: "refined"` and the preview fingerprint and steps. Compatible single-source Business Objects follow the copy. Removing a configured Business Object field fails with `refine_business_object_conflict`.
- A named entry has `dataset_id`, `name`, `kind`, `revision`, `primary_source_id`, `source_ids`, `row_count`, `column_count`, `created_at`, `updated_at`, and nullable `lineage`. For a refined copy, `lineage` records `parent_source_id`, `parent_content_fingerprint`, and `parent_schema_version`. A legacy listing adds `kind: "legacy"`, `dataset_id` equal to the source ID, and `revision: null` to the public source record.
- Generate one `request_id` per intent and reuse it for network retries of the same payload. Changed intent uses a new request ID. A stale `expected_revision` or workspace version returns `409`. Duplicate names are allowed and never act as identifiers. Display confirmation only after receiving the committed record.

### Opening and inspecting

The envelope has `dataset`, `workspace`, `source`, `analysis_context`, `analysis_lineage`, `governance_readiness`, `semantic_model`, `schema`, `preview`, `data_preview`, `row_count`, `offset`, `has_more`, `capabilities`, and `identity_map`. A full open adds `full_data` in the same shape as upload. `source` is the primary source and `schema` and returned rows describe the exact selected scope. Workspace installs `workspace`, `analysis_context`, and the complete result together. Analytics accepts `kind: "workspace"` with the returned `analysis_context`. `capabilities.refine` requires a single-source workspace without relationships.

A model save pins source identities and input content and recreates the saved working definition without relying on later edits. The open response maps authoring relationship and object IDs to the workspace's working IDs in `identity_map.relationship_ids` and `identity_map.object_ids`. These maps are empty for a saved source and null for a legacy catalog entry. Use the returned working IDs in workspace APIs. The exact Analytics scope is already mapped in the returned context. If someone edits an activated model without saving, opening the named entry creates a fresh working copy of the last save and leaves the edited context available to existing drafts.

Existing explicit registrations keep their original identities. Opening a registered file uses the unique workspace where the source is primary, or creates a reusable single-source context when none exists. Multiple primary matches return `409 ambiguous_dataset_workspace`. A manually registered file must remain readable. Its model definitions are available if they exist in the linked workspace. A missing or changed dependency returns an explicit error. Data access runs the current governance checks when opening a saved model or refined copy.

| Status | Common cases |
| --- | --- |
| `400` | `invalid_open_request`, `invalid_save_request`, `invalid_refine_request`, `invalid_cleaning_steps`, `cleaning_failed`, `empty_cleaning_result` |
| `404` | `saved_dataset_not_found`, `workspace_not_found` |
| `409` | `saved_dataset_revision_conflict`, `save_request_reused`, `workspace_version_conflict`, `saved_dataset_dependency_changed`, `source_unavailable`, `ambiguous_dataset_workspace`, `model_save_required`, `saved_dataset_object_conflict`, `refine_business_object_conflict`, `preparation_relationships_unsupported`, or a relationship execution refusal |
| `422` | `governance_blocked` or `multi_source_governance_blocked`, with readiness and no rows |
| `500` | `saved_dataset_unavailable`, safe to retry after the operation fails |
