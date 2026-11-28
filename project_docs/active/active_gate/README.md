Goal: Reset the current Analytics session and open a fresh Analysis.

## User Outcome

A user can clear current Analytics selections and start over in one action. Saved work remains accessible and the Library retains the edited draft for recovery.

## Scope

Reset Analytics is available from Analysis and Dashboard. It opens a default Analysis, clears current selections, results, and panels, and cancels the active query. The Library can reopen the last edited draft.

## Contracts

- [Analytics workflow roadmap](../analytics/README.md#improve-the-existing-analytics-workflow)
- [Analytics workspace](../contracts/analytics_workspace.md)

## Acceptance

Reset clears the active analysis and transient Analytics controls. A manually selected source resets to the default attached source, when available. Saved analyses, dashboards, and workbench layout remain accessible.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand AnalyticsShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `git diff --check`

## Owner And Control Return

The user owns the browser decision in chat. The [execution status](../status/project_execution_status.md) records ownership and continuation.
