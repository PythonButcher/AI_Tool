Goal: Let users save a configurable Business Object and see its saved definition in Data Model.

## User Value

Users can name a Business Object, choose a source and the fields that identify and label its records, and select the relationships it uses. They can reopen Business Objects to see saved definitions and any configuration that needs attention. Record browsing and the Analytics action come later.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

Ten Business Object tests verify two distinct configurations, reload and workspace isolation, the public API, reference changes, and failed-write rollback. The focused Business Object, workspace, relationship, and Analytics query run passed 75 tests. The Data Model canvas already loads workspace source schemas and relationship definitions. Its header currently exposes Create Relationship and Add Source, so add a Business Objects entry there.

## Required Context

- [Active gate](../active_gate/README.md), [execution status](../status/project_execution_status.md), [authorization](../status/phase_authorization.json), and [frontend guardrail](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md).
- [Definition API](../business_objects/README.md#definition-api), `backend/routes/data_workspaces.py`, and `tests/test_business_objects.py`.

## Scope And Target Files

- `frontend/frontend/src/features/data-model/SourceModelCanvas.jsx` — add the entry and pass the current model metadata to the panel.
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.jsx` — display saved definitions and provide the create form within the same panel.
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.css` — style the panel and entry with the shared theme.
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.test.jsx` — cover the user flow and the canvas integration.

**Required Change Coverage**: all target files

**Maximum Diff Lines**: 600

**Inline Styles**: forbidden

**Async Mutation**: yes

**Preserved Controls**: Create Relationship and Add Source remain visible and open their existing panels after closing Business Objects. Test: open and close Business Objects, then activate each existing control and assert its original panel renders.

Keep the canvas, existing data-fetching behavior, and relationship workflows in place. Keep membership, source and relationship edits, definition editing and deletion, record browsing, Analytics, and changes outside the four target files out of this assignment.

## Proven API Contract

Use the existing API base. URL-encode the active canvas `workspaceId` as a path segment. `GET /api/data-workspaces/<workspace_id>/business-objects` has no query or body and returns `200` with `{ business_objects: BusinessObject[] }`. `POST` to the same path uses `Content-Type: application/json` and returns `201` with `{ business_object: BusinessObject }`. The workspace routes use the existing app access boundary and require no new headers. The panel needs only these two operations.

`type CreateBusinessObject = { display_name: string, source_id: string, record_key_field: string, display_field?: string | null, relationship_ids: string[] }`

`type ConfigurationErrorCode = 'source_not_found' | 'relationship_not_found' | 'source_not_in_workspace' | 'managed_source_unavailable' | 'source_schema_unavailable' | 'source_field_not_found' | 'relationship_not_applicable' | 'relationship_field_not_found'`

`type ErrorBody<Code extends string> = { code: Code, message: string }`

`type BusinessObject = { contract_version: 'business_object_definition_v1', object_id: string, workspace_id: string, display_name: string, source_id: string, record_key_field: string, display_field: string | null, relationship_ids: string[], created_at: string, configuration_error: ErrorBody<ConfigurationErrorCode> | null }`

`type ListResponse = { business_objects: BusinessObject[] }`

`type CreateResponse = { business_object: BusinessObject }`

`type ErrorResponse = { error: ErrorBody<ConfigurationErrorCode | 'workspace_not_found' | 'invalid_request' | 'invalid_definition' | 'business_object_storage_error'> }`

List order is `created_at`, then `object_id`. A list response can carry `configuration_error` for an individual definition while other entries remain valid. Use server `object_id` for identity. Names may repeat. A successful POST always creates a new ID. Send only the five configuration fields, with `[]` for zero relationships and `null` or omission for no label field. Exact field names and explicit relationship IDs carry through to the response. The server trims the display name.

Use the canvas's hydrated workspace members (`workspace_id`, `source_id`, `alias`, `name`, `schema[].name`) and relationship definitions (`workspace_id`, `relationship_id`, `left_source_id`, `right_source_id`, `field_pairs[].left_field`, `field_pairs[].right_field`). Offer a relationship if either endpoint is the selected source and the other is a member. Drafts can be selected. Use the other member's alias or name and enough key information to distinguish multiple relationships to the same source. A source change clears selections that no longer apply. Show the saved configuration error message on its own entry and keep that entry visible.

## Representative JSON Fixtures

Create request `{"display_name":"Customer","source_id":"src_customer","record_key_field":"customer_id","display_field":"name","relationship_ids":["rel_orders"]}`.

Create success `{"business_object":{"contract_version":"business_object_definition_v1","object_id":"obj_customer","workspace_id":"ws_demo","display_name":"Customer","source_id":"src_customer","record_key_field":"customer_id","display_field":"name","relationship_ids":["rel_orders"],"created_at":"2026-11-22T15:00:00Z","configuration_error":null}}`. For list success, put the returned definition in `business_objects`. Empty list `{"business_objects":[]}`.

For a saved definition with a removed field, set its `configuration_error` to `{"code":"source_field_not_found","message":"Field 'name' is missing from the object source."}` inside the successful list.

All route failure fixtures use `{"error":{"code":"...","message":"..."}}`. The table supplies exact example payload values. Only `workspace_not_found` and `business_object_storage_error` apply to the collection GET. All listed codes can apply to POST.

| HTTP | `code` | `message` |
| --- | --- | --- |
| 400 | `invalid_request` | Supply a JSON object with definition fields only. |
| 400 | `invalid_definition` | Select each relationship only once. |
| 404 | `workspace_not_found` | Workspace 'ws_demo' was not found. |
| 404 | `source_not_found` | Source 'src_customer' was not found. |
| 404 | `relationship_not_found` | Relationship 'rel_orders' was not found in this workspace. |
| 409 | `source_not_in_workspace` | Source 'src_customer' is not in this workspace. |
| 409 | `managed_source_unavailable` | Managed storage for source 'src_customer' is unavailable. |
| 409 | `source_schema_unavailable` | Source 'src_customer' has no catalog schema. |
| 409 | `source_field_not_found` | Field 'name' is missing from the object source. |
| 409 | `relationship_not_applicable` | Relationship 'rel_orders' must directly connect the object source. |
| 409 | `relationship_field_not_found` | Relationship 'rel_orders' references a missing source field. |
| 500 | `business_object_storage_error` | Business Object storage is unavailable. |

## Required UI States

Keep the entry in the canvas header and open a labeled, keyboard-accessible panel with a close action. Show initial loading, empty state with a create action, a retryable list error, and the saved list. The form shows display name, member source, exact record key, optional label, and direct relationship choices. Show an announced validation message and preserve the draft on a failed save. While saving, disable form changes and repeated submission. Keep a safe close action available and restore focus to the entry. If a configured source or relationship disappears, show its saved definition with the server message. Preserve the theme and existing controls at compact widths.

## State Ownership

Keep API responses keyed by `workspace_id` within the panel. Reopen by reading the collection again. Use the `201` response to add the saved definition by `object_id`, with server list ordering, without another POST. List retry reads the collection again. A save conflict surfaces the server message and lets the user correct the draft after refreshing workspace data. After a network error with an unknown save outcome, let the user refresh the saved list before explicitly retrying. Keep fields and panel visibility local to the current workspace, with no URL or background job state. Scope async results to the current workspace and mounted panel. Offer source and relationship choices only from metadata belonging to that workspace.

## Async Mutation Acceptance

**In-Flight Navigation**: Closing with a pending save returns to the canvas. Reopening requests the authoritative list for the current workspace. Test: close during a deferred POST, reopen, resolve the old request, and confirm it cannot append to or replace the reopened list.

**Concurrent Edits**: Keep form controls disabled until the current save settles. Use the sent draft and its workspace throughout. Test: defer the first save, attempt a field change and second save, and verify controls are disabled and only the original payload was submitted.

**Failure Retry**: A failed save leaves the draft and reports the error. A network failure offers list refresh before an explicit retry. Test: reject the deferred POST, verify the draft and error, refresh the list, and assert exactly one additional POST occurs after the user retries.

**Conflict Or Duplicate**: A `409` preserves the draft and reports the returned message. Pending saves reject repeated submissions, including keyboard submission. Test: trigger two submissions before a deferred `409` and assert one POST, the conflict message, and the unchanged draft.

**Identity And Unmount**: Workspace changes clear local selection and prevent late reads or saves from applying to the new workspace. Test: switch workspace while a response is pending and assert the old definitions and source choices never appear under the new workspace.

## Non-Negotiables And Creative Latitude

Use the exact routes, fields, and source boundary above. Keep private storage details out of the UI. Use theme tokens and accessible controls. Compose and style the panel to fit the existing canvas while meeting the required interactions. Use reviewable edits and preserve existing work. If a target becomes empty or unexpectedly smaller, stop and return the incident. Leave backend, rules, authorization, contracts, and `GEMINI.md` files outside the implementation.

## Acceptance And Return

- Verify an empty list, two distinct datasets with different key and label fields through the same form, saved definitions after reopen, and a broken reference message alongside a valid definition.
- Verify loading, failure and explicit retry, keyboard access, focus return, duplicate submission prevention, workspace changes, and the preserved canvas controls in the named test file.
- Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand BusinessObjectsPanel.test.jsx`, `npm --prefix frontend/frontend run build`, `git diff --check`, and `git diff --name-only`. Include untracked new files in the changed-file report.
- Return through `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff business_object_definitions.md --summary "Business Object definition panel verification and changed-file summary"`, using the actual evidence in the summary. Report the exact files, commands and results, and any contract mismatch. Stop for Codex integration review.
