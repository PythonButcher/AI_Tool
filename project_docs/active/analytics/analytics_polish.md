Goal: Give the working Analytics application a substantial, cohesive visual polish across dashboard monitoring, analysis building, results, library and inspector.

## User Value

Users get a dedicated analytics application with a clear visual hierarchy, spacious results, compact editing controls and polished dashboards. The existing analytical features remain available throughout. Make this a substantial professional redesign, not a few cosmetic adjustments.

## Activation and Readiness

**Frontend Readiness**: `backend_contract_ready`

This brief is prepared, not executable until status names Antigravity as owner and the governed readiness check passes. Codex must establish a clean frontend baseline without absorbing unrelated concurrent ML Studio edits. Run `python .gemini/skills/status-tracker-skill/scripts/update_status.py check` before implementation. Do not bypass a failure.

The app is served at http://localhost:3000 and the Analytics API at http://127.0.0.1:5000. A live synthetic grouped query returned the verified total 35 from three rows. Backend tests cover 70 Analytics and AI regression cases. Consult the capability evidence file for the latest frontend/build results.

## Required Context

- `AGENTS.md`
- `project_docs/active/status/project_execution_status.md`
- `project_docs/active/status/phase_authorization.json`
- `project_docs/active/active_gate/README.md`
- `project_docs/active/analytics/README.md`
- `project_docs/active/analytics/capability_evidence.md`
- `project_docs/active/contracts/analytics_workspace.md`
- `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

## Scope And Target Files

Polish the shared workbench and its tightly coupled dashboard/analysis surfaces. The data contracts, state ownership and functional handlers are already implemented. Preserve them. Target only:

- `frontend/frontend/src/features/analytics/AnalyticsShell.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsShell.css`
- `frontend/frontend/src/features/analytics/AnalyticsBuilder.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsResult.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsDashboard.jsx`

**Required Change Coverage**: Shell composition and shared Analytics stylesheet; change other targets only as needed for coherent presentation.

**Maximum Diff Lines**: 1000

**Inline Styles**: allowed only for existing dynamic chart/conditional colors; use the shared stylesheet for all new layout and presentation.

**Async Mutation**: no

This assignment changes presentation only. Preserve existing Run, Cancel, Save, refresh, retry, import and persistence handlers and their request boundaries. No new requests or mutation flows are authorized. Return any functional gap to Codex rather than altering the contract.

**Preserved Controls**: Keep library CRUD, dataset confirmation/remapping, builder roles, Run/Cancel, save/drafts, pin/update original, filters, exports, appearance controls, recovery and AI entry points reachable at desktop and narrow widths. Test: existing AnalyticsShell save/reload, stale-pin, draft navigation, late-response, source-confirmation and origin-conflict tests must pass unchanged.

## Design Direction

Create a crisp application frame with a compact object header, purposeful primary action, source/save context and a large central canvas. Unify the library and inspector with the analytical surface. Break the current wall of controls into clear sections and progressive disclosure while keeping important actions obvious. Use the established light/dark tokens, typography, depth, borders and restrained accent color. Improve the dashboard tile headers, KPI hierarchy, chart framing, tables and builder field roles together.

The result should feel like a full Analytics product combining monitoring and investigation. Do not reintroduce old primary landing pages or floating windows as the main authoring flow. Do not remove advanced calculations, pivots, comparisons, templates or recovery controls to simplify the design. Preserve accessible labels used by tests; add visible focus and clear disabled/pending states. At narrow widths, rails must be dismissible and leave usable canvas space.

## Proven Contract and State Boundaries

No API/client changes. POST /api/analytics/query accepts explicit source and query and returns schema_version 1, dataset, fields, metrics, rows, columns, summary, pivot, comparison, row_count, total_result_rows, limit, truncated, filters, period, executed_at and analysis_lineage. Validation errors are 400 with error/code; server failures are safe 500 errors. The complete field and calculation contract is in the required contract file.

WindowContext owns the versioned Analytics collection. Shell owns the working draft, origin, query result and cancellation sequence. Builder edits configuration; Result renders server values; Dashboard refreshes live tiles and labels snapshots. Never calculate replacement business values in chart components. Preserve explicit source binding, imported-source confirmation, write-before-success feedback, cancellation, stale-result labeling and origin conflict checks.

Representative successful aggregate: rows contains region East and revenue 30 plus region West and revenue 5; columns is region/revenue; summary revenue is 35; row_count is 3. Empty success has rows empty and row_count zero. A missing source returns 400 with code dataset_required. Render errors from error text without inventing permissions or freshness.

## Required UI States and Evidence

Show distinct loading, empty, successful, last-successful-after-failure, changed-builder, storage failure, recovered draft and imported-source states. Keep retry and export-retained-work visible when storage fails. In both themes, provide readable charts and a table alternative, keyboard-operable controls, logical heading order and restrained focus transitions. Preserve title, filter, scope, limit and timestamp information in reporting layouts.

Use existing fixture tests for data behavior. Report which themes and widths were inspected and which were not. Browser acceptance belongs to the user; do not claim it. If the 1000-line budget cannot cover the entire visual pass, finish this bounded coherent pass and name the remaining polish for Codex's next assignment.

## Verification And Return

Run the focused Analytics tests with CI=true, watchAll=false, runInBand and testPathPattern=features/analytics, plus the WindowContext tests. Run `npm --prefix frontend/frontend run build`, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and the governed return:

`python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff analytics_polish.md --summary "Analytics visual polish; changed files and verification evidence supplied"`

Return changed files, exact test/build results, theme/responsive evidence and any remaining polish gaps. Stop for Codex review. Do not edit backend, contracts, authorization, active gate, unrelated ML Studio work or any GEMINI.md file.
