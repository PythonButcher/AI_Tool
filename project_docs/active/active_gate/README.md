Goal: Make data tools discoverable and open Power Query with the current dataset already visible.

## User Outcome

Users see the active dataset in Workspace, find preparation actions in Data Tools, and start Refine with rows and fields from the active dataset. A source-based inventory identifies capabilities users can reach and gaps they cannot reach through the current UI.

## Scope

Use the working dataset across Workspace, Data Tools, Power Query, and the existing save and reopen flow. Keep a source-backed inventory of visible, conditional, inert, and missing UI capabilities.

## Contracts

- [Saved dataset API](../saved_datasets/README.md#api-contract)
- [UI workflow and feature inventory](../reviews/datastream_ui_workflow_inventory.md)
- [Workspace and analysis context](../contracts/multiple_data_source_workspace.md)

## Acceptance

- Workspace identifies the current dataset and offers clear next actions.
- Data Tools is visible in navigation and routes to the existing governed actions.
- Power Query shows the working source and bounded rows before any transformation step. Preview and Apply retain the current workspace and source identity.
- Upload, explicit save, full reopen, Data Model, Analytics, and existing secondary features remain reachable.
- The inventory distinguishes top-level, secondary, conditional, and missing product entry points from backend or development-only capabilities.

## Verification

- `python -m pytest tests/test_saved_datasets.py tests/test_workspace_cleaning.py tests/test_source_workspace_context.py tests/test_business_objects.py -q`
- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand App.test.jsx DataHubWindow.test.jsx DataContext.test.jsx DataCleaningForm.test.jsx AnalyticsShell.test.jsx BusinessObjectsPanel.test.jsx PreparationEditor.test.jsx MLStudioShell.test.jsx WindowContext.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

The user owns browser acceptance in chat.
