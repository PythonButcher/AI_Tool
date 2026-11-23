# Project Execution Status

## Current Gate: Explicitly save and fully reopen working datasets

- **Current Gate**: Explicitly save and fully reopen working datasets
- **Roadmap Phase**: Phase 2 — Opt-in save and full activation
- **Phase State**: `AWAITING USER ACCEPTANCE`
- **What This State Means**: Explicit save and full Workspace activation are implemented and engineering-verified.
- **Current Milestone**: User accepts the saved-dataset workflow in chat
- **Automatic Continuation**: `WAIT_FOR_USER`
- **Current Owner**: User
- **Backend Readiness**: `complete`
- **Frontend Readiness**: `backend_contract_ready`
- **Next Action**: The user reviews the integrated workflow in the browser and responds in chat.
- **Required Action**: Record the user's browser decision.
- **Active Gate**: `project_docs/active/active_gate/README.md`
- **Authorization Record**: `project_docs/active/status/phase_authorization.json`
- **Roadmap**: `project_docs/active/saved_datasets/README.md`
- **Active Handoff**: None
- **Latest Verification**: 133 focused backend and 40 frontend tests passed. The production build passed with existing warnings. Focused coverage includes upload and Refine staying outside the catalog, named save, full reopen, Business Objects, exact Analytics scope, same names, stale dependencies, retry, and rollback.

The [Business Object repair](../../archive/business_object_definitions_repair_paused_2026_11_22.md) is paused. Antigravity retains its assignment and the [authorization record](phase_authorization.json) records the outstanding review.

## Pending Analytics Workbench Acceptance

The customizable Analysis workbench remains **awaiting user acceptance** in chat. The user owns the browser decision. Engineering verification passed 34 focused Analytics and WindowContext tests, scoped ESLint, and the production build. Chrome with fixture data verified pointer and keyboard snapping, visible resize handles and placement preview, per-panel locks, chart and draft preservation, compact stacking, reload, reset, and print layout. See the [Analytics roadmap](../analytics/README.md) and the preserved authorization in [phase_authorization.json](phase_authorization.json).

## Preserved Interface Verification

AI Chat retains its conversation controls, optional navigation rail, composer, model modes, and BI results. The authorization record holds the verification evidence for model routing, conversation management, and dock behavior. ML Studio's home and learning experience remains awaiting user acceptance.

## Preserved ML Studio State

ML Studio bulk preparation and full editor remain engineering-complete and **awaiting user acceptance**, without browser acceptance. The 2026-10-08 evidence remains: 96 frontend tests, 65 focused backend tests, changed Python compilation, frontend production build, CI harness, 28 hook tests, 7 policy tests and whitespace checks passed. Build warnings were pre-existing; Jest/hook fixtures needed execution outside the restricted sandbox. Shared theme tokens apply to ML Studio; its workflow behavior is unchanged.

The [ML Studio contract](../contracts/ml_studio.md) retains capability limitations. Managed uploads remain intact and ignored. The [configuration proposal](../future/codex/codex_configuration_redesign.md) remains deferred. Python tests use `PYTHONPATH=.codex_tmp_py;.codex_tmp_py/site-packages`.

## Completion Rule

The user owns the final browser decision in chat.
