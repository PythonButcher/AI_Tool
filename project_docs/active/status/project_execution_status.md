# Project Execution Status

## Current Gate: Redesign field assignment in the Analytics visual builder

- **Current Gate**: Redesign field assignment in the Analytics visual builder
- **Roadmap Phase**: 1
- **Phase State**: `IN PROGRESS`
- **What This State Means**: The frontend handoff returned and requires Codex source and build review.
- **Current Milestone**: Step 1: Redesign the field-assignment area
- **Automatic Continuation**: `CONTINUE`
- **Current Owner**: Codex
- **Backend Readiness**: `backend_contract_ready`
- **Frontend Readiness**: `backend_contract_ready`
- **Next Action**: Antigravity redesigns field assignment using the existing Analytics builder and query contract.
- **Required Action**: Review `project_docs/active/ai_hand_off/analytics_visual_builder.md` and its returned evidence.
- **Active Gate**: `project_docs/active/active_gate/README.md`
- **Authorization Record**: `project_docs/active/status/phase_authorization.json`
- **Roadmap**: `project_docs/active/analytics/README.md`, Improve the existing Analytics workflow
- **Active Handoff**: `project_docs/active/ai_hand_off/analytics_visual_builder.md` — returned for Codex review: Redesigned Analytics field assignment with live setup readiness strip, self-explaining role shelves, searchable typed field chooser, aggregation tags, and placement banner (17/17 tests, build, and harness passed).
- **Latest Verification**: The [prior engineering review](../../archive/analytics_visual_builder_reviewed_2026_11_27.md) verified the shortcut fix. The user's browser review found field assignment still unclear.

## Paused Business Object Work

The [record-to-Analytics checkpoint](../../archive/business_object_record_analytics_checkpoint_2026_11_27.md) preserves the exact server scope step. The [record browser engineering review](../../archive/business_object_record_browser_reviewed_2026_11_26.md) records passing tests and layout evidence. Final Business Objects browser acceptance remains pending.

## Pending Data Tools Acceptance

The Data Tools tab, Workspace landing, and initial Power Query preview remain awaiting the user's browser decision. The repair passed 97 focused frontend tests, 48 backend regression tests, seven App tests after the phone-width pane fix, Chrome fixtures at 1440 and 390 pixels, and the production build with existing warnings.

The inline Data Tools workbench also awaits the user's browser decision. It passed 101 focused frontend tests, 48 backend regression tests, and the production build with existing warnings. Chrome fixtures at 1440 and 390 pixels verified inline API and SQL, upload, quality tools, preview filters, Refine, explicit save, and reopening after reload. See the [UI workflow inventory](../reviews/devstream_ui_workflow_inventory.md).

Validate values and Summarize rows are available in Data Tools. Key checks are available before saving a relationship in Data Model or a definition in Business Objects. The relocation passed 45 backend tests, 32 frontend tests, and the production build with existing warnings. Chrome layout fixtures verified the collapsed Data Pane at 320, 390, and 1440 pixels. User browser acceptance remains pending.

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
