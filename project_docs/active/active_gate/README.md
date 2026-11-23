Goal: Let users explicitly save their working dataset and reopen its full state from Data Hub.

## User Outcome

Users upload and work with data before choosing to save. One Open dataset action restores all saved rows and the corresponding model in the normal workspace.

## Scope

Use the same working dataset identity for upload, applied Refine, explicit save, and full activation. Keep the catalog limited to named saves and explicit file registrations.

## Contracts

- [Saved dataset API](../saved_datasets/README.md#api-contract)
- [Workspace and analysis context](../contracts/multiple_data_source_workspace.md)

## Acceptance

- Upload and Refine leave Data Hub unchanged until Save Dataset confirms a named save.
- A same-name entry opens by its selected identity after refresh and loads all working rows into the normal workspace.
- Data Hub presents one Open dataset action. Save Dataset is visible in the working toolbar.
- Data Model opens in the returned workspace. Analytics receives the exact context and preserves its existing draft.
- Late responses or activation failures leave the active dataset and previous draft intact and let the user retry explicitly.

## Verification

- `python -m pytest tests/test_saved_datasets.py tests/test_source_workspace_context.py tests/test_source_relationships.py tests/test_business_objects.py tests/test_workspace_cleaning.py tests/test_analytics_query.py tests/test_analytics_change_explorer.py -q`
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand App.test.jsx DataHubWindow.test.jsx DataContext.test.jsx DataCleaningForm.test.jsx AnalyticsShell.test.jsx BusinessObjectsPanel.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

The user owns browser acceptance in chat.
