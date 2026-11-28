# Business Object record in Analytics checkpoint

Paused on November 27, 2026 when the Analytics visual builder became the active gate. Phase 3 remains incomplete. This record supplies resume context and does not authorize execution.

The open step was server-verified exact record scope. Resolve the saved workspace, object, and typed key on the server. Restrict execution to the selected record and its verified relationships, using the object source as the anchor even when it is a lookup source. Refuse changed, missing, ambiguous, and denied scope. Search can still display unusable matches with their configured field and row positions. Only a unique valid key can open a record or its analytics.

Verify the normal Analytics query endpoint with Acme and its Orders, Equipment and Maintenance, a second customer's excluded orders, and stale or denied scope. Reconcile the Acme grouped order sum of 20 to the selected order rows. The next steps are to connect a selected record to an independent Analysis draft through one Antigravity assignment and verify the complete workflow. The user owns final browser acceptance.

Backend targets are `backend/services/business_object_records.py`, `backend/services/relationship_execution.py`, `backend/analytics/query.py`, and `backend/routes/data_workspaces.py`. The verification command is `python -m pytest -q tests/test_analytics_query.py tests/test_business_objects.py tests/test_relationship_execution.py tests/test_saved_datasets.py`, followed by compilation of the four modules, the CI harness, and `git diff --check`.

See the [Business Objects roadmap](../active/business_objects/README.md), [Analytics contract](../active/contracts/analytics_workspace.md), and preserved `business_object_record_analytics_authorization` in the [authorization record](../active/status/phase_authorization.json). The pre-transition gate and path boundaries are available in Git at `c111c1e8ce2e3f70bb45c8a35e50dbfbfc277d1a`.
