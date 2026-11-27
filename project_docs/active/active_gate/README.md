Goal: Open a Business Object record in a new Analytics analysis scoped to that exact record.

## User Outcome

A user can open a selected Business Object record in Analytics, see its name and relationship scope, and group and measure the associated rows. The analysis they were editing stays available.

## Scope

**Current Step**: Step 1: Implement and verify exact record scope

**Target Files**: `backend/services/business_object_records.py`, `backend/services/relationship_execution.py`, `backend/analytics/query.py`, `backend/routes/data_workspaces.py`, `tests/test_business_objects.py`, `tests/test_analytics_query.py`, and the Business Objects and Analytics contracts.

**Step Acceptance**: Resolve the saved workspace, object, and typed key on the server. Restrict the analysis to that record and its selected, verified relationships. Use the object source as the record anchor even when it is a lookup source. Refuse changed, missing, ambiguous, or blocked scope visibly.

**Step Verification**: Exercise the normal Analytics query endpoint with Acme and its Orders, Equipment and Maintenance, a second customer with excluded orders, and stale or denied scope. Reconcile an Acme grouped order sum of 20 to the selected order rows.

**Next Step**: Step 2: Connect the selected record to a new Analytics draft

**Continuation Rule**: CONTINUE through the backend scope and focused verification.

**Stop Condition**: Transfer ownership through one bounded frontend handoff once the Analytics record source contract and failure behavior are verified.

- [ ] **Step 1: Implement and verify exact record scope** — [IN PROGRESS]
- [ ] **Step 2: Connect the selected record to a new Analytics draft** — [PENDING]
- [ ] **Step 3: Verify the complete workflow** — [PENDING]

## Contracts

- [Business Objects](../business_objects/README.md)
- [Analytics workspace](../contracts/analytics_workspace.md)
- [Workspace identity and scope](../contracts/multiple_data_source_workspace.md)
- [Relationship execution](../contracts/multiple_data_source_relationships.md)
- [Dataset governance](../contracts/data_catalog_lineage.md)

## Acceptance

Acme opens with a visible record identity and group scope. Its total matches only Acme's orders. Equipment uses the same path with its own key and Maintenance relationship. The current Analytics draft remains available, and invalid scope produces a visible refusal.

## Verification

- `python -m pytest -q tests/test_analytics_query.py tests/test_business_objects.py tests/test_relationship_execution.py tests/test_saved_datasets.py`
- `python -m py_compile backend/analytics/query.py backend/services/business_object_records.py backend/services/relationship_execution.py backend/routes/data_workspaces.py`
- `python .codex/hooks/ci_harness_check.py`
- `git diff --check`

## Owner And Control Return

Codex owns the backend scope and tests. Antigravity takes the frontend integration from a verified contract. The user owns final browser acceptance in chat.
