Goal: Open Devstream from the Datastream hub.

## User Outcome

Users land on the Datastream hub, can open Devstream and return to the hub, and can see the planned roles of Slipstream, Context Ledger, and Publishing Portal.

## Scope

Use the existing React entrypoint and theme. Use `?app=devstream` on the app's served path, keep legacy workspace bookmarks working, and preserve unrelated query parameters and fragments. Preserve sessions, existing Devstream destinations, tools, and detached windows across hub navigation. Show planned applications as informational entries.

## Contracts

- [Devstream UI workflow inventory](../reviews/devstream_ui_workflow_inventory.md)
- [Frontend ownership](../rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md)

This is an entry experience using the existing app shell. Live adapters, identity and SSO, access requests, provisioning, permission enforcement, and cross-app data sharing remain deferred.

## Acceptance

- The default app address opens the Datastream hub. The Open Devstream link and the direct Devstream address open the workspace.
- Users can return through the Datastream hub link or browser Back and Forward, preserving the current workspace and open tools.
- Workspace overlays and keyboard shortcuts stay within Devstream.
- Devstream navigation, upload, Data Tools, Power Query, saving, and reopen work through the workspace entry.
- Slipstream, Context Ledger, and Publishing Portal describe their planned purposes and offer no launch action.
- The launch and return links support keyboard operation. The hub layout fits narrow screens.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand --testTimeout=20000 App.test.jsx PlatformHub.test.jsx DataToolsWorkbench.test.jsx DataCleaningForm.test.jsx AnalyticsShell.test.jsx AIShell.test.jsx AiChatDock.test.jsx MLStudioShell.test.jsx ThemeContext.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `python .codex/hooks/ci_harness_check.py`
- `git diff --check`

## Owner And Control Return

The user owns browser acceptance in chat.
