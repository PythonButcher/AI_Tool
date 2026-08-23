# Completed Reference — Primary UI Compatibility Removal Handoff

This handoff is retained as a completed implementation and integration-review record. It is not an active assignment.

Goal: Make the primary AI Tool interface expose only BI-first features supported by the default backend by removing the visible Decision Graph entrypoint and its active-shell runtime wiring.

## Resolved Repair Blocker

`frontend/frontend/src/App.jsx` still destructures `fullData` and `semanticModel` from `DataContext`, but the Decision Graph prop removal eliminated their only reads in this file. The production build succeeds with new `no-unused-vars` warnings for `fullData` at line 49 and `semanticModel` at line 54, so the active-shell cleanup is incomplete. Remove only those two unused values from the destructuring while retaining `setFullData`, `setSemanticModel`, and every active data-loading behavior. Rerun `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`, then return the updated evidence to Codex.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, and the Runtime Registration And Compatibility Inventory in `project_docs/active/contracts/decision_objects.md`.

Target `frontend/frontend/src/App.jsx`, `frontend/frontend/src/components/layout/MenuBar.jsx`, and `frontend/frontend/src/components/layout/CanvasContainer.jsx`. Remove the Decision Graph ribbon command, `showDecisionGraph` and `decisionGraphContext` state, the open handler and related props, the `DecisionGraphWorkspace` import, and the conditional Decision Graph window from the active application shell. Preserve the Data Model canvas and relationship authoring; those are active BI features and are unrelated to the compatibility Decision Graph.

Do not delete or rewrite `frontend/frontend/src/features/business/decision/`, `decisionApi.js`, saved compatibility contracts, or backend endpoints. Do not redesign the AI ribbon or change AI Chat, Automation, Report, Narrative, charts, dashboards, Data Model, or dataset behavior. Compatibility source remains recoverable; this handoff removes only its visible primary-product entrypoint and runtime imports.

Acceptance requires no active-shell import or render path for `DecisionGraphWorkspace`, no Decision Graph command in the AI ribbon, no orphaned Decision Graph state or props in `App.jsx`, and no regression to Source Model/Data Model behavior. Run `npm --prefix frontend\frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Return the changed-file list, focused source evidence, build result, and check results to Codex, then stop for Codex review.

Antigravity owns only this bounded frontend cleanup. Codex retains backend truth, contracts, status, integration acceptance, and the decision about any later work.
