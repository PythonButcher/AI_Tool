# Project Execution Status

## Current Gate: Awaiting User Epic Goal

- **Current Gate**: Awaiting User Epic Goal
- **Roadmap Phase**: Pending product selection
- **Phase State**: `NOT STARTED`
- **What This State Means**: The project is open for product review while the user chooses the next outcome.
- **Current Milestone**: Choose the next Datastream product outcome
- **Automatic Continuation**: `WAIT_FOR_USER`
- **Current Owner**: User
- **Backend Readiness**: `implementation_required`
- **Frontend Readiness**: `not_applicable`
- **Next Action**: The user selects a product outcome in chat.
- **Required Action**: Codex records the chosen scope and any implementation authorization.
- **Active Gate**: `project_docs/active/active_gate/README.md`
- **Authorization Record**: `project_docs/active/status/phase_authorization.json`
- **Roadmap**: `project_docs/active/active_gate/README.md`
- **Active Handoff**: None
- **Latest Verification**: The user accepted the [Datastream Hub](../../archive/datastream_hub_platform_entry_accepted_2026_11_25.md) on November 25, 2026. All 16 focused Hub and app tests passed at `32c65f2e`, and the production build passed with warnings.

## Pending Data Tools Acceptance

The Data Tools tab, Workspace landing, and initial Power Query preview remain awaiting the user's browser decision. The repair passed 97 focused frontend tests, 48 backend regression tests, seven App tests after the phone-width pane fix, Chrome fixtures at 1440 and 390 pixels, and the production build with existing warnings.

The inline Data Tools workbench also awaits the user's browser decision. It passed 101 focused frontend tests, 48 backend regression tests, and the production build with existing warnings. Chrome fixtures at 1440 and 390 pixels verified inline API and SQL, upload, quality tools, preview filters, Refine, explicit save, and reopening after reload. See the [UI workflow inventory](../reviews/devstream_ui_workflow_inventory.md).

Validate values, Check keys, and Summarize rows are available in the toolbox and await browser acceptance. The follow-up passed 26 focused frontend tests, the production build with existing warnings, and Chrome fixture checks at 1440 and 390 pixels.

The [Business Object repair](../../archive/business_object_definitions_repair_paused_2026_11_22.md) is paused pending Codex review. The current source contains fixes and regression tests for the saved-list race and model-choice refresh described in that assignment.

## Pending Analytics Workbench Acceptance

The customizable Analysis workbench remains **awaiting user acceptance** in chat. The user owns the browser decision. Engineering verification passed 34 focused Analytics and WindowContext tests, scoped ESLint, and the production build. Chrome with fixture data verified pointer and keyboard snapping, visible resize handles and placement preview, per-panel locks, chart and draft preservation, compact stacking, reload, reset, and print layout. See the [Analytics roadmap](../analytics/README.md) and the preserved authorization in [phase_authorization.json](phase_authorization.json).

The user reported that the CSV analysis using Sum of sales worked in the browser. This verifies the reported raw-field aggregation path. Governed metric and Business Object validation remain separate.

## Pending PostgreSQL Workspace Acceptance

PostgreSQL imports and saved-model reopening are available from Devstream's Connect database workflow. [The PostgreSQL contract](../contracts/postgres_workspace.md) describes discovery, snapshots, and saved models. Local branch integration passed 53 focused backend tests with a disposable PostgreSQL 17 instance, 82 focused frontend tests, and the production build with warnings. The user owns browser acceptance.

## Preserved Interface Verification

AI Chat retains its conversation controls, optional navigation rail, composer, model modes, and BI results. The authorization record holds the verification evidence for model routing, conversation management, and dock behavior. ML Studio's home and learning experience remains awaiting user acceptance.

## Preserved ML Studio State

ML Studio bulk preparation and full editor remain engineering-complete and **awaiting user acceptance**, without browser acceptance. The 2026-10-08 evidence remains: 96 frontend tests, 65 focused backend tests, changed Python compilation, frontend production build, CI harness, 28 hook tests, 7 policy tests and whitespace checks passed. Build warnings were pre-existing; Jest/hook fixtures needed execution outside the restricted sandbox. Shared theme tokens apply to ML Studio; its workflow behavior is unchanged.

The [ML Studio contract](../contracts/ml_studio.md) retains capability limitations. Managed uploads remain intact and ignored. The [configuration proposal](../future/codex/codex_configuration_redesign.md) remains deferred. Python tests use `PYTHONPATH=.codex_tmp_py;.codex_tmp_py/site-packages`.

## Completion Rule

The user owns the final browser decision in chat.
